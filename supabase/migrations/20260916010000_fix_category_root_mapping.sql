-- Corrige a hierarquia e cria associações dos produtos com os departamentos.
-- Preserva as categorias e os vínculos existentes.

-- Festas é uma subcategoria de Variedades, deixando exatamente 4 departamentos principais.
update public.categories child
set parent_id = parent.id
from public.categories parent
where child.slug = 'festas'
  and child.parent_id is null
  and parent.slug = 'variedades'
  and parent.parent_id is null;

-- Todo produto associado a uma subcategoria também fica associado ao departamento pai.
-- Isso permite filtrar o departamento sem perder os vínculos específicos da subcategoria.
insert into public.product_categories (product_id, category_id)
select distinct pc.product_id, parent.id
from public.product_categories pc
join public.categories child on child.id = pc.category_id
join public.categories parent on parent.id = child.parent_id
where child.parent_id is not null
on conflict (product_id, category_id) do nothing;

-- Produtos legados cujo category_id aponta diretamente para um departamento também mantêm o vínculo.
insert into public.product_categories (product_id, category_id)
select p.id, p.category_id
from public.products p
join public.categories c on c.id = p.category_id
where p.category_id is not null
on conflict (product_id, category_id) do nothing;
