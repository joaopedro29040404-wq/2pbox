'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CircleCheck, Copy, KeyRound, Monitor, Power, RefreshCw, TriangleAlert, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { InlineLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';

// Caixas do PONTO (PDV) ligados à loja: código de ligação, lista e desligamento.
// As funções ponto_* do banco conferem se o usuário é admin da loja.

const STORE = '2pbox';
const GATEWAY_URL = 'https://gateway.2pbox.com.br';
const ONLINE_MS = 2 * 60 * 1000;
const LIST_REFRESH_MS = 10000; // a lista se atualiza sozinha
const CODE_POLL_MS = 2000; // com o código na tela, confere se o caixa já se ligou

type Terminal = {
  id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

type Alert = { at: string; kind: string; code: string | null; detail: string };

type PairingCode = { code: string; expires_at: string };

type PairingStatus = { used: boolean; expired: boolean; terminal_name: string | null };

const ALERT_LABELS: Record<string, string> = {
  negative_stock: 'Estoque ficou negativo',
  unknown_code: 'Código do caixa não existe no site',
  duplicate_code: 'Código repetido no site',
  count_mismatch: 'Contagem diferente',
  capture_error: 'Erro ao registrar uma mudança de estoque',
};

function formatDateTime(value: string | null) {
  if (!value) return 'nunca';
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function seenLabel(value: string | null, now: number) {
  if (!value) return 'Ainda não conectou';
  const diff = now - new Date(value).getTime();
  if (diff < ONLINE_MS) return 'Conectado agora';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `Visto há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Visto há ${hours} h`;
  return `Visto em ${formatDateTime(value)}`;
}

function alertText(alert: Alert) {
  if (alert.kind === 'capture_error') return alert.detail;
  try {
    const detail = JSON.parse(alert.detail) as Record<string, unknown>;
    const parts: string[] = [];
    if (alert.code) parts.push(`código ${alert.code}`);
    if (typeof detail.delta === 'number') parts.push(`variação ${detail.delta}`);
    if (typeof detail.after === 'number') parts.push(`estoque ficou em ${detail.after}`);
    return parts.join(', ') || alert.detail;
  } catch {
    return alert.detail;
  }
}

function errorMessage(error: { message?: string } | null) {
  const message = error?.message || '';
  if (message.includes('sem permissão')) return 'Seu usuário não administra esta loja.';
  if (message.includes('não está ligada')) return 'A loja ainda não foi ligada ao PONTO no servidor.';
  return message || 'Tente de novo em instantes.';
}

export default function CashRegistersPage() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<PairingCode | null>(null);
  const [connected, setConnected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const toast = useToast();

  const load = useCallback(async (silent = false) => {
    if (!supabase) return;
    if (!silent) setLoading(true);
    const [list, warnings] = await Promise.all([
      supabase.rpc('ponto_terminals', { p_store: STORE }),
      supabase.rpc('ponto_alerts', { p_store: STORE, p_limit: 30 }),
    ]);
    if (list.error) {
      if (!silent) toast.error('Não foi possível carregar os caixas', errorMessage(list.error));
    }
    else setTerminals((list.data ?? []) as Terminal[]);
    if (!warnings.error) setAlerts((warnings.data ?? []) as Alert[]);
    setNow(Date.now());
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, LIST_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Com o código na tela, confere a cada 2 s se o caixa já se ligou com ele.
  useEffect(() => {
    if (!supabase || !code) return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      const { data, error } = await supabase.rpc('ponto_pairing_status', { p_code: code.code });
      if (stopped || error) return;
      const row = (Array.isArray(data) ? data[0] : data) as PairingStatus | undefined;
      if (row?.used) {
        stopped = true;
        setCode(null);
        setConnected(row.terminal_name || 'O caixa');
        load(true);
      } else if (row?.expired) {
        stopped = true;
        setNow(Date.now());
      }
    }, CODE_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [code, load]);

  const active = useMemo(() => terminals.filter((t) => !t.revoked_at), [terminals]);
  const revoked = useMemo(() => terminals.filter((t) => t.revoked_at), [terminals]);
  const codeExpired = code ? new Date(code.expires_at).getTime() <= now : false;

  async function newCode() {
    if (!supabase || busy) return;
    setBusy('code');
    const { data, error } = await supabase.rpc('ponto_new_pairing_code', { p_store: STORE, p_minutes: 15 });
    setBusy(null);
    if (error) return toast.error('Não foi possível gerar o código', errorMessage(error));
    const row = (Array.isArray(data) ? data[0] : data) as PairingCode | undefined;
    if (!row) return toast.error('Não foi possível gerar o código');
    setConnected(null);
    setCode(row);
    setNow(Date.now());
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      toast.success('Código copiado', code.code);
    } catch {
      toast.error('Não foi possível copiar', 'Digite o código no caixa.');
    }
  }

  async function revoke(terminal: Terminal) {
    if (!supabase || busy) return;
    if (!confirm(`Desligar o caixa "${terminal.name}"? Ele para de enviar as vendas e de receber os pedidos do site. Para ligar de novo, será preciso um código novo.`)) return;
    setBusy(terminal.id);
    const { error } = await supabase.rpc('ponto_revoke_terminal', { p_terminal: terminal.id });
    setBusy(null);
    if (error) return toast.error('Não foi possível desligar o caixa', errorMessage(error));
    toast.success('Caixa desligado', terminal.name);
    load(true);
  }

  return (
    <main className="pdv-page">
      <SiteHeader variant="admin" subtitle="CAIXAS" />
      <section className="pdv-content">
        <div className="pdv-breadcrumb">
          <Link href="/admin">Painel</Link>
          <span>/</span>
          <strong>Caixas (PDV)</strong>
        </div>

        <div className="pdv-heading">
          <div>
            <p className="pdv-kicker">LOJA FÍSICA</p>
            <h1>Caixas (PDV)</h1>
            <span>Os caixas ligados aqui usam o mesmo estoque do site: cada venda no caixa baixa o site, e cada pedido do site baixa o caixa.</span>
          </div>
          <button type="button" className="pdv-secondary" onClick={() => load()} disabled={loading}>
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        <div className="pdv-grid">
          <article className="pdv-card pdv-pair">
            <div className="pdv-card-title">
              <KeyRound size={20} />
              <h2>Ligar um caixa</h2>
            </div>
            <ol>
              <li>Clique em <b>Gerar código de ligação</b>.</li>
              <li>No PONTO, abra <b>Configurações</b> e escolha <b>Ligar à loja virtual</b>.</li>
              <li>Digite o código e o nome do caixa. O endereço do servidor já vem preenchido ({GATEWAY_URL}).</li>
              <li>No <b>primeiro</b> caixa da loja, use também <b>Acertar estoque pela loja virtual</b>.</li>
            </ol>
            {connected ? (
              <div className="pdv-success" role="status">
                <CircleCheck size={44} />
                <strong>Caixa conectado com sucesso!</strong>
                <span>{connected} está ligado à loja e já troca o estoque com o site.</span>
                <div className="pdv-success-actions">
                  <button type="button" className="pdv-secondary" onClick={newCode} disabled={busy === 'code'}>
                    <KeyRound size={16} /> Conectar outro caixa
                  </button>
                  <button type="button" className="pdv-primary" onClick={() => setConnected(null)}>
                    Ok
                  </button>
                </div>
              </div>
            ) : code && !codeExpired ? (
              <div className="pdv-code">
                <span>Código de ligação</span>
                <strong>{code.code}</strong>
                <small>Vale até {new Date(code.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} e serve uma vez. Esta tela avisa quando o caixa se conectar.</small>
                <button type="button" className="pdv-secondary" onClick={copyCode}>
                  <Copy size={15} /> Copiar
                </button>
              </div>
            ) : (
              <>
                {code && <p className="pdv-muted">O código anterior venceu. Gere outro.</p>}
                <button type="button" className="pdv-primary" onClick={newCode} disabled={busy === 'code'}>
                  <KeyRound size={16} /> {busy === 'code' ? 'Gerando...' : 'Gerar código de ligação'}
                </button>
              </>
            )}
          </article>

          <article className="pdv-card">
            <div className="pdv-card-title">
              <Monitor size={20} />
              <h2>Caixas ligados</h2>
              <em>{active.length}</em>
            </div>
            {loading && !terminals.length ? (
              <InlineLoader label="Carregando os caixas..." />
            ) : active.length === 0 ? (
              <p className="pdv-muted">Nenhum caixa ligado ainda.</p>
            ) : (
              <ul className="pdv-list">
                {active.map((t) => {
                  const online = !!t.last_seen_at && now - new Date(t.last_seen_at).getTime() < ONLINE_MS;
                  return (
                    <li key={t.id}>
                      <div className={online ? 'pdv-dot is-online' : 'pdv-dot'}>{online ? <Wifi size={15} /> : <WifiOff size={15} />}</div>
                      <div className="pdv-item">
                        <strong>{t.name}</strong>
                        <small>{seenLabel(t.last_seen_at, now)} · ligado em {formatDateTime(t.created_at)}</small>
                      </div>
                      <button type="button" className="pdv-danger" onClick={() => revoke(t)} disabled={busy === t.id}>
                        <Power size={15} /> Desligar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {revoked.length > 0 && (
              <details className="pdv-revoked">
                <summary>Caixas desligados ({revoked.length})</summary>
                <ul>
                  {revoked.map((t) => (
                    <li key={t.id}>
                      {t.name} <small>desligado em {formatDateTime(t.revoked_at)}</small>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        </div>

        <article className="pdv-card">
          <div className="pdv-card-title">
            <TriangleAlert size={20} />
            <h2>Avisos da integração</h2>
            <em>{alerts.length}</em>
          </div>
          {alerts.length === 0 ? (
            <p className="pdv-muted">Nenhum aviso. O estoque do site e o dos caixas estão sendo trocados sem problemas.</p>
          ) : (
            <ul className="pdv-alerts">
              {alerts.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <span>{formatDateTime(a.at)}</span>
                  <strong>{ALERT_LABELS[a.kind] || a.kind}</strong>
                  <small>{alertText(a)}</small>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <style jsx>{`
        .pdv-page { min-height: 100vh; background: #f6f6f2; }
        .pdv-content { width: min(1180px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 60px; display: grid; gap: 20px; }
        .pdv-breadcrumb { display: flex; gap: 8px; font: 700 12px/1 Inter, Arial, sans-serif; color: #8b8b8b; }
        .pdv-breadcrumb :global(a) { color: #8b8b8b; text-decoration: none; }
        .pdv-breadcrumb strong { color: #111; }
        .pdv-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .pdv-kicker { margin: 0 0 6px; font: 900 10px/1 Inter, Arial, sans-serif; letter-spacing: 0.2em; color: #9a7200; }
        .pdv-heading h1 { margin: 0 0 8px; font: 900 30px/1.1 Inter, Arial, sans-serif; color: #111; }
        .pdv-heading span { display: block; max-width: 640px; font: 500 14px/1.5 Inter, Arial, sans-serif; color: #5f5f5a; }
        .pdv-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 20px; }
        .pdv-card { background: #fff; border: 1px solid #e7e7e1; border-radius: 14px; padding: 22px; display: grid; gap: 14px; align-content: start; }
        .pdv-card-title { display: flex; align-items: center; gap: 10px; color: #111; }
        .pdv-card-title h2 { margin: 0; font: 900 16px/1.2 Inter, Arial, sans-serif; }
        .pdv-card-title em { margin-left: auto; font: 800 12px/1 Inter, Arial, sans-serif; font-style: normal; background: #f1f1ec; border-radius: 20px; padding: 6px 10px; }
        .pdv-pair ol { margin: 0; padding-left: 20px; display: grid; gap: 8px; font: 500 13px/1.5 Inter, Arial, sans-serif; color: #3d3d39; }
        .pdv-code { display: grid; gap: 6px; justify-items: start; background: #111; color: #fff; border-radius: 12px; padding: 18px; }
        .pdv-code span { font: 800 10px/1 Inter, Arial, sans-serif; letter-spacing: 0.18em; color: #ffc400; text-transform: uppercase; }
        .pdv-code strong { font: 900 34px/1.1 ui-monospace, Consolas, monospace; letter-spacing: 0.08em; }
        .pdv-code small { font: 500 12px/1.4 Inter, Arial, sans-serif; color: #cfcfcf; }
        .pdv-success { display: grid; justify-items: center; text-align: center; gap: 10px; padding: 26px 18px; border-radius: 12px; background: #f1faf4; border: 1px solid #c9ead5; color: #15803d; }
        .pdv-success strong { font: 900 20px/1.2 Inter, Arial, sans-serif; color: #111; }
        .pdv-success span { max-width: 380px; font: 500 13px/1.5 Inter, Arial, sans-serif; color: #3d3d39; }
        .pdv-success-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }
        .pdv-primary, .pdv-secondary, .pdv-danger { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 16px; border-radius: 9px; font: 800 12px/1 Inter, Arial, sans-serif; cursor: pointer; border: 1px solid transparent; }
        .pdv-primary { background: #ffc400; color: #111; }
        .pdv-secondary { background: #fff; color: #111; border-color: #dcdcd6; }
        .pdv-danger { background: #fff; color: #b42318; border-color: #f1c4bf; height: 36px; }
        .pdv-primary:disabled, .pdv-secondary:disabled, .pdv-danger:disabled { opacity: 0.6; cursor: wait; }
        .pdv-muted { margin: 0; font: 500 13px/1.5 Inter, Arial, sans-serif; color: #7a7a75; }
        .pdv-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .pdv-list li { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #ededE6; border-radius: 10px; }
        .pdv-dot { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 50%; background: #f1f1ec; color: #8b8b8b; }
        .pdv-dot.is-online { background: #e7f6ec; color: #15803d; }
        .pdv-item { display: grid; gap: 4px; min-width: 0; flex: 1; }
        .pdv-item strong { font: 800 14px/1.2 Inter, Arial, sans-serif; color: #111; }
        .pdv-item small { font: 500 12px/1.3 Inter, Arial, sans-serif; color: #7a7a75; }
        .pdv-revoked summary { cursor: pointer; font: 700 12px/1.4 Inter, Arial, sans-serif; color: #7a7a75; }
        .pdv-revoked ul { margin: 8px 0 0; padding-left: 18px; font: 500 12px/1.6 Inter, Arial, sans-serif; color: #5f5f5a; }
        .pdv-alerts { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .pdv-alerts li { display: grid; grid-template-columns: 110px 220px minmax(0, 1fr); gap: 12px; align-items: baseline; padding: 10px 12px; border-radius: 9px; background: #fffaf0; border: 1px solid #f4e3b5; }
        .pdv-alerts span { font: 700 12px/1.3 Inter, Arial, sans-serif; color: #7a7a75; }
        .pdv-alerts strong { font: 800 13px/1.3 Inter, Arial, sans-serif; color: #111; }
        .pdv-alerts small { font: 500 12px/1.4 Inter, Arial, sans-serif; color: #5f5f5a; overflow-wrap: anywhere; }
        @media (max-width: 860px) {
          .pdv-grid { grid-template-columns: 1fr; }
          .pdv-alerts li { grid-template-columns: 1fr; gap: 4px; }
        }
      `}</style>
    </main>
  );
}
