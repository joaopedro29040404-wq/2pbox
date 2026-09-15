-- Marketing: fecha o cupom no mesmo cálculo transacional do pedido.
-- O código chega pelo header x-2pbox-coupon; o banco revalida tudo e nunca confia no desconto do cliente.

alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists coupon_discount numeric(12,2) not null default 0;

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
  v_promotion record;
  v_coupon record;
  v_qty integer;
  v_unit_price numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_coupon_code text;
  v_customer_id uuid := auth.uid();
  v_needs_address boolean;
  v_headers text;
begin
  if coalesce(trim(p_customer_name), '') = '' then raise exception 'Nome é obrigatório'; end if;
  if coalesce(trim(p_customer_phone), '') = '' then raise exception 'Telefone é obrigatório'; end if;
  if p_delivery_type not in ('pickup','whatsapp_shipping','own_delivery','express_delivery','app_delivery') then raise exception 'Forma de recebimento inválida'; end if;
  v_needs_address := p_delivery_type <> 'pickup';
  if v_needs_address and p_delivery_address is null then raise exception 'Endereço é obrigatório para entrega'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Carrinho vazio'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    select id, name, price, stock, active into v_product from public.products where id = (v_item->>'id')::uuid for update;
    if not found then raise exception 'Produto não encontrado'; end if;
    if not v_product.active then raise exception 'Produto indisponível: %', v_product.name; end if;
    if v_product.stock < v_qty then raise exception 'Estoque insuficiente para: % (disponível: %)', v_product.name, v_product.stock; end if;
    v_unit_price := v_product.price;
    select promotional_price into v_promotion from public.promotions where product_id = v_product.id and active = true and starts_at <= now() and ends_at >= now() and promotional_price < v_product.price order by promotional_price asc limit 1;
    if found then v_unit_price := v_promotion.promotional_price; end if;
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  end loop;

  v_headers := nullif(current_setting('request.headers', true), '');
  if v_headers is not null then
    v_coupon_code := upper(trim(coalesce((v_headers::json ->> 'x-2pbox-coupon'), '')));
  end if;

  if coalesce(v_coupon_code, '') <> '' then
    select * into v_coupon from public.coupons where code = v_coupon_code and active = true for update;
    if not found then raise exception 'Cupom inválido ou inativo'; end if;
    if v_coupon.starts_at > now() or v_coupon.ends_at < now() then raise exception 'Cupom fora do período de validade'; end if;
    if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then raise exception 'Cupom esgotado'; end if;
    if v_subtotal < coalesce(v_coupon.min_cart_total, 0) then raise exception 'O pedido não atingiu o valor mínimo para este cupom'; end if;
    if v_coupon.discount_type = 'percent' then v_discount := round(v_subtotal * (v_coupon.discount_value / 100), 2); else v_discount := v_coupon.discount_value; end if;
    v_discount := least(greatest(v_discount, 0), v_subtotal);
    v_total := greatest(v_subtotal - v_discount, 0);
  else
    v_total := v_subtotal;
  end if;

  insert into public.orders (customer_id, customer_name, customer_phone, customer_email, delivery_type, delivery_address, notes, total, items_subtotal, coupon_code, coupon_discount)
  values (v_customer_id, trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email), ''), p_delivery_type, case when v_needs_address then p_delivery_address else null end, nullif(trim(p_notes), ''), v_total, v_subtotal, nullif(v_coupon_code, ''), v_discount)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    select id, name, price into v_product from public.products where id = (v_item->>'id')::uuid;
    v_unit_price := v_product.price;
    select promotional_price into v_promotion from public.promotions where product_id = v_product.id and active = true and starts_at <= now() and ends_at >= now() and promotional_price < v_product.price order by promotional_price asc limit 1;
    if found then v_unit_price := v_promotion.promotional_price; end if;
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, total) values (v_order_id, v_product.id, v_product.name, v_qty, v_unit_price, v_unit_price * v_qty);
    update public.products set stock = stock - v_qty, updated_at = now() where id = v_product.id;
  end loop;

  if v_coupon is not null then
    update public.coupons set usage_count = usage_count + 1 where id = v_coupon.id;
  end if;
  return v_order_id;
end;
$$;

revoke all on function public.create_order_with_stock_v3(text,text,text,text,text,jsonb,jsonb) from public;
grant execute on function public.create_order_with_stock_v3(text,text,text,text,text,jsonb,jsonb) to anon, authenticated;
