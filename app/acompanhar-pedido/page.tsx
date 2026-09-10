'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Mail, Package, Search } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { TextField } from '@/components/ui/field';
import { InlineLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { isValidEmail } from '@/lib/masks';

export default function TrackOrderPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setError('Informe um e-mail válido.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/pedido/status?email=${encodeURIComponent(normalized)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.order?.id) {
        const message = data.error || 'Nenhum pedido encontrado para este e-mail.';
        setError(message);
        toast.warning('Pedido não localizado', message);
        return;
      }
      try {
        localStorage.setItem('2p_guest_order_email', normalized);
        localStorage.setItem('2p_last_order_id', String(data.order.id));
      } catch {}
      toast.success('Pedido encontrado', 'Abrindo o acompanhamento...');
      window.location.href = `/pedido/${encodeURIComponent(String(data.order.id))}?email=${encodeURIComponent(normalized)}`;
    } catch {
      const message = 'Não foi possível consultar o pedido agora. Tente novamente.';
      setError(message);
      toast.error('Falha na consulta', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="track-page">
      <SiteHeader subtitle="ACOMPANHAR PEDIDO" />

      <section className="track-hero">
        <div className="track-container">
          <div className="track-heading">
            <p className="track-eyebrow">2P BOX • PEDIDOS</p>
            <h1>
              Acompanhe seu <em>pedido.</em>
            </h1>
            <p className="track-lead">Digite o e-mail usado na compra e encontre seu pedido. Não é necessário informar o número do pedido.</p>
          </div>

          <div className="track-layout">
            <aside className="track-side">
              <div className="track-side-number">01</div>
              <Package size={28} strokeWidth={1.6} />
              <h2>
                Seu pedido,
                <br />
                <em>do começo ao fim.</em>
              </h2>
              <p>Sem login. Use o mesmo e-mail informado no checkout e acompanhe cada etapa em tempo real.</p>
            </aside>

            <div className="track-card">
              <div className="track-card-head">
                <div className="track-icon">
                  <Search size={21} strokeWidth={2} />
                </div>
                <div>
                  <p>CONSULTA RÁPIDA</p>
                  <h2>Localize sua compra</h2>
                </div>
              </div>

              <form onSubmit={submit} noValidate>
                <TextField
                  label="E-mail da compra"
                  type="email"
                  mask="email"
                  autoComplete="email"
                  placeholder="voce@email.com"
                  value={email}
                  error={error}
                  icon={<Mail size={16} />}
                  onValueChange={setEmail}
                  fullWidth
                />
                <button type="submit" disabled={loading}>
                  {loading ? <InlineLoader label="Consultando..." /> : <>ACOMPANHAR PEDIDO <ArrowRight size={17} /></>}
                </button>
              </form>

              <Link href="/loja" className="track-back">
                <ArrowLeft size={15} /> Voltar para a loja
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="track-bottom">
        <div className="track-container track-bottom-inner">
          <p>2P BOX</p>
          <h2>Precisa de ajuda com seu pedido?</h2>
          <Link href="/loja">
            CONTINUAR COMPRANDO <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="track-footer">
        <div className="track-container">
          <span>© 2026 2P Box. Todos os direitos reservados.</span>
          <strong>QUALIDADE • VARIEDADE • CONFIANÇA</strong>
        </div>
      </footer>

      <style jsx global>{`
        .track-page{--yellow:#ffc400;--gold:#e7ad00;--line:#e7e7e7;min-height:100svh;background:#fff;color:#111;font-family:Inter,Arial,sans-serif;overflow-x:hidden}
        .track-container{width:min(1180px,calc(100% - 56px));margin:0 auto}
        .track-hero{position:relative;overflow:hidden;background:linear-gradient(105deg,#fff 0%,#fff 63%,#fffdf2 100%);border-bottom:1px solid var(--line);padding:70px 0 84px}
        .track-hero:after{content:'';position:absolute;width:520px;height:330px;right:-150px;top:150px;background:radial-gradient(ellipse,rgba(255,196,0,.18),transparent 70%);pointer-events:none}
        .track-heading{position:relative;z-index:1;max-width:720px}
        .track-eyebrow{margin:0 0 13px;color:#9a7200;font:900 10px Inter,Arial,sans-serif;letter-spacing:.34em}
        .track-heading h1{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:clamp(50px,7vw,74px);line-height:.9;letter-spacing:-.025em;font-weight:800;font-style:italic;text-transform:uppercase}
        .track-heading h1 em{color:var(--gold);font-style:italic}
        .track-lead{max-width:590px;margin:23px 0 0;color:#686868;font-size:15px;line-height:1.65}
        .track-layout{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1.25fr;margin-top:52px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
        .track-side{min-height:345px;padding:34px 55px 34px 0;border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:flex-start}
        .track-side-number{color:#a37b00;font:900 9px Inter,Arial,sans-serif;letter-spacing:.18em;margin-bottom:26px}
        .track-side svg{margin-bottom:24px}
        .track-side h2{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:40px;line-height:.94;text-transform:uppercase;font-style:italic}
        .track-side h2 em{color:var(--gold);font-style:italic}
        .track-side p{max-width:280px;margin:17px 0 0;color:#777;font-size:12px;line-height:1.55}
        .track-card{align-self:center;width:min(560px,calc(100% - 70px));margin-left:70px;padding:34px 36px;background:#fff;border:1px solid #deded9;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.06)}
        .track-card-head{display:flex;align-items:center;gap:14px;margin-bottom:24px}
        .track-icon{width:48px;height:48px;flex:none;display:grid;place-items:center;background:var(--yellow);border-radius:50%}
        .track-card-head p{margin:0 0 4px;color:#9a7200;font:900 8px Inter,Arial,sans-serif;letter-spacing:.18em}
        .track-card-head h2{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:27px;line-height:1;text-transform:uppercase;font-style:italic}
        .track-card form{display:grid;gap:16px}
        .track-card button{width:100%;min-height:50px;border:0;border-radius:9px;background:var(--yellow);color:#111;display:flex;align-items:center;justify-content:center;gap:9px;font:900 10px Inter,Arial,sans-serif;letter-spacing:.1em;cursor:pointer}
        .track-card button:hover:not(:disabled){background:#111;color:#fff}
        .track-card button:disabled{opacity:.7;cursor:wait}
        .track-back{display:inline-flex;align-items:center;gap:6px;margin-top:20px;color:#666;text-decoration:none;font:800 10px Inter,Arial,sans-serif}
        .track-bottom{padding:52px 0;background:#111;color:#fff}
        .track-bottom-inner{display:flex;align-items:center;gap:25px}
        .track-bottom p{margin:0;color:var(--yellow);font:900 9px Inter,Arial,sans-serif;letter-spacing:.2em}
        .track-bottom h2{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:32px;font-style:italic;text-transform:uppercase}
        .track-bottom a{margin-left:auto;min-height:46px;padding:0 18px;display:flex;align-items:center;gap:8px;background:var(--yellow);color:#111;text-decoration:none;border-radius:8px;font:900 9px Inter,Arial,sans-serif;letter-spacing:.1em}
        .track-footer{background:#fff;padding:20px 0;color:#888;font-size:9px}
        .track-footer .track-container{display:flex;justify-content:space-between;gap:20px}
        .track-footer strong{color:#555;font-size:8px;letter-spacing:.15em}
        @media(max-width:900px){
          .track-container{width:min(100% - 36px,660px)}
          .track-hero{padding:48px 0 56px}
          .track-layout{grid-template-columns:1fr;margin-top:38px}
          .track-side{min-height:0;padding:26px 0;border-right:0;border-bottom:1px solid var(--line)}
          .track-side h2{font-size:33px}
          .track-card{width:100%;margin:28px 0 0;padding:26px 22px}
          .track-bottom{padding:38px 0}
          .track-bottom-inner{flex-wrap:wrap}
          .track-bottom a{margin-left:0;width:100%;justify-content:center}
          .track-footer .track-container{flex-direction:column;align-items:center;text-align:center}
        }
        @media(max-width:480px){
          .track-container{width:calc(100% - 28px)}
          .track-hero{padding:34px 0 42px}
          .track-heading h1{font-size:clamp(38px,13vw,54px)}
          .track-lead{font-size:13px;margin-top:16px}
          .track-side h2{font-size:30px}
          .track-card{padding:22px 16px}
          .track-card-head h2{font-size:23px}
          .track-bottom h2{font-size:25px;width:100%}
        }
      `}</style>
    </main>
  );
}
