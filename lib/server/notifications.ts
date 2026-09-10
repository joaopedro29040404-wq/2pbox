import { isEmailEnabled } from './env';
import { publishSafe, isQueueConfigured } from './rabbitmq';
import { QUEUES, type EmailJob, type EmailTemplateId } from './queues';

export type EnqueueEmailInput = {
  template: EmailTemplateId;
  to: string;
  data?: Record<string, unknown>;
  dedupeKey?: string;
};

export async function enqueueEmail({ template, to, data = {}, dedupeKey }: EnqueueEmailInput) {
  const recipient = String(to || '').trim().toLowerCase();
  if (!recipient.includes('@')) return false;
  if (!isEmailEnabled()) return false;

  const job: EmailJob = {
    kind: 'email',
    template,
    to: recipient,
    data: { ...data, to: recipient },
    dedupeKey: dedupeKey || `${template}:${recipient}`,
  };

  if (isQueueConfigured()) {
    const published = await publishSafe(QUEUES.email, job, { messageId: job.dedupeKey });
    if (published) return true;
  }

  const { deliverEmailJob } = await import('./email/deliver');
  await deliverEmailJob(job).catch((error) => console.error('[email] envio direto falhou:', error));
  return true;
}

export function paymentEmailTemplate(paymentStatus: string): EmailTemplateId | null {
  switch (String(paymentStatus || '').toLowerCase()) {
    case 'approved':
      return 'payment_confirmed';
    case 'rejected':
      return 'payment_rejected';
    case 'cancelled':
      return 'payment_cancelled';
    case 'pending':
    case 'in_process':
    case 'authorized':
      return 'payment_pending';
    default:
      return null;
  }
}
