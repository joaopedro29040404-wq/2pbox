alter table public.store_settings
  add column if not exists delivery_express_start_time text default '09:00',
  add column if not exists delivery_express_end_time text default '18:00';

update public.store_settings
set
  delivery_express_start_time = coalesce(delivery_express_start_time, '09:00'),
  delivery_express_end_time = coalesce(delivery_express_end_time, '18:00')
where delivery_express_start_time is null or delivery_express_end_time is null;
