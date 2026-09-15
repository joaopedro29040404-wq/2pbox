'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bike, Gift, LoaderCircle, MessageCircle, Minus, Plus, ShoppingBag, Store, Trash2, Zap } from 'lucide-react';
import { useCart } from '@/components/cart-provider';
import { SiteHeader } from '@/components/site-header';
import { RadioGroup } from '@/components/ui/field';
import { ProductImage } from '@/components/ui/product-image';
import { money } from '@/lib/order-format';

type DeliveryOption = { provider: string; label: string; description: string; fee: number | null; needsAddress: boolean; available?: boolean; reason?: string };

const ICONS: Record<string, React.ReactNode> = {
  pickup: <Store size={19} />,
  own: <Bike size={19} />,
  express: <Zap size={19} />,
  app: <Bike size={19} />,
};

function normalizeCep(value: string) {
  return value.replace(/\D/g, '').slice(0, 8);
}

function formatCep(value: string) {
  const digits = normalizeCep(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export default function CarrinhoPage() {
  const { items, setQty, remove, total, count, clear } = useCart();
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [delivery, setDelivery] = useState('pickup');
  const [cep, setCep] = useState('');
  const [cepError, setCepError] = useState('');
  const [calculatingFreight, setCalculatingFreight] = useState(false);
  const [freightCalculated, setFreightCalculated] = useState(false);
  const [freeShippingFrom, setFreeShippingFrom] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/entrega/cotacao', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const list: DeliveryOption[] = Array.isArray(data?.options) ? data.options : [];
        setOptions(list);
        setFreeShippingFrom(Number.isFinite(Number(data?.freeShippingFrom)) && Number(data.freeShippingFrom) > 0 ? Number(data.freeShippingFrom) : null);
        if (list.length) setDelivery(list[0].provider);
      })
      .catch(() => {
        if (active) setOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const calculateFreight = async () => {
    const normalized = normalizeCep(cep);
    if (normalized.length !== 8) {
      setCepError('Informe um CEP válido com 8 dígitos.');
      setFreightCalculated(false);
      return;
    }

    setCalculatingFreight(true);
    setCepError('');
    try {
      const response = await fetch('/api/entrega/cotacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ address: { postal_code: normalized } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Não foi possível calcular o frete.');

      const list: DeliveryOption[] = Array.isArray(data?.options) ? data.options : [];
      setOptions(list);
      setFreeShippingFrom(Number.isFinite(Number(data?.freeShippingFrom)) && Number(data.freeShippingFrom) > 0 ? Number(data.freeShippingFrom) : null);
      setFreightCalculated(true);

      const current = list.find((option) => option.provider === delivery);
      if (!current || current.available === false || (current.fee == null && current.provider !== 'pickup')) {
        const firstAvailable = list.find((option) => option.available !== false && (option.provider === 'pickup' || option.fee != null));
        if (firstAvailable) setDelivery(firstAvailable.provider);
      }
    } catch (error) {
      setCepError(error instanceof Error ? error.message : 'Não foi possível calcular o frete.');
      setFreightCalculated(false);
    } finally {
      setCalculatingFreight(false);
    }
  };

  const selected = options.find((option) => option.provider === delivery);
  const selectedFee = selected?.fee ?? null;
  const orderTotal = total + (selectedFee || 0);
  const freeShippingActive = freeShippingFrom != null && total >= freeShippingFrom;
  const freeShippingRemaining = freeShippingFrom != null ? Math.max(0, freeShippingFrom - total) : 0;
  const freeShippingProgress = freeShippingFrom != null ? Math.min(100, Math.round((total / freeShippingFrom) * 100)) : 0;

  return (
    <main className="cart-page-shell">
      <SiteHeader subtitle="SEU CARRINHO" />
      <section className="container section cart-page">
        <div className="cart-intro">
          <p className="eyebrow">SEU PEDIDO</p>
          <h1 className="cart-title">Carrinho</h1>
          <p>Confira seus produtos e escolha como deseja receber.</p>
        </div>

        {items.length === 0 ? (
          <div className="empty-cart">
            <div className="cart-empty-icon">
              <ShoppingBag size={30} />
            </div>
            <p className="eyebrow">NENHUM ITEM</p>
            <h2>Seu carrinho está vazio</h2>
            <p>Adicione produtos à sua sacola para começar seu pedido.</p>
            <Link className="primary" href="/loja">
              Explorar produtos
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              <div className="cart-list-head">
                <strong>PRODUTOS</strong>
                <div>
                  <span>
                    {count} {count === 1 ? 'item' : 'itens'}
                  </span>
                  <button type="button" onClick={() => clear()}>
                    <Trash2 size={13} /> Esvaziar
                  </button>
                </div>
              </div>

              {items.map((item) => (
                <article className="cart-item" key={item.id}>
                  <div className="cart-product-image">
                    <ProductImage src={item.image_url} alt={item.name} sizes="120px" />
                  </div>
                  <div className="cart-product-info">
                    <p className="cart-product-label">PRODUTO</p>
                    <h2>{item.name}</h2>
                    <p className="cart-unit-price">
                      {money(item.price)} <span>cada</span>
                    </p>
                    <p className="cart-stock">Disponível: {item.stock} unidade(s)</p>
                  </div>
                  <div className="cart-item-actions">
                    <div className="quantity-control">
                      <button type="button" className="quantity-btn" onClick={() => setQty(item.id, item.quantity - 1)} aria-label="Diminuir" disabled={item.quantity <= 1}>
                        <Minus size={15} />
                      </button>
                      <strong>{item.quantity}</strong>
                      <button type="button" className="quantity-btn" onClick={() => setQty(item.id, item.quantity + 1)} aria-label="Aumentar" disabled={item.quantity >= item.stock}>
                        <Plus size={15} />
                      </button>
                    </div>
                    <button type="button" className="remove-btn" onClick={() => remove(item.id)}>
                      <Trash2 size={15} /> Remover
                    </button>
                  </div>
                  <div className="cart-subtotal">{money(item.price * item.quantity)}</div>
                </article>
              ))}
            </div>

            <aside className="cart-summary">
              <div className="summary-heading">
                <div>
                  <p className="eyebrow">RESUMO</p>
                  <h2>Seu pedido</h2>
                </div>
                <ShoppingBag size={21} />
              </div>

              <div className="summary-line">
                <span>Produtos</span>
                <strong>{money(total)}</strong>
              </div>

              {freeShippingFrom != null && (
                <div className={`free-shipping-cart ${freeShippingActive ? 'is-active' : ''}`}>
                  <div className="free-shipping-cart-top">
                    <div className="free-shipping-cart-icon">
                      {freeShippingActive ? <Gift size={18} /> : <Bike size={18} />}
                    </div>
                    <div>
                      <strong>{freeShippingActive ? 'FRETE GRÁTIS LIBERADO' : 'GANHE FRETE GRÁTIS'}</strong>
                      <span>{freeShippingActive ? 'Seu pedido atingiu o valor mínimo.' : `Faltam ${money(freeShippingRemaining)} para liberar na entrega padrão.`}</span>
                    </div>
                  </div>
                  {!freeShippingActive && (
                    <>
                      <div className="free-shipping-progress"><span style={{ width: `${freeShippingProgress}%` }} /></div>
                      <div className="free-shipping-cart-footer">A partir de {money(freeShippingFrom)} em compras</div>
                    </>
                  )}
                </div>
              )}

              <div className="freight-calculator">
                <div className="freight-calculator-heading">
                  <div>
                    <strong>Calcule o frete</strong>
                    <span>Digite seu CEP para consultar o valor da entrega.</span>
                  </div>
                </div>
                <div className="cep-row">
                  <input
                    value={formatCep(cep)}
                    onChange={(event) => {
                      setCep(normalizeCep(event.target.value));
                      setCepError('');
                      setFreightCalculated(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void calculateFreight();
                      }
                    }}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={9}
                    placeholder="00000-000"
                    aria-label="CEP"
                  />
                  <button type="button" onClick={() => void calculateFreight()} disabled={calculatingFreight || normalizeCep(cep).length !== 8}>
                    {calculatingFreight ? <LoaderCircle size={16} className="spin" /> : 'Calcular'}
                  </button>
                </div>
                {cepError ? <p className="cep-feedback error">{cepError}</p> : freightCalculated ? <p className="cep-feedback success">Frete calculado para o CEP informado.</p> : null}
              </div>

              <div className="delivery-choice">
                <RadioGroup
                  name="delivery"
                  label="Como você quer receber?"
                  value={delivery}
                  options={options.map((option) => ({
                    value: option.provider,
                    label: option.label,
                    description: option.available === false ? option.description : option.fee != null && option.fee > 0 ? `${option.description} · ${money(option.fee)}` : option.fee === 0 ? option.description : option.description,
                    icon: ICONS[option.provider] || <MessageCircle size={19} />,
                    disabled: option.available === false || (freightCalculated && option.provider !== 'pickup' && option.fee == null),
                  }))}
                  onValueChange={setDelivery}
                />
              </div>

              <div className="summary-line">
                <span>Entrega</span>
                <span className="summary-muted">
                  {selected ? (selectedFee != null && selectedFee > 0 ? `${selected.label} · ${money(selectedFee)}` : selected.label) : 'Escolha uma opção'}
                </span>
              </div>

              <div className="summary-total">
                <span>Total do pedido</span>
                <strong>{money(orderTotal)}</strong>
              </div>

              <Link className="primary checkout-btn" href={`/checkout?entrega=${delivery}`}>
                <span>Finalizar pedido</span>
                <ArrowRight size={16} />
              </Link>
              <Link className="back-store" href="/loja">
                Continuar comprando
              </Link>
            </aside>
          </div>
        )}
      </section>

      <style jsx global>{`
        .cart-page-shell{background:#fff;color:#101010;min-height:100vh}
        .cart-page-shell .section{padding-top:48px;padding-bottom:80px}
        .cart-intro{margin-bottom:32px}
        .cart-intro .eyebrow{color:#9a7600;margin-bottom:8px}
        .cart-title{font-family:'Barlow Condensed';font-size:58px;line-height:.95;text-transform:uppercase;font-style:italic;margin:0 0 10px}
        .cart-intro>p:last-child{color:#686868;margin:0;font-size:14px}
        .cart-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:26px;align-items:start}
        .cart-items{display:grid;gap:14px}
        .cart-list-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0 4px 10px;font-size:10px;letter-spacing:.14em;color:#777}
        .cart-list-head>div{display:flex;align-items:center;gap:12px}
        .cart-list-head span{letter-spacing:0;text-transform:none;font-size:12px}
        .cart-list-head button{display:inline-flex;align-items:center;gap:5px;border:0;background:none;color:#8a8a8a;letter-spacing:0;font:700 11px Inter,Arial,sans-serif;cursor:pointer}
        .cart-list-head button:hover{color:#c62828}
        .cart-item{position:relative;display:grid;grid-template-columns:120px minmax(0,1fr) auto;grid-template-rows:auto auto;gap:16px;padding:18px;border:1px solid #e9e9e9;border-radius:18px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.025);transition:box-shadow .2s,border-color .2s}
        .cart-item:hover{border-color:#d9c98d;box-shadow:0 8px 24px rgba(0,0,0,.06)}
        .cart-product-image{grid-row:1/3;width:120px;height:120px;border-radius:12px;overflow:hidden;background:#f7f7f5}
        .cart-product-info{min-width:0}
        .cart-product-label{font-size:10px;letter-spacing:.12em;font-weight:800;color:#a07800;margin:2px 0 7px}
        .cart-product-info h2{font-family:'Barlow Condensed';font-size:26px;text-transform:uppercase;margin:0 0 7px;line-height:1}
        .cart-unit-price{font-weight:700;margin:0}
        .cart-unit-price span{font-weight:400;color:#686868;font-size:12px}
        .cart-stock{font-size:12px;color:#686868;margin:8px 0 0}
        .cart-item-actions{display:flex;align-items:center;gap:10px;align-self:center;flex-wrap:wrap}
        .quantity-control{display:flex;align-items:center;border:1px solid #e9e9e9;border-radius:9px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04)}
        .quantity-control strong{min-width:36px;text-align:center;font-size:14px}
        .quantity-btn{width:36px;height:38px;border:0;background:#fff;display:grid;place-items:center;cursor:pointer}
        .quantity-btn:hover:not(:disabled){background:#fafafa}
        .quantity-btn:disabled{opacity:.35;cursor:not-allowed}
        .remove-btn{height:38px;border:0;background:#fff;color:#555;display:inline-flex;align-items:center;gap:6px;padding:0 8px;cursor:pointer;font-weight:600}
        .remove-btn:hover{color:#c62828}
        .cart-subtotal{grid-column:2/4;justify-self:end;font-size:18px;font-weight:800}
        .cart-summary{position:sticky;top:110px;border:1px solid #dedede;border-radius:18px;padding:24px;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.055)}
        .summary-heading{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
        .summary-heading .eyebrow{margin-bottom:4px;color:#9a7600}
        .summary-heading h2{font-family:'Barlow Condensed';font-size:28px;text-transform:uppercase;margin:0;font-style:italic}
        .summary-line{display:flex;justify-content:space-between;gap:15px;padding:12px 0;font-size:14px;border-bottom:1px solid #eee}
        .summary-muted{color:#686868;text-align:right;font-size:12px}
        .free-shipping-cart{margin:14px 0 4px;padding:13px 14px;border:1px solid #ead37a;border-radius:12px;background:linear-gradient(135deg,#fffaf0,#fff7d6)}
        .free-shipping-cart.is-active{border-color:#86c99b;background:#f0fbf3}
        .free-shipping-cart-top{display:flex;align-items:center;gap:10px}
        .free-shipping-cart-icon{width:34px;height:34px;flex:0 0 34px;border-radius:9px;background:#ffc400;display:grid;place-items:center;color:#111}
        .free-shipping-cart.is-active .free-shipping-cart-icon{background:#2e9b5b;color:#fff}
        .free-shipping-cart-top>div:last-child{display:grid;gap:3px;min-width:0}
        .free-shipping-cart strong{font:900 10.5px Inter,Arial,sans-serif;letter-spacing:.04em}
        .free-shipping-cart span{font-size:10px;line-height:1.4;color:#666}
        .free-shipping-progress{height:5px;margin-top:11px;background:#eadfb8;border-radius:99px;overflow:hidden}
        .free-shipping-progress span{display:block;height:100%;border-radius:inherit;background:#ffc400;transition:width .25s ease}
        .free-shipping-cart-footer{font-size:9px;color:#8a6d00;margin-top:6px;text-align:right}
        .freight-calculator{padding:18px 0 12px;border-bottom:1px solid #eee}
        .freight-calculator-heading{margin-bottom:10px}
        .freight-calculator-heading strong{display:block;font-size:14px;text-transform:uppercase;letter-spacing:.04em}
        .freight-calculator-heading span{display:block;color:#686868;font-size:11px;line-height:1.4;margin-top:4px}
        .cep-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
        .cep-row input{width:100%;height:42px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font:600 13px Inter,Arial,sans-serif;outline:none}
        .cep-row input:focus{border-color:#b18b00;box-shadow:0 0 0 3px rgba(255,196,0,.16)}
        .cep-row button{height:42px;border:0;border-radius:8px;padding:0 13px;background:#111;color:#fff;font:800 11px Inter,Arial,sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px}
        .cep-row button:hover:not(:disabled){background:#ffc400;color:#111}
        .cep-row button:disabled{opacity:.45;cursor:not-allowed}
        .cep-feedback{font-size:11px;margin:7px 0 0;line-height:1.35}
        .cep-feedback.error{color:#c62828}
        .cep-feedback.success{color:#3d6b22}
        .spin{animation:cart-spin .8s linear infinite}
        @keyframes cart-spin{to{transform:rotate(360deg)}}
        .delivery-choice{padding:18px 0 10px}
        .summary-total{display:flex;justify-content:space-between;align-items:flex-end;gap:15px;padding:20px 0 18px;border-top:1px solid #111;margin-top:2px}
        .summary-total strong{font-size:28px}
        .checkout-btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:52px;border:0;border-radius:9px;background:#ffc400;color:#111;text-decoration:none;font:900 13px Inter,Arial,sans-serif}
        .checkout-btn:hover{background:#111;color:#fff}
        .back-store{display:block;text-align:center;margin-top:14px;font:700 13px Inter,Arial,sans-serif;color:#555;text-decoration:none}
        .back-store:hover{color:#111}
        .empty-cart{max-width:650px;margin:0 auto;text-align:center;padding:50px 30px;border:1px solid #e9e9e9;border-radius:20px}
        .empty-cart h2{font-family:'Barlow Condensed';font-size:38px;text-transform:uppercase;margin:10px 0}
        .empty-cart p{color:#686868;margin-bottom:24px}
        .cart-empty-icon{width:62px;height:62px;margin:0 auto 20px;border-radius:50%;display:grid;place-items:center;background:#ffc400}
        @media(max-width:900px){
          .cart-layout{grid-template-columns:1fr;gap:20px}
          .cart-summary{position:static}
          .cart-item{grid-template-columns:100px minmax(0,1fr);grid-template-rows:auto auto auto}
          .cart-product-image{width:100px;height:100px}
          .cart-item-actions{grid-column:2;justify-content:flex-start}
          .cart-subtotal{grid-column:2;justify-self:start}
        }
        @media(max-width:520px){
          .cart-page-shell .section{padding-top:28px;padding-bottom:50px}
          .cart-intro{margin-bottom:22px}
          .cart-title{font-size:46px}
          .cart-item{grid-template-columns:76px minmax(0,1fr);gap:12px;padding:14px;box-shadow:none}
          .cart-product-image{width:76px;height:76px;border-radius:10px}
          .cart-product-info h2{font-size:21px}
          .cart-item-actions{grid-column:1/3;justify-content:space-between;width:100%;padding-top:6px;border-top:1px solid #eee}
          .cart-subtotal{grid-column:1/3;justify-self:end;font-size:17px}
          .cart-summary{padding:18px;border-radius:16px}
          .summary-total strong{font-size:25px}
          .empty-cart{padding:38px 20px}
          .empty-cart h2{font-size:32px}
          .cep-row{grid-template-columns:1fr}
          .cep-row button{width:100%}
          .free-shipping-cart{margin-top:12px;padding:12px}
        }
      `}</style>
    </main>
  );
}
