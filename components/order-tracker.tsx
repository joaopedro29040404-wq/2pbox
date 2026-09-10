'use client';

import { Check, CircleDot, CreditCard, PackageCheck, Store, Truck, XCircle } from 'lucide-react';

export type OrderHistoryEntry = {
  status: string;
  payment_status?: string | null;
  note?: string | null;
  source?: string | null;
  created_at: string;
};

export const ORDER_STEPS = [
  { key: 'pending', label: 'Pedido recebido', hint: 'Recebemos seu pedido', icon: CircleDot },
  { key: 'confirmed', label: 'Pagamento confirmado', hint: 'Pagamento aprovado', icon: CreditCard },
  { key: 'preparing', label: 'Em preparação', hint: 'Separando os produtos', icon: PackageCheck },
  { key: 'ready', label: 'Pronto para retirada', hint: 'Disponível na loja', icon: Store },
  { key: 'completed', label: 'Pedido concluído', hint: 'Entregue ao cliente', icon: Truck },
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pedido recebido',
  confirmed: 'Pagamento confirmado',
  preparing: 'Em preparação',
  ready: 'Pronto para retirada',
  completed: 'Pedido concluído',
  cancelled: 'Pedido cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pagamento aprovado',
  failed: 'Pagamento não aprovado',
  refunded: 'Pagamento estornado',
};

const SOURCE_LABELS: Record<string, string> = {
  checkout: 'Checkout',
  mercadopago: 'Mercado Pago',
  admin: 'Equipe 2P Box',
  system: 'Automático',
  backfill: 'Histórico',
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function OrderTracker({
  status,
  history = [],
  compact = false,
}: {
  status: string;
  history?: OrderHistoryEntry[];
  compact?: boolean;
}) {
  const current = String(status || 'pending').toLowerCase();
  const cancelled = current === 'cancelled';
  const currentIndex = ORDER_STEPS.findIndex((step) => step.key === current);
  const reachedAt = new Map<string, string>();
  history.forEach((entry) => {
    const key = String(entry.status || '').toLowerCase();
    if (!reachedAt.has(key)) reachedAt.set(key, entry.created_at);
  });

  if (cancelled) {
    const cancelledAt = reachedAt.get('cancelled');
    return (
      <section className="ot-cancelled" aria-label="Situação do pedido">
        <span className="ot-cancelled-icon">
          <XCircle size={22} />
        </span>
        <div>
          <strong>Pedido cancelado</strong>
          <span>Este pedido não seguirá para as próximas etapas.{cancelledAt ? ` Cancelado em ${formatDateTime(cancelledAt)}.` : ''}</span>
        </div>
      </section>
    );
  }

  const progress = currentIndex < 0 ? 0 : (currentIndex / (ORDER_STEPS.length - 1)) * 100;

  return (
    <section className="ot" aria-label="Acompanhamento do pedido">
      <ol className="ot-steps">
        <span className="ot-rail" aria-hidden="true" style={{ '--ot-progress': `${progress}%` } as React.CSSProperties}>
          <i />
        </span>
        {ORDER_STEPS.map((step, index) => {
          const done = currentIndex >= 0 && index < currentIndex;
          const active = index === currentIndex;
          const Icon = step.icon;
          const stamp = reachedAt.get(step.key);
          return (
            <li key={step.key} className={`ot-step ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}>
              <span className="ot-dot">{done ? <Check size={15} /> : <Icon size={15} />}</span>
              <strong>{step.label}</strong>
              <small>{stamp ? formatDateTime(stamp) : step.hint}</small>
            </li>
          );
        })}
      </ol>

      {!compact && history.length > 0 && (
        <div className="ot-history">
          <p className="ot-history-title">Movimentação do pedido</p>
          <ul>
            {[...history].reverse().map((entry, index) => (
              <li key={`${entry.created_at}-${index}`}>
                <span className="ot-history-dot" aria-hidden="true" />
                <div>
                  <strong>{ORDER_STATUS_LABELS[String(entry.status).toLowerCase()] || entry.status}</strong>
                  <span>
                    {entry.payment_status ? `${PAYMENT_STATUS_LABELS[String(entry.payment_status).toLowerCase()] || entry.payment_status} · ` : ''}
                    {SOURCE_LABELS[String(entry.source || '').toLowerCase()] || 'Automático'}
                  </span>
                  {entry.note && <em>{entry.note}</em>}
                </div>
                <time>{formatDateTime(entry.created_at)}</time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
