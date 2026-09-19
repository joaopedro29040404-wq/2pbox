-- 2P Box | armazenamento das artes da Home
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('home-banners','home-banners',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload home banners" on storage.objects;
create policy "Admins can upload home banners" on storage.objects for insert to authenticated
with check (bucket_id = 'home-banners' and public.is_admin());

drop policy if exists "Admins can update home banners" on storage.objects;
create policy "Admins can update home banners" on storage.objects for update to authenticated
using (bucket_id = 'home-banners' and public.is_admin())
with check (bucket_id = 'home-banners' and public.is_admin());

drop policy if exists "Admins can delete home banners" on storage.objects;
create policy "Admins can delete home banners" on storage.objects for delete to authenticated
using (bucket_id = 'home-banners' and public.is_admin());
