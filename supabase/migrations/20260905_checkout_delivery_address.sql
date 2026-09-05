-- 2P Box | Endereço de entrega e checkout com frete via WhatsApp
alter table public.orders
  add column if not exists delivery_address jsonb;

create or replace function public.create_order_with_stock_v2(
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
begin
  if coalesce(trim(p_customer_name), '') = '' then raise exception 'Nome é obrigatório'; end if;
  if coalesce(trim(p_customer_phone), '') = '' then raise exception 'Telefone é obrigatório'; end if;
  if p_delivery_type not in ('pickup','whatsapp_shipping') then raise exception 'Forma de recebimento inválida'; end if;
  if p_delivery_type = 'whatsapp_shipping' and p_delivery_address is null then raise exception 'Endereço é obrigatório para calcular o frete'; end if;
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

  insert into public.orders (customer_name, customer_phone, customer_email, delivery_type, delivery_address, notes, total)
  values (trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email), ''), p_delivery_type, case when p_delivery_type='whatsapp_shipping' then p_delivery_address else null end, nullif(trim(p_notes), ''), v_total)
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

revoke all on function public.create_order_with_stock_v2(text,text,text,text,text,jsonb,jsonb) from public;
grant execute on function public.create_order_with_stock_v2(text,text,text,text,text,jsonb,jsonb) to anon, authenticated;
