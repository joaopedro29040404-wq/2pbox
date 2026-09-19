import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

const STATUSES = new Set(['received','printing','ready','completed','cancelled']);

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Supabase backend não configurado.' }, { status: 503 });

  const { data, error } = await client
    .from('print_jobs')
    .select('id,order_id,subtotal,status,metadata,created_at,orders(id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,total,payment_status,status),print_files(id,original_name,storage_path,mime_type,pages,copies,color_mode,duplex,sheets,print_total,print_paper_types(name,size),print_file_services(quantity,unit_price,total,selected_pages,print_services(name,charge_type))')
    .order('created_at', { ascending: false })
    .range(0, 1999);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data || [] });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Supabase backend não configurado.' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '').trim();
  const status = String(body?.status || '').trim();
  if (!id || !STATUSES.has(status)) return NextResponse.json({ error: 'Pedido ou status inválido.' }, { status: 400 });

  const { data, error } = await client.from('print_jobs').update({ status }).eq('id', id).select('id,status').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Pedido de impressão não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true, job: data });
}
