-- Marketing V1: promoções por produto e cupons de desconto.
-- Não altera checkout/pagamentos. O desconto é aplicado sobre o subtotal dos produtos.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  promotional_price numeric(12,2) not null check (promotional_price > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promotions_period_check check (ends_at > starts_at)
);

create unique index if not exists promotions_one_active_product_idx
  on public.promotions(product_id)
  where active = true;

create index if not exists promotions_public_lookup_idx
  on public.promotions(product_id, active, starts_at, ends_at);

alter table public.promotions enable row level security;
revoke all on table public.promotions from anon, authenticated;
grant select on table public.promotions to anon, authenticated;
grant insert, update, delete on table public.promotions to authenticated;

drop policy if exists "public can view active promotions" on public.promotions;
create policy "public can view active promotions"
  on public.promotions for select
  to anon, authenticated
  using (active = true and starts_at <= now() and ends_at >= now());

drop policy if exists "admins manage promotions" on public.promotions;
create policy "admins manage promotions"
  on public.promotions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_cart_total numeric(12,2) not null default 0 check (min_cart_total >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupons_period_check check (ends_at > starts_at),
  constraint coupons_percent_limit check (discount_type <> 'percent' or discount_value <= 100)
);

create index if not exists coupons_code_lookup_idx on public.coupons(lower(code));

alter table public.coupons enable row level security;
revoke all on table public.coupons from anon, authenticated;
grant select, insert, update, delete on table public.coupons to authenticated;

drop policy if exists "admins manage coupons" on public.coupons;
create policy "admins manage coupons"
  on public.coupons for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Validação pública sem expor a tabela de cupons ao cliente.
-- O retorno contém apenas o resultado necessário para calcular o desconto.
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns table (
  valid boolean,
  coupon_id uuid,
  normalized_code text,
  discount_type text,
  discount_value numeric,
  discount_amount numeric,
  message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon public.coupons%rowtype;
  v_subtotal numeric := greatest(coalesce(p_subtotal, 0), 0);
  v_discount numeric := 0;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_code = '' then
    return query select false, null::uuid, v_code, null::text, null::numeric, 0::numeric, 'Informe um cupom.';
    return;
  end if;

  select * into v_coupon
  from public.coupons
  where upper(code) = v_code
    and active = true
  limit 1;

  if not found then
    return query select false, null::uuid, v_code, null::text, null::numeric, 0::numeric, 'Cupom inválido ou inexistente.';
    return;
  end if;

  if v_coupon.starts_at > now() or v_coupon.ends_at < now() then
    return query select false, v_coupon.id, v_coupon.code, v_coupon.discount_type, v_coupon.discount_value, 0::numeric, 'Este cupom está fora do período de validade.';
    return;
  end if;

  if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then
    return query select false, v_coupon.id, v_coupon.code, v_coupon.discount_type, v_coupon.discount_value, 0::numeric, 'Este cupom atingiu o limite de utilizações.';
    return;
  end if;

  if v_subtotal < v_coupon.min_cart_total then
    return query select false, v_coupon.id, v_coupon.code, v_coupon.discount_type, v_coupon.discount_value, 0::numeric,
      format('O valor mínimo para utilizar este cupom é R$ %s.', replace(to_char(v_coupon.min_cart_total, 'FM999999990D00'), '.', ','));
    return;
  end if;

  if v_coupon.discount_type = 'percent' then
    v_discount := round(v_subtotal * v_coupon.discount_value / 100, 2);
  else
    v_discount := v_coupon.discount_value;
  end if;

  v_discount := least(greatest(v_discount, 0), v_subtotal);

  return query select true, v_coupon.id, v_coupon.code, v_coupon.discount_type, v_coupon.discount_value, v_discount, 'Cupom aplicado com sucesso.';
end;
$$;

revoke all on function public.validate_coupon(text, numeric) from public;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;
