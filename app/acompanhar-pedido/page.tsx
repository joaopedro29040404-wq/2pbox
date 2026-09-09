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
      <div className="topbar">
        <span>QUALIDADE</span><b>•</b><span>VARIEDADE</span><b>•</b><span>CONFIANÇA</span>
      </div>

      <header className="track-header">
        <div className="track-header-inner">
          <Link href="/" className="brand" aria-label="2P Box - voltar para a loja">
            <img src="/logo.pnh.png" alt="2P Box" />
            <div>
              <strong>2P BOX</strong>
              <small>ACOMPANHAMENTO DE PEDIDO</small>
            </div>
          </Link>
          <Link href="/loja" className="store-link">Voltar para a loja</Link>
        </div>
      </header>

      <section className="track-section">
        <div className="track-card">
          <div className="icon"><Package size={25} strokeWidth={2.1} /></div>
          <p className="eyebrow">COMPRA SEM LOGIN</p>
          <h1>Acompanhe seu pedido</h1>
          <p className="intro">
            Consulte o andamento da sua compra informando o número do pedido e o e-mail usado no checkout.
          </p>

          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="order">Número do pedido</label>
              <input
                id="order"
                value={orderId}
                onChange={e => setOrderId(e.target.value)}
                placeholder="Ex.: 8f31a2c4-..."
                autoComplete="off"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="email">E-mail da compra</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
                required
              />
            </div>

            <button type="submit">
              <Search size={17} strokeWidth={2.2} />
              Acompanhar pedido
            </button>
          </form>

          <Link href="/loja" className="back">
            <ArrowLeft size={15} />
            Voltar para a loja
          </Link>
        </div>
      </section>

      <footer>
        <span>2P BOX</span>
        <span>QUALIDADE • VARIEDADE • CONFIANÇA</span>
      </footer>

      <style jsx>{`
        .track-page {
          min-height: 100svh;
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          background: #f7f7f5;
          color: #111;
        }

        .topbar {
          min-height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 7px 16px;
          background: #111;
          color: #fff;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .18em;
        }

        .topbar b { opacity: .45; }

        .track-header {
          background: #fff;
          border-bottom: 1px solid #e8e8e5;
        }

        .track-header-inner {
          width: min(1180px, calc(100% - 40px));
          min-height: 78px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .brand {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #111;
          text-decoration: none;
        }

        .brand img {
          width: 60px;
          height: 48px;
          object-fit: contain;
          flex: 0 0 auto;
        }

        .brand div { display: grid; gap: 2px; min-width: 0; }
        .brand strong { font-size: 15px; font-weight: 950; letter-spacing: .1em; line-height: 1; }
        .brand small { color: #999; font-size: 7px; font-weight: 800; letter-spacing: .13em; white-space: nowrap; }

        .store-link {
          color: #333;
          text-decoration: none;
          font-size: 10px;
          font-weight: 850;
          padding: 10px 13px;
          border: 1px solid #deded9;
          border-radius: 8px;
          transition: background .18s ease, border-color .18s ease;
        }

        .store-link:hover { background: #f7f7f5; border-color: #cfcfca; }

        .track-section {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 58px 20px 64px;
        }

        .track-card {
          width: min(520px, 100%);
          padding: 38px 40px 32px;
          background: #fff;
          border: 1px solid #e4e4df;
          border-radius: 18px;
          box-shadow: 0 18px 55px rgba(0, 0, 0, .055);
          text-align: center;
        }

        .icon {
          width: 58px;
          height: 58px;
          margin: 0 auto 18px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #ffc400;
          color: #111;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #a17a00;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .18em;
        }

        .track-card h1 {
          margin: 0;
          font-size: clamp(27px, 4vw, 34px);
          line-height: 1.08;
          letter-spacing: -.035em;
        }

        .intro {
          max-width: 410px;
          margin: 13px auto 28px;
          color: #70706c;
          font-size: 12px;
          line-height: 1.65;
        }

        .track-card form { display: grid; gap: 16px; text-align: left; }
        .field { display: grid; gap: 7px; }
        .track-card label { color: #222; font-size: 10px; font-weight: 900; }

        .track-card input {
          width: 100%;
          height: 46px;
          box-sizing: border-box;
          border: 1px solid #d8d8d3;
          border-radius: 9px;
          padding: 0 13px;
          background: #fff;
          color: #111;
          font: inherit;
          font-size: 13px;
          outline: none;
          transition: border-color .18s ease, box-shadow .18s ease;
        }

        .track-card input::placeholder { color: #a6a6a2; }
        .track-card input:focus { border-color: #111; box-shadow: 0 0 0 3px rgba(255,196,0,.16); }

        .track-card button {
          width: 100%;
          min-height: 48px;
          margin-top: 2px;
          border: 0;
          border-radius: 9px;
          background: #ffc400;
          color: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .01em;
          transition: transform .15s ease, filter .15s ease;
        }

        .track-card button:hover { filter: brightness(.97); transform: translateY(-1px); }
        .track-card button:active { transform: translateY(0); }

        .back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 22px;
          color: #5e5e5a;
          text-decoration: none;
          font-size: 10px;
          font-weight: 850;
        }

        .back:hover { color: #111; }

        footer {
          min-height: 58px;
          box-sizing: border-box;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          background: #111;
          color: #fff;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .16em;
        }

        footer span:first-child { color: #ffc400; }

        @media (max-width: 600px) {
          .topbar { font-size: 7px; gap: 7px; letter-spacing: .14em; }
          .track-header-inner { width: min(100% - 28px, 1180px); min-height: 68px; }
          .brand img { width: 52px; height: 42px; }
          .brand strong { font-size: 13px; }
          .brand small { font-size: 6px; letter-spacing: .1em; }
          .store-link { padding: 9px 10px; font-size: 9px; }
          .track-section { padding: 32px 14px 42px; align-items: flex-start; }
          .track-card { padding: 30px 20px 26px; border-radius: 15px; }
          .icon { width: 54px; height: 54px; margin-bottom: 16px; }
          .track-card h1 { font-size: 26px; }
          .intro { margin-bottom: 24px; font-size: 11.5px; }
          .track-card input { height: 48px; }
          .track-card button { min-height: 50px; }
          footer { flex-direction: column; gap: 5px; padding: 16px; font-size: 7px; }
        }

        @media (max-width: 380px) {
          .track-header-inner { width: calc(100% - 20px); }
          .brand small { display: none; }
          .store-link { padding: 8px; }
          .track-section { padding-inline: 10px; }
          .track-card { padding-inline: 17px; }
        }
      `}</style>
    </main>
  );
}
