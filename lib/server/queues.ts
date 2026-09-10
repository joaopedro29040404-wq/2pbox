export const QUEUES = {
  paymentWebhook: '2pbox.payments.webhook',
  paymentReconcile: '2pbox.payments.reconcile',
  email: '2pbox.notifications.email',
} as const;

export const EXCHANGE = '2pbox.events';
export const DLX = '2pbox.events.dlx';
export const DLQ_SUFFIX = '.dlq';

export type PaymentWebhookJob = {
  kind: 'payment_webhook';
  resourceId: string;
  resourceType: 'payment' | 'order';
  action: string;
  receivedAt: string;
  attempt?: number;
};

export type PaymentReconcileJob = {
  kind: 'payment_reconcile';
  orderId: string;
  paymentId?: string | null;
  reason: string;
  /** Varredura de backlog reconcilia em silencio: o cliente nao deve receber
   *  "pagamento confirmado" de uma compra antiga. */
  notify?: boolean;
  attempt?: number;
};

export type EmailTemplateId =
  | 'account_created'
  | 'password_reset'
  | 'payment_received'
  | 'payment_confirmed'
  | 'payment_cancelled'
  | 'payment_rejected'
  | 'payment_pending'
  | 'order_status_updated'
  | 'order_details'
  | 'cart_reminder';

export type EmailJob = {
  kind: 'email';
  template: EmailTemplateId;
  to: string;
  data: Record<string, unknown>;
  dedupeKey?: string;
  attempt?: number;
};

export type QueueJob = PaymentWebhookJob | PaymentReconcileJob | EmailJob;
