import { NextResponse } from "next/server";
import { getMercadoPagoAccessToken } from "@/lib/server/env";
import { readSupportedMethods } from "@/lib/server/mercadopago";
import { getConnectionStatus, getSellerAccessToken } from "@/lib/server/mercadopago-oauth";
import { readStoreOperations } from "@/lib/server/store-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isTest = (value: string) => /^TEST-/i.test(value);

export async function GET() {
  const connection = await getConnectionStatus().catch(() => null);
  const platformToken = getMercadoPagoAccessToken();

  const envPublicKey = String(
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || "",
  ).trim();
  const publicKey = (
    connection?.connected && connection.publicKey
      ? connection.publicKey
      : envPublicKey
  ).trim();
  const operations = await readStoreOperations().catch(() => null);

  const connected = Boolean(connection?.connected);
  const hasToken = connected || Boolean(platformToken);

  const chargeIsTest = connected
    ? !connection?.liveMode
    : isTest(platformToken);
  const environmentMatches =
    Boolean(publicKey) && isTest(publicKey) === chargeIsTest;

  const chargeToken = connected ? await getSellerAccessToken().catch(() => null) : platformToken;
  const methods = hasToken && environmentMatches && chargeToken ? await readSupportedMethods(chargeToken) : { card: false, pix: false };

  let reason: string | null = null;
  if (!hasToken) reason = "mercadopago-desconectado";
  else if (!publicKey) reason = "public-key-ausente";
  else if (!environmentMatches) reason = "ambiente-divergente";

  return NextResponse.json({
    available: hasToken && environmentMatches,
    connected,
    reason,
    publicKey: hasToken && environmentMatches ? publicKey : "",
    methods,
    whatsapp: operations?.whatsapp || "",
  });
}
