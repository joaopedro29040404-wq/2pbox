import { getSiteUrl } from '../env';
import type { EmailTemplateId } from '../queues';
import {
  BRAND,
  button,
  dataRows,
  escapeHtml,
  formatDate,
  itemsTable,
  money,
  note,
  panel,
  paragraph,
  renderEmail,
  shortOrderId,
  stepper,
} from './layout';

export type RenderedEmail = { subject: string; html: string };

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pedido recebido',
  confirmed: 'Pagamento confirmado',
  preparing: 'Em preparação',
  ready: 'Pronto para retirada',
  completed: 'Pedido concluído',
  cancelled: 'Pedido cancelado',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pagamento aprovado',
  failed: 'Pagamento não aprovado',
  refunded: 'Pagamento estornado',
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  bank_transfer: 'Pix',
  pix: 'Pix',
  ticket: 'Boleto',
  account_money: 'Saldo Mercado Pago',
};

export function orderStatusLabel(status: unknown) {
  const key = String(status || '').toLowerCase();
  return ORDER_STATUS_LABELS[key] || key || 'Pedido recebido';
}

export function paymentStatusLabel(status: unknown) {
  const key = String(status || '').toLowerCase();
  return PAYMENT_STATUS_LABELS[key] || key || 'Aguardando pagamento';
}

export function paymentMethodLabel(type: unknown, method: unknown) {
  const key = String(type || '').toLowerCase();
  const label = PAYMENT_TYPE_LABELS[key];
  const brand = String(method || '').toUpperCase();
  if (label && brand && key.includes('card')) return `${label} · ${brand}`;
  return label || brand || 'Mercado Pago';
}

type OrderData = {
  id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  total?: number;
  status?: string;
  payment_status?: string;
  payment_id?: string;
  payment_method?: string;
  payment_type?: string;
  payment_installments?: number;
  payment_amount?: number;
  paid_at?: string;
  created_at?: string;
  delivery_type?: string;
  delivery_address?: Record<string, unknown> | string | null;
  notes?: string;
};

type TemplateData = Record<string, any>;

function firstName(value: unknown) {
  const name = String(value || '').trim();
  return name ? name.split(/\s+/)[0] : 'cliente';
}

function orderUrl(order: OrderData) {
  const site = getSiteUrl();
  const email = String(order.customer_email || '').trim();
  const query = email ? `?email=${encodeURIComponent(email)}` : '';
  return `${site}/pedido/${encodeURIComponent(String(order.id || ''))}${query}`;
}

function formatAddress(address: OrderData['delivery_address']) {
  if (!address) return '';
  if (typeof address === 'string') return escapeHtml(address);
  const a = address as Record<string, string>;
  const line1 = [a.street, a.number].filter(Boolean).join(', ');
  const line2 = [a.complement].filter(Boolean).join('');
  const line3 = [a.neighborhood, [a.city, a.state].filter(Boolean).join('/')].filter(Boolean).join(' — ');
  const line4 = a.postal_code ? `CEP: ${a.postal_code}` : '';
  return [line1, line2, line3, line4].filter(Boolean).map(escapeHtml).join('<br />');
}

function deliveryLabel(order: OrderData) {
  return order.delivery_type === 'pickup' ? 'Retirada na loja' : 'Entrega — frete pelo WhatsApp';
}

function billingBlock(order: OrderData) {
  const rows: Array<[string, string]> = [
    ['Pedido', `#${shortOrderId(order.id)}`],
    ['Data', escapeHtml(formatDate(order.created_at))],
    ['Forma de pagamento', escapeHtml(paymentMethodLabel(order.payment_type, order.payment_method))],
    ['Parcelamento', order.payment_installments && order.payment_installments > 1 ? `${order.payment_installments}x` : 'À vista'],
    ['Valor cobrado', money(order.payment_amount || order.total)],
    ['Status do pagamento', escapeHtml(paymentStatusLabel(order.payment_status))],
    ['Identificador do pagamento', order.payment_id ? escapeHtml(order.payment_id) : ''],
    ['Recebimento', escapeHtml(deliveryLabel(order))],
  ];
  return dataRows(rows);
}

function orderSummary(order: OrderData, items: any[] = []) {
  const address = formatAddress(order.delivery_address);
  return `${itemsTable(items, order.total)}
  ${panel(billingBlock(order))}
  ${
    address
      ? panel(
          `<p style="margin:0 0 8px;font:900 10px/1 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">Endereço de entrega</p>
           <p style="margin:0;font:400 13px/1.7 Arial,Helvetica,sans-serif;color:#4d4d4d;">${address}</p>`,
        )
      : ''
  }`;
}

const templates: Record<EmailTemplateId, (data: TemplateData) => RenderedEmail> = {
  account_created: (data) => {
    const site = getSiteUrl();
    const html = renderEmail({
      subject: 'Sua conta 2P Box está pronta',
      preheader: 'Acompanhe pedidos, favoritos e endereços em um só lugar.',
      eyebrow: 'BEM-VINDO À 2P BOX',
      title: 'Sua conta está pronta',
      body: `${paragraph(`Olá, <strong>${escapeHtml(firstName(data.name))}</strong>! Sua conta na 2P Box foi criada com sucesso.`)}
        ${paragraph('Agora você acompanha seus pedidos em tempo real, salva produtos favoritos e finaliza compras mais rápido.')}
        ${panel(
          dataRows([
            ['E-mail de acesso', escapeHtml(data.to || data.email || '')],
            ['Área do cliente', `<a href="${site}/conta" style="color:${BRAND.ink};">2pbox.com.br/conta</a>`],
          ]),
        )}
        ${button('Acessar minha conta', `${site}/conta`)}${button('Ver a loja', `${site}/loja`, 'ghost')}
        ${note('Se você não criou esta conta, ignore este e-mail com segurança.')}`,
    });
    return { subject: 'Sua conta 2P Box está pronta', html };
  },

  password_reset: (data) => {
    const site = getSiteUrl();
    const link = String(data.resetUrl || `${site}/conta`);
    const html = renderEmail({
      subject: 'Redefinir sua senha — 2P Box',
      preheader: 'Use o link para cadastrar uma nova senha de acesso.',
      eyebrow: 'SEGURANÇA DA CONTA',
      title: 'Redefinir sua senha',
      body: `${paragraph(`Olá, <strong>${escapeHtml(firstName(data.name))}</strong>. Recebemos um pedido para redefinir a senha da sua conta 2P Box.`)}
        ${paragraph('Clique no botão abaixo para cadastrar uma nova senha. O link é pessoal e expira em 1 hora.')}
        ${button('Criar nova senha', link)}
        ${note('Se você não solicitou a redefinição, nenhuma ação é necessária — sua senha atual continua válida.', 'warn')}`,
    });
    return { subject: 'Redefinir sua senha — 2P Box', html };
  },

  payment_received: (data) => {
    const order = (data.order || {}) as OrderData;
    const subject = `Recebemos seu pagamento — pedido #${shortOrderId(order.id)}`;
    const html = renderEmail({
      subject,
      preheader: 'Estamos confirmando o pagamento junto ao Mercado Pago.',
      eyebrow: 'PAGAMENTO REALIZADO',
      title: 'Recebemos seu pagamento',
      body: `${paragraph(`Olá, <strong>${escapeHtml(firstName(order.customer_name))}</strong>! Recebemos o pagamento do seu pedido <strong>#${shortOrderId(order.id)}</strong>.`)}
        ${paragraph('Assim que o Mercado Pago concluir a confirmação, avisamos você por e-mail e o pedido segue para separação.')}
        ${stepper('pending')}
        ${orderSummary(order, data.items || [])}
        ${button('Acompanhar pedido', orderUrl(order))}`,
    });
    return { subject, html };
  },

  payment_confirmed: (data) => {
    const order = (data.order || {}) as OrderData;
    const subject = `Pagamento confirmado — pedido #${shortOrderId(order.id)}`;
    const html = renderEmail({
      subject,
      preheader: 'Seu pagamento foi aprovado e o pedido já está em preparação.',
      eyebrow: 'PAGAMENTO CONFIRMADO',
      title: 'Pagamento aprovado!',
      body: `${note(`<strong>Tudo certo, ${escapeHtml(firstName(order.customer_name))}!</strong> O pagamento do pedido <strong>#${shortOrderId(order.id)}</strong> foi aprovado.`, 'success')}
        ${paragraph('Já estamos preparando seus produtos. Você receberá um novo e-mail a cada mudança de status do pedido.')}
        ${stepper('confirmed')}
        ${orderSummary(order, data.items || [])}
        ${button('Acompanhar pedido', orderUrl(order))}`,
    });
    return { subject, html };
  },

  payment_pending: (data) => {
    const order = (data.order || {}) as OrderData;
    const subject = `Pagamento pendente — pedido #${shortOrderId(order.id)}`;
    const html = renderEmail({
      subject,
      preheader: 'Estamos aguardando a confirmação do pagamento.',
      eyebrow: 'PAGAMENTO PENDENTE',
      title: 'Aguardando confirmação',
      body: `${paragraph(`Olá, <strong>${escapeHtml(firstName(order.customer_name))}</strong>. O pagamento do pedido <strong>#${shortOrderId(order.id)}</strong> ainda não foi confirmado pelo Mercado Pago.`)}
        ${note('Pagamentos por Pix e boleto podem levar alguns minutos para serem processados. Você não precisa fazer nada — assim que confirmar, avisamos por e-mail.', 'warn')}
        ${stepper('pending')}
        ${orderSummary(order, data.items || [])}
        ${button('Ver status em tempo real', orderUrl(order))}`,
    });
    return { subject, html };
  },

  payment_rejected: (data) => {
    const order = (data.order || {}) as OrderData;
    const site = getSiteUrl();
    const subject = `Pagamento recusado — pedido #${shortOrderId(order.id)}`;
    const html = renderEmail({
      subject,
      preheader: 'O pagamento não foi aprovado. Você pode tentar novamente.',
      eyebrow: 'PAGAMENTO RECUSADO',
      title: 'Pagamento não aprovado',
      accent: '#c62828',
      body: `${note(`O pagamento do pedido <strong>#${shortOrderId(order.id)}</strong> foi recusado pela operadora.`, 'danger')}
        ${paragraph('Isso costuma acontecer por limite indisponível, dados divergentes do cartão ou bloqueio preventivo do banco. Você pode tentar novamente com outro cartão ou pagar por Pix.')}
        ${panel(dataRows([['Motivo informado', escapeHtml(data.statusDetail || 'Não informado pelo Mercado Pago')], ['Valor', money(order.total)]]))}
        ${button('Tentar novamente', `${site}/loja`)}${button('Ver pedido', orderUrl(order), 'ghost')}`,
    });
    return { subject, html };
  },

  payment_cancelled: (data) => {
    const order = (data.order || {}) as OrderData;
    const site = getSiteUrl();
    const subject = `Pagamento cancelado — pedido #${shortOrderId(order.id)}`;
    const html = renderEmail({
      subject,
      preheader: 'O pagamento deste pedido foi cancelado.',
      eyebrow: 'PAGAMENTO CANCELADO',
      title: 'Pagamento cancelado',
      accent: '#c62828',
      body: `${note(`O pagamento do pedido <strong>#${shortOrderId(order.id)}</strong> foi cancelado e o pedido não seguirá para separação.`, 'danger')}
        ${paragraph('Se o valor chegou a ser debitado, o estorno é feito automaticamente pelo Mercado Pago conforme o prazo da sua instituição financeira.')}
        ${panel(dataRows([['Pedido', `#${shortOrderId(order.id)}`], ['Valor', money(order.total)], ['Data', escapeHtml(formatDate(order.created_at))]]))}
        ${button('Fazer um novo pedido', `${site}/loja`)}`,
    });
    return { subject, html };
  },

  order_status_updated: (data) => {
    const order = (data.order || {}) as OrderData;
    const status = String(data.status || order.status || 'pending');
    const subject = `${orderStatusLabel(status)} — pedido #${shortOrderId(order.id)}`;
    const html = renderEmail({
      subject,
      preheader: `Seu pedido mudou para: ${orderStatusLabel(status)}.`,
      eyebrow: 'ACOMPANHAMENTO DO PEDIDO',
      title: orderStatusLabel(status),
      body: `${paragraph(`Olá, <strong>${escapeHtml(firstName(order.customer_name))}</strong>. Seu pedido <strong>#${shortOrderId(order.id)}</strong> foi atualizado.`)}
        ${stepper(status)}
        ${panel(
          dataRows([
            ['Status atual', escapeHtml(orderStatusLabel(status))],
            ['Status anterior', data.previousStatus ? escapeHtml(orderStatusLabel(data.previousStatus)) : ''],
            ['Pagamento', escapeHtml(paymentStatusLabel(order.payment_status))],
            ['Atualizado em', escapeHtml(formatDate(data.changedAt))],
          ]),
        )}
        ${data.note ? note(escapeHtml(data.note)) : ''}
        ${button('Ver acompanhamento completo', orderUrl(order))}`,
    });
    return { subject, html };
  },

  order_details: (data) => {
    const order = (data.order || {}) as OrderData;
    const subject = `Detalhes do seu pedido #${shortOrderId(order.id)}`;
    const html = renderEmail({
      subject,
      preheader: 'Resumo completo do seu pedido na 2P Box.',
      eyebrow: 'RESUMO DO PEDIDO',
      title: `Pedido #${shortOrderId(order.id)}`,
      body: `${paragraph(`Olá, <strong>${escapeHtml(firstName(order.customer_name))}</strong>. Aqui está o resumo completo do seu pedido na 2P Box.`)}
        ${stepper(String(order.status || 'pending'))}
        ${orderSummary(order, data.items || [])}
        ${order.notes ? panel(`<p style="margin:0 0 6px;font:900 10px/1 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">Observações</p><p style="margin:0;font:400 13px/1.7 Arial,Helvetica,sans-serif;color:#4d4d4d;">${escapeHtml(order.notes)}</p>`) : ''}
        ${button('Acompanhar pedido', orderUrl(order))}`,
    });
    return { subject, html };
  },

  cart_reminder: (data) => {
    const site = getSiteUrl();
    const items = Array.isArray(data.items) ? data.items : [];
    const subject = 'Ainda há produtos no seu carrinho';
    const html = renderEmail({
      subject,
      preheader: 'Seus produtos continuam separados. Finalize quando quiser.',
      eyebrow: 'SEU CARRINHO 2P BOX',
      title: 'Você esqueceu algo',
      body: `${paragraph(`Olá, <strong>${escapeHtml(firstName(data.name))}</strong>! Notamos que você deixou produtos no carrinho da 2P Box.`)}
        ${paragraph('Eles continuam disponíveis — é só finalizar o pedido para garantir.')}
        ${itemsTable(
          items.map((item: any) => ({ product_name: item.name || item.product_name, quantity: item.quantity, unit_price: item.price ?? item.unit_price })),
          data.total,
        )}
        ${button('Finalizar meu pedido', `${site}/carrinho`)}${button('Continuar comprando', `${site}/loja`, 'ghost')}
        ${note('Os itens do carrinho não ficam reservados. A disponibilidade depende do estoque no momento da compra.')}`,
    });
    return { subject, html };
  },
};

export function renderTemplate(template: EmailTemplateId, data: TemplateData): RenderedEmail {
  const render = templates[template];
  if (!render) throw new Error(`Template de e-mail desconhecido: ${template}`);
  return render(data);
}
