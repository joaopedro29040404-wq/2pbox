alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists cost numeric(12,2) not null default 0;
create unique index if not exists products_barcode_unique on public.products(barcode) where barcode is not null and barcode <> '';
