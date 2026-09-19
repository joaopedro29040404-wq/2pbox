-- 2P Box | Configuração visual da Home
alter table if exists public.store_settings
  add column if not exists home_hero_mode text not null default 'logo',
  add column if not exists home_banners jsonb not null default '[]'::jsonb,
  add column if not exists home_print_enabled boolean not null default true,
  add column if not exists home_print_title text not null default 'PRECISA IMPRIMIR?',
  add column if not exists home_print_description text not null default 'Envie seu arquivo, escolha as configurações e faça seu pedido de impressão.',
  add column if not exists home_print_image_url text;

alter table if exists public.store_settings drop constraint if exists store_settings_home_hero_mode_check;
alter table if exists public.store_settings add constraint store_settings_home_hero_mode_check check (home_hero_mode in ('logo','carousel'));
