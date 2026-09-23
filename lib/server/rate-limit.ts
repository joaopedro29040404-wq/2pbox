import { createHash } from 'node:crypto';
import { getRedis } from './redis';

function subjectHash(subject: string) {
  return createHash('sha256').update(subject || 'anonymous').digest('hex').slice(0, 32);
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || '').trim().slice(0, 120) || null;
}

export async function checkRateLimit(scope: string, subject: string, limit: number, windowSeconds: number) {
  const redis = getRedis();
  if (!redis) return true;

  try {
    const key = `ratelimit:${scope}:${subjectHash(subject)}`;
    const total = await redis.incr(key);
    if (total === 1) await redis.expire(key, windowSeconds);
    return total <= limit;
  } catch {
    return true;
  }
}

export async function checkByteQuota(scope: string, subject: string, bytes: number, limitBytes: number, windowSeconds: number) {
  const redis = getRedis();
  if (!redis) return true;

  try {
    const amount = Math.max(0, Math.round(bytes));
    const key = `quota:${scope}:${subjectHash(subject)}`;
    const total = await redis.incrby(key, amount);
    if (total === amount) await redis.expire(key, windowSeconds);
    return total <= limitBytes;
  } catch {
    return true;
  }
}
