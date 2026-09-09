-- 2P Box | authoritative Mercado Pago reconciliation
-- Single database write path for payment reconciliation.
-- Approved is irreversible for an order; rejected/cancelled are protected
-- against stale events for the same Mercado Pago payment ID.

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
  v_incoming text := lower(coalesce(p_payment_status, 'pending'));
  v_current text;
  v_final text;
  v_order_status text;
  v_same_payment boolean;
begin
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_incoming in ('processed', 'accredited') then
    v_incoming := 'approved';
  elsif v_incoming = 'canceled' then
    v_incoming := 'cancelled';
  elsif v_incoming not in ('approved','pending','in_process','authorized','rejected','failed','cancelled','refunded','charged_back') then
    v_incoming := 'pending';
  end if;

  v_current := lower(coalesce(v_order.payment_status, ''));
  v_same_payment := nullif(trim(coalesce(p_payment_id, '')), '') is not null
                    and nullif(trim(coalesce(v_order.payment_id::text, '')), '') = nullif(trim(p_payment_id), '');

  -- An approved order can never be downgraded by any later/stale payment event.
  if v_current = 'approved' or lower(coalesce(v_order.status, '')) = 'confirmed' then
    v_final := 'approved';
    v_order_status := 'confirmed';
    update public.orders
       set payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
           payment_status = v_final,
           payment_status_detail = coalesce(nullif(trim(coalesce(p_status_detail, '')), ''), payment_status_detail),
           updated_at = now()
     where id = p_order_id;
    return jsonb_build_object('payment_status',v_final,'order_status',v_order_status,
                              'payment_id',coalesce(nullif(trim(p_payment_id),''),v_order.payment_id::text),
                              'ignored',true);
  end if;

  -- Rejected/cancelled protects against stale notifications for that same
  -- payment. A different payment ID may legitimately be a new checkout attempt.
  if v_current in ('rejected','cancelled') and v_same_payment and v_incoming <> v_current then
    return jsonb_build_object('payment_status',v_current,
                              'order_status',coalesce(v_order.status,'pending'),
                              'payment_id',v_order.payment_id::text,
                              'ignored',true);
  end if;

  if v_incoming = 'approved' then
    v_final := 'approved';
    v_order_status := 'confirmed';
  else
    v_final := case when v_incoming = 'failed' then 'rejected'
                    when v_incoming in ('refunded','charged_back') then 'cancelled'
                    else v_incoming end;
    -- Non-approved payment events do not alter the operational order status.
    v_order_status := coalesce(v_order.status, 'pending');
  end if;

  update public.orders
     set payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
         payment_status = v_final,
         payment_status_detail = nullif(trim(coalesce(p_status_detail, '')), ''),
         payment_updated_at = now(),
         status = v_order_status,
         updated_at = now()
   where id = p_order_id;

  return jsonb_build_object('payment_status',v_final,'order_status',v_order_status,
                            'payment_id',coalesce(nullif(trim(p_payment_id),''),v_order.payment_id::text),
                            'ignored',false);
end;
$$;

revoke all on function public.sync_order_payment_state(uuid,text,text,text,text) from public;
grant execute on function public.sync_order_payment_state(uuid,text,text,text,text) to service_role;
