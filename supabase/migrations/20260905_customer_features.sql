create table if not exists public.customer_favorites (
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);
alter table public.customer_favorites enable row level security;
create policy "customers manage own favorites" on public.customer_favorites for all using (auth.uid()=customer_id) with check (auth.uid()=customer_id);
create index if not exists customer_favorites_customer_idx on public.customer_favorites(customer_id);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  label text default 'Principal',
  recipient_name text not null,
  phone text not null,
  postal_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_addresses enable row level security;
create policy "customers manage own addresses" on public.customer_addresses for all using (auth.uid()=customer_id) with check (auth.uid()=customer_id);
create index if not exists customer_addresses_customer_idx on public.customer_addresses(customer_id);

create table if not exists public.customer_preferences (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  marketing_email boolean not null default true,
  marketing_whatsapp boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.customer_preferences enable row level security;
create policy "customers manage own preferences" on public.customer_preferences for all using (auth.uid()=customer_id) with check (auth.uid()=customer_id);

create or replace function public.customer_order_items(p_order_id uuid)
returns table(product_id uuid, product_name text, quantity integer, unit_price numeric)
language sql security definer set search_path=public
as $$
  select oi.product_id, oi.product_name, oi.quantity, oi.unit_price
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  where oi.order_id=p_order_id and o.customer_id=auth.uid();
$$;
