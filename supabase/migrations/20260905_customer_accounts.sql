-- 2P Box | Customer accounts
-- Apply this migration in Supabase SQL Editor before enabling the customer order history.

alter table public.orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null;

create index if not exists orders_customer_id_idx on public.orders(customer_id);

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  cpf text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

drop policy if exists "Customers can read own profile" on public.customer_profiles;
create policy "Customers can read own profile"
  on public.customer_profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Customers can update own profile" on public.customer_profiles;
create policy "Customers can update own profile"
  on public.customer_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Customers can insert own profile" on public.customer_profiles;
create policy "Customers can insert own profile"
  on public.customer_profiles for insert
  to authenticated
  with check (auth.uid() = id);

create or replace function public.handle_new_customer_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.customer_profiles (id, full_name, phone, cpf)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'cpf', '')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    cpf = excluded.cpf,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_customer_profile on auth.users;
create trigger on_auth_user_created_customer_profile
after insert on auth.users
for each row execute procedure public.handle_new_customer_profile();

create or replace function public.attach_order_to_customer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.customer_id is null and auth.uid() is not null then
    new.customer_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists before_order_customer_link on public.orders;
create trigger before_order_customer_link
before insert on public.orders
for each row execute procedure public.attach_order_to_customer();

-- Customer order visibility. If your existing orders table already has RLS,
-- this policy adds the authenticated customer's own orders without changing
-- the admin policies already in the project.
drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
  on public.orders for select
  to authenticated
  using (customer_id = auth.uid());
