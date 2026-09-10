import type { EmailJob } from '../queues';
import { markProcessed } from '../redis';
import { supabaseRest } from '../supabase-admin';
import { sendEmail } from './send';
import { renderTemplate } from './templates';

async function recordEvent(job: EmailJob, status: 'sent' | 'failed', detail: string | null, providerId: string | null) {
  try {
    await supabaseRest('email_events', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        dedupe_key: job.dedupeKey || `${job.template}:${job.to}:${Date.now()}`,
        template: job.template,
        recipient: job.to,
        status,
        detail,
        provider_id: providerId,
      }),
    });
  } catch (error) {
    console.error('[email] não foi possível registrar o evento:', error);
  }
}

async function alreadyDelivered(dedupeKey: string) {
  try {
    const query = new URLSearchParams({ select: 'id', dedupe_key: `eq.${dedupeKey}`, status: 'eq.sent', limit: '1' });
    const rows = await supabaseRest(`email_events?${query.toString()}`);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function deliverEmailJob(job: EmailJob) {
  const dedupeKey = job.dedupeKey || `${job.template}:${job.to}`;

  const firstTime = await markProcessed(`email:${dedupeKey}`, 60 * 60 * 6);
  if (!firstTime) return { skipped: true as const, reason: 'duplicado' };
  if (await alreadyDelivered(dedupeKey)) return { skipped: true as const, reason: 'ja-enviado' };

  const { subject, html } = renderTemplate(job.template, job.data || {});

  try {
    const result = await sendEmail({ to: job.to, subject, html, tags: { template: job.template } });
    await recordEvent(job, 'sent', null, result.id);
    return { skipped: false as const, id: result.id };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await recordEvent(job, 'failed', detail, null);
    throw error;
  }
}
