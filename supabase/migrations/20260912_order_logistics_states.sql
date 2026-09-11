-- Estados logisticos que faltavam para fechar o ciclo do pedido.
-- O estado de pagamento continua em orders.payment_status, separado deste.
--
-- Retirada: pending -> confirmed -> preparing -> ready -> completed
-- Entrega:  pending -> confirmed -> preparing -> out_for_delivery -> delivered
-- Qualquer ponto pode ir para cancelled.

alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders add constraint orders_status_check
  check (status in (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled'
  ));

alter table public.orders
  add column if not exists dispatched_at timestamptz,
  add column if not exists delivered_at timestamptz;

comment on column public.orders.dispatched_at is 'Momento em que o pedido saiu para entrega.';
comment on column public.orders.delivered_at is 'Momento da entrega ou da retirada concluida.';

create index if not exists orders_logistics_idx
  on public.orders(status, created_at desc)
  where status in ('confirmed', 'preparing', 'ready', 'out_for_delivery');
