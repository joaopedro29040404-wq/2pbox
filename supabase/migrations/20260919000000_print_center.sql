-- 2P Box | Central de Impressão configurável
create extension if not exists pgcrypto;
create table if not exists public.print_paper_types (id uuid primary key default gen_random_uuid(),name text not null,size text not null default 'A4',active boolean not null default true,sort_order integer not null default 0,created_at timestamptz not null default now());
create table if not exists public.print_price_tiers (id uuid primary key default gen_random_uuid(),paper_type_id uuid not null references public.print_paper_types(id) on delete cascade,color_mode text not null check (color_mode in ('bw','color')),min_sheets integer not null check (min_sheets>0),max_sheets integer check (max_sheets is null or max_sheets>=min_sheets),price_per_sheet numeric(12,2) not null check (price_per_sheet>=0),created_at timestamptz not null default now());
create table if not exists public.print_services (id uuid primary key default gen_random_uuid(),name text not null,description text,charge_type text not null default 'per_page' check (charge_type in ('per_page','per_sheet','per_document','flat')),price numeric(12,2) not null default 0 check (price>=0),active boolean not null default true,sort_order integer not null default 0,created_at timestamptz not null default now());
create table if not exists public.print_jobs (id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id) on delete set null,subtotal numeric(12,2) not null default 0,status text not null default 'received',metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table if not exists public.print_files (id uuid primary key default gen_random_uuid(),print_job_id uuid not null references public.print_jobs(id) on delete cascade,original_name text not null,storage_path text not null,mime_type text not null,pages integer not null check (pages>0),copies integer not null default 1 check (copies>0),paper_type_id uuid not null references public.print_paper_types(id),color_mode text not null check (color_mode in ('bw','color')),duplex boolean not null default false,sheets integer not null default 0,print_total numeric(12,2) not null default 0,metadata jsonb not null default '{}'::jsonb);
create table if not exists public.print_file_services (id uuid primary key default gen_random_uuid(),print_file_id uuid not null references public.print_files(id) on delete cascade,service_id uuid not null references public.print_services(id),selected_pages jsonb not null default '[]'::jsonb,quantity integer not null default 1,unit_price numeric(12,2) not null default 0,total numeric(12,2) not null default 0);
alter table public.order_items add column if not exists print_job_id uuid references public.print_jobs(id) on delete set null;
insert into public.print_paper_types(name,size,sort_order) select 'Padrão A4','A4',1 where not exists(select 1 from public.print_paper_types);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('print-files','print-files',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;
alter table public.print_paper_types enable row level security; alter table public.print_price_tiers enable row level security; alter table public.print_services enable row level security; alter table public.print_jobs enable row level security; alter table public.print_files enable row level security; alter table public.print_file_services enable row level security;
drop policy if exists "public read print papers" on public.print_paper_types; create policy "public read print papers" on public.print_paper_types for select to anon,authenticated using(active=true);
drop policy if exists "public read print tiers" on public.print_price_tiers; create policy "public read print tiers" on public.print_price_tiers for select to anon,authenticated using(exists(select 1 from public.print_paper_types p where p.id=paper_type_id and p.active=true));
drop policy if exists "public read print services" on public.print_services; create policy "public read print services" on public.print_services for select to anon,authenticated using(active=true);
drop policy if exists "admins manage print papers" on public.print_paper_types; create policy "admins manage print papers" on public.print_paper_types for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admins manage print tiers" on public.print_price_tiers; create policy "admins manage print tiers" on public.print_price_tiers for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admins manage print services" on public.print_services; create policy "admins manage print services" on public.print_services for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admins read print jobs" on public.print_jobs; create policy "admins read print jobs" on public.print_jobs for select to authenticated using(public.is_admin());
drop policy if exists "admins read print files" on public.print_files; create policy "admins read print files" on public.print_files for select to authenticated using(public.is_admin());
drop policy if exists "admins read print file services" on public.print_file_services; create policy "admins read print file services" on public.print_file_services for select to authenticated using(public.is_admin());

create or replace function public.create_order_with_stock_v5(p_customer_name text,p_customer_phone text,p_customer_email text,p_delivery_type text,p_notes text,p_items jsonb,p_delivery_address jsonb default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare
v_order_id uuid; v_item jsonb; v_product record; v_promotion record; v_coupon record; v_qty integer; v_unit_price numeric; v_subtotal numeric:=0; v_discount numeric:=0; v_total numeric:=0; v_coupon_code text; v_customer_id uuid:=auth.uid(); v_needs_address boolean; v_headers text;
v_job_id uuid; v_file_id uuid; v_file jsonb; v_service jsonb; v_paper record; v_tier record; v_service_row record; v_pages integer; v_copies integer; v_sheets integer; v_file_total numeric; v_service_qty integer; v_service_total numeric; v_selected jsonb; v_duplex boolean; v_color text; v_job_total numeric;
begin
if coalesce(trim(p_customer_name),'')='' then raise exception 'Nome é obrigatório'; end if;
if coalesce(trim(p_customer_phone),'')='' then raise exception 'Telefone é obrigatório'; end if;
if p_delivery_type not in ('pickup','whatsapp_shipping','own_delivery','express_delivery','app_delivery') then raise exception 'Forma de recebimento inválida'; end if;
v_needs_address:=p_delivery_type<>'pickup'; if v_needs_address and p_delivery_address is null then raise exception 'Endereço é obrigatório para entrega'; end if;
if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Carrinho vazio'; end if;

for v_item in select * from jsonb_array_elements(p_items) loop
 if coalesce(v_item->>'type','product')='print' then
  v_job_total:=0;
  for v_file in select * from jsonb_array_elements(coalesce(v_item->'files','[]'::jsonb)) loop
   v_pages:=greatest(1,coalesce((v_file->>'pages')::integer,1)); v_copies:=greatest(1,coalesce((v_file->>'copies')::integer,1)); v_duplex:=coalesce((v_file->>'duplex')::boolean,false); v_color:=coalesce(v_file->>'color_mode','bw');
   select * into v_paper from public.print_paper_types where id=(v_file->>'paper_type_id')::uuid and active=true; if not found then raise exception 'Tipo de papel inválido'; end if;
   v_sheets:=ceil(v_pages::numeric/case when v_duplex then 2 else 1 end)*v_copies;
   select * into v_tier from public.print_price_tiers where paper_type_id=v_paper.id and color_mode=v_color and min_sheets<=v_sheets and (max_sheets is null or max_sheets>=v_sheets) order by min_sheets desc limit 1; if not found then raise exception 'Não há preço configurado para % folhas em %',v_sheets,v_paper.name; end if;
   v_file_total:=v_sheets*v_tier.price_per_sheet;
   for v_service in select * from jsonb_array_elements(coalesce(v_file->'services','[]'::jsonb)) loop
    select * into v_service_row from public.print_services where id=(v_service->>'service_id')::uuid and active=true; if not found then raise exception 'Serviço de impressão inválido'; end if;
    v_selected:=coalesce(v_service->'selected_pages','[]'::jsonb); if jsonb_typeof(v_selected)<>'array' then v_selected:='[]'::jsonb; end if;
    if v_service_row.charge_type='per_page' then v_service_qty:=jsonb_array_length(v_selected)*v_copies;
    elsif v_service_row.charge_type='per_sheet' then select count(distinct ceil((x.value::text)::numeric/2.0)) into v_service_qty from jsonb_array_elements_text(v_selected) x(value); v_service_qty:=greatest(1,v_service_qty)*v_copies;
    elsif v_service_row.charge_type='per_document' then v_service_qty:=v_copies; else v_service_qty:=1; end if;
    v_service_total:=v_service_qty*v_service_row.price; v_file_total:=v_file_total+v_service_total;
   end loop;
   v_job_total:=v_job_total+v_file_total;
  end loop;
  if v_job_total<=0 then raise exception 'Serviço de impressão sem valor'; end if;
  v_subtotal:=v_subtotal+v_job_total;
 else
  v_qty:=greatest(1,coalesce((v_item->>'quantity')::integer,1));
  select id,name,price,stock,active into v_product from public.products where id=(v_item->>'id')::uuid for update;
  if not found then raise exception 'Produto não encontrado'; end if; if not v_product.active then raise exception 'Produto indisponível: %',v_product.name; end if; if v_product.stock<v_qty then raise exception 'Estoque insuficiente para: % (disponível: %)',v_product.name,v_product.stock; end if;
  v_unit_price:=v_product.price; select promotional_price into v_promotion from public.promotions where product_id=v_product.id and active=true and starts_at<=now() and ends_at>=now() and promotional_price<v_product.price order by promotional_price asc limit 1; if found then v_unit_price:=v_promotion.promotional_price; end if;
  v_subtotal:=v_subtotal+v_unit_price*v_qty;
 end if;
end loop;

v_headers:=nullif(current_setting('request.headers',true),''); if v_headers is not null then v_coupon_code:=upper(trim(coalesce((v_headers::json->>'x-2pbox-coupon'),''))); end if;
if coalesce(v_coupon_code,'')<>'' then
 select * into v_coupon from public.coupons where code=v_coupon_code and active=true for update; if not found then raise exception 'Cupom inválido ou inativo'; end if;
 if v_coupon.starts_at>now() or v_coupon.ends_at<now() then raise exception 'Cupom fora do período de validade'; end if; if v_coupon.usage_limit is not null and v_coupon.usage_count>=v_coupon.usage_limit then raise exception 'Cupom esgotado'; end if; if v_subtotal<coalesce(v_coupon.min_cart_total,0) then raise exception 'O pedido não atingiu o valor mínimo para este cupom'; end if;
 if v_coupon.discount_type='percent' then v_discount:=round(v_subtotal*(v_coupon.discount_value/100),2); else v_discount:=v_coupon.discount_value; end if; v_discount:=least(greatest(v_discount,0),v_subtotal); v_total:=greatest(v_subtotal-v_discount,0);
else v_total:=v_subtotal; end if;

insert into public.orders(customer_id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,total,items_subtotal,coupon_code,coupon_discount)
values(v_customer_id,trim(p_customer_name),trim(p_customer_phone),nullif(trim(p_customer_email),''),p_delivery_type,case when v_needs_address then p_delivery_address else null end,nullif(trim(p_notes),''),v_total,v_subtotal,nullif(v_coupon_code,''),v_discount) returning id into v_order_id;

for v_item in select * from jsonb_array_elements(p_items) loop
 if coalesce(v_item->>'type','product')='print' then
  v_job_total:=0; insert into public.print_jobs(order_id,metadata) values(v_order_id,coalesce(v_item->'metadata','{}'::jsonb)) returning id into v_job_id;
  for v_file in select * from jsonb_array_elements(coalesce(v_item->'files','[]'::jsonb)) loop
   v_pages:=greatest(1,coalesce((v_file->>'pages')::integer,1)); v_copies:=greatest(1,coalesce((v_file->>'copies')::integer,1)); v_duplex:=coalesce((v_file->>'duplex')::boolean,false); v_color:=coalesce(v_file->>'color_mode','bw');
   select * into v_paper from public.print_paper_types where id=(v_file->>'paper_type_id')::uuid and active=true; v_sheets:=ceil(v_pages::numeric/case when v_duplex then 2 else 1 end)*v_copies;
   select * into v_tier from public.print_price_tiers where paper_type_id=v_paper.id and color_mode=v_color and min_sheets<=v_sheets and (max_sheets is null or max_sheets>=v_sheets) order by min_sheets desc limit 1;
   v_file_total:=v_sheets*v_tier.price_per_sheet;
   insert into public.print_files(print_job_id,original_name,storage_path,mime_type,pages,copies,paper_type_id,color_mode,duplex,sheets,print_total,metadata) values(v_job_id,v_file->>'original_name',v_file->>'storage_path',v_file->>'mime_type',v_pages,v_copies,v_paper.id,v_color,v_duplex,v_sheets,v_file_total,coalesce(v_file->'metadata','{}'::jsonb)) returning id into v_file_id;
   for v_service in select * from jsonb_array_elements(coalesce(v_file->'services','[]'::jsonb)) loop
    select * into v_service_row from public.print_services where id=(v_service->>'service_id')::uuid and active=true; v_selected:=coalesce(v_service->'selected_pages','[]'::jsonb);
    if v_service_row.charge_type='per_page' then v_service_qty:=jsonb_array_length(v_selected)*v_copies; elsif v_service_row.charge_type='per_sheet' then select count(distinct ceil((x.value::text)::numeric/2.0)) into v_service_qty from jsonb_array_elements_text(v_selected) x(value); v_service_qty:=greatest(1,v_service_qty)*v_copies; elsif v_service_row.charge_type='per_document' then v_service_qty:=v_copies; else v_service_qty:=1; end if;
    v_service_total:=v_service_qty*v_service_row.price;
    insert into public.print_file_services(print_file_id,service_id,selected_pages,quantity,unit_price,total) values(v_file_id,v_service_row.id,v_selected,v_service_qty,v_service_row.price,v_service_total);
    v_file_total:=v_file_total+v_service_total;
   end loop;
   v_job_total:=v_job_total+v_file_total;
  end loop;
  update public.print_jobs set subtotal=v_job_total where id=v_job_id;
  insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,total,print_job_id) values(v_order_id,null,'Serviço de impressão',1,v_job_total,v_job_total,v_job_id);
 else
  v_qty:=greatest(1,coalesce((v_item->>'quantity')::integer,1)); select id,name,price into v_product from public.products where id=(v_item->>'id')::uuid; v_unit_price:=v_product.price;
  select promotional_price into v_promotion from public.promotions where product_id=v_product.id and active=true and starts_at<=now() and ends_at>=now() and promotional_price<v_product.price order by promotional_price asc limit 1; if found then v_unit_price:=v_promotion.promotional_price; end if;
  insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,total) values(v_order_id,v_product.id,v_product.name,v_qty,v_unit_price,v_unit_price*v_qty); update public.products set stock=stock-v_qty,updated_at=now() where id=v_product.id;
 end if;
end loop;
if v_coupon is not null then update public.coupons set usage_count=usage_count+1 where id=v_coupon.id; end if;
return v_order_id;
end;
$$;
revoke all on function public.create_order_with_stock_v5(text,text,text,text,text,jsonb,jsonb) from public;
grant execute on function public.create_order_with_stock_v5(text,text,text,text,text,jsonb,jsonb) to anon,authenticated;
