import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

export async function PATCH(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Supabase backend não configurado.' }, { status: 503 });
  try {
    const body = await request.json();
    const orderId = String(body?.order_id || '').trim();
    if (!orderId) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    const isTest = Boolean(body?.is_test);
    const { error } = await client.from('orders').update({ is_test: isTest }).eq('id', orderId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, is_test: isTest });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar o pedido.' }, { status: 500 });
  }
}
