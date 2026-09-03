# 2P Box

Plataforma de e-commerce da 2P Box — papelaria, eletrônicos e impressão.

## V1
- Loja online responsiva
- Catálogo por categorias
- Busca e detalhes de produto
- Carrinho
- Checkout com retirada na loja
- Opção de frete direcionada ao WhatsApp
- Área administrativa para produtos, categorias, estoque e pedidos
- Preparação para integração de pagamentos via Pagar.me

## Stack proposta
- Next.js + TypeScript
- Supabase (Postgres, Auth e Storage)
- Pagar.me para pagamentos
- Vercel para deploy

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Variáveis de ambiente

Crie `.env.local` com:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
PAGARME_API_KEY=
PAGARME_WEBHOOK_SECRET=
NEXT_PUBLIC_STORE_WHATSAPP=
```

> Nunca publique chaves secretas no GitHub. As chaves do Pagar.me devem ficar somente no ambiente do servidor/deploy.
