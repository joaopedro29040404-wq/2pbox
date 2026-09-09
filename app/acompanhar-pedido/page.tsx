'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Menu, Package, Search, ShoppingBag, X } from 'lucide-react';

export default function TrackOrderPage() {
  const [email, setEmail] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/pedido/status?email=${encodeURIComponent(normalizedEmail)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.order?.id) { setError(data.error || 'Nenhum pedido encontrado para este e-mail.'); return; }
      try { localStorage.setItem('2p_guest_order_email', normalizedEmail); localStorage.setItem('2p_last_order_id', String(data.order.id)); } catch {}
      window.location.href = `/pedido/${encodeURIComponent(String(data.order.id))}?email=${encodeURIComponent(normalizedEmail)}`;
    } catch { setError('Não foi possível consultar o pedido agora. Tente novamente.'); }
    finally { setLoading(false); }
  }

  return (
    <main className="track-page">
      <div className="track-topbar"><span>QUALIDADE</span><b>•</b><span>VARIEDADE</span><b>•</b><span>CONFIANÇA</span></div>
      <header className="track-header">
        <div className="track-container track-header-inner">
          <Link href="/" className="track-brand" aria-label="2P Box - início">
            <Image src="/logo.pnh.png" alt="2P Box" width={150} height={70} priority />
          </Link>
          <nav className={menuOpen ? 'track-nav track-nav-open' : 'track-nav'}>
            <Link href="/" onClick={() => setMenuOpen(false)}>Início</Link><Link href="/loja" onClick={() => setMenuOpen(false)}>Loja</Link><Link href="/acompanhar-pedido" onClick={() => setMenuOpen(false)}>Acompanhar pedido</Link>
          </nav>
          <div className="track-actions"><Link href="/conta" className="track-account">Entrar</Link><Link href="/carrinho" className="track-cart"><ShoppingBag size={18} strokeWidth={1.9}/><span>Carrinho</span></Link><button className="track-menu" onClick={() => setMenuOpen(v => !v)} aria-label="Abrir menu">{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button></div>
        </div>
      </header>
      <section className="track-hero"><div className="track-container">
        <div className="track-heading"><p className="track-eyebrow">2P BOX • PEDIDOS</p><h1>Acompanhe seu <em>pedido.</em></h1><p className="track-lead">Digite o e-mail usado na compra e encontre seu pedido. Não é necessário informar o número do pedido.</p></div>
        <div className="track-layout">
          <aside className="track-side"><div className="track-side-number">01</div><Package size={28} strokeWidth={1.6}/><h2>Seu pedido,<br/><em>do começo ao fim.</em></h2><p>Sem login. Use o mesmo e-mail informado no checkout e localize sua compra.</p></aside>
          <div className="track-card"><div className="track-card-head"><div className="track-icon"><Search size={21} strokeWidth={2}/></div><div><p>CONSULTA RÁPIDA</p><h2>Localize sua compra</h2></div></div>
            <form onSubmit={submit} noValidate><label htmlFor="email">E-mail da compra</label><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" required />{error && <p className="track-error" role="alert">{error}</p>}<button type="submit" disabled={loading}>{loading ? 'CONSULTANDO...' : 'ACOMPANHAR PEDIDO'} <ArrowRight size={17}/></button></form>
            <Link href="/loja" className="track-back"><ArrowLeft size={15}/> Voltar para a loja</Link>
          </div>
        </div>
      </div></section>
      <section className="track-bottom"><div className="track-container track-bottom-inner"><p>2P BOX</p><h2>Precisa de ajuda com seu pedido?</h2><Link href="/loja">CONTINUAR COMPRANDO <ArrowRight size={16/></Link></div></section>
      <footer className="track-footer"><div className="track-container"><span>© 2026 2P Box. Todos os direitos reservados.</span><strong>QUALIDADE • VARIEDADE • CONFIANÇA</strong></div></footer>
      <style jsx global>{`
        .track-page{--yellow:#ffc400;--gold:#e7ad00;--ink:#111;--muted:#707070;--line:#e7e7e7;min-height:100svh;background:#fff;color:var(--ink);font-family:Inter,Arial,sans-serif;overflow-x:hidden}
        .track-container{width:min(1180px,calc(100% - 56px));margin:0 auto}.track-topbar{height:34px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;gap:14px;font-size:10px;font-weight:800;letter-spacing:.25em}.track-topbar b{color:var(--yellow);font-size:9px}
        .track-header{height:86px;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:50}.track-header-inner{height:100%;display:flex;align-items:center;gap:38px}.track-brand{display:block;width:112px;height:56px;flex:none}.track-brand img{width:100%;height:100%;object-fit:contain}.track-nav{display:flex;align-items:center;gap:34px;margin-left:auto}.track-nav a,.track-account{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:#111}.track-nav a:hover,.track-account:hover{color:var(--gold)}.track-actions{display:flex;align-items:center;gap:20px}.track-account{white-space:nowrap}.track-cart{height:42px;display:flex;align-items:center;gap:9px;padding:0 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:11px;font-weight:800}.track-menu{display:none;width:42px;height:42px;background:#fff;border:1px solid #ddd;border-radius:8px}
        .track-hero{position:relative;overflow:hidden;background:linear-gradient(105deg,#fff 0%,#fff 63%,#fffdf2 100%);border-bottom:1px solid var(--line);padding:76px 0 88px}.track-hero:after{content:'';position:absolute;width:520px;height:330px;right:-150px;top:150px;background:radial-gradient(ellipse,rgba(255,196,0,.18),transparent 70%);pointer-events:none}.track-heading{position:relative;z-index:1;max-width:720px}.track-eyebrow{margin:0 0 13px;color:#9a7200;font-size:10px;font-weight:900;letter-spacing:.34em}.track-heading h1{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:clamp(52px,7vw,76px);line-height:.9;letter-spacing:-.025em;font-weight:800;font-style:italic;text-transform:uppercase}.track-heading h1 em{color:var(--gold);font-style:italic}.track-lead{max-width:590px;margin:23px 0 0;color:#686868;font-size:15px;line-height:1.65}
        .track-layout{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1.25fr;gap:0;margin-top:55px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.track-side{min-height:345px;padding:34px 55px 34px 0;border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:flex-start}.track-side-number{color:#a37b00;font-size:9px;font-weight:900;letter-spacing:.18em;margin-bottom:26px}.track-side svg{margin-bottom:24px}.track-side h2{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:42px;line-height:.94;text-transform:uppercase;font-style:italic}.track-side h2 em{color:var(--gold);font-style:italic}.track-side p{max-width:270px;margin:17px 0 0;color:#777;font-size:12px;line-height:1.55}
        .track-card{align-self:center;width:min(560px,calc(100% - 70px));margin-left:70px;padding:36px 38px;background:#fff;border:1px solid #deded9;border-radius:10px;box-shadow:0 20px 50px rgba(0,0,0,.06)}.track-card-head{display:flex;align-items:center;gap:14px;margin-bottom:26px}.track-icon{width:48px;height:48px;flex:none;display:grid;place-items:center;background:var(--yellow);border-radius:50%}.track-card-head p{margin:0 0 4px;color:#9a7200;font-size:8px;font-weight:900;letter-spacing:.18em}.track-card-head h2{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:27px;line-height:1;text-transform:uppercase;font-style:italic}.track-card form{display:grid;gap:8px}.track-card label{margin-top:7px;font-size:10px;font-weight:900;letter-spacing:.03em}.track-card input{width:100%;height:48px;box-sizing:border-box;border:1px solid #d8d8d3;border-radius:7px;padding:0 13px;background:#fff;color:#111;font:inherit;font-size:16px;outline:none}.track-card input:focus{border-color:#111;box-shadow:0 0 0 3px rgba(255,196,0,.16)}.track-card input::placeholder{color:#a6a6a2}.track-card button{width:100%;min-height:48px;margin-top:10px;border:0;border-radius:7px;background:var(--yellow);color:#111;display:flex;align-items:center;justify-content:center;gap:9px;font-size:10px;font-weight:900;letter-spacing:.1em;cursor:pointer}.track-card button:disabled{opacity:.65;cursor:wait}.track-error{margin:4px 0 0;padding:10px 11px;border:1px solid #f0cccc;border-radius:7px;background:#fff3f3;color:#a22;font-size:10px;line-height:1.4}.track-back{display:inline-flex;align-items:center;gap:6px;margin-top:20px;color:#666;text-decoration:none;font-size:10px;font-weight:800}
        .track-bottom{padding:54px 0;background:#111;color:#fff}.track-bottom-inner{display:flex;align-items:center;gap:25px}.track-bottom p{margin:0;color:var(--yellow);font-size:9px;font-weight:900;letter-spacing:.2em}.track-bottom h2{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:32px;font-style:italic;text-transform:uppercase}.track-bottom a{margin-left:auto;min-height:44px;padding:0 18px;display:flex;align-items:center;gap:8px;background:var(--yellow);color:#111;text-decoration:none;border-radius:7px;font-size:9px;font-weight:900;letter-spacing:.1em}.track-footer{background:#fff;padding:20px 0;color:#888;font-size:9px}.track-footer .track-container{display:flex;justify-content:space-between;gap:20px}.track-footer strong{color:#555;font-size:8px;letter-spacing:.15em}
        @media(max-width:900px){.track-container{width:min(100% - 36px,640px)}.track-nav{display:none}.track-menu{display:grid;place-items:center}.track-actions{margin-left:auto}.track-account{display:none}.track-header{height:76px}.track-brand{width:94px;height:52px}.track-nav-open{position:absolute;top:110px;left:18px;right:18px;display:flex;flex-direction:column;align-items:stretch;gap:0;padding:8px;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 14px 35px rgba(0,0,0,.12)}.track-nav-open a{padding:14px;font-size:10px;border-bottom:1px solid #eee}.track-nav-open a:last-child{border-bottom:0}.track-hero{padding:52px 0 58px}.track-heading h1{font-size:clamp(46px,12vw,68px)}.track-layout{grid-template-columns:1fr;margin-top:40px}.track-side{min-height:0;padding:27px 0;border-right:0;border-bottom:1px solid var(--line)}.track-side h2{font-size:34px}.track-card{width:100%;box-sizing:border-box;margin:30px 0 0;padding:28px 24px}.track-bottom{padding:38px 0}.track-bottom-inner{flex-wrap:wrap}.track-bottom a{margin-left:0}.track-footer .track-container{flex-direction:column;align-items:center;text-align:center}}
        @media(max-width:480px){.track-container{width:calc(100% - 28px)}.track-topbar{height:30px;gap:8px;font-size:7px;letter-spacing:.14em}.track-header{height:68px}.track-brand{width:82px;height:48px}.track-cart span{display:none}.track-cart{width:42px;height:42px;padding:0;justify-content:center}.track-hero{padding:38px 0 45px}.track-eyebrow{font-size:8px;letter-spacing:.22em}.track-heading h1{font-size:clamp(40px,13vw,56px)}.track-lead{font-size:13px;line-height:1.55;margin-top:17px}.track-layout{margin-top:31px}.track-side{padding:23px 0}.track-side-number{margin-bottom:18px}.track-side svg{margin-bottom:17px}.track-side h2{font-size:31px}.track-side p{font-size:11px}.track-card{margin-top:22px;padding:23px 17px;border-radius:8px}.track-card-head{margin-bottom:20px;gap:11px}.track-icon{width:43px;height:43px}.track-card-head h2{font-size:23px}.track-card input{height:48px}.track-card button{min-height:50px}.track-bottom-inner{gap:12px}.track-bottom h2{font-size:25px;width:100%}.track-bottom a{width:100%;justify-content:center}.track-footer{font-size:8px}}
        @media(max-width:340px){.track-brand{width:72px}.track-hero{padding-top:30px}.track-heading h1{font-size:38px}.track-card{padding-inline:14px}.track-card-head h2{font-size:21px}}
      `}</style>
    </main>
  );
}
