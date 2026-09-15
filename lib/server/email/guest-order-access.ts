import { getSiteUrl } from '../env';
import { button, escapeHtml, note, paragraph, renderEmail, shortOrderId } from './layout';

export type GuestOrderAccessEmail = { subject: string; html: string };

export function renderGuestOrderAccess(data: Record<string, unknown>): GuestOrderAccessEmail {
  const orderId = String(data.orderId || '');
  const name = String(data.name || '').trim().split(/\s+/)[0] || 'cliente';
  const accessUrl = String(data.accessUrl || `${getSiteUrl()}/conta`);
  const subject = `Acesse seu pedido #${shortOrderId(orderId)} na 2P Box`;
  const html = renderEmail({
    subject,
    preheader: 'Seu acesso seguro aos pedidos da 2P Box está pronto.',
    eyebrow: 'ACESSO AOS SEUS PEDIDOS',
    title: 'Seu pedido está pronto para acompanhamento',
    body: `${paragraph(`Olá, <strong>${escapeHtml(name)}</strong>! Recebemos seu pedido <strong>#${shortOrderId(orderId)}</strong> na 2P Box.`)}
      ${paragraph('Para acompanhar o pedido e acessar sua área do cliente, clique no botão abaixo. O acesso é protegido pelo sistema de autenticação da 2P Box.')}
      ${button('Acompanhar meu pedido', accessUrl)}
      ${note('Se você não fez esta compra, ignore este e-mail com segurança. Não compartilhe este link com outras pessoas.', 'warn')}`,
  });

  return { subject, html };
}
