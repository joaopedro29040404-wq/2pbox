import type { Channel, ConsumeMessage } from 'amqplib';
import { createServer } from 'node:http';
import { deliverEmailJob } from '../lib/server/email/deliver';
import { isEmailEnabled } from '../lib/server/env';
import {
  fetchMercadoPagoResource,
  isMercadoPagoConfigured,
  normalizeOrderResource,
  resolveMercadoPagoPayment,
  syncOrderPayment,
} from '../lib/server/mercadopago';
import { notifyPaymentChange } from '../lib/server/orders';
import { enqueueEmail } from '../lib/server/notifications';
import { QUEUES, type EmailJob, type PaymentReconcileJob, type PaymentWebhookJob, type QueueJob } from '../lib/server/queues';
import { closeRabbit, getRabbitChannel, isQueueConfigured, publishSafe } from '../lib/server/rabbitmq';
import { acquireLock, closeRedis, releaseLock } from '../lib/server/redis';
import { supabaseRest } from '../lib/server/supabase-admin';

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5000;
const PREFETCH = Number(process.env.WORKER_PREFETCH || 8);
const RECONCILE_INTERVAL_MS = Number(process.env.WORKER_RECONCILE_INTERVAL_MS || 60_000);
const CART_INTERVAL_MS = Number(process.env.WORKER_CART_INTERVAL_MS || 15 * 60_000);
const CART_REMINDER_AFTER_MS = Number(process.env.CART_REMINDER_AFTER_MS || 3 * 60 * 60_000);
const HEALTH_PORT = Number(process.env.WORKER_HEALTH_PORT || 3001);
const NOTIFY_MAX_AGE_MS = Number(process.env.RECONCILE_NOTIFY_MAX_AGE_MS || 48 * 60 * 60_000);

let shuttingDown = false;
const timers: NodeJS.Timeout[] = [];

function log(level: 'info' | 'warn' | 'error', message: string, meta?: unknown) {
  const line = `[worker] ${message}`;
  if (level === 'error') console.error(line, meta ?? '');
  else if (level === 'warn') console.warn(line, meta ?? '');
  else console.info(line, meta ?? '');
}

async function markWebhookEvent(resourceId: string, status: string, detail: string | null, orderId: string | null) {
  try {
    const query = new URLSearchParams({ resource_id: `eq.${resourceId}`, status: 'eq.queued' });
    await supabaseRest(`webhook_events?${query.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status, detail, order_id: orderId, processed_at: new Date().toISOString() }),
    });
  } catch (error) {
    log('warn', 'não foi possível atualizar webhook_events', error);
  }
}

async function handlePaymentWebhook(job: PaymentWebhookJob) {
  if (!isMercadoPagoConfigured()) throw new Error('Mercado Pago não configurado.');

  const result = await fetchMercadoPagoResource(job.resourceType, job.resourceId);
  if (result.status === 404) {
    await markWebhookEvent(job.resourceId, 'ignored', 'Recurso não encontrado no Mercado Pago.', null);
    return;
  }
  if (!result.ok) throw new Error(`Mercado Pago respondeu HTTP ${result.status}.`);

  const resource = result.resource as any;
  const isOrder = job.resourceType === 'order' || resource?.type === 'online';
  const orderId = String(resource?.external_reference || '').trim();

  if (!orderId) {
    await markWebhookEvent(job.resourceId, 'ignored', 'Recurso sem external_reference.', null);
    return;
  }

  const payment = isOrder ? normalizeOrderResource(resource, orderId) : resource;
  if (!payment) {
    await markWebhookEvent(job.resourceId, 'ignored', 'Recurso sem pagamento associado.', orderId);
    return;
  }

  const lockKey = `order:${orderId}`;
  if (!(await acquireLock(lockKey, 30))) {
    throw new Error('Pedido já está sendo reconciliado por outro consumidor.');
  }

  try {
    const synced = await syncOrderPayment(orderId, { ...payment, external_reference: orderId });
    await markWebhookEvent(job.resourceId, 'processed', `payment_status=${synced.paymentStatus}`, orderId);
    if (synced.changed) await notifyPaymentChange(orderId, synced);
    log('info', 'webhook reconciliado', { orderId, paymentStatus: synced.paymentStatus, changed: synced.changed });
  } finally {
    await releaseLock(lockKey);
  }
}

async function handlePaymentReconcile(job: PaymentReconcileJob) {
  if (!isMercadoPagoConfigured()) throw new Error('Mercado Pago não configurado.');

  const lockKey = `order:${job.orderId}`;
  if (!(await acquireLock(lockKey, 30))) return;

  try {
    const payment = await resolveMercadoPagoPayment(job.orderId, { paymentId: job.paymentId || undefined });
    if (!payment) {
      log('info', 'nenhum pagamento encontrado no Mercado Pago', { orderId: job.orderId, reason: job.reason });
      return;
    }
    const synced = await syncOrderPayment(job.orderId, payment);
    const shouldNotify = job.notify !== false;
    if (synced.changed && shouldNotify) await notifyPaymentChange(job.orderId, synced);
    log('info', 'reconciliação concluída', {
      orderId: job.orderId,
      paymentStatus: synced.paymentStatus,
      changed: synced.changed,
      notified: synced.changed && shouldNotify,
    });
  } finally {
    await releaseLock(lockKey);
  }
}

async function handleEmail(job: EmailJob) {
  if (!isEmailEnabled()) {
    log('warn', 'RESEND_KEY ausente, e-mail descartado', { template: job.template });
    return;
  }
  const result = await deliverEmailJob(job);
  log('info', 'e-mail processado', { template: job.template, to: job.to, ...result });
}

async function dispatch(job: QueueJob) {
  switch (job.kind) {
    case 'payment_webhook':
      return handlePaymentWebhook(job);
    case 'payment_reconcile':
      return handlePaymentReconcile(job);
    case 'email':
      return handleEmail(job);
    default:
      log('warn', 'job desconhecido descartado', job);
  }
}

async function retry(queue: string, job: QueueJob, error: unknown) {
  const attempt = Number(job.attempt || 0) + 1;
  const message = error instanceof Error ? error.message : String(error);

  if (attempt >= MAX_ATTEMPTS) {
    log('error', `job descartado após ${attempt} tentativas em ${queue}`, message);
    if (job.kind === 'payment_webhook') await markWebhookEvent(job.resourceId, 'failed', message, null);
    return false;
  }

  const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
  log('warn', `reagendando job de ${queue} (tentativa ${attempt})`, message);
  const timer = setTimeout(() => {
    void publishSafe(queue, { ...job, attempt });
  }, delay);
  timer.unref();
  timers.push(timer);
  return true;
}

function consume(channel: Channel, queue: string) {
  return channel.consume(queue, async (message: ConsumeMessage | null) => {
    if (!message) return;
    let job: QueueJob | null = null;
    try {
      job = JSON.parse(message.content.toString()) as QueueJob;
      await dispatch(job);
      channel.ack(message);
    } catch (error) {
      channel.ack(message);
      if (job) await retry(queue, job, error);
      else log('error', `mensagem inválida em ${queue}`, error);
    }
  });
}

async function reconcilePendingOrders() {
  if (shuttingDown || !isMercadoPagoConfigured()) return;
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const notifyAfter = Date.now() - NOTIFY_MAX_AGE_MS;
    const query = new URLSearchParams({
      select: 'id,payment_id,payment_status,created_at',
      payment_status: 'in.(pending,in_process,authorized)',
      created_at: `gte.${since}`,
      order: 'created_at.desc',
      limit: '60',
    });
    const rows = await supabaseRest(`orders?${query.toString()}`);
    if (!Array.isArray(rows) || !rows.length) return;

    log('info', `reconciliando ${rows.length} pedido(s) pendente(s)`);
    for (const row of rows) {
      if (shuttingDown) break;
      const job: PaymentReconcileJob = {
        kind: 'payment_reconcile',
        orderId: String(row.id),
        paymentId: row.payment_id ? String(row.payment_id) : null,
        reason: 'scheduled',
        notify: new Date(row.created_at).getTime() >= notifyAfter,
      };
      if (isQueueConfigured()) await publishSafe(QUEUES.paymentReconcile, job);
      else await handlePaymentReconcile(job).catch((error) => log('error', 'reconciliação direta falhou', error));
    }
  } catch (error) {
    log('error', 'varredura de pedidos pendentes falhou', error);
  }
}

async function sendCartReminders() {
  if (shuttingDown || !isEmailEnabled()) return;
  try {
    const threshold = new Date(Date.now() - CART_REMINDER_AFTER_MS).toISOString();
    const query = new URLSearchParams({
      select: 'id,email,customer_name,items,total,updated_at',
      converted_at: 'is.null',
      reminded_at: 'is.null',
      updated_at: `lte.${threshold}`,
      order: 'updated_at.asc',
      limit: '40',
    });
    const rows = await supabaseRest(`abandoned_carts?${query.toString()}`);
    if (!Array.isArray(rows) || !rows.length) return;

    for (const cart of rows) {
      const items = Array.isArray(cart.items) ? cart.items : [];
      if (!items.length) continue;
      await enqueueEmail({
        template: 'cart_reminder',
        to: String(cart.email),
        data: { name: cart.customer_name, items, total: cart.total },
        dedupeKey: `cart:${cart.id}:${cart.updated_at}`,
      });
      await supabaseRest(`abandoned_carts?id=eq.${cart.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ reminded_at: new Date().toISOString() }),
      });
    }
    log('info', `lembretes de carrinho enviados: ${rows.length}`);
  } catch (error) {
    log('error', 'lembretes de carrinho falharam', error);
  }
}

function startHealthServer() {
  const server = createServer((request, response) => {
    if (request.url === '/health' || request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: !shuttingDown, service: '2pbox-worker' }));
      return;
    }
    response.writeHead(404).end();
  });
  server.listen(HEALTH_PORT, () => log('info', `healthcheck em :${HEALTH_PORT}/health`));
  return server;
}

function schedule(task: () => Promise<void>, interval: number) {
  const run = () => void task();
  const timer = setInterval(run, interval);
  timers.push(timer);
  setTimeout(run, 5000).unref();
}

async function main() {
  log('info', 'iniciando worker 2P Box');

  const health = startHealthServer();

  if (isQueueConfigured()) {
    const channel = await getRabbitChannel();
    await channel.prefetch(PREFETCH);
    await Promise.all([
      consume(channel, QUEUES.paymentWebhook),
      consume(channel, QUEUES.paymentReconcile),
      consume(channel, QUEUES.email),
    ]);
    log('info', 'consumidores ativos', Object.values(QUEUES));
  } else {
    log('warn', 'RABBITMQ_URL ausente: worker roda apenas as rotinas agendadas');
  }

  schedule(reconcilePendingOrders, RECONCILE_INTERVAL_MS);
  schedule(sendCartReminders, CART_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('info', `encerrando (${signal})`);
    timers.forEach(clearInterval);
    health.close();
    await closeRabbit();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  log('error', 'falha fatal ao iniciar o worker', error);
  process.exit(1);
});
