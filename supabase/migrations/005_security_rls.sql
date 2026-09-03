-- Segurança V1: RLS para catálogo e área administrativa.
-- A função is_admin() deve existir conforme migration 003_security_admin.sql.

alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Catálogo público: somente produtos/categorias ativos podem ser lidos sem login.
drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select to anon, authenticated using (active = true);

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select to anon, authenticated using (true);

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pedidos e itens não podem ser lidos ou alterados diretamente por visitantes.
-- A criação pública ocorre exclusivamente pela função transacional do checkout.
drop policy if exists "public read orders" on public.orders;
drop policy if exists "public insert orders" on public.orders;
drop policy if exists "public update orders" on public.orders;
drop policy if exists "public delete orders" on public.orders;

drop policy if exists "admins manage orders" on public.orders;
create policy "admins manage orders" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read order items" on public.order_items;
drop policy if exists "public insert order items" on public.order_items;
drop policy if exists "public update order items" on public.order_items;
drop policy if exists "public delete order items" on public.order_items;

drop policy if exists "admins manage order items" on public.order_items;
create policy "admins manage order items" on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Funções de checkout não devem ser executadas com privilégios de dono por usuários sem necessidade.
-- A função de checkout continua SECURITY DEFINER para fazer a transação e deve validar todos os dados recebidos.
revoke all on function public.create_order_with_stock(text,text,text,text,text,jsonb) from public;
grant execute on function public.create_order_with_stock(text,text,text,text,text,jsonb) to anon, authenticated;
