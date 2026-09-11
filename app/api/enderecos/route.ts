import { NextResponse } from 'next/server';
import { isGeoAvailable, resolvePlace, suggestAddresses } from '@/lib/server/geo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// A chave do Google fica no servidor: o browser consulta esta rota, nunca o
// Google diretamente.
export async function GET(request: Request) {
  if (!isGeoAvailable()) return NextResponse.json({ available: false, suggestions: [] });

  const url = new URL(request.url);
  const placeId = url.searchParams.get('placeId');
  const session = url.searchParams.get('session') || undefined;

  try {
    if (placeId) {
      const address = await resolvePlace(placeId, session);
      return NextResponse.json({ available: true, address });
    }

    const suggestions = await suggestAddresses(url.searchParams.get('q') || '', session);
    return NextResponse.json({ available: true, suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na busca de endereços.';
    return NextResponse.json({ available: true, error: message, suggestions: [] }, { status: 502 });
  }
}
