'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import PaymentBrick from '@/components/payment-brick';
import { PageLoader } from '@/components/ui/loader';

function PaymentPage() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get('orderId') || '';
  const amount = Number(params.get('total') || 0);
  const email = params.get('email') || '';
  const [error, setError] = useState('');

  if (!orderId || !amount) return <main className="payment-page"><div className="payment-card"><h1>Pagamento indisponível</h1><p>Não foi possível carregar os dados do pagamento.</p><Link href="/carrinho">Voltar ao carrinho</Link></div></main>;

  const handlePaymentResult = (result: { id?: string | number; status?: string; statusDetail?: string }) => {
    const status = result.status || 'pending';
    setError('');
    const query = new URLSearchParams({ payment: status });
    if (result.id) query.set('paymentId', String(result.id));
    if (result.statusDetail) query.set('statusDetail', result.statusDetail);
    router.push(`/pagamento/${encodeURIComponent(orderId)}?${query.toString()}`);
  };

  return (
    <main className="payment-page">
      <div className="payment-top">PAGAMENTO SEGURO <span>•</span> 2P BOX</div>
      <header className="payment-header"><Link href="/" className="payment-brand"><span className="logo-frame"><img src="/logo.pnh.png" alt="2P Box"/></span><div><strong>PAGAMENTO</strong><small>PAGAMENTO SEGURO PELO MERCADO PAGO</small></div></Link></header>
      <section className="payment-container">
        <div className="payment-heading"><p>PEDIDO {orderId}</p><h1>Finalize seu pagamento</h1><span>Você está em um ambiente seguro. Escolha a forma de pagamento abaixo.</span></div>
        <div className="payment-card">
          <div className="payment-total"><span>Total do pedido</span><strong>R$ {amount.toFixed(2).replace('.', ',')}</strong></div>
          <PaymentBrick amount={amount} orderId={orderId} email={email} onResult={handlePaymentResult} onError={setError}/>
          {error && <div className="payment-error">{error}</div>}
        </div>
        <p className="payment-note">Seus dados de pagamento são processados pelo Mercado Pago. A 2P Box não recebe nem armazena os dados do seu cartão.</p>
      </section>
      <style jsx>{`
        .payment-page{--yellow:#ffc400;min-height:100svh;background:#f7f7f5;color:#111;overflow-x:hidden;display:flex;flex-direction:column;font-family:Inter,Arial,sans-serif}
        .payment-top{height:34px;flex:0 0 34px;background:#111;color:#fff;display:flex;justify-content:center;align-items:center;font:800 9px Inter,Arial,sans-serif;letter-spacing:.2em}.payment-top span{color:var(--yellow);margin:0 8px}
        .payment-header{height:78px;flex:0 0 78px;background:#fff;border-bottom:1px solid #e5e5e5;overflow:hidden}.payment-brand{height:100%;width:min(1180px,calc(100% - 40px));margin:auto;display:flex;align-items:center;gap:11px;text-decoration:none;color:#111;min-width:0}.logo-frame{width:54px;height:40px;flex:0 0 54px;display:flex;align-items:center;justify-content:center;overflow:hidden}.payment-brand img{display:block;width:100%;height:100%;object-fit:contain;object-position:center}.payment-brand div{min-width:0}.payment-brand strong{display:block;font:900 17px/1 'Barlow Condensed',Arial,sans-serif;font-style:italic}.payment-brand small{display:block;margin-top:4px;font:800 7px/1 Inter,Arial,sans-serif;letter-spacing:.1em;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .payment-container{width:min(760px,calc(100% - 32px));margin:0 auto;padding:42px 0 58px;flex:1}.payment-heading{text-align:center;margin-bottom:22px}.payment-heading p{margin:0 0 7px;color:#9a7200;font:900 8px Inter,Arial,sans-serif;letter-spacing:.2em;overflow-wrap:anywhere}.payment-heading h1{margin:0;font:900 clamp(34px,5vw,48px)/.95 'Barlow Condensed',Arial,sans-serif;font-style:italic;text-transform:uppercase}.payment-heading span{display:block;margin:10px auto 0;color:#777;font:13px/1.5 Inter,Arial,sans-serif;max-width:620px}
        .payment-card{background:#fff;border:1px solid #dedede;border-radius:16px;padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.06);min-width:0;overflow:hidden}.payment-total{display:flex;justify-content:space-between;align-items:end;gap:12px;padding:0 0 16px;margin-bottom:16px;border-bottom:1px solid #eee}.payment-total span{font:800 9px Inter,Arial,sans-serif;color:#777;text-transform:uppercase;letter-spacing:.08em}.payment-total strong{font:900 24px 'Barlow Condensed',Arial,sans-serif;white-space:nowrap}.payment-error{margin-top:15px;padding:12px;border-radius:9px;background:#fff1f1;border:1px solid #eccaca;color:#9a2626;font:11px/1.4 Inter,Arial,sans-serif;overflow-wrap:anywhere}.payment-note{max-width:600px;margin:13px auto 0;text-align:center;color:#888;font:9px/1.5 Inter,Arial,sans-serif}
        @media(max-width:600px){.payment-top{height:30px;flex-basis:30px;font-size:7px;letter-spacing:.12em}.payment-top span{margin:0 5px}.payment-header{height:68px;flex-basis:68px}.payment-brand{width:calc(100% - 24px);gap:8px}.logo-frame{width:46px;height:34px;flex-basis:46px}.payment-brand strong{font-size:14px}.payment-brand small{font-size:6px;letter-spacing:.08em}.payment-container{width:calc(100% - 20px);padding:28px 0 40px}.payment-heading{margin-bottom:18px}.payment-heading p{font-size:7px}.payment-heading h1{font-size:clamp(30px,9vw,38px)}.payment-heading span{font-size:11px;line-height:1.45;padding:0 4px}.payment-card{padding:14px;border-radius:13px}.payment-total{align-items:center;padding-bottom:13px;margin-bottom:13px}.payment-total span{font-size:8px}.payment-total strong{font-size:21px}.payment-note{font-size:8px;padding:0 8px}}
        @media(max-width:340px){.payment-brand{width:calc(100% - 18px)}.logo-frame{width:42px;height:31px;flex-basis:42px}.payment-brand strong{font-size:13px}.payment-brand small{font-size:5px}.payment-container{width:calc(100% - 14px)}.payment-card{padding:11px}.payment-heading h1{font-size:28px}.payment-heading span{font-size:10px}}
      `}</style>
    </main>
  );
}

export default function PaymentPageWrapper() {
  return (
    <Suspense fallback={<PageLoader title="Carregando pagamento" description="Preparando o ambiente seguro do Mercado Pago." />}>
      <PaymentPage />
    </Suspense>
  );
}