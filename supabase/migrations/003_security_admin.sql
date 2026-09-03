-- 2P Box — hardening da autorização administrativa.
-- Depois de aplicar, cadastre o UUID do usuário admin:
-- insert into public.admin_users (user_id) values ('UUID_DO_USUARIO');

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Admins can view orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Admins can view order items" on public.order_items;
drop policy if exists "Admins can update products" on public.products;

create policy "Admins can view orders" on public.orders for select to authenticated using (public.is_admin());
create policy "Admins can update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can view order items" on public.order_items for select to authenticated using (public.is_admin());
create policy "Admins can update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated can upload product images" on storage.objects;
drop policy if exists "Authenticated can update product images" on storage.objects;
drop policy if exists "Authenticated can delete product images" on storage.objects;

create policy "Admins can upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'products' and public.is_admin());
create policy "Admins can update product images" on storage.objects for update to authenticated using (bucket_id = 'products' and public.is_admin()) with check (bucket_id = 'products' and public.is_admin());
create policy "Admins can delete product images" on storage.objects for delete to authenticated using (bucket_id = 'products' and public.is_admin());
