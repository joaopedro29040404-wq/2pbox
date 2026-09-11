'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ClipboardCheck, Copy, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import { InlineLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { money, shortId } from '@/lib/order-format';

type PixData = { qrCode: string | null; qrCodeBase64: string | null; ticketUrl: string | null; expiresAt?: string | null };

type Props = {
  amount: number;
  orderId: string;
  email: string;
  cpf?: string;
  name?: string;
  onApproved: () => void;
  onError: (message: string) => void;
};

const POLL_MS = 4000;

export default function PixPayment({ amount, orderId, email, cpf, name, onApproved, onError }: Props) {
  const [pix, setPix] = useState<PixData | null>(null);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const approved = useRef(false);
  const toast = useToast();

  const createPix = useCallback(async (renew = false) => {
    if (creating) return;
    setCreating(true);
    if (renew) {
      setPix(null);
      setRemaining(null);
    }
    try {
      const response = await fetch('/api/mercadopago/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          total: amount,
          renew,
          formData: {
            payment_method_id: 'pix',
            email,
            payer: {
              email,
              ...(name ? { first_name: name.split(/\s+/)[0], last_name: name.split(/\s+/).slice(1).join(' ') } : {}),
              ...((cpf || '').replace(/\D/g, '').length === 11
                ? { identification: { type: 'CPF', number: (cpf || '').replace(/\D/g, '') } }
                : {}),
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.statusDetail || data?.error || 'Não foi possível gerar o PIX.');
      if (!data?.pix?.qrCode && !data?.pix?.qrCodeBase64) throw new Error('O Mercado Pago não retornou o QR Code do PIX.');

      setPix(data.pix as PixData);
      setFailed(false);
    } catch (error) {
      setFailed(true);
      onError(error instanceof Error ? error.message : 'Não foi possível gerar o PIX.');
    } finally {
      setCreating(false);
    }
  }, [amount, cpf, creating, email, name, onError, orderId]);

  const checkStatus = useCallback(async () => {
    if (approved.current) return;
    setChecking(true);
    try {
      const response = await fetch(`/api/mercadopago/payment-status?orderId=${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const status = String(data?.paymentStatus || '').toLowerCase();
      if (status === 'paid') {
        approved.current = true;
        toast.success('PIX confirmado!', 'Seu pagamento foi aprovado.');
        onApproved();
      }
    } catch {
      // Falha de rede momentanea nao invalida o PIX ja exibido.
    } finally {
      setChecking(false);
    }
  }, [orderId, onApproved, toast]);

  useEffect(() => {
    if (!pix) return;
    const timer = window.setInterval(() => void checkStatus(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [pix, checkStatus]);

  useEffect(() => {
    if (!pix?.expiresAt) return;
    const target = new Date(pix.expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [pix?.expiresAt]);

  async function copyCode() {
    if (!pix?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      toast.success('Código copiado', 'Cole no app do seu banco.');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar', 'Selecione o código manualmente.');
    }
  }

  // O QR so nasce depois que o cliente confirma: o pedido ja existe, o que
  // falta e o pagamento, e a tela precisa deixar essa separacao clara.
  if (!pix) {
    return (
      <div className="pix-confirm">
        <div className="pix-total">
          <span>Valor a pagar</span>
          <strong>{money(amount)}</strong>
        </div>

        <ol className="pix-steps">
          <li>Confirme o pedido abaixo</li>
          <li>Geramos o QR Code e o código copia e cola na hora</li>
          <li>Pague pelo app do seu banco — esta tela avança sozinha</li>
        </ol>

        <button type="button" className="pix-cta" onClick={() => void createPix()} disabled={creating}>
          {creating ? (
            <InlineLoader label="Registrando seu pedido..." />
          ) : failed ? (
            <>
              <RefreshCw size={16} /> Tentar gerar o PIX novamente
            </>
          ) : (
            <>
              <QrCode size={17} /> Confirmar pedido e gerar PIX
            </>
          )}
        </button>

        {failed && <p className="pix-failed">Não conseguimos gerar o PIX agora. Seu pedido continua salvo — tente de novo em instantes.</p>}

        <p className="pix-note">
          <ShieldCheck size={13} /> Nada é cobrado até você pagar o PIX no app do seu banco.
        </p>
      </div>
    );
  }

  const minutes = remaining !== null ? Math.floor(remaining / 60) : null;
  const seconds = remaining !== null ? remaining % 60 : null;

  return (
    <div className="pix-wrap">
      <div className="pix-placed">
        <ClipboardCheck size={19} />
        <div>
          <strong>Pedido {shortId(orderId)} registrado</strong>
          <span>Falta apenas o pagamento. Assim que o PIX cair, confirmamos automaticamente.</span>
        </div>
      </div>

      <div className="pix-total">
        <span>Valor a pagar</span>
        <strong>{money(amount)}</strong>
      </div>

      {pix.qrCodeBase64 && (
        <div className="pix-qr">
          <img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code do PIX" />
        </div>
      )}

      <ol className="pix-steps">
        <li>Abra o app do seu banco e escolha pagar com PIX</li>
        <li>Aponte para o QR Code ou use o código copia e cola</li>
        <li>Confirme o pagamento — esta tela avança sozinha</li>
      </ol>

      {pix.qrCode && (
        <div className="pix-code">
          <code>{pix.qrCode}</code>
          <button type="button" onClick={copyCode} className={copied ? 'is-copied' : ''}>
            {copied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar código</>}
          </button>
        </div>
      )}

      <div className="pix-status">
        <span className={`pix-dot ${checking ? 'is-active' : ''}`} />
        <strong>Aguardando confirmação do pagamento</strong>
        {minutes !== null && seconds !== null && remaining! > 0 && (
          <small>
            expira em {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </small>
        )}
      </div>

      {remaining === 0 && (
        <div className="pix-expired">
          <p>Este PIX expirou.</p>
          <button type="button" onClick={() => void createPix(true)}>
            <RefreshCw size={15} /> Gerar um novo
          </button>
        </div>
      )}

      <p className="pix-note">
        <ShieldCheck size={13} /> Pagamento processado pelo Mercado Pago. A confirmação chega pelo retorno oficial, não
        pela sua palavra — por isso é seguro.
      </p>

      <style jsx>{`
        .pix-wrap,.pix-confirm{display:grid;gap:18px}
        .pix-cta{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:54px;border:0;border-radius:10px;background:#ffc400;color:#111;font:900 12.5px Inter,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
        .pix-cta:hover:not(:disabled){background:#111;color:#fff}
        .pix-cta:disabled{opacity:.75;cursor:wait}
        .pix-failed{margin:0;padding:12px 14px;background:#fff2f2;border:1px solid #f0cccc;border-radius:10px;color:#8f2626;font-size:12px;line-height:1.5}
        .pix-placed{display:flex;align-items:flex-start;gap:11px;padding:14px 15px;background:#effaf1;border:1px solid #bfe6c8;border-radius:11px}
        .pix-placed svg{flex:none;margin-top:1px;color:#276b36}
        .pix-placed>div{display:grid;gap:3px}
        .pix-placed strong{font:800 12.5px Inter,Arial,sans-serif;color:#1f5b2c}
        .pix-placed span{font-size:11.5px;line-height:1.5;color:#3f7a4d}
        .pix-expired button{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 18px;border:1px solid #dcdcd6;border-radius:9px;background:#fff;font:800 12px Inter,Arial,sans-serif;cursor:pointer}
        .pix-total{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-bottom:14px;border-bottom:1px solid #eee}
        .pix-total span{font:800 10px Inter,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#777}
        .pix-total strong{font:900 26px 'Barlow Condensed',Inter,sans-serif}
        .pix-qr{display:grid;place-items:center;padding:18px;background:#fff;border:1px solid #e6e6e2;border-radius:14px}
        .pix-qr img{width:min(240px,100%);height:auto;display:block;image-rendering:pixelated}
        .pix-steps{margin:0;padding:0 0 0 20px;display:grid;gap:7px;color:#5d5d5d;font-size:12.5px;line-height:1.5}
        .pix-code{display:grid;gap:10px}
        .pix-code code{display:block;padding:12px 13px;background:#f7f7f5;border:1px solid #e6e6e2;border-radius:9px;font:400 11px/1.5 ui-monospace,Menlo,monospace;overflow-wrap:anywhere;max-height:88px;overflow-y:auto}
        .pix-code button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border:0;border-radius:9px;background:#ffc400;color:#111;font:900 12px Inter,Arial,sans-serif;cursor:pointer}
        .pix-code button:hover{background:#111;color:#fff}
        .pix-code button.is-copied{background:#111;color:#fff}
        .pix-status{display:flex;align-items:center;gap:9px;padding:13px 15px;background:#fafaf7;border:1px solid #e8e8df;border-radius:10px}
        .pix-status strong{font:800 11px Inter,Arial,sans-serif}
        .pix-status small{margin-left:auto;color:#8a8a86;font-size:10px;white-space:nowrap}
        .pix-dot{width:8px;height:8px;flex:none;border-radius:50%;background:#d3d3d0}
        .pix-dot.is-active{background:#ffc400}
        .pix-expired{display:grid;gap:10px;padding:14px 15px;background:#fff4f4;border:1px solid #f0cccc;border-radius:10px;text-align:center}
        .pix-expired p{margin:0;font:700 12px Inter,Arial,sans-serif;color:#8f2626}
        .pix-note{display:flex;align-items:flex-start;gap:6px;margin:0;color:#8a8a86;font-size:10px;line-height:1.5}
        @media(max-width:600px){.pix-total strong{font-size:23px}.pix-qr{padding:12px}}
      `}</style>
    </div>
  );
}
