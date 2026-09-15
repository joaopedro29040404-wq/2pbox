alter table public.store_settings
  add column if not exists delivery_express_price_table jsonb default '[]'::jsonb,
  add column if not exists delivery_express_max_km numeric(6,2) default 12;

-- O envio imediato passa a usar distância + tabela própria, sem alterar
-- a tabela da entrega no mesmo dia. O antigo delivery_express_fee é mantido
-- apenas para compatibilidade com instalações antigas.
