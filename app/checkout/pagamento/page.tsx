'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import PaymentBrick from '@/components/payment-brick';

function PaymentPage() {
  const params = useSearchParams();
  const orderId = params.get('orderId') || '';
  const amount = Number(params.get('total') || 0);
  const email = params.get('email') || '';
  const preferenceId = params.get('preferenceId') || undefined;
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);

  if (!orderId || !amount) return <main className="payment-page"><div className="payment-card"><h1>Pagamento indisponível</h1><p>Não foi possível carregar os dados do pagamento.</p><Link href="/carrinho">Voltar ao carrinho</Link></div></main>;

  return (
    <main className="payment-page">
      <div className="payment-top">PAGAMENTO SEGURO <span>•</span> 2P BOX</div>
      <header className="payment-header"><Link href="/" className="payment-brand"><span className="logo-frame"><img src="/logo.pnh.png" alt="2P Box"/></span><div><strong>PAGAMENTO</strong><small>PAGAMENTO SEGURO PELO MERCADO PAGO</small></div></Link></header>
      <section className="payment-container">
        <div className="payment-heading"><p>PEDIDO {orderId}</p><h1>Finalize seu pagamento</h1><span>Você está em um ambiente seguro. Escolha a forma de pagamento abaixo.</span></div>
        <div className="payment-card">
          {paid ? <div className="payment-success"><div className="success-mark">✓</div><h2>Pagamento enviado!</h2><p>Recebemos o pagamento do pedido <strong>{orderId}</strong>. Você pode acompanhar o pedido pela sua conta.</p><Link href={`/pedido/${orderId}`} className="payment-button">Acompanhar pedido</Link></div> : <><div className="payment-total"><span>Total do pedido</span><strong>R$ {amount.toFixed(2).replace('.', ',')}</strong></div><PaymentBrick amount={amount} orderId={orderId} email={email} preferenceId={preferenceId} onResult={(result) => { if (result.status === 'approved') setPaid(true); else setError(`Pagamento ${result.status || 'em análise'}. Você poderá acompanhar o pedido.`); }} onError={setError}/>{error && <div className="payment-error">{error}</div>}</>}
        </div>
        <p className="payment-note">Seus dados de pagamento são processados pelo Mercado Pago. A 2P Box não recebe nem armazena os dados do seu cartão.</p>
      </section>
      <style jsx>{`
        .payment-page{min-height:100vh;background:#f7f7f5;color:#111;overflow-x:hidden}.payment-top{height:36px;background:#111;color:#fff;display:flex;justify-content:center;align-items:center;font:800 9px Inter,Arial,sans-serif;letter-spacing:.2em}.payment-top span{color:#ffc400;margin:0 8px}.payment-header{height:92px;background:#fff;border-bottom:1px solid #e5e5e5;overflow:hidden}.payment-brand{height:100%;width:min(1120px,calc(100% - 32px));margin:auto;display:flex;align-items:center;gap:14px;text-decoration:none;color:#111;min-width:0}.logo-frame{width:72px;height:54px;flex:0 0 72px;display:flex;align-items:center;justify-content:center;overflow:hidden}.payment-brand img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center}.payment-brand div{min-width:0}.payment-brand strong{display:block;font:900 20px/1 'Barlow Condensed',Arial,sans-serif;font-style:italic}.payment-brand small{display:block;margin-top:5px;font:800 8px/1 Inter,Arial,sans-serif;letter-spacing:.13em;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.payment-container{width:min(760px,calc(100% - 28px));margin:0 auto;padding:50px 0 70px}.payment-heading{text-align:center;margin-bottom:25px}.payment-heading p{margin:0 0 8px;color:#9a7200;font:900 9px Inter,Arial,sans-serif;letter-spacing:.2em}.payment-heading h1{margin:0;font:900 48px/.95 'Barlow Condensed',Arial,sans-serif;font-style:italic;text-transform:uppercase}.payment-heading span{display:block;margin:11px auto 0;color:#777;font:13px/1.5 Inter,Arial,sans-serif}.payment-card{background:#fff;border:1px solid #dedede;border-radius:20px;padding:24px;box-shadow:0 18px 50px rgba(0,0,0,.06);min-width:0;overflow:hidden}.payment-total{display:flex;justify-content:space-between;align-items:end;padding:0 0 18px;margin-bottom:18px;border-bottom:1px solid #eee}.payment-total span{font:800 10px Inter,Arial,sans-serif;color:#777;text-transform:uppercase;letter-spacing:.08em}.payment-total strong{font:900 25px 'Barlow Condensed',Arial,sans-serif}.payment-error{margin-top:15px;padding:12px;border-radius:9px;background:#fff1f1;border:1px solid #eccaca;color:#9a2626;font:11px/1.4 Inter,Arial,sans-serif}.payment-success{text-align:center;padding:35px 15px}.success-mark{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;margin:auto;background:#ffc400;font:bold 30px Arial}.payment-success h2{margin:16px 0 8px;font:900 32px 'Barlow Condensed',Arial,sans-serif;text-transform:uppercase}.payment-success p{max-width:480px;margin:0 auto 20px;color:#666;font:13px/1.6 Inter,Arial,sans-serif}.payment-button{display:inline-flex;padding:13px 20px;background:#ffc400;color:#111;border-radius:10px;text-decoration:none;font:900 12px Inter,Arial,sans-serif}.payment-note{max-width:600px;margin:15px auto 0;text-align:center;color:#888;font:10px/1.5 Inter,Arial,sans-serif}@media(max-width:600px){.payment-header{height:76px}.payment-brand{width:calc(100% - 28px);gap:9px}.logo-frame{width:58px;height:42px;flex-basis:58px}.payment-brand strong{font-size:15px}.payment-brand small{font-size:6px}.payment-container{padding-top:34px}.payment-heading h1{font-size:39px}.payment-heading span{font-size:12px}.payment-card{padding:16px;border-radius:16px}.payment-total strong{font-size:22px}}
      `}</style>
    </main>
  );
}

export default function PaymentPageWrapper() { return <Suspense fallback={<main className="payment-page"><div className="payment-card">Carregando pagamento...</div></main>}><PaymentPage/></Suspense>; }