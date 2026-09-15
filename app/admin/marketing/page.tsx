'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Check, Percent, Plus, Tag, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { useToast } from '@/components/ui/toast';

type Product = { id: string; name: string; price: number; active: boolean };
type Promotion = { id: string; product_id: string; promotional_price: number; starts_at: string; ends_at: string; active: boolean; products?: { name: string; price: number } | null };
type Coupon = { id: string; code: string; discount_type: 'percent' | 'fixed'; discount_value: number; min_cart_total: number; starts_at: string; ends_at: string; active: boolean };

const dateInput = (value: Date) => { const d = new Date(value); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const money = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

export default function MarketingPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'promotions'|'coupons'>('promotions');
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showPromotion, setShowPromotion] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promotionForm, setPromotionForm] = useState({ product_id:'', promotional_price:'', starts_at:dateInput(new Date()), ends_at:dateInput(new Date(Date.now()+7*86400000)) });
  const [couponForm, setCouponForm] = useState({ code:'', discount_type:'percent' as 'percent'|'fixed', discount_value:'', min_cart_total:'', starts_at:dateInput(new Date()), ends_at:dateInput(new Date(Date.now()+30*86400000)) });

  async function load() {
    if (!supabase) return;
    const [{data:p}, {data:pr}, {data:c}] = await Promise.all([
      supabase.from('products').select('id,name,price,active').order('name'),
      supabase.from('promotions').select('id,product_id,promotional_price,starts_at,ends_at,active,products(name,price)').order('created_at',{ascending:false}),
      supabase.from('coupons').select('id,code,discount_type,discount_value,min_cart_total,starts_at,ends_at,active').order('created_at',{ascending:false}),
    ]);
    setProducts((p||[]) as Product[]); setPromotions((pr||[]) as Promotion[]); setCoupons((c||[]) as Coupon[]);
  }
  useEffect(()=>{void load();},[]);

  async function createPromotion(e: FormEvent) {
    e.preventDefault(); if(!supabase || saving) return;
    const product=products.find(p=>p.id===promotionForm.product_id); const price=Number(promotionForm.promotional_price);
    if(!product || !price || price<=0 || price>=Number(product.price)) return toast.error('Preço inválido','O preço promocional deve ser menor que o preço atual.');
    setSaving(true);
    const {error}=await supabase.from('promotions').insert({product_id:product.id,promotional_price:price,starts_at:new Date(promotionForm.starts_at).toISOString(),ends_at:new Date(promotionForm.ends_at).toISOString(),active:true});
    setSaving(false); if(error) return toast.error('Não foi possível criar a promoção',error.message);
    toast.success('Promoção criada',product.name); setShowPromotion(false); setPromotionForm({...promotionForm,product_id:'',promotional_price:''}); void load();
  }

  async function createCoupon(e: FormEvent) {
    e.preventDefault(); if(!supabase || saving) return;
    const value=Number(couponForm.discount_value); if(!couponForm.code.trim()||!value||value<=0||(couponForm.discount_type==='percent'&&value>100)) return toast.error('Dados inválidos','Confira o código e o desconto.');
    setSaving(true);
    const {error}=await supabase.from('coupons').insert({code:couponForm.code.trim().toUpperCase(),discount_type:couponForm.discount_type,discount_value:value,min_cart_total:Number(couponForm.min_cart_total||0),starts_at:new Date(couponForm.starts_at).toISOString(),ends_at:new Date(couponForm.ends_at).toISOString(),active:true});
    setSaving(false); if(error) return toast.error('Não foi possível criar o cupom',error.message);
    toast.success('Cupom criado',couponForm.code.toUpperCase()); setShowCoupon(false); setCouponForm({...couponForm,code:'',discount_value:'',min_cart_total:''}); void load();
  }

  async function togglePromotion(row:Promotion){ if(!supabase)return; const {error}=await supabase.from('promotions').update({active:!row.active}).eq('id',row.id); if(error)return toast.error('Erro',error.message); void load(); }
  async function removePromotion(row:Promotion){ if(!supabase)return; if(!confirm('Excluir esta promoção?'))return; const {error}=await supabase.from('promotions').delete().eq('id',row.id); if(error)return toast.error('Erro',error.message); void load(); }
  async function toggleCoupon(row:Coupon){ if(!supabase)return; const {error}=await supabase.from('coupons').update({active:!row.active}).eq('id',row.id); if(error)return toast.error('Erro',error.message); void load(); }
  async function removeCoupon(row:Coupon){ if(!supabase)return; if(!confirm('Excluir este cupom?'))return; const {error}=await supabase.from('coupons').delete().eq('id',row.id); if(error)return toast.error('Erro',error.message); void load(); }

  const activePromotions=useMemo(()=>promotions.filter(p=>p.active).length,[promotions]);
  const activeCoupons=useMemo(()=>coupons.filter(c=>c.active).length,[coupons]);

  return <main className="marketing-page"><SiteHeader variant="admin" subtitle="MARKETING"/><section className="marketing-shell">
    <Link href="/admin" className="marketing-back"><ArrowLeft size={15}/> Painel</Link>
    <div className="marketing-head"><div><p>MARKETING</p><h1>Promoções e cupons</h1><span>Crie ofertas para destacar produtos e descontos no carrinho.</span></div></div>
    <div className="marketing-tabs"><button className={tab==='promotions'?'active':''} onClick={()=>setTab('promotions')}><Tag size={17}/> Promoções <b>{activePromotions}</b></button><button className={tab==='coupons'?'active':''} onClick={()=>setTab('coupons')}><Percent size={17}/> Cupons <b>{activeCoupons}</b></button></div>
    {tab==='promotions' ? <section><div className="marketing-toolbar"><div><h2>Promoções</h2><p>O selo aparece automaticamente no catálogo e na página do produto.</p></div><button className="marketing-primary" onClick={()=>setShowPromotion(true)}><Plus size={17}/> Criar promoção</button></div>
      {promotions.length===0?<div className="marketing-empty">Nenhuma promoção criada.</div>:<div className="marketing-list">{promotions.map(row=><article className="marketing-row" key={row.id}><div className="marketing-row-icon"><Tag size={19}/></div><div className="marketing-row-main"><strong>{row.products?.name||'Produto'}</strong><span><s>{money(Number(row.products?.price||0))}</s> <b>{money(Number(row.promotional_price))}</b> · {Math.round((1-Number(row.promotional_price)/Number(row.products?.price||row.promotional_price))*100)}% OFF</span><small>{new Date(row.ends_at).toLocaleDateString('pt-BR')} · {row.active?'Ativa':'Inativa'}</small></div><div className="marketing-actions"><button onClick={()=>togglePromotion(row)}>{row.active?'Desativar':'Ativar'}</button><button onClick={()=>removePromotion(row)} aria-label="Excluir"><Trash2 size={15}/></button></div></article>)}</div>}
    </section> : <section><div className="marketing-toolbar"><div><h2>Cupons</h2><p>O desconto é aplicado sobre o subtotal dos produtos no carrinho.</p></div><button className="marketing-primary" onClick={()=>setShowCoupon(true)}><Plus size={17}/> Criar cupom</button></div>
      {coupons.length===0?<div className="marketing-empty">Nenhum cupom criado.</div>:<div className="marketing-list">{coupons.map(row=><article className="marketing-row" key={row.id}><div className="marketing-row-icon"><Percent size={19}/></div><div className="marketing-row-main"><strong>{row.code}</strong><span>{row.discount_type==='percent'?`${row.discount_value}% OFF`:`${money(row.discount_value)} OFF`}{Number(row.min_cart_total)>0?` · mínimo ${money(row.min_cart_total)}`:''}</span><small>{new Date(row.ends_at).toLocaleDateString('pt-BR')} · {row.active?'Ativo':'Inativo'}</small></div><div className="marketing-actions"><button onClick={()=>toggleCoupon(row)}>{row.active?'Desativar':'Ativar'}</button><button onClick={()=>removeCoupon(row)} aria-label="Excluir"><Trash2 size={15}/></button></div></article>)}</div>}
    </section>}

    {showPromotion&&<div className="marketing-modal"><form onSubmit={createPromotion}><button type="button" className="marketing-close" onClick={()=>setShowPromotion(false)}><X/></button><p>OFERTA</p><h2>Criar promoção</h2><label>Produto<select required value={promotionForm.product_id} onChange={e=>setPromotionForm({...promotionForm,product_id:e.target.value})}><option value="">Selecione</option>{products.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}</select></label><label>Preço promocional<input required type="number" min="0.01" step="0.01" value={promotionForm.promotional_price} onChange={e=>setPromotionForm({...promotionForm,promotional_price:e.target.value})}/></label><div className="marketing-two"><label>Início<input type="datetime-local" value={promotionForm.starts_at} onChange={e=>setPromotionForm({...promotionForm,starts_at:e.target.value})}/></label><label>Fim<input type="datetime-local" value={promotionForm.ends_at} onChange={e=>setPromotionForm({...promotionForm,ends_at:e.target.value})}/></label></div><button className="marketing-primary" disabled={saving}>{saving?'Salvando...':'Criar promoção'}</button></form></div>}
    {showCoupon&&<div className="marketing-modal"><form onSubmit={createCoupon}><button type="button" className="marketing-close" onClick={()=>setShowCoupon(false)}><X/></button><p>DESCONTO</p><h2>Criar cupom</h2><label>Código<input required value={couponForm.code} onChange={e=>setCouponForm({...couponForm,code:e.target.value.toUpperCase()})} placeholder="2P10"/></label><div className="marketing-two"><label>Tipo<select value={couponForm.discount_type} onChange={e=>setCouponForm({...couponForm,discount_type:e.target.value as 'percent'|'fixed'})}><option value="percent">Percentual (%)</option><option value="fixed">Valor (R$)</option></select></label><label>Desconto<input required type="number" min="0.01" step="0.01" value={couponForm.discount_value} onChange={e=>setCouponForm({...couponForm,discount_value:e.target.value})}/></label></div><label>Valor mínimo do carrinho (opcional)<input type="number" min="0" step="0.01" value={couponForm.min_cart_total} onChange={e=>setCouponForm({...couponForm,min_cart_total:e.target.value})}/></label><div className="marketing-two"><label>Início<input type="datetime-local" value={couponForm.starts_at} onChange={e=>setCouponForm({...couponForm,starts_at:e.target.value})}/></label><label>Fim<input type="datetime-local" value={couponForm.ends_at} onChange={e=>setCouponForm({...couponForm,ends_at:e.target.value})}/></label></div><button className="marketing-primary" disabled={saving}>{saving?'Salvando...':'Criar cupom'}</button></form></div>}
    </section><style jsx global>{`.marketing-page{min-height:100vh;background:#f6f6f3;color:#111}.marketing-shell{width:min(1100px,calc(100% - 32px));margin:auto;padding:32px 0 70px}.marketing-back{display:inline-flex;gap:7px;align-items:center;color:#666;text-decoration:none;font-size:12px;margin-bottom:28px}.marketing-head p{margin:0 0 7px;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.2em}.marketing-head h1{margin:0;font:italic 58px/1 'Barlow Condensed';text-transform:uppercase}.marketing-head span{display:block;color:#777;margin-top:10px;font-size:13px}.marketing-tabs{display:flex;gap:8px;margin:30px 0 26px}.marketing-tabs button{border:1px solid #ddd;background:#fff;border-radius:12px;padding:12px 15px;display:flex;gap:8px;align-items:center;font-weight:800;cursor:pointer}.marketing-tabs button.active{background:#111;color:#fff;border-color:#111}.marketing-tabs b{font-size:10px;background:#ffc400;color:#111;border-radius:99px;padding:3px 7px}.marketing-toolbar{display:flex;justify-content:space-between;gap:15px;align-items:center;margin-bottom:15px}.marketing-toolbar h2{margin:0;font:34px 'Barlow Condensed';text-transform:uppercase}.marketing-toolbar p{margin:4px 0 0;color:#777;font-size:12px}.marketing-primary{border:0;border-radius:10px;background:#ffc400;color:#111;padding:11px 15px;font-weight:900;display:inline-flex;gap:7px;align-items:center;cursor:pointer}.marketing-primary:disabled{opacity:.6}.marketing-list{display:grid;gap:9px}.marketing-row{background:#fff;border:1px solid #e2e2de;border-radius:14px;padding:15px;display:flex;align-items:center;gap:13px}.marketing-row-icon{width:40px;height:40px;border-radius:10px;background:#f4f4ef;display:grid;place-items:center;color:#9b7600}.marketing-row-main{min-width:0;flex:1}.marketing-row-main strong{display:block;font-size:14px}.marketing-row-main span{display:block;margin-top:4px;font-size:12px}.marketing-row-main span b{color:#138a43}.marketing-row-main small{display:block;color:#999;margin-top:5px;font-size:10px}.marketing-actions{display:flex;gap:6px}.marketing-actions button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:8px 10px;font-size:11px;font-weight:800;cursor:pointer}.marketing-actions button:last-child{color:#c62828}.marketing-empty{background:#fff;border:1px dashed #ccc;border-radius:14px;padding:40px;text-align:center;color:#888;font-size:13px}.marketing-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:20px;z-index:100}.marketing-modal form{width:min(520px,100%);background:#fff;border-radius:18px;padding:25px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.25)}.marketing-modal form>p{margin:0;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.18em}.marketing-modal h2{margin:5px 0 22px;font:34px 'Barlow Condensed';text-transform:uppercase}.marketing-modal label{display:block;font-size:11px;font-weight:800;margin:0 0 13px}.marketing-modal input,.marketing-modal select{display:block;width:100%;height:43px;margin-top:6px;border:1px solid #ddd;border-radius:9px;padding:0 11px;background:#fff;font:13px Inter,Arial,sans-serif}.marketing-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.marketing-close{position:absolute;right:15px;top:15px;border:0;background:#f4f4f4;border-radius:8px;width:32px;height:32px;display:grid;place-items:center;cursor:pointer}@media(max-width:600px){.marketing-head h1{font-size:45px}.marketing-toolbar{align-items:flex-start;flex-direction:column}.marketing-row{align-items:flex-start}.marketing-actions{margin-left:auto;flex-direction:column}.marketing-two{grid-template-columns:1fr}}`}</style></main>;
}
