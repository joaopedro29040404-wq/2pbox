-- 2P Box | Analytics foundation
-- Isolated from checkout/payment APIs. Mercado Pago continues to own payment state.

alter table public.orders
  add column if not exists is_test boolean not null default false,
  add column if not exists analytics_session_id text,
  add column if not exists analytics_utm_source text,
  add column if not exists analytics_utm_medium text,
  add column if not exists analytics_utm_campaign text;

create index if not exists orders_analytics_session_idx on public.orders(analytics_session_id);
create index if not exists orders_is_test_idx on public.orders(is_test);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  page_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  device_type text,
  value numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_name_check check (event_name in ('page_view','product_view','add_to_cart','remove_from_cart','begin_checkout','payment_started','purchase')),
  constraint analytics_events_device_check check (device_type is null or device_type in ('mobile','tablet','desktop','unknown'))
);

create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_session_idx on public.analytics_events(session_id);
create index if not exists analytics_events_name_idx on public.analytics_events(event_name);
create index if not exists analytics_events_product_idx on public.analytics_events(product_id);
create index if not exists analytics_events_order_idx on public.analytics_events(order_id);
create index if not exists analytics_events_source_idx on public.analytics_events(utm_source);
create unique index if not exists analytics_purchase_order_uidx on public.analytics_events(order_id) where event_name = 'purchase' and order_id is not null;

alter table public.analytics_events enable row level security;

create or replace function public.analytics_record_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or coalesce(old.payment_status, '') <> 'paid')
     and coalesce(new.is_test, false) = false
  then
    insert into public.analytics_events (
      event_name, session_id, user_id, order_id, utm_source, utm_medium,
      utm_campaign, device_type, value, page_path, metadata, created_at
    )
    values (
      'purchase',
      coalesce(nullif(new.analytics_session_id, ''), 'order:' || new.id::text),
      new.customer_id,
      new.id,
      new.analytics_utm_source,
      new.analytics_utm_medium,
      new.analytics_utm_campaign,
      null,
      new.total,
      '/pedido/' || new.id::text,
      jsonb_build_object('source', 'order_payment_state'),
      coalesce(new.paid_at, now())
    )
    on conflict (order_id) where event_name = 'purchase' do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_analytics_record_purchase on public.orders;
create trigger trg_analytics_record_purchase
after insert or update of payment_status, is_test on public.orders
for each row execute function public.analytics_record_purchase();

revoke all on public.analytics_events from anon, authenticated;
revoke all on public.analytics_events from public;
