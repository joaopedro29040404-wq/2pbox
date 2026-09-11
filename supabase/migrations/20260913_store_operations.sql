alter table public.store_settings
  add column if not exists business_days text[] default array['mon','tue','wed','thu','fri']::text[],
  add column if not exists opens_at text default '09:00',
  add column if not exists closes_at text default '18:00',
  add column if not exists shipping_mode text default 'whatsapp',
  add column if not exists pickup_mode text default 'store',
  add column if not exists service_fee_percent numeric(5,2) default 0,
  add column if not exists service_fee_fixed numeric(10,2) default 0,
  add column if not exists min_order_total numeric(10,2) default 0,
  add column if not exists free_shipping_from numeric(10,2),
  add column if not exists address_line text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists address_district text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_zip text,
  add column if not exists address_place_id text,
  add column if not exists address_lat numeric(10,7),
  add column if not exists address_lng numeric(10,7),
  add column if not exists delivery_pickup_enabled boolean default true,
  add column if not exists delivery_own_enabled boolean default false,
  add column if not exists delivery_app_enabled boolean default false,
  add column if not exists delivery_subsidy_percent numeric(5,2) default 30,
  add column if not exists delivery_max_km numeric(6,2) default 12,
  add column if not exists delivery_price_table jsonb default '[]'::jsonb,
  add column if not exists delivery_cycle_hour smallint default 16;

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public' and table_name = 'store_settings'
      and constraint_name = 'store_settings_delivery_cycle_hour_check'
  ) then
    alter table public.store_settings
      add constraint store_settings_delivery_cycle_hour_check
      check (delivery_cycle_hour between 0 and 23);
  end if;
end $$;

alter table public.orders
  add column if not exists delivery_distance_km numeric(6,2),
  add column if not exists delivery_fee numeric(10,2),
  add column if not exists delivery_fee_subsidy numeric(10,2),
  add column if not exists delivery_provider text,
  add column if not exists delivery_cycle_start timestamptz,
  add column if not exists delivery_notes text;

-- O painel de Entregas agrupa por ciclo operacional (16h de um dia ate 16h do
-- seguinte), por isso o ciclo precisa ser indexado.
create index if not exists orders_delivery_cycle_idx
  on public.orders (delivery_cycle_start desc)
  where delivery_cycle_start is not null;

create index if not exists orders_delivery_provider_idx
  on public.orders (delivery_provider)
  where delivery_provider is not null;
