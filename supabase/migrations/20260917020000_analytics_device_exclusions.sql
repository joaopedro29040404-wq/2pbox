-- 2P Box | Analytics device exclusions
-- Excluded devices are ignored by analytics without changing checkout/payment behavior.

alter table public.orders
  add column if not exists analytics_excluded boolean not null default false;

create index if not exists orders_analytics_excluded_idx
  on public.orders(analytics_excluded);

create table if not exists public.analytics_excluded_devices (
  session_id text primary key,
  label text,
  excluded_at timestamptz not null default now(),
  excluded_by uuid references auth.users(id) on delete set null
);

alter table public.analytics_excluded_devices enable row level security;
revoke all on public.analytics_excluded_devices from anon, authenticated;
revoke all on public.analytics_excluded_devices from public;

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
     and coalesce(new.analytics_excluded, false) = false
     and not exists (
       select 1
       from public.analytics_excluded_devices d
       where d.session_id = new.analytics_session_id
     )
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
after insert or update of payment_status, is_test, analytics_excluded on public.orders
for each row execute function public.analytics_record_purchase();
