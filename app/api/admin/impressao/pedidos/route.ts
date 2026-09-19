import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

const STATUSES = new Set(['pending','confirmed','preparing','ready','out_for_delivery','delivered','completed','cancelled']);

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Supabase backend não configurado.' }, { status: 503 });

  // Keep the main query shallow. PostgREST rejects the previous deeply nested
  // select expression in this endpoint, which made the entire admin screen fail.
  const { data: jobs, error } = await client
    .from('print_jobs')
    .select('id,order_id,subtotal,status,metadata,created_at,orders!inner(id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,total,payment_status,status),print_files(id,original_name,storage_path,mime_type,pages,copies,color_mode,duplex,sheets,print_total,paper_type_id)')
    .eq('orders.payment_status', 'paid')
    .order('created_at', { ascending: false })
    .range(0, 1999);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = jobs || [];
  const files = rows.flatMap((job: any) => Array.isArray(job.print_files) ? job.print_files : []);
  const fileIds = files.map((file: any) => file.id).filter(Boolean);
  const paperTypeIds = [...new Set(files.map((file: any) => file.paper_type_id).filter(Boolean))];

  const [papersResult, servicesResult] = await Promise.all([
    paperTypeIds.length
      ? client.from('print_paper_types').select('id,name,size').in('id', paperTypeIds)
      : Promise.resolve({ data: [], error: null } as any),
    fileIds.length
      ? client.from('print_file_services').select('print_file_id,quantity,unit_price,total,selected_pages,service_id').in('print_file_id', fileIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (papersResult.error) return NextResponse.json({ error: papersResult.error.message }, { status: 500 });
  if (servicesResult.error) return NextResponse.json({ error: servicesResult.error.message }, { status: 500 });

  const serviceRows = servicesResult.data || [];
  const serviceIds = [...new Set(serviceRows.map((row: any) => row.service_id).filter(Boolean))];
  const { data: services, error: serviceError } = serviceIds.length
    ? await client.from('print_services').select('id,name,charge_type').in('id', serviceIds)
    : { data: [], error: null };

  if (serviceError) return NextResponse.json({ error: serviceError.message }, { status: 500 });

  const paperById = new Map((papersResult.data || []).map((paper: any) => [paper.id, paper]));
  const serviceById = new Map((services || []).map((service: any) => [service.id, service]));
  const serviceRowsByFile = new Map<string, any[]>();

  for (const row of serviceRows) {
    const list = serviceRowsByFile.get(row.print_file_id) || [];
    list.push({
      quantity: row.quantity,
      unit_price: row.unit_price,
      total: row.total,
      selected_pages: row.selected_pages,
      print_services: serviceById.get(row.service_id) || null,
    });
    serviceRowsByFile.set(row.print_file_id, list);
  }

  const normalizedJobs = rows.map((job: any) => {
    const order = Array.isArray(job.orders) ? job.orders[0] : job.orders;
    return {
      ...job,
      // O status exibido na Central é sempre o status real do pedido principal.
      // O valor legado de print_jobs (ex.: "received") não deve aparecer para o administrador.
      status: order?.status || job.status,
      print_files: (Array.isArray(job.print_files) ? job.print_files : []).map((file: any) => ({
      ...file,
      print_paper_types: paperById.get(file.paper_type_id) || null,
      print_file_services: serviceRowsByFile.get(file.id) || [],
      })),
    };
  });

  return NextResponse.json({ jobs: normalizedJobs });
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

  const { data: job, error: jobError } = await client.from('print_jobs').select('id,order_id').eq('id', id).maybeSingle();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'Pedido de impressão não encontrado.' }, { status: 404 });
  if (!job.order_id) return NextResponse.json({ error: 'Pedido de impressão sem pedido principal vinculado.' }, { status: 409 });

  // Usa exatamente o fluxo de atualização do pedido normal: grava o status,
  // registra o histórico e dispara a notificação de e-mail ao cliente.
  const origin = request.headers.get('origin') || new URL(request.url).origin;
  const response = await fetch(`${origin}/api/admin/pedidos/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
    body: JSON.stringify({ orderId: job.order_id, status }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: payload?.error || 'Não foi possível atualizar o pedido.' }, { status: response.status });

  return NextResponse.json({ ok: true, job: { id: job.id, order_id: job.order_id, status } });
}
