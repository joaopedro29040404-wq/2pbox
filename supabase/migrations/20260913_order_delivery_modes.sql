alter table public.orders
  drop constraint if exists orders_delivery_type_check;

alter table public.orders
  add constraint orders_delivery_type_check
  check (delivery_type in ('pickup','whatsapp_shipping','own_delivery','app_delivery'));

create or replace function public.create_order_with_stock_v3(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_type text,
  p_notes text,
  p_items jsonb,
  p_delivery_address jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_unit_price numeric;
  v_total numeric := 0;
  v_customer_id uuid := auth.uid();
  v_needs_address boolean;
begin
  if coalesce(trim(p_customer_name), '') = '' then raise exception 'Nome é obrigatório'; end if;
  if coalesce(trim(p_customer_phone), '') = '' then raise exception 'Telefone é obrigatório'; end if;
  if p_delivery_type not in ('pickup','whatsapp_shipping','own_delivery','app_delivery') then
    raise exception 'Forma de recebimento inválida';
  end if;

  v_needs_address := p_delivery_type in ('whatsapp_shipping','own_delivery','app_delivery');
  if v_needs_address and p_delivery_address is null then raise exception 'Endereço é obrigatório para entrega'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Carrinho vazio'; end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, (v_item->>'quantity')::integer);
    select id, name, price, stock, active into v_product
    from public.products where id = (v_item->>'id')::uuid for update;
    if not found then raise exception 'Produto não encontrado'; end if;
    if not v_product.active then raise exception 'Produto indisponível: %', v_product.name; end if;
    if v_product.stock < v_qty then raise exception 'Estoque insuficiente para: % (disponível: %)', v_product.name, v_product.stock; end if;
    v_total := v_total + (v_product.price * v_qty);
  end loop;

  insert into public.orders (customer_id, customer_name, customer_phone, customer_email, delivery_type, delivery_address, notes, total)
  values (
    v_customer_id,
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(p_customer_email), ''),
    p_delivery_type,
    case when v_needs_address then p_delivery_address else null end,
    nullif(trim(p_notes), ''),
    v_total
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, (v_item->>'quantity')::integer);
    select id, name, price into v_product from public.products where id = (v_item->>'id')::uuid;
    v_unit_price := v_product.price;
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, total)
    values (v_order_id, v_product.id, v_product.name, v_qty, v_unit_price, v_unit_price * v_qty);
    update public.products set stock = stock - v_qty, updated_at = now() where id = v_product.id;
  end loop;
  return v_order_id;
end;
$$;

revoke all on function public.create_order_with_stock_v3(text,text,text,text,text,jsonb,jsonb) from public;
grant execute on function public.create_order_with_stock_v3(text,text,text,text,text,jsonb,jsonb) to anon, authenticated;

-- O subtotal dos itens fica registrado para o frete poder ser somado ao total
-- sem perder a referencia do valor das mercadorias.
alter table public.orders
  add column if not exists items_subtotal numeric(10,2);

update public.orders o
set items_subtotal = coalesce((select sum(i.total) from public.order_items i where i.order_id = o.id), o.total)
where o.items_subtotal is null;
