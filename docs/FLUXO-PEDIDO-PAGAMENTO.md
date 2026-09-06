# 2P Box — Fluxo oficial de pedido e pagamento

## Fluxograma

```text
CLIENTE
  │
  ├─ Carrinho
  │    └─ Escolhe recebimento
  │
  ├─ RETIRADA NA LOJA
  │    │
  │    ├─ Checkout: dados do cliente
  │    ├─ Cria pedido no Supabase
  │    │    └─ status = pending
  │    ├─ Cria preferência Mercado Pago
  │    ├─ Payment Brick
  │    │    ├─ Cartão
  │    │    ├─ Pix
  │    │    ├─ Boleto/outros meios disponíveis
  │    │    └─ Conta Mercado Pago
  │    │
  │    ├─ Mercado Pago cria/atualiza pagamento
  │    │    ├─ approved ───────► payment_status=approved
  │    │    │                     status=confirmed
  │    │    ├─ pending/in_process ► payment_status=pending/in_process
  │    │    │                     status=pending
  │    │    └─ rejected/cancelled ► payment_status=rejected/cancelled
  │    │                          status=cancelled
  │    │
  │    └─ Webhook ──► sincroniza Supabase ──► telas atualizam automaticamente
  │
  └─ ENTREGA / FRETE VIA WHATSAPP
       │
       ├─ Checkout: dados + endereço
       ├─ Cria pedido no Supabase
       │    └─ status = pending
       ├─ Abre WhatsApp para cálculo do frete
       └─ Pagamento fica para o fluxo definido após o frete

STATUS DO PEDIDO

pending → confirmed → preparing → ready → completed
   │
   └──────────────────────────────► cancelled

STATUS DO PAGAMENTO

pending / in_process / authorized
             │
       ┌─────┴─────┐
       ▼           ▼
   approved    rejected/cancelled
       │           │
       ▼           ▼
  confirmed    cancelled
```

## Regra de fonte da verdade

1. O **Mercado Pago** é a fonte do status financeiro.
2. O **webhook** é o mecanismo principal de sincronização.
3. O endpoint de status consulta o Mercado Pago novamente como fallback, para evitar que uma demora no webhook deixe a tela desatualizada durante os testes.
4. O **Supabase `orders`** guarda o estado consolidado que as telas da 2P Box exibem.
5. Nenhuma tela deve considerar o pagamento aprovado apenas porque o cliente chegou à página de pagamento.

## Telas que acompanham o estado

- `/checkout`: coleta dados e renderiza o Payment Brick.
- `/pagamento/[id]`: confirmação, recusa ou processamento do pagamento.
- `/pedido/[id]`: acompanhamento do pedido, pagamento e etapas operacionais.
- `/acompanhar-pedido`: entrada pública para cliente sem login.
- `/conta`: histórico do cliente, incluindo compras feitas como convidado pelo mesmo e-mail.
- `/admin/pedidos`: visão operacional da loja com atualização em tempo real + fallback periódico.

## Cartões de teste Mercado Pago

- `5480 8328 0103 3311` — Mastercard — CVV `123` — validade `11/30`
- `APRO` + CPF `12345678909` → aprovado
- `OTHE` + CPF `12345678909` → recusado
- `CONT` → pendente
- `FUND` → recusado por quantia insuficiente
- `SECU` → recusado por código de segurança

## Regras de segurança

- Access Token somente no backend/Vercel.
- `SUPABASE_SERVICE_ROLE_KEY` somente no backend.
- O `external_reference` do Mercado Pago precisa ser exatamente o ID do pedido.
- O webhook pode validar `MERCADOPAGO_WEBHOOK_SECRET` quando essa variável estiver configurada.
- O sistema não deve aceitar atualização de um pagamento que não pertença ao pedido informado.
- Uma aprovação já consolidada não deve ser rebaixada por uma consulta atrasada de outro pagamento pendente/recusado.
