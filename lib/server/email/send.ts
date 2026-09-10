import { Resend } from 'resend';
import { getEmailFrom, getEmailReplyTo, getResendKey } from '../env';

let client: Resend | null = null;

function getClient() {
  if (client) return client;
  const key = getResendKey();
  if (!key) return null;
  client = new Resend(key);
  return client;
}

export type SendEmailInput = { to: string; subject: string; html: string; tags?: Record<string, string> };

export async function sendEmail({ to, subject, html, tags }: SendEmailInput) {
  const resend = getClient();
  if (!resend) throw new Error('RESEND_KEY não configurado.');

  const replyTo = getEmailReplyTo();
  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to: [to],
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(tags ? { tags: Object.entries(tags).map(([name, value]) => ({ name, value })) } : {}),
  });

  if (error) throw new Error(`Resend: ${error.message || 'falha no envio'}`);
  return { id: data?.id || null };
}
