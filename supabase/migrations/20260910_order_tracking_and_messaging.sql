alter table public.products add column if not exists images jsonb not null default '[]'::jsonb;

alter table public.orders
  add column if not exists payment_method text,
  add column if not exists payment_type text,
  add column if not exists payment_installments integer,
  add column if not exists payment_amount numeric(12,2),
  add column if not exists paid_at timestamptz;

create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_customer_email_idx on public.orders(lower(trim(customer_email)));

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  payment_status text,
  note text,
  source text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_idx on public.order_status_history(order_id, created_at);

alter table public.order_status_history enable row level security;

drop policy if exists "admins read order history" on public.order_status_history;
create policy "admins read order history" on public.order_status_history
  for select to authenticated using (public.is_admin());

drop policy if exists "customers read own order history" on public.order_status_history;
create policy "customers read own order history" on public.order_status_history
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (
          o.customer_id = auth.uid()
          or (
            o.customer_id is null
            and o.customer_email is not null
            and lower(trim(o.customer_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          )
        )
    )
  );

create or replace function public.track_order_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := case when auth.uid() is null then 'system' else 'admin' end;
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, status, payment_status, note, source)
    values (new.id, coalesce(new.status, 'pending'), coalesce(new.payment_status, 'pending'), 'Pedido criado', 'checkout');
    return new;
  end if;

  if coalesce(new.status, '') is distinct from coalesce(old.status, '') then
    insert into public.order_status_history (order_id, status, payment_status, note, source)
    values (new.id, new.status, new.payment_status, 'Status do pedido alterado', v_source);
  elsif coalesce(new.payment_status, '') is distinct from coalesce(old.payment_status, '') then
    insert into public.order_status_history (order_id, status, payment_status, note, source)
    values (new.id, coalesce(new.status, 'pending'), new.payment_status, 'Status do pagamento atualizado', 'mercadopago');
  end if;

  return new;
end;
$$;

drop trigger if exists order_movement_tracking on public.orders;
create trigger order_movement_tracking
after insert or update on public.orders
for each row execute procedure public.track_order_movement();

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null,
  template text not null,
  recipient text not null,
  status text not null default 'sent',
  detail text,
  provider_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists email_events_dedupe_sent_idx
  on public.email_events(dedupe_key) where status = 'sent';
create index if not exists email_events_recipient_idx on public.email_events(recipient, created_at desc);

alter table public.email_events enable row level security;

drop policy if exists "admins read email events" on public.email_events;
create policy "admins read email events" on public.email_events
  for select to authenticated using (public.is_admin());

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mercadopago',
  resource_type text not null,
  resource_id text not null,
  action text,
  payload jsonb,
  status text not null default 'queued',
  detail text,
  order_id uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists webhook_events_resource_idx on public.webhook_events(provider, resource_type, resource_id, created_at desc);
create index if not exists webhook_events_status_idx on public.webhook_events(status, created_at desc);

alter table public.webhook_events enable row level security;

drop policy if exists "admins read webhook events" on public.webhook_events;
create policy "admins read webhook events" on public.webhook_events
  for select to authenticated using (public.is_admin());

create table if not exists public.abandoned_carts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  customer_name text,
  items jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0,
  reminded_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abandoned_carts_pending_idx on public.abandoned_carts(updated_at) where converted_at is null and reminded_at is null;

alter table public.abandoned_carts enable row level security;

drop policy if exists "admins read abandoned carts" on public.abandoned_carts;
create policy "admins read abandoned carts" on public.abandoned_carts
  for select to authenticated using (public.is_admin());

create or replace function public.sync_order_payment_state_v2(
  p_order_id uuid,
  p_payment_id text,
  p_payment_status text,
  p_status_detail text default null,
  p_payment_method text default null,
  p_payment_type text default null,
  p_installments integer default null,
  p_payment_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_incoming text := lower(coalesce(p_payment_status, 'pending'));
  v_current text;
  v_final_payment text;
  v_final_order text;
  v_changed boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;

  if v_incoming in ('processed', 'accredited') then
    v_incoming := 'approved';
  elsif v_incoming = 'canceled' then
    v_incoming := 'cancelled';
  elsif v_incoming = 'failed' then
    v_incoming := 'rejected';
  elsif v_incoming in ('refunded', 'charged_back') then
    v_incoming := 'cancelled';
  elsif v_incoming not in ('approved','pending','in_process','authorized','rejected','cancelled') then
    v_incoming := 'pending';
  end if;

  v_current := lower(coalesce(v_order.payment_status, ''));

  if v_current = 'approved' or lower(coalesce(v_order.status, '')) = 'confirmed' then
    update public.orders set
      payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
      payment_status = 'approved',
      payment_status_detail = coalesce(nullif(trim(coalesce(p_status_detail, '')), ''), payment_status_detail),
      payment_method = coalesce(nullif(trim(coalesce(p_payment_method, '')), ''), payment_method),
      payment_type = coalesce(nullif(trim(coalesce(p_payment_type, '')), ''), payment_type),
      payment_installments = coalesce(p_installments, payment_installments),
      payment_amount = coalesce(p_payment_amount, payment_amount),
      paid_at = coalesce(paid_at, now()),
      status = case when lower(coalesce(status, '')) = 'pending' then 'confirmed' else status end,
      updated_at = now()
    where id = p_order_id;

    return jsonb_build_object('payment_status','approved','order_status',
      (select status from public.orders where id = p_order_id),'changed', v_current <> 'approved');
  end if;

  if v_incoming = 'approved' then
    v_final_payment := 'approved';
    v_final_order := 'confirmed';
  else
    v_final_payment := v_incoming;
    v_final_order := coalesce(v_order.status, 'pending');
  end if;

  v_changed := v_current is distinct from v_final_payment;

  update public.orders set
    payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
    payment_status = v_final_payment,
    payment_status_detail = nullif(trim(coalesce(p_status_detail, '')), ''),
    payment_method = coalesce(nullif(trim(coalesce(p_payment_method, '')), ''), payment_method),
    payment_type = coalesce(nullif(trim(coalesce(p_payment_type, '')), ''), payment_type),
    payment_installments = coalesce(p_installments, payment_installments),
    payment_amount = coalesce(p_payment_amount, payment_amount),
    paid_at = case when v_final_payment = 'approved' then coalesce(paid_at, now()) else paid_at end,
    payment_updated_at = now(),
    status = v_final_order,
    updated_at = now()
  where id = p_order_id;

  return jsonb_build_object('payment_status', v_final_payment, 'order_status', v_final_order, 'changed', v_changed);
end;
$$;

revoke all on function public.sync_order_payment_state_v2(uuid,text,text,text,text,text,integer,numeric) from public;
grant execute on function public.sync_order_payment_state_v2(uuid,text,text,text,text,text,integer,numeric) to service_role;

create or replace function public.guest_order_details(
  p_order_id uuid,
  p_customer_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb;
  v_items jsonb;
  v_history jsonb;
begin
  select to_jsonb(o) - 'customer_id' into v_order
  from public.orders o
  where o.id = p_order_id
    and o.customer_email is not null
    and lower(trim(o.customer_email)) = lower(trim(coalesce(p_customer_email, '')));

  if v_order is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', oi.product_id, 'product_name', oi.product_name,
    'quantity', oi.quantity, 'unit_price', oi.unit_price
  ) order by oi.product_name), '[]'::jsonb) into v_items
  from public.order_items oi where oi.order_id = p_order_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'status', h.status, 'payment_status', h.payment_status,
    'note', h.note, 'source', h.source, 'created_at', h.created_at
  ) order by h.created_at), '[]'::jsonb) into v_history
  from public.order_status_history h where h.order_id = p_order_id;

  return jsonb_build_object('order', v_order, 'items', v_items, 'history', v_history);
end;
$$;

revoke all on function public.guest_order_details(uuid,text) from public;
grant execute on function public.guest_order_details(uuid,text) to anon, authenticated;

insert into public.order_status_history (order_id, status, payment_status, note, source, created_at)
select o.id, coalesce(o.status, 'pending'), coalesce(o.payment_status, 'pending'), 'Estado inicial importado', 'backfill', o.created_at
from public.orders o
where not exists (select 1 from public.order_status_history h where h.order_id = o.id);
