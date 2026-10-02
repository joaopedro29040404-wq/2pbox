-- Endurecimento de acesso (2026-10-02).
--
-- 1. Políticas permissivas: davam a QUALQUER usuário logado (role authenticated)
--    poder de alterar e apagar produtos e categorias, ler e alterar todos os
--    pedidos e itens, e a anon/authenticated poder de inserir pedidos e itens
--    direto na tabela. Continuam valendo as políticas certas:
--    "admins manage ..." (is_admin()), a leitura pública do catálogo ativo e a
--    leitura dos próprios pedidos pelo cliente. O checkout não usa estas
--    políticas: as funções create_order_with_stock* são SECURITY DEFINER do
--    postgres (BYPASSRLS). As rotas do servidor usam a chave secreta.
drop policy if exists "Admins can delete products" on public.products;
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Admins can update products" on public.products;

drop policy if exists "Admins can delete categories" on public.categories;
drop policy if exists "Admins can insert categories" on public.categories;
drop policy if exists "Admins can update categories" on public.categories;

drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Admins can view orders" on public.orders;
drop policy if exists "Anyone can create orders" on public.orders;

drop policy if exists "Admins can view order items" on public.order_items;
drop policy if exists "Anyone can create order items" on public.order_items;

-- 2. Funções de sincronização do pagamento: qualquer visitante (anon) podia
--    chamá-las pela API e marcar um pedido como pago. Só o servidor
--    (service_role, chave secreta) as usa (lib/server/mercadopago.ts).
revoke execute on function public.sync_order_payment_state(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.sync_order_payment_state_v2(uuid, text, text, text, text, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.sync_order_payment_state(uuid, text, text, text, text) to service_role;
grant execute on function public.sync_order_payment_state_v2(uuid, text, text, text, text, text, integer, numeric) to service_role;
