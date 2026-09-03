-- V1: políticas para checkout público e administração autenticada.
-- Execute este arquivo no Supabase SQL Editor.

create policy "Public can create orders"
on public.orders for insert to anon, authenticated
with check (true);

create policy "Public can create order items"
on public.order_items for insert to anon, authenticated
with check (true);

create policy "Admins can view orders"
on public.orders for select to authenticated
using (true);

create policy "Admins can update orders"
on public.orders for update to authenticated
using (true) with check (true);

create policy "Admins can view order items"
on public.order_items for select to authenticated
using (true);

create policy "Admins can update products"
on public.products for update to authenticated
using (true) with check (true);

-- Bucket público para imagens dos produtos.
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = true;

create policy "Public can view product images"
on storage.objects for select
using (bucket_id = 'products');

create policy "Authenticated can upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'products');

create policy "Authenticated can update product images"
on storage.objects for update to authenticated
using (bucket_id = 'products') with check (bucket_id = 'products');

create policy "Authenticated can delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'products');
