'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';

type Item={id:string;name:string;price:number;quantity:number;image_url?:string|null};
const KEY='2pbox-cart';
export default function CarrinhoPage(){const [items,setItems]=useState<Item[]>([]);const [ready,setReady]=useState(false);
 useEffect(()=>{try{setItems(JSON.parse(localStorage.getItem(KEY)||'[]'))}catch{}setReady(true)},[]);
 function save(next:Item[]){setItems(next);localStorage.setItem(KEY,JSON.stringify(next));}
 const total=useMemo(()=>items.reduce((s,i)=>s+i.price*i.quantity,0),[items]);
 function qty(id:string,d:number){save(items.map(i=>i.id===id?{...i,quantity:Math.max(1,i.quantity+d)}:i))}
 if(!ready)return null;
 return <main><div className="topbar">Qualidade <span>•</span> Variedade <span>•</span> Confiança</div><header className="header container"><Link href="/" className="brand"><div className="brand-mark">2P</div><div><strong>2P BOX</strong><small>TUDO QUE VOCÊ PRECISA, EM UM SÓ LUGAR.</small></div></Link><Link className="secondary" href="/loja">Continuar comprando</Link></header><section className="container section"><p className="eyebrow">SEU PEDIDO</p><h1 style={{fontFamily:'Barlow Condensed',fontSize:52,textTransform:'uppercase',fontStyle:'italic',marginTop:0}}>Carrinho</h1>{items.length===0?<div className="category" style={{maxWidth:760}}><h3>Seu carrinho está vazio</h3><p>Adicione produtos para começar seu pedido.</p><Link className="primary" href="/loja">Explorar produtos</Link></div>:<><div style={{display:'grid',gap:12,maxWidth:820}}>{items.map(i=><div className="category" key={i.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}><div><h3>{i.name}</h3><strong>R$ {i.price.toFixed(2).replace('.',',')}</strong></div><div style={{display:'flex',alignItems:'center',gap:8}}><button className="secondary" onClick={()=>qty(i.id,-1)}><Minus size={15}/></button><strong>{i.quantity}</strong><button className="secondary" onClick={()=>qty(i.id,1)}><Plus size={15}/></button><button className="secondary" onClick={()=>save(items.filter(x=>x.id!==i.id))}><Trash2 size={15}/></button></div></div>)}</div><div className="category" style={{maxWidth:820,marginTop:18,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><small>TOTAL</small><h2 style={{margin:0}}>R$ {total.toFixed(2).replace('.',',')}</h2></div><Link className="primary" href="/checkout">Finalizar pedido</Link></div></>}</section></main>;
}
