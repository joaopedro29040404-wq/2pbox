<!-- BEGIN:nextjs-agent-rules -->

**# This is NOT the Next.js you know**

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify it from `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with the work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Regras para agentes de código

## 1. Regra crítica: integrações de pagamento

**NÃO ALTERE, CRIE, REMOVA, MIGRE, REFATORE OU RECONFIGURE NADA RELACIONADO A PAGAMENTOS.**

Esta regra tem prioridade sobre qualquer outra instrução da tarefa.

O agente **não deve modificar diretamente** qualquer código, configuração ou comportamento relacionado a:

* Mercado Pago
* Pagar.me
* Stripe
* Checkout
* Payment / Payments
* Payment Intent
* Pix
* Cartão de crédito ou débito
* Split de pagamento
* OAuth de gateways
* Webhooks de pagamento
* APIs ou SDKs de gateways
* Credenciais, tokens, secrets ou access tokens de pagamento
* Taxas de pagamento
* Repasse/comissionamento
* Captura, autorização ou estorno de pagamentos
* Status de pagamento
* Conciliação financeira
* Fluxos de aprovação/recusa de pagamento
* Integrações com adquirentes, subadquirentes ou gateways
* Variáveis de ambiente relacionadas a pagamento
* Endpoints de pagamento
* Serviços, hooks, controllers, routes ou repositories responsáveis por pagamentos
* Banco de dados/tabelas/colunas cujo objetivo seja exclusivamente suportar pagamentos
* Dependências ou versões de bibliotecas utilizadas especificamente pela integração de pagamento

### 1.1. Não faça alterações indiretas

Mesmo que a alteração de pagamento pareça necessária para concluir a tarefa, **não faça a alteração**.

Exemplos:

* Não altere um checkout porque a tela foi modificada.
* Não atualize um SDK de pagamento porque existe uma versão nova.
* Não altere um webhook porque encontrou um possível problema.
* Não modifique uma variável de ambiente de pagamento.
* Não altere contratos, payloads ou tipos usados pela integração.
* Não "aproveite" a tarefa para corrigir bugs no pagamento.
* Não faça refactors em arquivos de pagamento para melhorar a arquitetura.
* Não substitua uma biblioteca de pagamento.
* Não altere configurações de split, comissão ou recebimento.
* Não altere credenciais ou secrets.

**Se a tarefa exigir uma alteração nessa área, pare antes de modificar o código e registre a necessidade no final da resposta.**

---

## 2. Identificação de código relacionado a pagamento

Antes de modificar qualquer arquivo, avalie se ele possui relação direta ou indireta com pagamentos.

Se um arquivo misturar responsabilidades de negócio comuns com lógica de pagamento, **não altere a parte relacionada ao pagamento**.

Se não for possível realizar a alteração solicitada sem modificar a integração de pagamento:

1. Não faça a alteração de pagamento.
2. Faça somente as partes da tarefa que forem seguras.
3. Explique claramente o bloqueio.
4. Adicione a alteração necessária à seção `## Alterações de pagamento pendentes`.
5. Prepare uma mensagem pronta para envio pelo WhatsApp.

---

## 3. Não invente soluções para integrações protegidas

Se encontrar:

* bug;
* código incompatível;
* API desatualizada;
* erro de TypeScript;
* erro de build;
* problema de webhook;
* problema de checkout;
* problema de autenticação;
* problema de configuração;
* dependência desatualizada;

e isso estiver relacionado a pagamento, **não tente corrigir automaticamente**.

Apenas registre o problema.

O objetivo é impedir que uma tarefa aparentemente simples cause alterações não autorizadas no fluxo financeiro da aplicação.

---

## 4. Execução das tarefas

Para cada pedido:

1. Entenda o escopo solicitado.
2. Inspecione os arquivos relevantes.
3. Identifique possíveis dependências com pagamentos.
4. Execute somente as alterações permitidas.
5. Não altere integrações de pagamento.
6. Não faça refactors fora do escopo.
7. Não altere comportamento existente sem necessidade.
8. Execute os testes/builds relevantes quando possível.
9. Ao final, informe claramente o que foi alterado.
10. Caso exista qualquer necessidade relacionada a pagamento, registre-a na seção obrigatória abaixo.

---

## 5. Alterações de pagamento pendentes

**Sempre inclua esta seção no final da resposta.**

Se nenhuma alteração relacionada a pagamento for necessária:

> Nenhuma alteração de pagamento pendente.

Se houver necessidade, utilize este formato:

### Alterações de pagamento pendentes

**Item 1 — [Título curto]**

* **Arquivo/área:** `caminho/do/arquivo`
* **Problema:** descrição objetiva.
* **Alteração necessária:** descrição do que precisa ser feito.
* **Motivo:** por que a alteração é necessária.
* **Impacto:** o que pode ser afetado.
* **Risco:** baixo / médio / alto.
* **Observação:** qualquer informação relevante.

**Importante:** essas alterações devem ser apenas documentadas. **Não devem ser implementadas pelo agente.**

---

## 6. Mensagem para WhatsApp

Quando existir pelo menos uma alteração de pagamento pendente, gere também uma mensagem pronta para ser enviada ao responsável pelo WhatsApp:

**Número de destino:** `11963757171`

A mensagem deve:

* ser objetiva;
* explicar o que foi encontrado;
* explicar exatamente o que precisa ser alterado;
* informar os arquivos/áreas afetadas quando relevante;
* explicar o motivo;
* deixar claro que a alteração **não foi realizada** por causa da regra de proteção de pagamentos;
* ser escrita em português;
* estar pronta para copiar e enviar;
* não conter explicações internas sobre o funcionamento deste `AGENTS.md`.

Utilize este formato:

### Mensagem para WhatsApp — 11963757171

```text
Olá! Durante a implementação da tarefa, identifiquei uma alteração necessária na integração de pagamento que não foi realizada para preservar o fluxo atual de pagamentos.

[DESCREVER O QUE FOI IDENTIFICADO]

O que precisa ser feito:
- [ALTERAÇÃO 1]
- [ALTERAÇÃO 2]

Área/arquivo afetado:
[ARQUIVO OU ÁREA]

Motivo:
[MOTIVO]

A alteração ficou pendente e precisa ser realizada separadamente para evitar alterações não autorizadas na integração de pagamento.
```

Se houver múltiplos itens, consolide todos em **uma única mensagem**.

---

## 7. Regra de segurança

**Pagamento é uma área protegida.**

Na dúvida, **não altere**.

É preferível entregar parcialmente uma tarefa e reportar uma alteração de pagamento pendente do que modificar silenciosamente qualquer parte da infraestrutura financeira da aplicação.

**Nunca assuma autorização para alterar pagamentos apenas porque a alteração parece necessária, pequena, óbvia ou tecnicamente segura.**

A autorização para alterações de pagamento deve ocorrer separadamente.
