create or replace function public.analytics_record_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or coalesce(old.payment_status, '') <> 'paid')
     and coalesce(new.is_test, false) = false
     and coalesce(new.analytics_excluded, false) = false
     and not exists (
       select 1
       from public.analytics_excluded_devices d
       where d.session_id = new.analytics_session_id
     )
  then
    begin
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
      on conflict (order_id) where event_name = 'purchase' and order_id is not null do nothing;
    exception when others then
      raise warning 'analytics_record_purchase nao registrou a compra do pedido %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_analytics_record_purchase on public.orders;
create trigger trg_analytics_record_purchase
after insert or update of payment_status, is_test, analytics_excluded on public.orders
for each row execute function public.analytics_record_purchase();
