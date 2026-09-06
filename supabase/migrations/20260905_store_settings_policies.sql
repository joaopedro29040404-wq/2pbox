-- 2P Box | Persistência das configurações da loja
-- Garante que o Admin autenticado possa atualizar store_settings
-- e que a vitrine/checkout possam continuar lendo a configuração.

alter table if exists public.store_settings enable row level security;

-- A vitrine precisa ler as configurações sem login.
drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
on public.store_settings
for select
to anon, authenticated
using (true);

-- Somente administradores autenticados podem alterar as configurações.
drop policy if exists "Admins can insert store settings" on public.store_settings;
create policy "Admins can insert store settings"
on public.store_settings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update store settings" on public.store_settings;
create policy "Admins can update store settings"
on public.store_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete store settings" on public.store_settings;
create policy "Admins can delete store settings"
on public.store_settings
for delete
to authenticated
using (public.is_admin());
