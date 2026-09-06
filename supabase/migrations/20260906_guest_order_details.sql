-- 2P Box | Acompanhamento de pedido para compras sem login
-- Permite que o convidado veja o próprio pedido usando ID + e-mail informado no checkout.
-- O UUID do pedido funciona como identificador adicional e o e-mail precisa coincidir exatamente.

create or replace function public.guest_order_details(
  p_order_id uuid,
  p_customer_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb;
  v_items jsonb;
begin
  select to_jsonb(o) - 'customer_id'
    into v_order
  from public.orders o
  where o.id = p_order_id
    and o.customer_email is not null
    and lower(trim(o.customer_email)) = lower(trim(coalesce(p_customer_email, '')));

  if v_order is null then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_id', oi.product_id,
      'product_name', oi.product_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price
    ) order by oi.product_name
  ), '[]'::jsonb)
  into v_items
  from public.order_items oi
  where oi.order_id = p_order_id;

  return jsonb_build_object('order', v_order, 'items', v_items);
end;
$$;

revoke all on function public.guest_order_details(uuid,text) from public;
grant execute on function public.guest_order_details(uuid,text) to anon, authenticated;

-- Corrige/expõe a função usada pela página de detalhes para clientes autenticados.
create or replace function public.get_order_items_for_customer(p_order_id uuid)
returns table(product_id uuid, product_name text, quantity integer, unit_price numeric)
language sql
security definer
set search_path = public
as $$
  select oi.product_id, oi.product_name, oi.quantity, oi.unit_price
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.order_id = p_order_id
    and (
      o.customer_id = auth.uid()
      or (
        o.customer_id is null
        and o.customer_email is not null
        and lower(trim(o.customer_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      )
    );
$$;

revoke all on function public.get_order_items_for_customer(uuid) from public;
grant execute on function public.get_order_items_for_customer(uuid) to authenticated;
