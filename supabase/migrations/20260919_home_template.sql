-- Home template selector. Default keeps the current storefront unchanged.
alter table if exists public.store_settings
  add column if not exists home_template text not null default 'default';

alter table if exists public.store_settings
  drop constraint if exists store_settings_home_template_check;

alter table if exists public.store_settings
  add constraint store_settings_home_template_check
  check (home_template in ('default','modern'));
