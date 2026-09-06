-- 2P Box | Rastreamento de pagamentos Mercado Pago
-- Mantém o pedido sincronizado com o status real do pagamento.

alter table public.orders
  add column if not exists payment_id text;

create index if not exists orders_payment_id_idx
  on public.orders(payment_id)
  where payment_id is not null;
