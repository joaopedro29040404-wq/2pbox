'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Search, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { useToast } from '@/components/ui/toast';

type Product = { id: string; name: string; slug: string; price: number; active: boolean };
type Channel = { id: string; label: string; source: string; medium: string };

const CHANNELS: Channel[] = [
  { id: 'whatsapp', label: 'WhatsApp', source: 'whatsapp', medium: 'status' },
  { id: 'instagram', label: 'Instagram', source: 'instagram', medium: 'story' },
  { id: 'tiktok', label: 'TikTok', source: 'tiktok', medium: 'video' },
  { id: 'facebook', label: 'Facebook', source: 'facebook', medium: 'post' },
  { id: 'google', label: 'Google', source: 'google', medium: 'organic' },
  { id: 'other', label: 'Outro', source: 'other', medium: 'organic' },
];

const money = (value: number) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

export default function MarketingSharePage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const { data, error } = await supabase.from('products').select('id,name,slug,price,active').eq('active', true).order('name').range(0, 999);
      if (error) toast.error('Não foi possível carregar os produtos', error.message);
      setProducts((data || []) as Product[]);
      setLoading(false);
    }
    void load();
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => !q || product.name.toLowerCase().includes(q));
  }, [products, search]);

  const link = useMemo(() => {
    if (!selected || !channel || typeof window === 'undefined') return '';
    const url = new URL(`/produto/${selected.slug}`, window.location.origin);
    url.searchParams.set('utm_source', channel.source);
    url.searchParams.set('utm_medium', channel.medium);
    return url.toString();
  }, [selected, channel]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copiado', 'Pronto para divulgar.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Não foi possível copiar', 'Selecione e copie o link manualmente.');
    }
  }

  return (
    <main className="share-page">
      <SiteHeader variant="admin" subtitle="MARKETING · DIVULGAÇÃO" />
      <section className="share-shell">
        <Link href="/admin/marketing" className="share-back"><ArrowLeft size={16} /> Marketing</Link>
        <header className="share-head">
          <div><p>MARKETING</p><h1>Divulgar produto</h1><span>Escolha um produto, o canal e copie um link rastreável.</span></div>
          <div className="share-mark"><Share2 size={24} /></div>
        </header>

        <div className="share-grid">
          <section className="share-panel">
            <div className="share-panel-head"><div><strong>1. Produto</strong><span>Produtos ativos</span></div><b>{filtered.length}</b></div>
            <div className="share-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto..." /></div>
            <div className="share-products">
              {loading ? <div className="share-empty">Carregando produtos...</div> : filtered.length === 0 ? <div className="share-empty">Nenhum produto encontrado.</div> : filtered.map((product) => (
                <button type="button" className={`share-product ${selected?.id === product.id ? 'selected' : ''}`} key={product.id} onClick={() => { setSelected(product); setChannel(null); setCopied(false); }}>
                  <span className="share-product-check">{selected?.id === product.id ? <Check size={14} /> : null}</span>
                  <span><strong>{product.name}</strong><small>{money(product.price)}</small></span>
                </button>
              ))}
            </div>
          </section>

          <section className="share-panel">
            <div className="share-panel-head"><div><strong>2. Canal</strong><span>Onde você vai divulgar?</span></div></div>
            <div className="share-channels">
              {CHANNELS.map((item) => <button type="button" key={item.id} className={`share-channel ${channel?.id === item.id ? 'selected' : ''}`} disabled={!selected} onClick={() => { setChannel(item); setCopied(false); }}><span>{item.label}</span><small>{selected ? `utm_source=${item.source}` : 'Selecione um produto'}</small>{channel?.id === item.id && <Check size={16} />}</button>)}
            </div>

            <div className="share-result">
              <div><strong>3. Link pronto</strong><span>Esse é o único dado gerado para a divulgação.</span></div>
              <div className="share-url">{link || 'Selecione o produto e o canal.'}</div>
              <button type="button" className="share-copy" disabled={!link} onClick={() => void copyLink()}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copiado' : 'Copiar link'}</button>
            </div>
          </section>
        </div>
      </section>

      <style jsx global>{`
        .share-page{min-height:100vh;background:#f5f5f2;color:#111;font-family:Inter,Arial,sans-serif}.share-shell{width:min(1120px,calc(100% - 32px));margin:auto;padding:28px 0 70px}.share-back{display:inline-flex;align-items:center;gap:7px;color:#666;text-decoration:none;font-size:12px;font-weight:800;margin-bottom:28px}.share-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:28px}.share-head p{margin:0 0 7px;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.2em}.share-head h1{margin:0;font:italic 58px/1 'Barlow Condensed';text-transform:uppercase}.share-head span{display:block;color:#777;margin-top:10px;font-size:13px}.share-mark{width:54px;height:54px;border-radius:16px;background:#ffc400;display:grid;place-items:center;flex:none}.share-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.share-panel{background:#fff;border:1px solid #dddcd7;border-radius:18px;overflow:hidden;min-width:0}.share-panel-head{display:flex;justify-content:space-between;align-items:center;padding:18px 18px 12px}.share-panel-head div{display:grid;gap:4px}.share-panel-head strong{font-size:15px}.share-panel-head span{font-size:11px;color:#888}.share-panel-head>b{font-size:12px;background:#f3f3ef;border-radius:999px;padding:6px 9px}.share-search{margin:0 14px 10px;display:flex;align-items:center;gap:8px;border:1px solid #ddd;border-radius:10px;padding:10px 11px;color:#888}.share-search input{border:0;outline:0;width:100%;font:13px Inter}.share-products{max-height:540px;overflow:auto}.share-product{width:100%;border:0;border-top:1px solid #eee;background:#fff;padding:12px 14px;display:grid;grid-template-columns:28px 1fr;gap:9px;text-align:left;cursor:pointer}.share-product:hover,.share-product.selected{background:#fff9df}.share-product-check{width:22px;height:22px;border:1px solid #ddd;border-radius:7px;display:grid;place-items:center}.share-product.selected .share-product-check{background:#ffc400;border-color:#ffc400}.share-product span:last-child{display:grid;gap:4px;min-width:0}.share-product strong{font-size:12px;overflow-wrap:anywhere}.share-product small{font-size:10px;color:#777}.share-empty{padding:30px 18px;color:#888;font-size:12px}.share-channels{display:grid;gap:8px;padding:0 14px 14px}.share-channel{position:relative;text-align:left;border:1px solid #ddd;background:#fff;border-radius:11px;padding:11px 38px 11px 12px;display:grid;gap:3px;cursor:pointer}.share-channel:disabled{opacity:.55;cursor:not-allowed}.share-channel.selected{border-color:#ffc400;background:#fff9df}.share-channel span{font-size:12px;font-weight:900}.share-channel small{font-size:9px;color:#888}.share-channel svg{position:absolute;right:12px;top:50%;transform:translateY(-50%)}.share-result{margin:4px 14px 14px;padding:16px;border-radius:14px;background:#111;color:#fff}.share-result>div:first-child{display:grid;gap:4px}.share-result strong{font-size:13px}.share-result span{font-size:10px;color:#aaa}.share-url{margin:13px 0;padding:11px;border-radius:9px;background:#222;color:#ffc400;font:11px/1.45 monospace;overflow-wrap:anywhere;word-break:break-all}.share-copy{width:100%;border:0;border-radius:10px;background:#ffc400;color:#111;padding:12px;display:flex;justify-content:center;align-items:center;gap:8px;font:900 12px Inter;cursor:pointer}.share-copy:disabled{opacity:.45;cursor:not-allowed}@media(max-width:760px){.share-shell{width:calc(100% - 20px);padding:20px 0 48px}.share-head{align-items:flex-start}.share-head h1{font-size:44px}.share-mark{width:46px;height:46px}.share-grid{grid-template-columns:1fr}.share-products{max-height:360px}.share-channels{grid-template-columns:1fr 1fr}.share-result{margin-top:4px}}@media(max-width:430px){.share-channels{grid-template-columns:1fr}.share-head span{font-size:12px}}
      `}</style>
    </main>
  );
}
