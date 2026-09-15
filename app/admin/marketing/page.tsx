'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Check, Percent, Pencil, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { useToast } from '@/components/ui/toast';

type Product = { id: string; name: string; price: number; active: boolean };
type Promotion = { id: string; product_id: string; promotional_price: number; starts_at: string; ends_at: string; active: boolean; products?: { name: string; price: number } | null };
type Coupon = { id: string; code: string; discount_type: 'percent' | 'fixed'; discount_value: number; min_cart_total: number; starts_at: string; ends_at: string; active: boolean };

const money = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
const dateInput = (value: Date | string) => { const d = new Date(value); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export default function MarketingPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'promotions' | 'coupons'>('promotions');
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showPromotion, setShowPromotion] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [promotionForm, setPromotionForm] = useState({ product_id: '', promotional_price: '', starts_at: dateInput(new Date()), ends_at: dateInput(new Date(Date.now() + 7 * 86400000)) });
  const [couponForm, setCouponForm] = useState({ code: '', discount_type: 'percent' as 'percent' | 'fixed', discount_value: '', min_cart_total: '', starts_at: dateInput(new Date()), ends_at: dateInput(new Date(Date.now() + 30 * 86400000)) });

  async function load() {
    if (!supabase) return;
    const [{ data: p, error: productsError }, { data: pr }, { data: c }] = await Promise.all([
      supabase.from('products').select('id,name,price,active').eq('active', true).order('name').range(0, 999),
      supabase.from('promotions').select('id,product_id,promotional_price,starts_at,ends_at,active,products(name,price)').order('created_at', { ascending: false }),
      supabase.from('coupons').select('id,code,discount_type,discount_value,min_cart_total,starts_at,ends_at,active').order('created_at', { ascending: false }),
    ]);
    if (productsError) toast.error('Não foi possível carregar os produtos', productsError.message);
    setProducts((p || []) as Product[]); setPromotions((pr || []) as Promotion[]); setCoupons((c || []) as Coupon[]);
  }
  useEffect(() => { void load(); }, []);

  const filteredProducts = useMemo(() => { const q = productSearch.trim().toLowerCase(); return q ? products.filter(p => p.name.toLowerCase().includes(q)) : products; }, [products, productSearch]);
  const selectedProduct = products.find(p => p.id === promotionForm.product_id) || null;
  const activePromotions = promotions.filter(p => p.active).length;
  const activeCoupons = coupons.filter(c => c.active).length;

  function openCreatePromotion() {
    setEditingPromotion(null); setProductSearch('');
    setPromotionForm({ product_id: '', promotional_price: '', starts_at: dateInput(new Date()), ends_at: dateInput(new Date(Date.now() + 7 * 86400000)) });
    setShowPromotion(true);
  }
  function openEditPromotion(row: Promotion) {
    setEditingPromotion(row); setProductSearch('');
    setPromotionForm({ product_id: row.product_id, promotional_price: String(row.promotional_price), starts_at: dateInput(row.starts_at), ends_at: dateInput(row.ends_at) });
    setShowPromotion(true);
  }
  function openCreateCoupon() {
    setEditingCoupon(null);
    setCouponForm({ code: '', discount_type: 'percent', discount_value: '', min_cart_total: '', starts_at: dateInput(new Date()), ends_at: dateInput(new Date(Date.now() + 30 * 86400000)) });
    setShowCoupon(true);
  }
  function openEditCoupon(row: Coupon) {
    setEditingCoupon(row);
    setCouponForm({ code: row.code, discount_type: row.discount_type, discount_value: String(row.discount_value), min_cart_total: String(row.min_cart_total || ''), starts_at: dateInput(row.starts_at), ends_at: dateInput(row.ends_at) });
    setShowCoupon(true);
  }

  async function savePromotion(e: FormEvent) {
    e.preventDefault(); if (!supabase || saving) return;
    const product = products.find(p => p.id === promotionForm.product_id); const price = Number(promotionForm.promotional_price); const startsAt = new Date(promotionForm.starts_at); const endsAt = new Date(promotionForm.ends_at);
    if (!product || !price || price <= 0 || price >= Number(product.price)) return toast.error('Preço inválido', 'O preço promocional deve ser menor que o preço atual.');
    if (endsAt <= startsAt) return toast.error('Período inválido', 'A data de fim deve ser posterior à data de início.');
    setSaving(true);
    const payload = { product_id: product.id, promotional_price: price, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() };
    const result = editingPromotion ? await supabase.from('promotions').update(payload).eq('id', editingPromotion.id) : await supabase.from('promotions').insert({ ...payload, active: true });
    setSaving(false);
    if (result.error) return toast.error(`Não foi possível ${editingPromotion ? 'editar' : 'criar'} a promoção`, result.error.message);
    toast.success(editingPromotion ? 'Promoção atualizada' : 'Promoção criada', product.name); setShowPromotion(false); setEditingPromotion(null); void load();
  }

  async function saveCoupon(e: FormEvent) {
    e.preventDefault(); if (!supabase || saving) return;
    const code = couponForm.code.trim().toUpperCase(); const value = Number(couponForm.discount_value); const minCartTotal = Number(couponForm.min_cart_total || 0); const startsAt = new Date(couponForm.starts_at); const endsAt = new Date(couponForm.ends_at);
    if (!code || !value || value <= 0 || minCartTotal < 0 || (couponForm.discount_type === 'percent' && value > 100)) return toast.error('Dados inválidos', 'Confira o código, o desconto e o valor mínimo.');
    if (endsAt <= startsAt) return toast.error('Período inválido', 'A data de fim deve ser posterior à data de início.');
    setSaving(true);
    const payload = { code, discount_type: couponForm.discount_type, discount_value: value, min_cart_total: minCartTotal, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() };
    const result = editingCoupon ? await supabase.from('coupons').update(payload).eq('id', editingCoupon.id) : await supabase.from('coupons').insert({ ...payload, active: true });
    setSaving(false);
    if (result.error) return toast.error(`Não foi possível ${editingCoupon ? 'editar' : 'criar'} o cupom`, result.error.message);
    toast.success(editingCoupon ? 'Cupom atualizado' : 'Cupom criado', code); setShowCoupon(false); setEditingCoupon(null); void load();
  }

  async function togglePromotion(row: Promotion) { if (!supabase) return; const { error } = await supabase.from('promotions').update({ active: !row.active }).eq('id', row.id); if (error) return toast.error('Erro', error.message); void load(); }
  async function removePromotion(row: Promotion) { if (!supabase || !confirm('Excluir esta promoção?')) return; const { error } = await supabase.from('promotions').delete().eq('id', row.id); if (error) return toast.error('Erro', error.message); void load(); }
  async function toggleCoupon(row: Coupon) { if (!supabase) return; const { error } = await supabase.from('coupons').update({ active: !row.active }).eq('id', row.id); if (error) return toast.error('Erro', error.message); void load(); }
  async function removeCoupon(row: Coupon) { if (!supabase || !confirm('Excluir este cupom?')) return; const { error } = await supabase.from('coupons').delete().eq('id', row.id); if (error) return toast.error('Erro', error.message); void load(); }

  return <main className="marketing-page"><SiteHeader variant="admin" subtitle="MARKETING"/><section className="marketing-shell">
    <Link href="/admin" className="marketing-back"><ArrowLeft size={16}/> Painel</Link>
    <header className="marketing-head"><div><p>MARKETING</p><h1>Promoções e cupons</h1><span>Crie ofertas para destacar produtos e descontos no carrinho.</span></div></header>
    <div className="marketing-tabs"><button className={tab === 'promotions' ? 'active' : ''} onClick={() => setTab('promotions')}><Tag size={17}/> Promoções <b>{activePromotions}</b></button><button className={tab === 'coupons' ? 'active' : ''} onClick={() => setTab('coupons')}><Percent size={17}/> Cupons <b>{activeCoupons}</b></button></div>
    {tab === 'promotions' ? <section><div className="marketing-toolbar"><div><h2>Promoções</h2><p>O selo aparece automaticamente no catálogo e na página do produto.</p></div><button className="marketing-primary" onClick={openCreatePromotion}><Plus size={17}/> Criar promoção</button></div>
      {promotions.length === 0 ? <div className="marketing-empty"><Tag size={25}/><strong>Nenhuma promoção criada</strong><span>Crie sua primeira oferta para destacar um produto.</span></div> : <div className="marketing-list">{promotions.map(row => <article className="marketing-row" key={row.id}><div className="marketing-row-icon"><Tag size={19}/></div><div className="marketing-row-main"><strong>{row.products?.name || 'Produto'}</strong><span><s>{money(Number(row.products?.price || 0))}</s><b>{money(Number(row.promotional_price))}</b><em>{Math.round((1 - Number(row.promotional_price) / Number(row.products?.price || row.promotional_price)) * 100)}% OFF</em></span><small><CalendarDays size={12}/> {new Date(row.starts_at).toLocaleDateString('pt-BR')} até {new Date(row.ends_at).toLocaleDateString('pt-BR')} · {row.active ? 'Ativa' : 'Inativa'}</small></div><div className="marketing-actions"><button onClick={() => openEditPromotion(row)} aria-label="Editar promoção"><Pencil size={14}/> Editar</button><button onClick={() => togglePromotion(row)}>{row.active ? 'Desativar' : 'Ativar'}</button><button onClick={() => removePromotion(row)} aria-label="Excluir"><Trash2 size={15}/></button></div></article>)}</div>}
    </section> : <section><div className="marketing-toolbar"><div><h2>Cupons</h2><p>O desconto é aplicado sobre o subtotal dos produtos no carrinho.</p></div><button className="marketing-primary" onClick={openCreateCoupon}><Plus size={17}/> Criar cupom</button></div>
      {coupons.length === 0 ? <div className="marketing-empty"><Percent size={25}/><strong>Nenhum cupom criado</strong><span>Crie um código de desconto para seus clientes.</span></div> : <div className="marketing-list">{coupons.map(row => <article className="marketing-row" key={row.id}><div className="marketing-row-icon"><Percent size={19}/></div><div className="marketing-row-main"><strong>{row.code}</strong><span>{row.discount_type === 'percent' ? `${row.discount_value}% OFF` : `${money(row.discount_value)} OFF`}{Number(row.min_cart_total) > 0 ? ` · mínimo ${money(row.min_cart_total)}` : ''}</span><small><CalendarDays size={12}/> {new Date(row.starts_at).toLocaleDateString('pt-BR')} até {new Date(row.ends_at).toLocaleDateString('pt-BR')} · {row.active ? 'Ativo' : 'Inativo'}</small></div><div className="marketing-actions"><button onClick={() => openEditCoupon(row)} aria-label="Editar cupom"><Pencil size={14}/> Editar</button><button onClick={() => toggleCoupon(row)}>{row.active ? 'Desativar' : 'Ativar'}</button><button onClick={() => removeCoupon(row)} aria-label="Excluir"><Trash2 size={15}/></button></div></article>)}</div>}
    </section>}

    {showPromotion && <div className="marketing-modal" onMouseDown={e => { if (e.target === e.currentTarget && !saving) { setShowPromotion(false); setEditingPromotion(null); } }}><form className="marketing-form" onSubmit={savePromotion}><button type="button" className="marketing-close" onClick={() => !saving && (setShowPromotion(false), setEditingPromotion(null))}><X size={19}/></button><p>OFERTA</p><h2>{editingPromotion ? 'Editar promoção' : 'Criar promoção'}</h2><span className="form-subtitle">Escolha um produto ativo e defina o preço especial da campanha.</span><label>Produto</label><div className="product-picker"><div className="product-search"><Search size={16}/><input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Buscar produto..." autoComplete="off"/></div><div className="product-picker-list">{filteredProducts.length === 0 ? <div className="product-picker-empty">Nenhum produto ativo encontrado.</div> : filteredProducts.map(product => { const selected = product.id === promotionForm.product_id; return <button type="button" key={product.id} className={`product-option ${selected ? 'selected' : ''}`} onClick={() => setPromotionForm({ ...promotionForm, product_id: product.id, promotional_price: selected ? promotionForm.promotional_price : '' })}><span className="product-option-check">{selected ? <Check size={14}/> : null}</span><span className="product-option-name">{product.name}</span><strong>{money(product.price)}</strong></button>; })}</div></div>{selectedProduct && <div className="selected-product"><div><small>PRODUTO SELECIONADO</small><strong>{selectedProduct.name}</strong></div><b>{money(selectedProduct.price)}</b></div>}<label>Preço promocional<input required type="number" min="0.01" step="0.01" value={promotionForm.promotional_price} onChange={e => setPromotionForm({ ...promotionForm, promotional_price: e.target.value })} placeholder="24,90"/></label><div className="marketing-two"><label>Início<input type="datetime-local" value={promotionForm.starts_at} onChange={e => setPromotionForm({ ...promotionForm, starts_at: e.target.value })}/></label><label>Fim<input type="datetime-local" value={promotionForm.ends_at} onChange={e => setPromotionForm({ ...promotionForm, ends_at: e.target.value })}/></label></div><button className="marketing-primary form-submit" disabled={saving || !promotionForm.product_id}>{saving ? 'Salvando...' : editingPromotion ? 'Salvar alterações' : 'Criar promoção'}</button></form></div>}

    {showCoupon && <div className="marketing-modal" onMouseDown={e => { if (e.target === e.currentTarget && !saving) { setShowCoupon(false); setEditingCoupon(null); } }}><form className="marketing-form" onSubmit={saveCoupon}><button type="button" className="marketing-close" onClick={() => !saving && (setShowCoupon(false), setEditingCoupon(null))}><X size={19}/></button><p>DESCONTO</p><h2>{editingCoupon ? 'Editar cupom' : 'Criar cupom'}</h2><span className="form-subtitle">Configure um código de desconto para aplicar diretamente no carrinho.</span><label>Código<input required value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="2P10"/></label><div className="marketing-two"><label>Tipo<select value={couponForm.discount_type} onChange={e => setCouponForm({ ...couponForm, discount_type: e.target.value as 'percent' | 'fixed' })}><option value="percent">Percentual (%)</option><option value="fixed">Valor (R$)</option></select></label><label>Desconto<input required type="number" min="0.01" step="0.01" value={couponForm.discount_value} onChange={e => setCouponForm({ ...couponForm, discount_value: e.target.value })}/></label></div><label>Valor mínimo do carrinho <span className="optional">opcional</span><input type="number" min="0" step="0.01" value={couponForm.min_cart_total} onChange={e => setCouponForm({ ...couponForm, min_cart_total: e.target.value })} placeholder="0,00"/></label><div className="marketing-two"><label>Início<input type="datetime-local" value={couponForm.starts_at} onChange={e => setCouponForm({ ...couponForm, starts_at: e.target.value })}/></label><label>Fim<input type="datetime-local" value={couponForm.ends_at} onChange={e => setCouponForm({ ...couponForm, ends_at: e.target.value })}/></label></div><button className="marketing-primary form-submit" disabled={saving}>{saving ? 'Salvando...' : editingCoupon ? 'Salvar alterações' : 'Criar cupom'}</button></form></div>}
  </section>
  <style jsx global>{`
    .marketing-page{min-height:100vh;background:#f5f5f2;color:#111;width:100%;max-width:100%;overflow-x:clip}
    .marketing-shell{width:min(1120px,calc(100% - 32px));max-width:100%;margin:auto;padding:28px 0 72px;min-width:0}
    .marketing-back{display:inline-flex;gap:7px;align-items:center;color:#666;text-decoration:none;font-size:12px;font-weight:800;margin-bottom:28px}
    .marketing-head{margin-bottom:28px;min-width:0;max-width:100%}.marketing-head p,.marketing-form>p{margin:0 0 7px;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.2em}.marketing-head h1{margin:0;font:italic 58px/1 'Barlow Condensed';text-transform:uppercase;letter-spacing:-.02em;max-width:100%;overflow-wrap:anywhere}.marketing-head span{display:block;color:#777;margin-top:10px;font-size:13px;line-height:1.45;max-width:100%}
    .marketing-tabs{display:flex;gap:8px;margin-bottom:30px;max-width:100%;min-width:0}.marketing-tabs button{border:1px solid #deded9;border-radius:17px;background:#fff;color:#666;padding:13px 18px;display:flex;align-items:center;gap:10px;font:700 15px Inter;cursor:pointer;min-width:0;flex:1}.marketing-tabs button.active{background:#111;color:#fff;border-color:#111}.marketing-tabs button b{background:#ffc400;color:#111;border-radius:999px;padding:4px 9px;font-size:12px;margin-left:auto;flex:none}
    .marketing-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;min-width:0}.marketing-toolbar>div{min-width:0;flex:1}.marketing-toolbar h2{font:700 35px/1 'Barlow Condensed';text-transform:uppercase;margin:0 0 6px}.marketing-toolbar p{margin:0;color:#888;font-size:13px;line-height:1.4}.marketing-primary{border:0;background:#ffc83d;color:#111;border-radius:15px;padding:14px 22px;display:inline-flex;align-items:center;justify-content:center;gap:10px;font:800 14px Inter;cursor:pointer;min-width:0;max-width:100%}.marketing-primary:disabled{opacity:.55;cursor:not-allowed}
    .marketing-list{display:grid;gap:16px;min-width:0;max-width:100%}.marketing-row{display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:14px;padding:16px 18px;background:#fff;border:1px solid #dddcd7;border-radius:18px;min-width:0;max-width:100%;overflow:hidden}.marketing-row-icon{width:46px;height:46px;border-radius:14px;background:#f7f5ef;color:#9b7600;display:grid;place-items:center;flex:none}.marketing-row-main{min-width:0;max-width:100%;overflow:hidden}.marketing-row-main>strong{display:block;min-width:0;max-width:100%;font-size:18px;line-height:1.2;overflow-wrap:anywhere;word-break:break-word;white-space:normal}.marketing-row-main>span{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:7px;min-width:0;max-width:100%;font-size:15px}.marketing-row-main s{color:#222;white-space:nowrap}.marketing-row-main b{color:#3e8d50;white-space:nowrap}.marketing-row-main em{font-style:normal;font-size:12px;font-weight:800;color:#3e8d50;background:#edf7ef;border-radius:999px;padding:5px 9px;white-space:nowrap}.marketing-row-main small{display:flex;align-items:center;gap:5px;color:#999;font-size:12px;margin-top:9px;min-width:0;max-width:100%;overflow-wrap:anywhere}.marketing-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0;max-width:100%;flex-wrap:wrap}.marketing-actions button{border:1px solid #ddd;background:#fff;color:#555;border-radius:9px;padding:8px 10px;font:700 11px Inter;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}.marketing-actions button:last-child{width:34px;height:34px;padding:0;display:grid;place-items:center}
    .marketing-empty{padding:35px 20px;background:#fff;border:1px dashed #ddd;border-radius:18px;display:grid;place-items:center;text-align:center;gap:8px;color:#888}.marketing-empty strong{color:#111}.marketing-modal{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.48);display:grid;place-items:center;padding:18px;overflow:auto}.marketing-form{width:min(680px,100%);max-width:100%;max-height:calc(100vh - 36px);overflow:auto;background:#fff;border-radius:20px;padding:28px;position:relative;box-shadow:0 24px 70px rgba(0,0,0,.2)}.marketing-close{position:absolute;top:17px;right:17px;border:1px solid #ddd;background:#fff;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;cursor:pointer}.marketing-form h2{font:700 40px/1 'Barlow Condensed';text-transform:uppercase;margin:0 0 7px}.form-subtitle{display:block;color:#777;font-size:12px;line-height:1.5;margin-bottom:22px;max-width:560px}.marketing-form>label{display:grid;gap:7px;font-size:12px;font-weight:800;margin-top:15px}.marketing-form input,.marketing-form select{width:100%;min-width:0;border:1px solid #ddd;border-radius:10px;padding:12px 13px;background:#fff;color:#111;font:inherit;outline:none}.marketing-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.marketing-two label{display:grid;gap:7px;font-size:12px;font-weight:800;margin-top:15px}.product-picker{margin-top:8px;border:1px solid #ddd;border-radius:13px;overflow:hidden;min-width:0}.product-search{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #eee}.product-search input{border:0!important;padding:5px!important;outline:none!important}.product-picker-list{max-height:240px;overflow:auto}.product-option{width:100%;border:0;border-bottom:1px solid #eee;background:#fff;display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:9px;text-align:left;padding:10px 12px;cursor:pointer;min-width:0}.product-option:last-child{border-bottom:0}.product-option.selected{background:#fff9df}.product-option-check{width:22px;height:22px;border-radius:7px;border:1px solid #ddd;display:grid;place-items:center;color:#111}.product-option.selected .product-option-check{background:#ffc400;border-color:#ffc400}.product-option-name{min-width:0;overflow-wrap:anywhere;word-break:break-word}.product-option>strong{white-space:nowrap}.product-picker-empty{padding:18px;color:#888;font-size:12px}.selected-product{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-top:12px;padding:12px;border-radius:12px;background:#f7f5ef;min-width:0}.selected-product>div{min-width:0}.selected-product small{display:block;color:#9b7600;font-size:9px;font-weight:900;letter-spacing:.1em;margin-bottom:4px}.selected-product strong{display:block;overflow-wrap:anywhere;word-break:break-word}.selected-product>b{white-space:nowrap}.form-submit{width:100%;margin-top:20px}.optional{font-weight:400;color:#999}
    @media(max-width:700px){.marketing-shell{width:calc(100% - 20px);padding:20px 0 48px}.marketing-back{margin-bottom:22px}.marketing-head{margin-bottom:22px}.marketing-head h1{font-size:44px}.marketing-head span{font-size:12px}.marketing-tabs{margin-bottom:23px}.marketing-tabs button{padding:11px 8px;justify-content:center;gap:7px}.marketing-tabs button b{margin-left:2px}.marketing-toolbar{align-items:stretch;flex-direction:column;gap:12px}.marketing-toolbar h2{font-size:31px}.marketing-primary{width:100%}.marketing-row{grid-template-columns:38px minmax(0,1fr);align-items:start;padding:13px;gap:10px}.marketing-row-icon{width:38px;height:38px;border-radius:12px}.marketing-actions{grid-column:2;justify-content:flex-start;padding-top:3px}.marketing-actions button{padding:8px}.marketing-row-main>strong{font-size:16px}.marketing-row-main>span{gap:6px;font-size:14px}.marketing-form{padding:22px 17px;border-radius:17px}.marketing-form h2{font-size:34px}.marketing-two{grid-template-columns:1fr}.product-picker-list{max-height:250px}.selected-product{grid-template-columns:1fr}.selected-product>b{justify-self:start}}
    @media(max-width:380px){.marketing-shell{width:calc(100% - 16px)}.marketing-tabs{gap:5px}.marketing-tabs button{font-size:13px;padding:10px 5px}.marketing-tabs button b{padding:3px 7px}.marketing-head h1{font-size:39px}.marketing-row-main>strong{font-size:15px}}
  `}</style>
  </main>;
}
