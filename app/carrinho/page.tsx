'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useCart } from '@/components/cart-provider';

export default function CarrinhoPage(){
 const {items,setQty,remove,total}=useCart();
 return <main>
  <div className="topbar">Qualidade <span>•</span> Variedade <span>•</span> Confiança</div>
  <header className="header container cart-header">
   <Link href="/" className="brand"><Image className="brand-logo" src="/logo.pnh.png" alt="2P Box" width={150} height={70}/><div className="store-brand-copy"><strong>CARRINHO</strong><small>SEU PEDIDO 2P BOX</small></div></Link>
   <Link className="secondary" href="/loja"><ArrowLeft size={16}/> Continuar comprando</Link>
  </header>
  <section className="container section cart-page">
   <p className="eyebrow">SEU PEDIDO</p><h1 className="cart-title">Carrinho</h1>
   {items.length===0 ? <div className="empty-cart category"><div className="cart-empty-icon"><ShoppingBag size={30}/></div><p className="eyebrow">NENHUM ITEM</p><h2>Seu carrinho está vazio</h2><p>Adicione produtos à sua sacola para começar seu pedido.</p><Link className="primary" href="/loja">Explorar produtos</Link></div> : <div className="cart-layout">
    <div className="cart-items">{items.map(i=><article className="cart-item" key={i.id}>
      <div className="cart-product-image">{(i as any).image_url?<img src={(i as any).image_url} alt={i.name}/>:<div className="product-placeholder">2P</div>}</div>
      <div className="cart-product-info"><p className="cart-product-label">PRODUTO</p><h2>{i.name}</h2><p className="cart-unit-price">R$ {i.price.toFixed(2).replace('.',',')} <span>cada</span></p><p className="cart-stock">Disponível: {i.stock} unidade(s)</p></div>
      <div className="cart-item-actions"><div className="quantity-control"><button className="quantity-btn" onClick={()=>setQty(i.id,i.quantity-1)} aria-label="Diminuir"><Minus size={15}/></button><strong>{i.quantity}</strong><button className="quantity-btn" onClick={()=>setQty(i.id,i.quantity+1)} aria-label="Aumentar"><Plus size={15}/></button></div><button className="remove-btn" onClick={()=>remove(i.id)}><Trash2 size={15}/> Remover</button></div>
      <div className="cart-subtotal">R$ {(i.price*i.quantity).toFixed(2).replace('.',',')}</div>
    </article>)}</div>
    <aside className="cart-summary"><p className="eyebrow">RESUMO DO PEDIDO</p><div className="summary-line"><span>Produtos</span><strong>R$ {total.toFixed(2).replace('.',',')}</strong></div><div className="summary-line"><span>Frete</span><span className="summary-muted">Calculado no WhatsApp</span></div><div className="summary-total"><span>Total</span><strong>R$ {total.toFixed(2).replace('.',',')}</strong></div><Link className="primary checkout-btn" href="/checkout">Finalizar pedido</Link><Link className="back-store" href="/loja">Continuar comprando</Link></aside>
   </div>}
  </section>
 </main>;
}
