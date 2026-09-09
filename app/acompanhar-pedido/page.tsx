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
      <div className="track-topbar">
        <span>QUALIDADE</span><b>•</b><span>VARIEDADE</span><b>•</b><span>CONFIANÇA</span>
      </div>

      <header className="track-header">
        <div className="track-header-inner">
          <Link href="/" className="track-brand" aria-label="2P Box - voltar para a loja">
            <img src="/logo.pnh.png" alt="2P Box" />
            <span>
              <strong>2P BOX</strong>
              <small>ACOMPANHAMENTO DE PEDIDO</small>
            </span>
          </Link>
          <Link href="/loja" className="track-store-link">Voltar para a loja</Link>
        </div>
      </header>

      <section className="track-content">
        <div className="track-card">
          <div className="track-icon"><Package size={25} strokeWidth={2.1} /></div>
          <p className="track-eyebrow">COMPRA SEM LOGIN</p>
          <h1>Acompanhe seu pedido</h1>
          <p className="track-intro">
            Consulte o andamento da sua compra informando o número do pedido e o e-mail usado no checkout.
          </p>

          <form onSubmit={submit} noValidate>
            <div className="track-field">
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

            <div className="track-field">
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

          <Link href="/loja" className="track-back">
            <ArrowLeft size={15} />
            Voltar para a loja
          </Link>
        </div>
      </section>

      <footer className="track-footer">
        <span>2P BOX</span>
        <span>QUALIDADE • VARIEDADE • CONFIANÇA</span>
      </footer>

      <style jsx>{`
        .track-page {
          width: 100%;
          min-width: 0;
          min-height: 100svh;
          overflow-x: hidden;
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          background: #f7f7f5;
          color: #111;
        }

        .track-topbar {
          width: 100%;
          min-height: 30px;
          padding: 7px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: #111;
          color: #fff;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .18em;
          text-align: center;
        }

        .track-topbar b { opacity: .45; }

        .track-header {
          width: 100%;
          background: #fff;
          border-bottom: 1px solid #e8e8e5;
        }

        .track-header-inner {
          width: min(1180px, calc(100% - 40px));
          min-width: 0;
          min-height: 78px;
          margin: 0 auto;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .track-brand {
          min-width: 0;
          max-width: 100%;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #111;
          text-decoration: none;
        }

        .track-brand img {
          width: 60px;
          height: 48px;
          flex: 0 0 auto;
          object-fit: contain;
        }

        .track-brand span {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .track-brand strong {
          display: block;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: .1em;
          line-height: 1;
        }

        .track-brand small {
          display: block;
          color: #999;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: .13em;
          white-space: nowrap;
        }

        .track-store-link {
          flex: 0 0 auto;
          color: #333;
          text-decoration: none;
          font-size: 10px;
          font-weight: 850;
          padding: 10px 13px;
          border: 1px solid #deded9;
          border-radius: 8px;
          white-space: nowrap;
        }

        .track-content {
          width: 100%;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 58px 20px 64px;
        }

        .track-card {
          width: min(520px, 100%);
          min-width: 0;
          padding: 38px 40px 32px;
          background: #fff;
          border: 1px solid #e4e4df;
          border-radius: 18px;
          box-shadow: 0 18px 55px rgba(0, 0, 0, .055);
          text-align: center;
        }

        .track-icon {
          width: 58px;
          height: 58px;
          margin: 0 auto 18px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #ffc400;
          color: #111;
        }

        .track-eyebrow {
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
          overflow-wrap: anywhere;
        }

        .track-intro {
          width: min(410px, 100%);
          margin: 13px auto 28px;
          color: #70706c;
          font-size: 12px;
          line-height: 1.65;
        }

        .track-card form {
          width: 100%;
          min-width: 0;
          display: grid;
          gap: 16px;
          text-align: left;
        }

        .track-field {
          width: 100%;
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .track-field label {
          color: #222;
          font-size: 10px;
          font-weight: 900;
        }

        .track-field input {
          width: 100%;
          min-width: 0;
          height: 48px;
          box-sizing: border-box;
          border: 1px solid #d8d8d3;
          border-radius: 9px;
          padding: 0 13px;
          background: #fff;
          color: #111;
          font-family: inherit;
          font-size: 16px;
          line-height: 1;
          outline: none;
          -webkit-appearance: none;
        }

        .track-field input::placeholder { color: #a6a6a2; }
        .track-field input:focus { border-color: #111; box-shadow: 0 0 0 3px rgba(255,196,0,.16); }

        .track-card button {
          width: 100%;
          min-width: 0;
          min-height: 50px;
          margin-top: 2px;
          padding: 0 16px;
          border: 0;
          border-radius: 9px;
          background: #ffc400;
          color: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          font-weight: 950;
          white-space: normal;
        }

        .track-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 22px;
          color: #5e5e5a;
          text-decoration: none;
          font-size: 10px;
          font-weight: 850;
        }

        .track-footer {
          width: 100%;
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
          text-align: center;
        }

        .track-footer span:first-child { color: #ffc400; }

        @media (max-width: 600px) {
          .track-topbar {
            min-height: 28px;
            padding: 6px 10px;
            gap: 7px;
            font-size: 7px;
            letter-spacing: .12em;
          }

          .track-header-inner {
            width: 100%;
            min-height: 68px;
            padding: 0 14px;
            gap: 10px;
          }

          .track-brand { gap: 8px; }
          .track-brand img { width: 50px; height: 40px; }
          .track-brand strong { font-size: 13px; letter-spacing: .08em; }
          .track-brand small { font-size: 6px; letter-spacing: .08em; overflow: hidden; text-overflow: ellipsis; }
          .track-store-link { padding: 9px 10px; font-size: 9px; }

          .track-content {
            align-items: flex-start;
            padding: 28px 12px 38px;
          }

          .track-card {
            width: 100%;
            padding: 28px 18px 25px;
            border-radius: 15px;
          }

          .track-icon { width: 54px; height: 54px; margin-bottom: 15px; }
          .track-eyebrow { font-size: 8px; letter-spacing: .15em; }
          .track-card h1 { font-size: clamp(24px, 7vw, 29px); }
          .track-intro { margin-top: 12px; margin-bottom: 22px; font-size: 12px; line-height: 1.55; }
          .track-card form { gap: 14px; }
          .track-field input { height: 50px; }
          .track-card button { min-height: 50px; }

          .track-footer {
            flex-direction: column;
            gap: 5px;
            padding: 15px 12px;
            font-size: 7px;
            letter-spacing: .13em;
          }
        }

        @media (max-width: 390px) {
          .track-header-inner { padding-inline: 10px; }
          .track-brand img { width: 44px; height: 36px; }
          .track-brand strong { font-size: 12px; }
          .track-brand small { display: none; }
          .track-store-link { padding: 8px 9px; font-size: 8px; }
          .track-content { padding-inline: 8px; }
          .track-card { padding-inline: 15px; }
        }

        @media (max-width: 340px) {
          .track-store-link { font-size: 0; }
          .track-store-link::after { content: 'Loja'; font-size: 9px; }
          .track-card h1 { font-size: 23px; }
          .track-intro { font-size: 11px; }
        }
      `}</style>
    </main>
  );
}
