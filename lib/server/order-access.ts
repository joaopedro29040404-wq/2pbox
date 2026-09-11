import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { getSupabaseSecretKey } from './env';
import { strictDel, strictGet, strictIncr, strictSet } from './redis';

const CODE_TTL_SECONDS = 10 * 60;
const CODE_MAX_ATTEMPTS = 5;
const REQUEST_WINDOW_SECONDS = 15 * 60;
const REQUEST_MAX_PER_EMAIL = 3;
const REQUEST_MAX_PER_IP = 10;
const TOKEN_TTL_SECONDS = 30 * 60;

export const ORDER_ACCESS_COOKIE = '2p_order_access';

function secret() {
  const value = String(process.env.ORDER_ACCESS_SECRET || '').trim() || getSupabaseSecretKey();
  if (!value) throw new Error('ORDER_ACCESS_SECRET nao configurado.');
  return value;
}

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function codeKey(email: string) {
  return `order-access:code:${email}`;
}

function attemptsKey(email: string) {
  return `order-access:attempts:${email}`;
}

function hashCode(email: string, code: string) {
  return createHmac('sha256', secret()).update(`${email}:${code}`).digest('hex');
}

export type RequestOutcome = { ok: true; code: string } | { ok: false; reason: 'rate_limited' };

/**
 * Gera o codigo de acesso. Rate limit por e-mail e por IP; sem Redis a chamada
 * lanca, para nunca liberar consulta de pedido sem verificacao.
 */
export async function issueAccessCode(rawEmail: string, ip: string): Promise<RequestOutcome> {
  const email = normalizeEmail(rawEmail);

  const perEmail = await strictIncr(`order-access:req:email:${email}`, REQUEST_WINDOW_SECONDS);
  if (perEmail > REQUEST_MAX_PER_EMAIL) return { ok: false, reason: 'rate_limited' };

  if (ip) {
    const perIp = await strictIncr(`order-access:req:ip:${ip}`, REQUEST_WINDOW_SECONDS);
    if (perIp > REQUEST_MAX_PER_IP) return { ok: false, reason: 'rate_limited' };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await strictSet(codeKey(email), hashCode(email, code), CODE_TTL_SECONDS);
  await strictDel(attemptsKey(email));

  return { ok: true, code };
}

export type VerifyOutcome = 'ok' | 'invalid' | 'expired' | 'too_many_attempts';

export async function verifyAccessCode(rawEmail: string, rawCode: string): Promise<VerifyOutcome> {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode || '').replace(/\D/g, '');
  if (code.length !== 6) return 'invalid';

  const stored = await strictGet(codeKey(email));
  if (!stored) return 'expired';

  const attempts = await strictIncr(attemptsKey(email), CODE_TTL_SECONDS);
  if (attempts > CODE_MAX_ATTEMPTS) {
    await strictDel(codeKey(email));
    return 'too_many_attempts';
  }

  const expected = hashCode(email, code);
  const matches =
    expected.length === stored.length && timingSafeEqual(Buffer.from(expected), Buffer.from(stored));
  if (!matches) return 'invalid';

  await strictDel(codeKey(email));
  await strictDel(attemptsKey(email));
  return 'ok';
}

export function signAccessToken(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const expiresAt = Date.now() + TOKEN_TTL_SECONDS * 1000;
  const payload = `${email}|${expiresAt}`;
  const signature = createHmac('sha256', secret()).update(payload).digest('hex');
  return { token: `${Buffer.from(payload).toString('base64url')}.${signature}`, maxAge: TOKEN_TTL_SECONDS };
}

export function readAccessToken(token: string | undefined | null): string | null {
  const raw = String(token || '');
  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);

  let decoded = '';
  try {
    decoded = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = createHmac('sha256', secret()).update(decoded).digest('hex');
  try {
    if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return null;
    }
  } catch {
    return null;
  }

  const [email, expiresAt] = decoded.split('|');
  if (!email || !expiresAt || Number(expiresAt) < Date.now()) return null;
  return email;
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || '';
}
