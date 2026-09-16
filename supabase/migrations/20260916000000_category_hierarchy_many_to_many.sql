-- Category hierarchy + many-to-many product/category relationships.
-- Backward compatible: products.category_id is preserved and copied to the junction table.

alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;

create index if not exists categories_parent_id_idx on public.categories(parent_id);

create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index if not exists product_categories_category_id_idx on public.product_categories(category_id);

alter table public.product_categories enable row level security;

drop policy if exists "public read product categories" on public.product_categories;
create policy "public read product categories"
  on public.product_categories
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_categories.product_id
        and p.active = true
    )
    and exists (
      select 1
      from public.categories c
      where c.id = product_categories.category_id
        and c.active = true
    )
  );

drop policy if exists "admins manage product categories" on public.product_categories;
create policy "admins manage product categories"
  on public.product_categories
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Four permanent top-level departments.
insert into public.categories (name, slug, description, active, parent_id)
values
  ('Papelaria', 'papelaria', 'Material escolar, escritório, artes e papelaria.', true, null),
  ('Eletrônicos', 'eletronicos', 'Tecnologia, conectividade, energia e periféricos.', true, null),
  ('Acessórios para celular', 'acessorios-para-celular', 'Acessórios e itens para dispositivos móveis.', true, null),
  ('Variedades', 'variedades', 'Casa, beleza, automotivo, presentes e utilidades.', true, null)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    active = true,
    parent_id = null;

-- Existing 20 categories become subcategories. The mapping is intentionally explicit
-- so a future migration cannot silently move categories because of fuzzy matching.
with roots as (
  select id, slug from public.categories where slug in ('papelaria','eletronicos','acessorios-para-celular','variedades') and parent_id is null
), mapping(slug, parent_slug) as (
  values
    ('papelaria-escritorio','papelaria'),
    ('artes-artesanato','papelaria'),
    ('moda-costura','papelaria'),
    ('audio','eletronicos'),
    ('cabos-adaptadores','eletronicos'),
    ('carregadores-energia','eletronicos'),
    ('informatica-perifericos','eletronicos'),
    ('seguranca-eletrica','eletronicos'),
    ('celulares-acessorios','acessorios-para-celular'),
    ('alimentos-conveniencia','variedades'),
    ('brinquedos-jogos','variedades'),
    ('casa-cozinha','variedades'),
    ('organizacao-limpeza','variedades'),
    ('automotivo','variedades'),
    ('ferramentas-utilidades','variedades'),
    ('beleza-cuidados-pessoais','variedades'),
    ('acessorios-pessoais','variedades'),
    ('esportes-lazer','variedades'),
    ('presentes-decoracao','variedades'),
    ('diversos-conveniencia','variedades')
)
update public.categories c
set parent_id = r.id,
    active = true
from mapping m
join roots r on r.slug = m.parent_slug
where c.slug = m.slug;

-- Preserve every existing product/category assignment.
insert into public.product_categories (product_id, category_id)
select p.id, p.category_id
from public.products p
where p.category_id is not null
on conflict do nothing;

-- Keep the legacy single category field and the new relation synchronized for old code paths.
create or replace function public.sync_legacy_product_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null then
    insert into public.product_categories(product_id, category_id)
    values (new.id, new.category_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_legacy_category on public.products;
create trigger products_sync_legacy_category
after insert or update of category_id on public.products
for each row execute function public.sync_legacy_product_category();

-- Helper RPC for the admin UI: replace a product's category set atomically.
create or replace function public.set_product_categories(p_product_id uuid, p_category_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.product_categories where product_id = p_product_id;

  insert into public.product_categories(product_id, category_id)
  select p_product_id, x
  from unnest(coalesce(p_category_ids, '{}'::uuid[])) as x
  on conflict do nothing;

  update public.products
  set category_id = (select x from unnest(coalesce(p_category_ids, '{}'::uuid[])) as x limit 1),
      updated_at = now()
  where id = p_product_id;
end;
$$;

revoke all on function public.set_product_categories(uuid, uuid[]) from public;
grant execute on function public.set_product_categories(uuid, uuid[]) to authenticated;
