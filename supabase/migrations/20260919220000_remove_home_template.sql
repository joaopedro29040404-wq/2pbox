-- Remove the abandoned Home template selector and return Home presentation to the existing configuration.
alter table if exists public.store_settings
  drop constraint if exists store_settings_home_template_check;

alter table if exists public.store_settings
  drop column if exists home_template;
