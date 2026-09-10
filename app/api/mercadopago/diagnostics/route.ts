import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken } from '@/lib/server/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) return NextResponse.json({ ok: false, error: 'MERCADOPAGO_ACCESS_TOKEN não configurado.' }, { status: 500 });

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json();
    const methods = Array.isArray(data) ? data : [];
    const cards = methods.filter((method: any) => ['credit_card', 'debit_card', 'prepaid_card'].includes(method?.payment_type_id));
    return NextResponse.json({
      ok: response.ok,
      httpStatus: response.status,
      paymentMethodsCount: methods.length,
      cardMethodsCount: cards.length,
      mastercard: cards.some((method: any) => method?.id === 'master'),
      visa: cards.some((method: any) => method?.id === 'visa'),
      environment: accessToken.startsWith('TEST-') ? 'TEST' : accessToken.startsWith('APP_USR-') ? 'APP_USR' : 'unknown',
      error: response.ok ? null : (data?.message || data?.error || data),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
