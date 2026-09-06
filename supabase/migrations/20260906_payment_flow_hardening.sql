-- 2P Box | Fluxo de pagamento: estado, auditoria e devolução de estoque
-- Executar no Supabase antes de colocar pagamentos em produção.

alter table public.orders
  add column if not exists payment_status_detail text,
  add column if not exists payment_updated_at timestamptz,
  add column if not exists stock_restored_at timestamptz;

create index if not exists orders_payment_id_idx on public.orders(payment_id);
create index if not exists orders_customer_email_idx on public.orders(lower(customer_email));

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
  v_payment_status text := lower(trim(coalesce(p_payment_status, 'pending')));
  v_order_status text := lower(trim(coalesce(p_order_status, 'pending')));
begin
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_payment_status not in ('pending','in_process','authorized','approved','rejected','cancelled') then
    v_payment_status := 'pending';
  end if;

  if v_order_status not in ('pending','confirmed','preparing','ready','completed','cancelled') then
    v_order_status := case
      when v_payment_status = 'approved' then 'confirmed'
      when v_payment_status in ('rejected','cancelled') then 'cancelled'
      else 'pending'
    end;
  end if;

  -- Estado terminal nunca é regredido por webhook/polling atrasado.
  if v_order.payment_status = 'approved' and v_payment_status <> 'approved' then
    return jsonb_build_object('payment_status', 'approved', 'order_status', coalesce(v_order.status, 'confirmed'), 'payment_id', v_order.payment_id::text, 'ignored', true);
  end if;

  if v_order.payment_status in ('rejected','cancelled') and v_payment_status not in ('approved','rejected','cancelled') then
    return jsonb_build_object('payment_status', v_order.payment_status, 'order_status', v_order.status, 'payment_id', v_order.payment_id::text, 'ignored', true);
  end if;

  if v_payment_status = 'approved' then
    v_order_status := case
      when v_order.status in ('preparing','ready','completed') then v_order.status
      else 'confirmed'
    end;
  elsif v_payment_status in ('rejected','cancelled') then
    v_order_status := 'cancelled';
  else
    v_order_status := case
      when v_order.status in ('preparing','ready','completed') then v_order.status
      else 'pending'
    end;
  end if;

  if v_order_status = 'cancelled' and v_order.stock_restored_at is null then
    update public.products p
       set stock = p.stock + oi.quantity,
           updated_at = now()
      from public.order_items oi
     where oi.order_id = p_order_id
       and p.id = oi.product_id;
    v_restored := true;
  end if;

  update public.orders
     set payment_id = coalesce(nullif(trim(p_payment_id), ''), payment_id),
         payment_status = v_payment_status,
         payment_status_detail = nullif(trim(coalesce(p_status_detail, '')), ''),
         payment_updated_at = now(),
         status = v_order_status,
         stock_restored_at = case when v_order_status = 'cancelled' then coalesce(stock_restored_at, now()) else stock_restored_at end,
         updated_at = now()
   where id = p_order_id;

  return jsonb_build_object(
    'payment_status', v_payment_status,
    'order_status', v_order_status,
    'payment_id', coalesce(nullif(trim(p_payment_id), ''), v_order.payment_id::text),
    'stock_restored', v_restored,
    'ignored', false
  );
end;
$$;

revoke all on function public.sync_order_payment_state(uuid,text,text,text,text) from public;
grant execute on function public.sync_order_payment_state(uuid,text,text,text,text) to service_role;
