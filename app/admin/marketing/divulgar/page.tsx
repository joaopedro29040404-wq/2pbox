'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Search, Share2, Store, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { useToast } from '@/components/ui/toast';

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  active: boolean;
  stock: number;
  image_url: string | null;
};
type Channel = { id: string; label: string; source: string; medium: string };

type ShareMode = 'product' | 'store';

const CHANNELS: Channel[] = [
  { id: 'whatsapp', label: 'WhatsApp', source: 'whatsapp', medium: 'status' },
  { id: 'instagram', label: 'Instagram', source: 'instagram', medium: 'story' },
  { id: 'tiktok', label: 'TikTok', source: 'tiktok', medium: 'video' },
  { id: 'facebook', label: 'Facebook', source: 'facebook', medium: 'post' },
  { id: 'google', label: 'Google', source: 'google', medium: 'organic' },
  { id: 'other', label: 'Outro', source: 'other', medium: 'organic' },
];

const money = (value: number) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

function productImage(product: Product) {
  return product.image_url || '';
}

export default function MarketingSharePage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [mode, setMode] = useState<ShareMode>('product');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('products')
        .select('id,name,slug,price,active,stock,image_url')
        .eq('active', true)
        .order('name')
        .range(0, 999);
      if (error) toast.error('Não foi possível carregar os produtos', error.message);
      setProducts((data || []) as Product[]);
      setLoading(false);
    }
    void load();
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => product.name.toLowerCase().includes(q));
  }, [products, search]);

  const link = useMemo(() => {
    if (!channel || typeof window === 'undefined') return '';
    const url = new URL(mode === 'store' ? '/' : `/produto/${selected?.slug || ''}`, window.location.origin);
    if (mode === 'product' && !selected) return '';
    url.searchParams.set('utm_source', channel.source);
    url.searchParams.set('utm_medium', channel.medium);
    url.searchParams.set('utm_campaign', mode === 'store' ? 'loja' : 'produto');
    return url.toString();
  }, [mode, selected, channel]);

  function chooseMode(nextMode: ShareMode) {
    setMode(nextMode);
    setCopied(false);
    if (nextMode === 'store') setSelected(null);
  }

  function chooseProduct(product: Product) {
    setSelected(product);
    setMode('product');
    setChannel(null);
    setCopied(false);
  }

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
          <div><p>MARKETING</p><h1>Divulgação</h1><span>Crie links rastreáveis para levar clientes ao produto ou à loja.</span></div>
          <div className="share-mark"><Share2 size={24} /></div>
        </header>

        <div className="share-mode-switch" role="tablist" aria-label="Tipo de divulgação">
          <button type="button" className={mode === 'product' ? 'active' : ''} onClick={() => chooseMode('product')}>
            <Share2 size={17} /><span><strong>Divulgar produto</strong><small>Link direto para um produto</small></span>
          </button>
          <button type="button" className={mode === 'store' ? 'active' : ''} onClick={() => chooseMode('store')}>
            <Store size={17} /><span><strong>Compartilhar loja</strong><small>Link para a loja inteira</small></span>
          </button>
        </div>

        {mode === 'product' ? (
          <div className="share-grid">
            <section className="share-panel">
              <div className="share-panel-head"><div><strong>1. Escolha o produto</strong><span>Produtos ativos disponíveis para divulgação</span></div><b>{filtered.length}</b></div>
              <div className="share-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome do produto..." aria-label="Buscar produto" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca"><X size={15} /></button>}</div>
              <div className="share-products">
                {loading ? <div className="share-empty">Carregando produtos...</div> : filtered.length === 0 ? <div className="share-empty"><strong>Nenhum produto encontrado.</strong><span>Tente outro nome de produto.</span></div> : filtered.map((product) => {
                  const image = productImage(product);
                  return (
                    <button type="button" className={`share-product ${selected?.id === product.id ? 'selected' : ''}`} key={product.id} onClick={() => chooseProduct(product)}>
                      <span className="share-product-thumb">{image ? <Image src={image} alt="" width={54} height={54} unoptimized /> : <Share2 size={18} />}</span>
                      <span className="share-product-info"><strong>{product.name}</strong><small>{product.stock > 0 ? `${product.stock} em estoque` : 'Sem estoque'} · Produto ativo</small><b>{money(product.price)}</b></span>
                      <span className="share-product-check">{selected?.id === product.id ? <Check size={14} /> : null}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="share-panel">
              <div className="share-panel-head"><div><strong>2. Canal de divulgação</strong><span>Onde você vai compartilhar?</span></div></div>
              {selected && (
                <div className="share-selected">
                  <div className="share-selected-thumb">{productImage(selected) ? <Image src={productImage(selected)} alt="" width={64} height={64} unoptimized /> : <Share2 size={20} />}</div>
                  <div><small>PRODUTO SELECIONADO</small><strong>{selected.name}</strong><span>{money(selected.price)} · {selected.stock > 0 ? `${selected.stock} em estoque` : 'sem estoque'}</span></div>
                </div>
              )}
              <div className="share-channels">
                {CHANNELS.map((item) => <button type="button" key={item.id} className={`share-channel ${channel?.id === item.id ? 'selected' : ''}`} disabled={!selected} onClick={() => { setChannel(item); setCopied(false); }}><span>{item.label}</span><small>{selected ? `Origem: ${item.source} · ${item.medium}` : 'Selecione um produto primeiro'}</small>{channel?.id === item.id && <Check size={16} />}</button>)}
              </div>

              <div className="share-result">
                <div><strong>3. Link rastreável</strong><span>Quem acessar por este link terá a origem registrada no Analytics.</span></div>
                <div className="share-url">{link ? new URL(link).origin + new URL(link).pathname : 'Selecione o produto e o canal.'}</div>
                <button type="button" className="share-copy" disabled={!link} onClick={() => void copyLink()}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copiado' : 'Copiar link'}</button>
              </div>
            </section>
          </div>
        ) : (
          <div className="share-store-layout">
            <section className="share-store-card">
              <div className="store-icon"><Store size={28} /></div>
              <div><p>LINK DA LOJA</p><h2>Leve o cliente para a 2P BOX</h2><span>Ideal para bio, status, perfil, cartão digital e campanhas em que você quer apresentar toda a loja.</span></div>
              <div className="store-benefits"><div><Check size={15} /><span>Rastreia de qual canal veio o acesso</span></div><div><Check size={15} /><span>Mantém a origem durante a navegação</span></div><div><Check size={15} /><span>Pode ser usado para medir vendas no Analytics</span></div></div>
            </section>
            <section className="share-panel store-channel-panel">
              <div className="share-panel-head"><div><strong>1. Escolha o canal</strong><span>O link muda conforme a origem da divulgação.</span></div></div>
              <div className="share-channels">
                {CHANNELS.map((item) => <button type="button" key={item.id} className={`share-channel ${channel?.id === item.id ? 'selected' : ''}`} onClick={() => { setChannel(item); setCopied(false); }}><span>{item.label}</span><small>Origem: {item.source} · {item.medium}</small>{channel?.id === item.id && <Check size={16} />}</button>)}
              </div>
              <div className="share-result">
                <div><strong>2. Link da loja</strong><span>Link rastreável para a página inicial da 2P BOX.</span></div>
                <div className="share-url">{link || 'Selecione o canal de divulgação.'}</div>
                <button type="button" className="share-copy" disabled={!link} onClick={() => void copyLink()}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copiado' : 'Copiar link da loja'}</button>
              </div>
            </section>
          </div>
        )}
      </section>

      <style jsx global>{`
        .share-page{min-height:100vh;background:#f5f5f2;color:#111;font-family:Inter,Arial,sans-serif}.share-shell{width:min(1120px,calc(100% - 32px));margin:auto;padding:28px 0 70px}.share-back{display:inline-flex;align-items:center;gap:7px;color:#666;text-decoration:none;font-size:12px;font-weight:800;margin-bottom:28px}.share-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}.share-head p{margin:0 0 7px;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.2em}.share-head h1{margin:0;font:italic 58px/1 'Barlow Condensed';text-transform:uppercase}.share-head span{display:block;color:#777;margin-top:10px;font-size:13px}.share-mark{width:54px;height:54px;border-radius:16px;background:#ffc400;display:grid;place-items:center;flex:none}.share-mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.share-mode-switch button{border:1px solid #dddcd7;background:#fff;border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:11px;text-align:left;cursor:pointer}.share-mode-switch button.active{border-color:#ffc400;background:#fff9df;box-shadow:0 0 0 1px #ffc400 inset}.share-mode-switch svg{flex:none}.share-mode-switch span{display:grid;gap:3px}.share-mode-switch strong{font-size:12px}.share-mode-switch small{font-size:10px;color:#888}.share-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:16px}.share-panel{background:#fff;border:1px solid #dddcd7;border-radius:18px;overflow:hidden;min-width:0}.share-panel-head{display:flex;justify-content:space-between;align-items:center;padding:18px 18px 12px}.share-panel-head div{display:grid;gap:4px}.share-panel-head strong{font-size:15px}.share-panel-head span{font-size:11px;color:#888}.share-panel-head>b{font-size:12px;background:#f3f3ef;border-radius:999px;padding:6px 9px}.share-search{margin:0 14px 10px;display:flex;align-items:center;gap:8px;border:1px solid #ddd;border-radius:10px;padding:10px 11px;color:#888}.share-search:focus-within{border-color:#ffc400;box-shadow:0 0 0 3px #fff4bf}.share-search input{border:0;outline:0;width:100%;font:13px Inter;background:transparent}.share-search button{border:0;background:transparent;color:#888;padding:2px;display:grid;place-items:center;cursor:pointer}.share-products{max-height:540px;overflow:auto}.share-product{width:100%;border:0;border-top:1px solid #eee;background:#fff;padding:10px 14px;display:grid;grid-template-columns:54px 1fr 24px;align-items:center;gap:11px;text-align:left;cursor:pointer}.share-product:hover,.share-product.selected{background:#fff9df}.share-product-thumb{width:54px;height:54px;border-radius:10px;background:#f4f4f1;display:grid;place-items:center;overflow:hidden;color:#aaa;flex:none}.share-product-thumb img{width:100%;height:100%;object-fit:contain;padding:4px}.share-product-info{display:grid;gap:4px;min-width:0}.share-product-info strong{font-size:12px;line-height:1.3;overflow-wrap:anywhere}.share-product-info small{font-size:9px;color:#888}.share-product-info b{font-size:12px}.share-product-check{width:22px;height:22px;border:1px solid #ddd;border-radius:7px;display:grid;place-items:center}.share-product.selected .share-product-check{background:#ffc400;border-color:#ffc400}.share-empty{padding:36px 18px;color:#888;font-size:12px;text-align:center;display:grid;gap:5px}.share-empty strong{color:#555}.share-channels{display:grid;gap:8px;padding:0 14px 14px}.share-channel{position:relative;text-align:left;border:1px solid #ddd;background:#fff;border-radius:11px;padding:11px 38px 11px 12px;display:grid;gap:3px;cursor:pointer}.share-channel:disabled{opacity:.55;cursor:not-allowed}.share-channel.selected{border-color:#ffc400;background:#fff9df}.share-channel span{font-size:12px;font-weight:900}.share-channel small{font-size:9px;color:#888}.share-channel svg{position:absolute;right:12px;top:50%;transform:translateY(-50%)}.share-selected{margin:0 14px 12px;padding:10px;border:1px solid #eee;border-radius:12px;background:#fafaf7;display:flex;align-items:center;gap:10px}.share-selected-thumb{width:64px;height:64px;border-radius:10px;background:#fff;display:grid;place-items:center;overflow:hidden;color:#aaa;flex:none}.share-selected-thumb img{width:100%;height:100%;object-fit:contain;padding:4px}.share-selected>div:last-child{display:grid;gap:4px;min-width:0}.share-selected small{font-size:8px;font-weight:900;color:#9b7600;letter-spacing:.08em}.share-selected strong{font-size:12px;overflow-wrap:anywhere}.share-selected span{font-size:10px;color:#777}.share-result{margin:4px 14px 14px;padding:16px;border-radius:14px;background:#111;color:#fff}.share-result>div:first-child{display:grid;gap:4px}.share-result strong{font-size:13px}.share-result span{font-size:10px;color:#aaa}.share-url{margin:13px 0;padding:11px;border-radius:9px;background:#222;color:#ffc400;font:11px/1.45 monospace;overflow-wrap:anywhere;word-break:break-all}.share-copy{width:100%;border:0;border-radius:10px;background:#ffc400;color:#111;padding:12px;display:flex;justify-content:center;align-items:center;gap:8px;font:900 12px Inter;cursor:pointer}.share-copy:disabled{opacity:.45;cursor:not-allowed}.share-store-layout{display:grid;grid-template-columns:1fr 1fr;gap:16px}.share-store-card{background:#111;color:#fff;border-radius:18px;padding:24px;display:flex;flex-direction:column;min-height:100%;position:relative;overflow:hidden}.share-store-card:after{content:'';position:absolute;width:180px;height:180px;border-radius:50%;background:#ffc400;right:-90px;top:-90px;opacity:.12}.store-icon{width:54px;height:54px;border-radius:15px;background:#ffc400;color:#111;display:grid;place-items:center;margin-bottom:24px}.share-store-card p{margin:0 0 7px;color:#ffc400;font-size:9px;font-weight:900;letter-spacing:.18em}.share-store-card h2{margin:0;font:italic 40px/1 'Barlow Condensed';text-transform:uppercase}.share-store-card>div:nth-child(2)>span{display:block;margin-top:11px;color:#bbb;font-size:12px;line-height:1.55;max-width:430px}.store-benefits{display:grid;gap:10px;margin-top:auto;padding-top:30px}.store-benefits div{display:flex;align-items:center;gap:8px;font-size:11px;color:#ddd}.store-benefits svg{color:#ffc400;flex:none}.store-channel-panel{display:flex;flex-direction:column}.store-channel-panel .share-result{margin-top:auto}.store-channel-panel .share-channels{padding-bottom:10px}@media(max-width:760px){.share-shell{width:calc(100% - 20px);padding:20px 0 48px}.share-head{align-items:flex-start}.share-head h1{font-size:44px}.share-mark{width:46px;height:46px}.share-grid,.share-store-layout{grid-template-columns:1fr}.share-products{max-height:390px}.share-store-card{min-height:310px}.share-store-card h2{font-size:36px}}@media(max-width:430px){.share-mode-switch{grid-template-columns:1fr}.share-product{grid-template-columns:48px 1fr 22px;padding:10px}.share-product-thumb{width:48px;height:48px}.share-store-card h2{font-size:32px}.share-head span{font-size:12px}}
      `}</style>
    </main>
  );
}
