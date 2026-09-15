alter table public.store_settings
  add column if not exists delivery_express_price_table jsonb default '[]'::jsonb,
  add column if not exists delivery_express_max_km numeric(6,2) default 12,
  add column if not exists delivery_express_start_time text default '09:00',
  add column if not exists delivery_express_end_time text default '18:00';
