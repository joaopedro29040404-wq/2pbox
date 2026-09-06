'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Search } from 'lucide-react';

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const id = orderId.trim().replace(/^#/, '');
    const normalizedEmail = email.trim().toLowerCase();
    if (!id || !normalizedEmail) return;
    try {
      localStorage.setItem('2p_guest_order_email', normalizedEmail);
      localStorage.setItem('2p_last_order_id', id);
    } catch {}
    window.location.href = `/pedido/${encodeURIComponent(id)}?email=${encodeURIComponent(normalizedEmail)}`;
  }

  return (
    <main className="track-page">
      <header><Link href="/" className="brand"><img src="/logo.pnh.png" alt="2P Box" /><span>2P BOX<small>ACOMPANHAMENTO DE PEDIDO</small></span></Link></header>
      <section className="track-card">
        <div className="icon"><Package size={28} /></div>
        <p className="eyebrow">COMPRA SEM LOGIN</p>
        <h1>Acompanhe seu pedido</h1>
        <p className="intro">Você não precisa criar uma conta para acompanhar sua compra. Informe o número do pedido e o e-mail usado no checkout.</p>
        <form onSubmit={submit}>
          <label htmlFor="order">Número do pedido</label>
          <input id="order" value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="Ex.: 8f31a2c4-..." autoComplete="off" required />
          <label htmlFor="email">E-mail da compra</label>
          <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" required />
          <button type="submit"><Search size={17} /> Acompanhar pedido</button>
        </form>
        <Link href="/loja" className="back"><ArrowLeft size={15} /> Voltar para a loja</Link>
      </section>
      <footer>2P BOX • QUALIDADE • VARIEDADE • CONFIANÇA</footer>
      <style jsx>{`.track-page{min-height:100vh;background:#f7f7f5;color:#111;display:grid;grid-template-rows:auto 1fr auto}.track-page header{height:78px;background:#fff;border-bottom:1px solid #e8e8e5;display:flex;align-items:center;padding:0 max(20px,calc((100% - 1180px)/2))}.brand{display:flex;align-items:center;gap:9px;text-decoration:none;color:#111;font-size:13px;font-weight:900;letter-spacing:.08em}.brand img{width:66px;height:48px;object-fit:contain}.brand span{display:grid;gap:2px}.brand small{font-size:7px;letter-spacing:.14em;color:#999}.track-card{width:min(480px,calc(100% - 32px));align-self:center;justify-self:center;margin:50px auto;padding:36px;background:#fff;border:1px solid #e4e4df;border-radius:18px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.04)}.icon{width:60px;height:60px;margin:0 auto 18px;border-radius:50%;background:#fff4bf;display:grid;place-items:center}.eyebrow{margin:0 0 7px;color:#b68c00;font-size:9px;font-weight:900;letter-spacing:.18em}.track-card h1{margin:0 0 10px;font-size:30px;letter-spacing:-.03em}.intro{margin:0 auto 25px;color:#777;font-size:12px;line-height:1.6}.track-card form{display:grid;gap:8px;text-align:left}.track-card label{font-size:10px;font-weight:900;margin-top:5px}.track-card input{height:44px;border:1px solid #d9d9d4;border-radius:8px;padding:0 12px;font-size:13px;outline:none}.track-card input:focus{border-color:#111}.track-card button{height:46px;margin-top:8px;border:0;border-radius:9px;background:#ffc400;color:#111;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.back{display:inline-flex;align-items:center;gap:6px;margin-top:20px;color:#555;text-decoration:none;font-size:10px;font-weight:800}footer{padding:22px;text-align:center;background:#111;color:#fff;font-size:9px;font-weight:900;letter-spacing:.18em}@media(max-width:600px){.track-card{margin:30px auto;padding:27px 20px}.track-card h1{font-size:25px}}`}</style>
    </main>
  );
}
