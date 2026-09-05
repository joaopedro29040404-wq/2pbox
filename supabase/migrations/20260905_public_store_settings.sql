-- The storefront and checkout need the same store contact settings
-- configured in /admin/configuracoes.
alter table if exists public.store_settings enable row level security;

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
on public.store_settings
for select
to anon, authenticated
using (true);
