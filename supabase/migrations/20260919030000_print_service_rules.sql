-- 2P Box | corrigir faixas A4 para a tabela oficial da loja
-- A tabela fornecida em 19/09/2026 define somente estas faixas de Xerox/P&B para A4.

do $$
declare
  v_paper uuid;
begin
  select id into v_paper from public.print_paper_types where name='Papel comum A4' order by sort_order, created_at limit 1;
  if v_paper is null then
    raise exception 'Papel comum A4 não encontrado';
  end if;

  delete from public.print_price_tiers where paper_type_id=v_paper;

  insert into public.print_price_tiers(paper_type_id,color_mode,min_sheets,max_sheets,price_per_sheet)
  values
    (v_paper,'bw',1,50,0.40),
    (v_paper,'bw',51,100,0.35),
    (v_paper,'bw',101,150,0.30),
    (v_paper,'bw',151,200,0.25);
end $$;


-- 2P Box | regras claras para serviços de impressão
alter table public.print_services
  add column if not exists service_group text not null default 'other',
  add column if not exists selection_group text,
  add column if not exists min_sheets integer,
  add column if not exists max_sheets integer;

alter table public.print_services
  drop constraint if exists print_services_service_group_check;
alter table public.print_services
  add constraint print_services_service_group_check check (service_group in ('binding','lamination','other'));

alter table public.print_services
  drop constraint if exists print_services_min_sheets_check;
alter table public.print_services
  add constraint print_services_min_sheets_check check (min_sheets is null or min_sheets > 0);

alter table public.print_services
  drop constraint if exists print_services_max_sheets_check;
alter table public.print_services
  add constraint print_services_max_sheets_check check (max_sheets is null or min_sheets is null or max_sheets >= min_sheets);

update public.print_services
set service_group='binding', selection_group='finishing', min_sheets=1, max_sheets=50
where name='Encadernação 1 a 50 folhas';

update public.print_services
set service_group='binding', selection_group='finishing', min_sheets=51, max_sheets=100
where name='Encadernação 51 a 100 folhas';

update public.print_services
set service_group='binding', selection_group='finishing', min_sheets=101, max_sheets=150
where name='Encadernação 101 a 150 folhas';

update public.print_services
set service_group='binding', selection_group='finishing', min_sheets=151, max_sheets=200
where name='Encadernação 151 a 200 folhas';

update public.print_services
set service_group='lamination', selection_group='finishing', min_sheets=null, max_sheets=null
where name ilike 'Plastificação%';

update public.print_services
set service_group='other', selection_group=null, min_sheets=null, max_sheets=null
where service_group not in ('binding','lamination');

create or replace function public.validate_print_file_service_rules()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_service record;
  v_file record;
  v_existing_group text;
begin
  select service_group, selection_group, min_sheets, max_sheets into v_service
  from public.print_services where id=new.service_id and active=true;
  if not found then raise exception 'Serviço de impressão inválido ou inativo'; end if;

  select pages,copies,sheets into v_file from public.print_files where id=new.print_file_id;
  if not found then raise exception 'Arquivo de impressão não encontrado'; end if;

  if v_service.service_group='binding' and
     (v_service.min_sheets is not null and v_file.sheets < v_service.min_sheets or
      v_service.max_sheets is not null and v_file.sheets > v_service.max_sheets) then
    raise exception 'A encadernação escolhida não atende a quantidade de folhas do arquivo';
  end if;

  if v_service.selection_group is not null then
    select ps.selection_group into v_existing_group
    from public.print_file_services pfs
    join public.print_services ps on ps.id=pfs.service_id
    where pfs.print_file_id=new.print_file_id
      and ps.selection_group=v_service.selection_group
      and pfs.id<>new.id
    limit 1;
    if v_existing_group is not null then
      raise exception 'Escolha apenas um acabamento para este arquivo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_print_file_service_rules on public.print_file_services;
create trigger trg_validate_print_file_service_rules
before insert or update on public.print_file_services
for each row execute function public.validate_print_file_service_rules();

revoke all on function public.validate_print_file_service_rules() from public;
grant execute on function public.validate_print_file_service_rules() to anon,authenticated;


-- Corrige a cobrança de serviços por folha para usar as folhas físicas calculadas do arquivo.
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
    elsif v_service_row.charge_type='per_sheet' then v_service_qty:=v_sheets;
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
    if v_service_row.charge_type='per_page' then v_service_qty:=jsonb_array_length(v_selected)*v_copies; elsif v_service_row.charge_type='per_sheet' then v_service_qty:=v_sheets; elsif v_service_row.charge_type='per_document' then v_service_qty:=v_copies; else v_service_qty:=1; end if;
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
