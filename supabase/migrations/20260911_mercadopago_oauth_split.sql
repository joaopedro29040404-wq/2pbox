create table if not exists public.store_mercadopago (
  id uuid primary key default gen_random_uuid(),
  mp_user_id text,
  nickname text,
  email text,
  access_token text,
  refresh_token text,
  public_key text,
  scope text,
  live_mode boolean not null default false,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_mercadopago_single_row on public.store_mercadopago((true));

alter table public.store_mercadopago enable row level security;

-- Os tokens do lojista nunca sao expostos ao navegador. Nenhuma policy de
-- select e criada: somente a service_role (backend) le esta tabela.
drop policy if exists "admins read mercadopago tokens" on public.store_mercadopago;

alter table public.orders
  add column if not exists platform_fee numeric(12,2),
  add column if not exists seller_amount numeric(12,2),
  add column if not exists mp_seller_user_id text;

comment on column public.orders.platform_fee is 'Comissao retida pela plataforma via application_fee.';
comment on column public.orders.seller_amount is 'Valor destinado ao lojista, bruto de tarifas do Mercado Pago.';
