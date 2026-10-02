-- Desfaz 20261002120000_security_hardening.sql (estado da produção em 02/10/2026, antes da mudança).
-- ATENÇÃO: reabre as falhas de segurança. Use só em emergência.
create policy "Admins can delete categories" on public.categories as PERMISSIVE for DELETE to authenticated using (true);
create policy "Admins can delete products" on public.products as PERMISSIVE for DELETE to authenticated using (true);
create policy "Admins can insert categories" on public.categories as PERMISSIVE for INSERT to authenticated with check (true);
create policy "Admins can insert products" on public.products as PERMISSIVE for INSERT to authenticated with check (true);
create policy "Admins can update categories" on public.categories as PERMISSIVE for UPDATE to authenticated using (true) with check (true);
create policy "Admins can update orders" on public.orders as PERMISSIVE for UPDATE to authenticated using (true) with check (true);
create policy "Admins can update products" on public.products as PERMISSIVE for UPDATE to authenticated using (true) with check (true);
create policy "Admins can view order items" on public.order_items as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admins can view orders" on public.orders as PERMISSIVE for SELECT to authenticated using (true);
create policy "Anyone can create order items" on public.order_items as PERMISSIVE for INSERT to anon, authenticated with check (true);
create policy "Anyone can create orders" on public.orders as PERMISSIVE for INSERT to anon, authenticated with check (true);
grant execute on function public.sync_order_payment_state(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.sync_order_payment_state_v2(uuid, text, text, text, text, text, integer, numeric) to anon, authenticated;
