-- 2P Box | Pagamento aprovado confirma o pedido e o status só muda pelo Admin.
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
  v_payment_status text := lower(coalesce(p_payment_status, 'pending'));
  v_current_payment text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;

  v_current_payment := lower(coalesce(v_order.payment_status, ''));

  -- Once approved, payment stays approved and the order stays confirmed.
  -- Only the Admin order-status action may change the order status afterwards.
  if v_current_payment = 'approved' or lower(coalesce(v_order.status, '')) = 'confirmed' then
    update public.orders set
      payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
      payment_status = 'approved',
      payment_status_detail = nullif(trim(coalesce(p_status_detail, '')), ''),
      payment_updated_at = now(),
      status = case when lower(coalesce(v_order.status,'')) = 'confirmed' then v_order.status else 'confirmed' end,
      updated_at = now()
    where id = p_order_id;
    return jsonb_build_object('payment_status','approved','order_status',case when lower(coalesce(v_order.status,''))='confirmed' then v_order.status else 'confirmed' end,'ignored',true);
  end if;

  if v_payment_status in ('approved','processed','accredited') then
    update public.orders set
      payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
      payment_status = 'approved',
      payment_status_detail = nullif(trim(coalesce(p_status_detail, '')), ''),
      payment_updated_at = now(),
      status = 'confirmed',
      updated_at = now()
    where id = p_order_id;
    return jsonb_build_object('payment_status','approved','order_status','confirmed','ignored',false);
  end if;

  update public.orders set
    payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
    payment_status = v_payment_status,
    payment_status_detail = nullif(trim(coalesce(p_status_detail, '')), ''),
    payment_updated_at = now(),
    updated_at = now()
  where id = p_order_id;

  -- Deliberately do not write status here for non-approved payments.
  return jsonb_build_object('payment_status',v_payment_status,'order_status',v_order.status,'ignored',false);
end;
$$;
revoke all on function public.sync_order_payment_state(uuid,text,text,text,text) from public;
grant execute on function public.sync_order_payment_state(uuid,text,text,text,text) to service_role;
