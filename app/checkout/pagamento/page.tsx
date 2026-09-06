import { redirect } from 'next/navigation';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LegacyPaymentPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  if (orderId) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && key !== 'orderId') query.set(key, value);
    }
    redirect(`/pagamento/${encodeURIComponent(orderId)}${query.toString() ? `?${query.toString()}` : ''}`);
  }
  redirect('/checkout');
}
