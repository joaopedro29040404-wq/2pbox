'use client';

import { useEffect, useState } from 'react';
import { getIdentificationTypes, getPaymentMethods, initMercadoPago } from '@mercadopago/sdk-react';

const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || '';
const TEST_BINS = [
  { label: 'Mastercard de teste', bin: '548083' },
  { label: 'Visa de teste', bin: '423564' },
];

type Diagnostic = { label: string; status: 'ok' | 'error' | 'info'; detail: string };

function describeError(error: unknown) {
  if (!error) return 'Sem detalhes.';
  if (typeof error === 'string') return error;
  const value = error as Record<string, unknown>;
  const parts = [value.errorCode, value.cause, value.code, value.message, value.status].filter(Boolean).map(String);
  try {
    const raw = JSON.stringify(error);
    return parts.length ? `${parts.join(' | ')}\n${raw}` : raw;
  } catch { return parts.join(' | ') || String(error); }
}

export default function MercadoPagoDiagnosticPage() {
  const [running, setRunning] = useState(true);
  const [results, setResults] = useState<Diagnostic[]>([]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const next: Diagnostic[] = [];
      if (!publicKey) {
        next.push({ label: 'Public Key', status: 'error', detail: 'NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY não chegou ao navegador.' });
        if (active) { setResults(next); setRunning(false); }
        return;
      }
      next.push({ label: 'Public Key carregada', status: 'ok', detail: `${publicKey.slice(0, 12)}… | tamanho ${publicKey.length} | ambiente ${publicKey.startsWith('TEST-') ? 'TEST' : publicKey.startsWith('APP_USR-') ? 'APP_USR' : 'desconhecido'}` });
      try {
        initMercadoPago(publicKey, { locale: 'pt-BR' });
        next.push({ label: 'SDK inicializado', status: 'ok', detail: 'initMercadoPago executado com locale pt-BR.' });
      } catch (error) {
        next.push({ label: 'SDK inicializado', status: 'error', detail: describeError(error) });
      }
      try {
        const identificationTypes = await getIdentificationTypes();
        next.push({ label: 'Identificação / Public Key', status: 'ok', detail: `SDK conseguiu consultar os tipos de documento (${Array.isArray(identificationTypes) ? identificationTypes.length : 'resposta recebida'}).` });
      } catch (error) {
        next.push({ label: 'Identificação / Public Key', status: 'error', detail: describeError(error) });
      }
      for (const item of TEST_BINS) {
        try {
          const methods = await getPaymentMethods({ bin: item.bin });
          const list = Array.isArray(methods) ? methods : [];
          next.push({ label: `BIN ${item.bin} / ${item.label}`, status: 'ok', detail: `Consulta concluída. Métodos retornados: ${list.length}.` });
        } catch (error) {
          next.push({ label: `BIN ${item.bin} / ${item.label}`, status: 'error', detail: describeError(error) });
        }
      }
      try {
        const response = await fetch('/api/mercadopago/diagnostics', { cache: 'no-store' });
        const data = await response.json();
        next.push({ label: 'Access Token / API do servidor', status: response.ok && data.ok ? 'ok' : 'error', detail: JSON.stringify(data, null, 2) });
      } catch (error) {
        next.push({ label: 'Access Token / API do servidor', status: 'error', detail: describeError(error) });
      }
      if (active) { setResults(next); setRunning(false); }
    };
    run();
    return () => { active = false; };
  }, []);

  return <main style={{ minHeight: '100vh', background: '#f7f7f5', color: '#111', padding: '32px 18px', fontFamily: 'Arial,sans-serif' }}>
    <section style={{ width: 'min(760px,100%)', margin: '0 auto', background: '#fff', border: '1px solid #ddd', borderRadius: 16, padding: 24, boxSizing: 'border-box' }}>
      <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.14em', margin: 0 }}>2P BOX • MERCADO PAGO</p>
      <h1 style={{ fontSize: 30, margin: '10px 0 8px' }}>Diagnóstico do Payment Brick</h1>
      <p style={{ color: '#666', fontSize: 13, lineHeight: 1.5 }}>Teste objetivo das credenciais e dos dois BINs oficiais de cartão de teste. Nenhum número completo de cartão ou Access Token é exibido.</p>
      {running && <p style={{ padding: 12, background: '#fff8d6', borderRadius: 8, fontSize: 12 }}>Executando diagnóstico…</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {results.map((item) => <div key={item.label} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 14, background: item.status === 'error' ? '#fff3f3' : item.status === 'ok' ? '#f3faf4' : '#fafafa' }}><strong style={{ display: 'block', fontSize: 12 }}>{item.status === 'ok' ? '✓' : item.status === 'error' ? '✕' : '•'} {item.label}</strong><pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '8px 0 0', font: '10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace' }}>{item.detail}</pre></div>)}
      </div>
      <div style={{ marginTop: 18, padding: 12, background: '#f4f4f4', borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}><strong>Cartões oficiais usados somente para diagnóstico:</strong> Mastercard `5480 8328 0103 3311` → BIN `548083`; Visa `4235 6477 2802 5682` → BIN `423564`. Esta página envia somente os BINs ao SDK.</div>
    </section>
  </main>;
}
