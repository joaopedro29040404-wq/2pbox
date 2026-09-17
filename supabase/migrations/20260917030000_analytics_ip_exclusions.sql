-- 2P Box | Analytics IP blocking
-- Stores the source IP captured by the analytics endpoint so admins can block a whole network without typing its IP.

alter table public.analytics_events
  add column if not exists ip_address text;

create index if not exists analytics_events_ip_address_idx
  on public.analytics_events(ip_address);

create table if not exists public.analytics_excluded_ips (
  ip_address text primary key,
  label text,
  blocked_at timestamptz not null default now(),
  blocked_by uuid references auth.users(id) on delete set null
);

alter table public.analytics_excluded_ips enable row level security;
revoke all on public.analytics_excluded_ips from anon, authenticated;
revoke all on public.analytics_excluded_ips from public;
