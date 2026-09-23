import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkByteQuota, checkRateLimit, clientIp } from '@/lib/server/rate-limit';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_REQUEST_BYTES = 24 * 1024 * 1024;
const MAX_DAILY_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 });
  const subject = clientIp(request) || 'unknown';
  if (!(await checkRateLimit('print-upload', subject, 40, 10 * 60))) return NextResponse.json({ error: 'Muitos envios em pouco tempo. Tente novamente em alguns minutos.' }, { status: 429 });

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return NextResponse.json({ error: 'Arquivo maior que 20 MB.' }, { status: 413 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo não informado.' }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Formato não permitido.' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Arquivo maior que 20 MB.' }, { status: 400 });
  if (!(await checkByteQuota('print-upload-daily', subject, file.size, MAX_DAILY_BYTES, 24 * 60 * 60))) return NextResponse.json({ error: 'Limite diário de arquivos atingido. Tente novamente mais tarde.' }, { status: 429 });

  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Storage não configurado.' }, { status: 503 });
  const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const path = `pending/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  const { error } = await client.storage.from('print-files').upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path });
}
