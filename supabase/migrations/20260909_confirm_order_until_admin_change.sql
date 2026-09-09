-- 2P Box: pagamento aprovado confirma o pedido e nenhum sincronizador de pagamento pode alterar o status do pedido depois disso.
-- O status do pedido, uma vez confirmado pelo pagamento, só pode ser alterado pelo Admin.

create or replace function public.sync_order_payment_state(
  p_order_id uuid,
  p_payment_id text,
  p_payment_status text,
  p_order_status text,
  p_status_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_restored boolean := false;
  v_payment_status text := lower(coalesce(p_payment_status, 'pending'));
  v_is_approved boolean := lower(coalesce(p_payment_status, '')) = 'approved';
  v_is_cancelled_payment boolean := lower(coalesce(p_payment_status, '')) in ('cancelled','canceled','refunded','charged_back','rejected','failed');
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;

  -- Pagamento aprovado é definitivo para o status do pedido.
  -- Polling/webhook posterior nunca pode devolver o pedido para pending.
  if v_order.status = 'confirmed' and not v_is_approved then
    update public.orders
       set payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
           payment_status = case when v_order.payment_status = 'approved' then 'approved' else v_order.payment_status end,
           payment_status_detail = nullif(trim(coalesce(p_status_detail, '')), ''),
           payment_updated_at = now(),
           updated_at = now()
     where id = p_order_id;
    return jsonb_build_object('payment_status', coalesce(v_order.payment_status,'approved'), 'order_status','confirmed', 'payment_id',coalesce(v_order.payment_id::text,p_payment_id), 'ignored',true);
  end if;

  if v_is_approved then
    update public.orders
       set payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
           payment_status = 'approved',
           payment_status_detail = nullif(trim(coalesce(p_status_detail, '')), ''),
           payment_updated_at = now(),
           status = 'confirmed',
           updated_at = now()
     where id = p_order_id;
    return jsonb_build_object('payment_status','approved','order_status','confirmed','payment_id',coalesce(nullif(trim(p_payment_id), ''),v_order.payment_id::text),'ignored',false);
  end if;

  if v_order.payment_status in ('rejected','cancelled') and not v_is_approved then
    return jsonb_build_object('payment_status',v_order.payment_status,'order_status',v_order.status,'payment_id',coalesce(v_order.payment_id::text,p_payment_id),'ignored',true);
  end if;

  if p_order_status = 'cancelled' and v_order.stock_restored_at is null then
    update public.products p set stock = p.stock + oi.quantity, updated_at = now()
      from public.order_items oi where oi.order_id = p_order_id and p.id = oi.product_id;
    v_restored := true;
  end if;

  update public.orders set payment_id=coalesce(nullif(trim(p_payment_id),''),payment_id), payment_status=v_payment_status, payment_status_detail=nullif(trim(coalesce(p_status_detail,'')),''), payment_updated_at=now(), status=p_order_status, stock_restored_at=case when p_order_status='cancelled' then coalesce(stock_restored_at,now()) else stock_restored_at end, updated_at=now() where id=p_order_id;
  return jsonb_build_object('payment_status',v_payment_status,'order_status',p_order_status,'payment_id',coalesce(nullif(trim(p_payment_id),''),v_order.payment_id::text),'stock_restored',v_restored,'ignored',false);
end;
$$;

revoke all on function public.sync_order_payment_state(uuid,text,text,text,text) from public;
grant execute on function public.sync_order_payment_state(uuid,text,text,text,text) to service_role;
