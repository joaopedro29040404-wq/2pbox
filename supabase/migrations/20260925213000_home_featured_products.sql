-- 2P Box | Seleção manual dos Destaques da Home
-- Guarda a ordem escolhida pelo Admin. Array vazio mantém o fallback atual
-- para os produtos mais recentes até que os destaques sejam configurados.

alter table if exists public.store_settings
  add column if not exists home_featured_product_ids uuid[] not null default '{}'::uuid[];

alter table if exists public.store_settings
  drop constraint if exists store_settings_home_featured_product_ids_max;

alter table if exists public.store_settings
  add constraint store_settings_home_featured_product_ids_max
  check (cardinality(home_featured_product_ids) <= 4);

comment on column public.store_settings.home_featured_product_ids is
  'Até 4 IDs de produtos, em ordem, exibidos na seção Destaques da Home. Array vazio usa o fallback da aplicação.';
