const PAYMENT_TYPE_LABELS: Record<string, string> = {
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  bank_transfer: 'Pix',
  pix: 'Pix',
  ticket: 'Boleto',
  account_money: 'Saldo Mercado Pago',
};

export function money(value: unknown) {
  const amount = Number(value || 0);
  return `R$ ${(Number.isFinite(amount) ? amount : 0).toFixed(2).replace('.', ',')}`;
}

export function formatPaymentMethod(type: unknown, method: unknown) {
  const key = String(type || '').toLowerCase();
  const label = PAYMENT_TYPE_LABELS[key];
  const brand = String(method || '').toUpperCase();
  if (label && brand && key.includes('card')) return `${label} · ${brand}`;
  return label || brand || 'Não informado';
}

export function formatAddress(address: Record<string, string> | string | null | undefined) {
  if (!address) return '';
  if (typeof address === 'string') {
    const trimmed = address.trim();
    if (!trimmed.startsWith('{')) return trimmed;
    try {
      return formatAddress(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }

  const street = [address.street, address.number].filter(Boolean).join(', ');
  const region = [address.neighborhood, [address.city, address.state].filter(Boolean).join('/')].filter(Boolean).join(' — ');
  return [street, address.complement, region, address.postal_code ? `CEP: ${address.postal_code}` : '']
    .filter(Boolean)
    .join('\n');
}
