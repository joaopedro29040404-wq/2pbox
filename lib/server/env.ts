function read(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function getSupabaseUrl() {
  return read('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
}

export function getSupabaseSecretKey() {
  const direct = read('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE');
  if (direct) return direct;
  try {
    const named = read('SUPABASE_SECRET_KEYS');
    if (named) {
      const parsed = JSON.parse(named);
      return String(parsed?.default || '').trim();
    }
  } catch {}
  return '';
}

export function getMercadoPagoAccessToken() {
  return read('MERCADOPAGO_ACCESS_TOKEN', 'MERCADO_PAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN');
}

export function getMercadoPagoWebhookSecret() {
  return read('MERCADOPAGO_WEBHOOK_SECRET');
}

export function getRabbitMqUrl() {
  return read('RABBITMQ_URL');
}

export function getRedisUrl() {
  const url = read('REDIS_URL');
  if (url) return url;
  const host = read('REDIS_HOST');
  if (!host) return '';
  const port = read('REDIS_PORT') || '6379';
  const password = read('REDIS_PASSWORD');
  const db = read('REDIS_DB') || '0';
  const auth = password ? `:${encodeURIComponent(password)}@` : '';
  return `redis://${auth}${host}:${port}/${db}`;
}

export function getResendKey() {
  return read('RESEND_KEY', 'RESEND_API_KEY');
}

export function getEmailFrom() {
  return read('EMAIL_FROM') || '2P Box <nao-responda@2pbox.com.br>';
}

export function getEmailReplyTo() {
  return read('EMAIL_REPLY_TO');
}

export function getSiteUrl() {
  return (read('NEXT_PUBLIC_SITE_URL', 'SITE_URL') || 'https://2pbox.com.br').replace(/\/$/, '');
}

export function getStoreWhatsApp() {
  return read('NEXT_PUBLIC_STORE_WHATSAPP').replace(/\D/g, '');
}

export function isEmailEnabled() {
  return Boolean(getResendKey());
}
