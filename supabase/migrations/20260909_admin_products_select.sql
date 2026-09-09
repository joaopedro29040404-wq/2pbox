-- Permite que usuários administrativos consultem o catálogo completo.
-- A loja pública continua vendo somente produtos ativos.
-- A checagem administrativa usa a função segura public.is_admin().

drop policy if exists "Admins can view all products" on public.products;

create policy "Admins can view all products"
on public.products
for select
to authenticated
using (public.is_admin());
