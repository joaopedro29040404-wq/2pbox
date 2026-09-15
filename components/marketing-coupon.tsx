'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag, X, LoaderCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCart } from '@/components/cart-provider';
import { money } from '@/lib/order-format';

export function MarketingCoupon() {
  const pathname = usePathname();
  const { subtotal, coupon, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pathname !== '/carrinho') {
      setHost(null);
      return;
    }
    const timer = window.setInterval(() => {
      const summary = document.querySelector('.cart-summary');
      if (!summary) return;
      let target = summary.querySelector<HTMLElement>('[data-marketing-coupon]');
      if (!target) {
        target = document.createElement('div');
        target.dataset.marketingCoupon = 'true';
        summary.insertBefore(target, summary.querySelector('.summary-total') || null);
      }
      setHost(target);
      window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, [pathname]);

  if (pathname !== '/carrinho' || !host) return null;

  const submit = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return setMessage('Digite um código de cupom.');
    setLoading(true);
    setMessage('');
    const valid: boolean = await applyCoupon(normalized);
    setLoading(false);
    if (!valid) {
      setMessage('Cupom inválido, expirado ou não elegível para este carrinho.');
      return;
    }
    setCode('');
    setMessage('Cupom aplicado com sucesso.');
  };

  return createPortal(
    <section className="marketing-coupon-box">
      <div className="marketing-coupon-head">
        <div><Tag size={16} /><strong>Tem um cupom?</strong></div>
        {coupon ? <button type="button" onClick={() => { removeCoupon(); setMessage(''); }} aria-label="Remover cupom"><X size={15} /></button> : null}
      </div>
      {coupon ? (
        <div className="marketing-coupon-applied">
          <div><b>{coupon.code}</b><span>{coupon.discount > 0 ? `Desconto de ${money(coupon.discount)}` : 'Cupom aplicado'}</span></div>
          <small>Subtotal após desconto: {money(Math.max(0, subtotal - coupon.discount))}</small>
        </div>
      ) : (
        <div className="marketing-coupon-form">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }} placeholder="Digite seu cupom" maxLength={60} autoComplete="off" />
          <button type="button" onClick={() => void submit()} disabled={loading || !code.trim()}>{loading ? <LoaderCircle size={15} className="marketing-coupon-spin" /> : 'Aplicar'}</button>
        </div>
      )}
      {message ? <p className={`marketing-coupon-message ${coupon ? 'success' : 'error'}`}>{message}</p> : null}
      <style jsx global>{`
        .marketing-coupon-box{padding:16px 0;border-bottom:1px solid #eee}
        .marketing-coupon-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
        .marketing-coupon-head>div{display:flex;align-items:center;gap:7px;color:#9a7600}
        .marketing-coupon-head strong{font-size:13px;text-transform:uppercase;letter-spacing:.03em;color:#111}
        .marketing-coupon-head>button{border:0;background:#f3f3f1;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;cursor:pointer;color:#666}
        .marketing-coupon-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}
        .marketing-coupon-form input{width:100%;height:40px;border:1px solid #ddd;border-radius:8px;padding:0 11px;font:700 12px Inter,Arial,sans-serif;outline:none;text-transform:uppercase}
        .marketing-coupon-form input:focus{border-color:#b18b00;box-shadow:0 0 0 3px rgba(255,196,0,.14)}
        .marketing-coupon-form button{height:40px;border:0;border-radius:8px;background:#111;color:#fff;padding:0 12px;font-size:11px;font-weight:800;cursor:pointer}
        .marketing-coupon-form button:disabled{opacity:.45;cursor:not-allowed}
        .marketing-coupon-applied{padding:11px 12px;border:1px solid #d8e8dc;background:#f5fbf6;border-radius:9px}
        .marketing-coupon-applied>div{display:flex;justify-content:space-between;gap:10px;align-items:center}
        .marketing-coupon-applied b{font-size:12px;letter-spacing:.06em}
        .marketing-coupon-applied span,.marketing-coupon-applied small{display:block;color:#39814f;font-size:11px}
        .marketing-coupon-applied small{margin-top:5px}
        .marketing-coupon-message{margin:7px 0 0;font-size:10px;line-height:1.35}
        .marketing-coupon-message.error{color:#b3261e}.marketing-coupon-message.success{color:#267443}
        .marketing-coupon-spin{animation:marketing-coupon-spin .8s linear infinite}@keyframes marketing-coupon-spin{to{transform:rotate(360deg)}}
      `}</style>
    </section>,
    host,
  );
}
