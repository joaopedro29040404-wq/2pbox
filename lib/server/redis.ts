import Redis from 'ioredis';
import { getRedisUrl } from './env';

let client: Redis | null = null;
let unavailable = false;

export function isRedisConfigured() {
  return Boolean(getRedisUrl());
}

export function getRedis(): Redis | null {
  if (client) return client;
  if (unavailable) return null;
  const url = getRedisUrl();
  if (!url) {
    unavailable = true;
    return null;
  }
  client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  client.on('error', (error) => console.error('[redis]', error.message));
  return client;
}

export async function acquireLock(key: string, ttlSeconds = 30): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const result = await redis.set(`lock:${key}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    return true;
  }
}

export async function releaseLock(key: string) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`lock:${key}`);
  } catch {}
}

export async function markProcessed(key: string, ttlSeconds = 60 * 60 * 24): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const result = await redis.set(`seen:${key}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    return true;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(`cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {}
}

export async function closeRedis() {
  const current = client;
  client = null;
  if (!current) return;
  try {
    await current.quit();
  } catch {
    current.disconnect();
  }
}
