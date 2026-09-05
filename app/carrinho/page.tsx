'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Store, MessageCircle } from 'lucide-react';
import { useCart } from '@/components/cart-provider';
import { useState } from 'react';

export default function CarrinhoPage(){
 const {items,setQty,remove,total}=useCart();
 const [delivery,setDelivery]=useState<'pickup'|'shipping'>('pickup');
 return <main className="cart-page-shell">
  <div className="topbar">Qualidade <span>•</span> Variedade <span>•</span> Confiança</div>
  <header className="header container cart-header">
   <Link href="/" className="brand"><Image className="brand-logo" src="/logo.pnh.png" alt="2P Box" width={150} height={70}/><div className="store-brand-copy"><strong>CARRINHO</strong><small>SEU PEDIDO 2P BOX</small></div></Link>
   <Link className="secondary" href="/loja"><ArrowLeft size={16}/> Continuar comprando</Link>
  </header>
  <section className="container section cart-page">
   <div className="cart-intro"><p className="eyebrow">SEU PEDIDO</p><h1 className="cart-title">Carrinho</h1><p>Confira seus produtos e escolha como deseja receber.</p></div>
   {items.length===0 ? <div className="empty-cart category"><div className="cart-empty-icon"><ShoppingBag size={30}/></div><p className="eyebrow">NENHUM ITEM</p><h2>Seu carrinho está vazio</h2><p>Adicione produtos à sua sacola para começar seu pedido.</p><Link className="primary" href="/loja">Explorar produtos</Link></div> : <div className="cart-layout">
    <div className="cart-items"><div className="cart-list-head"><strong>PRODUTOS</strong><span>{items.reduce((n,i)=>n+i.quantity,0)} {items.reduce((n,i)=>n+i.quantity,0)===1?'item':'itens'}</span></div>{items.map(i=><article className="cart-item" key={i.id}>
      <div className="cart-product-image">{(i as any).image_url?<img src={(i as any).image_url} alt={i.name}/>:<div className="product-placeholder">2P</div>}</div>
      <div className="cart-product-info"><p className="cart-product-label">PRODUTO</p><h2>{i.name}</h2><p className="cart-unit-price">R$ {i.price.toFixed(2).replace('.',',')} <span>cada</span></p><p className="cart-stock">Disponível: {i.stock} unidade(s)</p></div>
      <div className="cart-item-actions"><div className="quantity-control"><button type="button" className="quantity-btn" onClick={()=>setQty(i.id,i.quantity-1)} aria-label="Diminuir"><Minus size={15}/></button><strong>{i.quantity}</strong><button type="button" className="quantity-btn" onClick={()=>setQty(i.id,i.quantity+1)} aria-label="Aumentar"><Plus size={15}/></button></div><button type="button" className="remove-btn" onClick={()=>remove(i.id)}><Trash2 size={15}/> Remover</button></div>
      <div className="cart-subtotal">R$ {(i.price*i.quantity).toFixed(2).replace('.',',')}</div>
    </article>)}</div>
    <aside className="cart-summary"><div className="summary-heading"><div><p className="eyebrow">RESUMO</p><h2>Seu pedido</h2></div><ShoppingBag size={21}/></div><div className="summary-line"><span>Produtos</span><strong>R$ {total.toFixed(2).replace('.',',')}</strong></div>
      <div className="delivery-choice"><p className="delivery-title">Como você quer receber?</p><div className="delivery-options">
        <button type="button" className={`delivery-option ${delivery==='pickup'?'selected':''}`} onClick={()=>setDelivery('pickup')}><Store size={19}/><span><strong>Retirar na loja</strong><small>Sem custo de entrega</small></span><i>{delivery==='pickup'?'✓':''}</i></button>
        <button type="button" className={`delivery-option ${delivery==='shipping'?'selected':''}`} onClick={()=>setDelivery('shipping')}><MessageCircle size={19}/><span><strong>Calcular frete no WhatsApp</strong><small>Combine o frete conosco</small></span><i>{delivery==='shipping'?'✓':''}</i></button>
      </div></div>
      <div className="summary-line"><span>Entrega</span><span className="summary-muted">{delivery==='pickup'?'Retirada na loja':'Frete calculado no WhatsApp'}</span></div>
      <div className="summary-total"><span>Total dos produtos</span><strong>R$ {total.toFixed(2).replace('.',',')}</strong></div>
      <Link className="primary checkout-btn" href={`/checkout?entrega=${delivery}`}>Finalizar pedido <ArrowLeft size={16} style={{transform:'rotate(180deg)'}}/></Link><Link className="back-store" href="/loja">Continuar comprando</Link>
    </aside>
   </div>}
  </section>
  <style jsx global>{`
    .cart-page-shell{background:#fff;color:#101010;min-height:100vh}.cart-page-shell .cart-header{background:#fff}.cart-page-shell .section{padding-top:54px;padding-bottom:80px}.cart-intro{margin-bottom:34px}.cart-intro .eyebrow{color:#9a7600;margin-bottom:8px}.cart-title{font-family:'Barlow Condensed';font-size:60px;line-height:.95;text-transform:uppercase;font-style:italic;margin:0 0 10px}.cart-intro>p:last-child{color:#686868;margin:0;font-size:14px}.cart-list-head{display:flex;justify-content:space-between;align-items:center;padding:0 4px 10px;font-size:10px;letter-spacing:.14em;color:#777}.cart-list-head span{letter-spacing:0;text-transform:none;font-size:12px}.cart-item{box-shadow:0 2px 10px rgba(0,0,0,.025);transition:box-shadow .2s,border-color .2s}.cart-item:hover{border-color:#d9c98d;box-shadow:0 8px 24px rgba(0,0,0,.06)}.cart-product-image{background:#f7f7f5}.cart-item-actions{flex-wrap:wrap}.quantity-control{box-shadow:0 1px 3px rgba(0,0,0,.04)}.quantity-btn:hover{background:#fafafa}.remove-btn:hover{color:#111}.cart-summary{box-shadow:0 8px 28px rgba(0,0,0,.055);border-color:#dedede}.summary-heading{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}.summary-heading .eyebrow{margin-bottom:4px;color:#9a7600}.summary-heading h2{font-family:'Barlow Condensed';font-size:28px;text-transform:uppercase;margin:0;font-style:italic}.summary-heading>svg{color:#111}.delivery-choice{padding:18px 0 8px}.delivery-title{font-size:13px;font-weight:800;margin:0 0 11px}.delivery-options{display:grid;gap:9px}.delivery-option{position:relative;width:100%;display:flex;align-items:flex-start;gap:11px;text-align:left;padding:14px 38px 14px 14px;border:1px solid #ddd;border-radius:12px;background:#fff;color:#111;cursor:pointer;font:inherit;transition:.18s}.delivery-option>svg{flex:none;color:#555;margin-top:1px}.delivery-option span{display:grid;gap:4px}.delivery-option strong{font-size:12px}.delivery-option small{font-size:10px;color:#777;line-height:1.35}.delivery-option i{position:absolute;right:13px;top:50%;transform:translateY(-50%);width:19px;height:19px;border-radius:50%;display:grid;place-items:center;background:#ffc400;color:#111;font-style:normal;font-size:11px;font-weight:900}.delivery-option:not(.selected) i{background:#f3f3f3;color:transparent}.delivery-option.selected{border:1.5px solid #111;background:#fffdf2;box-shadow:inset 0 0 0 1px #ffc400}.delivery-option.selected>svg{color:#111}.summary-total{border-top:1px solid #111;margin-top:2px}.checkout-btn{font-size:14px}.checkout-btn svg{flex:none}.back-store{color:#555}.back-store:hover{color:#111}.empty-cart{margin:0 auto}@media(max-width:850px){.cart-page-shell .section{padding-top:42px}.cart-layout{gap:20px}.cart-summary{box-shadow:0 5px 20px rgba(0,0,0,.05)}}@media(max-width:520px){.cart-page-shell .section{padding-top:30px;padding-bottom:50px}.cart-intro{margin-bottom:24px}.cart-title{font-size:48px}.cart-item{box-shadow:none}.cart-list-head{padding-bottom:8px}.cart-summary{padding:18px;border-radius:16px}.delivery-option{padding:13px 34px 13px 12px}.summary-total{padding-top:18px}.summary-total strong{font-size:25px}}
  `}</style>
 </main>;
}
