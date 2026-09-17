-- 2P Box | Analytics purchase idempotency when a test order is toggled.
-- Does not touch Mercado Pago; it only observes orders.payment_status.

create or replace function public.analytics_record_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
     and coalesce(new.is_test, false) = false
     and (
       tg_op = 'INSERT'
       or coalesce(old.payment_status, '') <> 'paid'
       or (tg_op = 'UPDATE' and coalesce(old.is_test, false) = true and coalesce(new.is_test, false) = false)
     )
  then
    insert into public.analytics_events (
      event_name, session_id, user_id, order_id, utm_source, utm_medium,
      utm_campaign, device_type, value, page_path, metadata, created_at
    )
    values (
      'purchase',
      coalesce(nullif(new.analytics_session_id, ''), 'order:' || new.id::text),
      new.customer_id,
      new.id,
      new.analytics_utm_source,
      new.analytics_utm_medium,
      new.analytics_utm_campaign,
      null,
      new.total,
      '/pedido/' || new.id::text,
      jsonb_build_object('source', 'order_payment_state'),
      coalesce(new.paid_at, now())
    )
    on conflict (order_id) where event_name = 'purchase' do nothing;
  end if;
  return new;
end;
$$;
