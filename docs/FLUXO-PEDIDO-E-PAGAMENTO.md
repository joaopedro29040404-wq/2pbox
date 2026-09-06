# 2P Box — fluxo oficial de pedido e pagamento

## 1. Entrada

```text
LOJA
  ↓
CARRINHO
  ↓
ESCOLHA DA FORMA DE RECEBIMENTO
  ├─ Retirada na loja
  │    ↓
  │  CHECKOUT
  │    ↓
  │  cria pedido no Supabase (pending)
  │    ↓
  │  cria preferência Mercado Pago
  │    ↓
  │  Payment Brick
  │    ├─ Cartão
  │    ├─ Pix
  │    ├─ Boleto/outros métodos disponíveis
  │    └─ Conta Mercado Pago, quando habilitada pela preferência
  │
  └─ Entrega / frete pelo WhatsApp
       ↓
     CHECKOUT + endereço
       ↓
     cria pedido no Supabase (pending)
       ↓
     envia pedido + endereço ao WhatsApp
       ↓
     frete é combinado fora do pagamento automático
```

## 2. Pagamento com Mercado Pago

```text
Payment Brick
   ↓
POST /api/mercadopago/create-payment
   ↓
Mercado Pago /v1/payments
   ↓
┌──────────────┬─────────────────┬──────────────────┐
│ approved     │ pending/in_proc │ rejected/cancel. │
│              │                │                  │
│ pagamento    │ aguarda        │ pagamento        │
│ aprovado     │ confirmação    │ recusado         │
└──────┬───────┴───────┬────────┴────────┬─────────┘
       ↓                ↓                 ↓
 order=confirmed   order=pending    order=cancelled
       ↓                ↓                 ↓
 estoque mantido   continua polling  estoque devolvido
       ↓                ↓                 ↓
 tela de sucesso   status em tempo   tela de recusa
                    real
```

## 3. Fonte do status

**Webhook do Mercado Pago é a fonte oficial.**

1. Mercado Pago envia `payment` para `/api/mercadopago/webhook`.
2. O servidor consulta o pagamento pelo ID recebido.
3. `syncOrderPayment` valida a referência externa do pedido.
4. A função SQL `sync_order_payment_state` trava o pedido, evita regressões e atualiza pagamento + pedido atomicamente.
5. Se o pagamento for recusado/cancelado, o estoque reservado no momento da criação do pedido é devolvido uma única vez.
6. As telas fazem polling curto como fallback, para o usuário não precisar recarregar a página enquanto o webhook chega.

## 4. Telas que acompanham o mesmo estado

- `/checkout`: pagamento e resultado inicial.
- `/pagamento/[id]`: confirmação, recusa ou processamento.
- `/pedido/[id]`: pedido completo, pagamento e linha do tempo.
- `/acompanhar-pedido`: localização do pedido sem login.
- `/conta`: histórico do cliente e status de pagamento.
- `/admin/pedidos`: operação da loja; atualiza por Supabase Realtime + polling de segurança.

## 5. Compra sem login

O pedido é vinculado ao e-mail informado no checkout. O cliente pode abrir `/pedido/[id]` e informar o mesmo e-mail para acompanhar o pedido sem criar conta.

O e-mail e o último ID do pedido também são mantidos localmente no dispositivo para facilitar o retorno à página de acompanhamento.

## 6. Estados visíveis

### Pagamento

- `pending` — Aguardando pagamento
- `in_process` — Pagamento em análise
- `authorized` — Pagamento autorizado
- `approved` — Pagamento aprovado
- `rejected` — Pagamento recusado
- `cancelled` — Pagamento cancelado

### Pedido

- `pending` — Pedido recebido / aguardando pagamento
- `confirmed` — Pagamento confirmado
- `preparing` — Em preparação
- `ready` — Pronto para retirada
- `completed` — Pedido concluído
- `cancelled` — Pedido cancelado/recusado

## 7. Regras importantes

- Uma aprovação já registrada não pode ser sobrescrita por um webhook atrasado de `pending`.
- Um pagamento recusado/cancelado não volta para `pending` por uma notificação atrasada do mesmo pagamento.
- O estoque é devolvido apenas uma vez para cada pedido cancelado.
- O `external_reference` do Mercado Pago é o ID do pedido 2P Box.
- O cartão nunca é armazenado pela 2P Box; o Payment Brick gera o token e envia os dados necessários ao backend.
- O `SUPABASE_SERVICE_ROLE_KEY` permanece exclusivamente no servidor.
