-- 2P Box | Regra definitiva do fluxo de pedido/pagamento
-- Pagamento aprovado -> pedido confirmado.
-- Depois disso, somente o fluxo administrativo pode alterar o status do pedido.

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
  v_payment text := lower(coalesce(p_payment_status, 'pending'));
  v_final_payment text;
  v_final_order text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;

  -- Um pagamento já aprovado nunca volta para um estado anterior.
  if lower(coalesce(v_order.payment_status, '')) = 'approved'
     or lower(coalesce(v_order.status, '')) = 'confirmed' then
    if v_payment <> 'approved' then
      return jsonb_build_object(
        'payment_status','approved',
        'order_status',coalesce(v_order.status,'confirmed'),
        'payment_id',coalesce(v_order.payment_id::text,p_payment_id),
        'ignored',true
      );
    end if;
  end if;

  v_final_payment := case
    when v_payment in ('processed','accredited') then 'approved'
    else v_payment
  end;

  -- A aprovação é a única resposta automática que promove o pedido.
  -- Para qualquer outro estado, PRESERVAMOS o status operacional atual.
  -- Assim pending/in_process/authorized nunca desfazem confirmed, e rejeição
  -- do pagamento também não altera o fluxo que o Admin controla.
  v_final_order := case
    when v_payment in ('approved','processed','accredited') then 'confirmed'
    else coalesce(v_order.status, 'pending')
  end;

  update public.orders
     set payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
         payment_status = v_final_payment,
         payment_status_detail = nullif(trim(coalesce(p_status_detail, '')), ''),
         payment_updated_at = now(),
         status = v_final_order,
         updated_at = now()
   where id = p_order_id;

  return jsonb_build_object(
    'payment_status',v_final_payment,
    'order_status',v_final_order,
    'payment_id',coalesce(nullif(trim(p_payment_id),''),v_order.payment_id::text),
    'ignored',false
  );
end;
$$;

revoke all on function public.sync_order_payment_state(uuid,text,text,text,text) from public;
grant execute on function public.sync_order_payment_state(uuid,text,text,text,text) to service_role;
