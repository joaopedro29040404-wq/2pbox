'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Product = { id:string; name:string; description:string|null; price:number; stock:number; image_url:string|null; categories?: {name:string}|null };
export default function LojaPage(){
 const [products,setProducts]=useState<Product[]>([]); const [loading,setLoading]=useState(true); const [category,setCategory]=useState('Todas');
 useEffect(()=>{async function load(){if(!supabase)return;const {data}=await supabase.from('products').select('id,name,description,price,stock,image_url,categories(name)').eq('active',true).order('created_at',{ascending:false});setProducts((data??[]) as unknown as Product[]);setLoading(false)}load()},[]);
 const cats=['Todas',...Array.from(new Set(products.map(p=>p.categories?.name).filter(Boolean) as string[]))]; const filtered=category==='Todas'?products:products.filter(p=>p.categories?.name===category);
 return <main><div className="topbar">Qualidade <span>•</span> Variedade <span>•</span> Confiança</div><header className="header container"><Link href="/" className="brand"><div className="brand-mark">2P</div><div><strong>2P BOX</strong><small>TUDO QUE VOCÊ PRECISA, EM UM SÓ LUGAR.</small></div></Link><Link className="cart-btn" href="/carrinho"><ShoppingBag size={19}/> Carrinho</Link></header><section className="container section"><Link href="/" className="secondary"><ArrowLeft size={16}/> Início</Link><p className="eyebrow" style={{marginTop:30}}>CATÁLOGO 2P BOX</p><h1 style={{fontFamily:'Barlow Condensed',fontSize:56,textTransform:'uppercase',fontStyle:'italic',marginTop:0}}>Produtos</h1><div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'20px 0 28px'}}>{cats.map(c=><button key={c} className={category===c?'primary':'secondary'} onClick={()=>setCategory(c)} style={{border:0,cursor:'pointer'}}>{c}</button>)}</div>{loading?<p>Carregando produtos...</p>:filtered.length===0?<div className="category"><h3>Nenhum produto disponível</h3><p>Cadastre produtos no painel administrativo.</p></div>:<div className="product-grid">{filtered.map(p=><article className="product" key={p.id}><div className="product-image">{p.image_url?<img src={p.image_url} alt={p.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<div className="product-placeholder">2P</div>}</div><div className="product-body"><small>{p.categories?.name||'2P Box'}</small><h3>{p.name}</h3><p>{p.description}</p><strong>R$ {Number(p.price).toFixed(2).replace('.',',')}</strong><button disabled={p.stock<=0}>{p.stock>0?'Adicionar ao carrinho':'Sem estoque'}</button></div></article>)}</div>}</section></main>
}
