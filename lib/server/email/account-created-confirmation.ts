import { getSiteUrl } from '../env';
import { button, escapeHtml, note, paragraph, renderEmail } from './layout';

export type AccountCreatedConfirmationEmail = { subject: string; html: string };

export function renderAccountCreatedConfirmation(data: Record<string, unknown>): AccountCreatedConfirmationEmail {
  const site = getSiteUrl();
  const name = String(data.name || '').trim().split(/\s+/)[0] || 'cliente';
  const confirmUrl = String(data.confirmUrl || `${site}/conta`);
  const subject = 'Confirme seu e-mail na 2P Box';

  const html = renderEmail({
    subject,
    preheader: 'Confirme seu e-mail para ativar seu acesso à 2P Box.',
    eyebrow: 'BEM-VINDO À 2P BOX',
    title: 'Confirme seu e-mail',
    body: `${paragraph(`Olá, <strong>${escapeHtml(name)}</strong>! Sua conta na 2P Box foi criada com sucesso.`)}
      ${paragraph('Para ativar seu acesso e entrar na sua conta, confirme seu endereço de e-mail pelo botão abaixo.')}
      ${button('Confirmar meu e-mail', confirmUrl)}
      ${note('Se você não criou esta conta, ignore este e-mail com segurança.', 'warn')}`,
  });

  return { subject, html };
}
