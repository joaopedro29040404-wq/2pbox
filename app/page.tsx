'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Headphones, Image as ImageIcon, Laptop, PencilLine, Printer, ShoppingBag, Smartphone, Star, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getStoreSettings, StoreSettings } from '@/lib/store-settings';
import { SiteHeader } from '@/components/site-header';
import { ProductImage, productCover } from '@/components/ui/product-image';
import { SkeletonGrid } from '@/components/ui/loader';
import { money } from '@/lib/order-format';

type Category = { id: string; name: string; description?: string | null; parent_id?: string | null };
type Product = { id: string; name: string; slug: string; price: number; image_url?: string | null; images?: string[] | null };
type Banner = { id: string; image_url: string; mobile_image_url?: string; title?: string; description?: string; button_label?: string; link_url?: string; active?: boolean; sort_order?: number };

const MAIN_CATEGORY_ORDER = ['Papelaria', 'Eletrônicos', 'Acessórios para celular', 'Variedades'];
const FALLBACK_MAIN_CATEGORIES: Category[] = [
  { id: 'papelaria', name: 'Papelaria', description: 'Material escolar, escritório, artes e papelaria.' },
  { id: 'eletronicos', name: 'Eletrônicos', description: 'Tecnologia, conectividade, energia e periféricos.' },
  { id: 'acessorios-para-celular', name: 'Acessórios para celular', description: 'Acessórios e itens para dispositivos móveis.' },
  { id: 'variedades', name: 'Variedades', description: 'Casa, beleza, automotivo, presentes e utilidades.' },
];

function CategoryIcon({ index }: { index: number }) {
  if (index === 1) return <Laptop size={25} strokeWidth={1.8} />;
  if (index === 2) return <Smartphone size={25} strokeWidth={1.8} />;
  if (index === 3) return <ShoppingBag size={25} strokeWidth={1.8} />;
  return <PencilLine size={25} strokeWidth={1.8} />;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [slide, setSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const [printEnabled, setPrintEnabled] = useState(true);
  const [printTitle, setPrintTitle] = useState('PRECISA IMPRIMIR?');
  const [printDescription, setPrintDescription] = useState('Envie seu arquivo, escolha as configurações e faça seu pedido de impressão.');
  const [printImage, setPrintImage] = useState('');

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      const [{ data: categoryRows }, { data: productRows }, settings, { data: homeConfig }] = await Promise.all([
        client.from('categories').select('id,name,description,parent_id').eq('active', true).is('parent_id', null),
        client.from('products').select('id,name,slug,price,image_url,images').eq('active', true).order('created_at', { ascending: false }).limit(8),
        getStoreSettings(),
        client.from('store_settings').select('home_banners').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!mounted) return;
      if (categoryRows) {
        const ordered = [...(categoryRows as Category[])].sort((a, b) => {
          const ai = MAIN_CATEGORY_ORDER.indexOf(a.name);
          const bi = MAIN_CATEGORY_ORDER.indexOf(b.name);
          return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        });
        setCategories(ordered);
      }
      if (productRows) setProducts(productRows as Product[]);
      setStoreSettings(settings);
      const config = homeConfig as any;
      const activeBanners = Array.isArray(config?.home_banners) ? config.home_banners.filter((b: Banner) => b?.active !== false && b?.image_url).sort((a: Banner, b: Banner) => Number(a.sort_order || 0) - Number(b.sort_order || 0)) : [];
      setBanners(activeBanners.slice(0, 4));
      setPrintEnabled(true);
      setPrintTitle('PRECISA IMPRIMIR?');
      setPrintDescription('Envie seu arquivo, escolha as configurações e faça seu pedido de impressão.');
      setPrintImage('');
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(() => setSlide(current => (current + 1) % banners.length), 5000);
    return () => window.clearInterval(timer);
  }, [banners.length]);


  const visibleCategories = useMemo(
    () => (categories.length === 4 ? categories : FALLBACK_MAIN_CATEGORIES),
    [categories],
  );
  const whatsapp = storeSettings?.whatsapp?.trim() || '(11) 9 9999-9999';
  const hours = storeSettings?.hours?.trim() || 'Seg–Sex • 9h às 18h';

  return (
    <main className="home-page">
      <SiteHeader />
      <section className="home-hero">
        <div className="home-container home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-eyebrow">2P BOX</p>
            <h1>TUDO QUE VOCÊ PRECISA,<br/><em>EM UM SÓ LUGAR.</em></h1>
            <p className="home-lead">Papelaria, eletrônicos, acessórios para celular e variedades para facilitar o seu dia a dia.</p>
            <div className="home-hero-actions">
              <Link href="/loja" className="home-primary">COMPRAR AGORA <ArrowRight size={18}/></Link>
              <Link href="#categorias" className="home-secondary">VER CATEGORIAS</Link>
            </div>
          </div>

          <div className="home-hero-art">
            {banners.length ? <div className="home-carousel" onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { const startX = touchStartX.current; const endX = event.changedTouches[0]?.clientX ?? null; touchStartX.current = null; if (startX === null || endX === null || banners.length < 2) return; const distance = endX - startX; if (Math.abs(distance) < 45) return; setSlide(current => distance < 0 ? (current + 1) % banners.length : (current - 1 + banners.length) % banners.length); }}>
              <div className="home-carousel-shell">
                <Link href={banners[slide]?.link_url || '/loja'} className="home-carousel-media" aria-label={'Abrir banner promocional ' + (slide + 1)}>
                  <picture>
                    {banners[slide]?.mobile_image_url ? <source media="(max-width: 680px)" srcSet={banners[slide].mobile_image_url} /> : null}
                    <img key={banners[slide].id} src={banners[slide].image_url} alt="Banner promocional 2P Box" className="home-carousel-image" fetchPriority={slide === 0 ? 'high' : 'auto'} />
                  </picture>
                </Link>
                {banners.length > 1 ? <>
                  <button type="button" className="home-carousel-arrow left" onClick={(event)=>{event.preventDefault();event.stopPropagation();setSlide(current=>(current-1+banners.length)%banners.length)}} aria-label="Banner anterior"><ChevronLeft size={19}/></button>
                  <button type="button" className="home-carousel-arrow right" onClick={(event)=>{event.preventDefault();event.stopPropagation();setSlide(current=>(current+1)%banners.length)}} aria-label="Próximo banner"><ChevronRight size={19}/></button>
                </> : null}
              </div>
              {banners.length > 1 ? <div className="home-carousel-controls" aria-label="Controles do carrossel">
                <span>{String(slide + 1).padStart(2, '0')} / {String(banners.length).padStart(2, '0')}</span>
                <div className="home-carousel-dots">{banners.map((banner,index)=><button type="button" key={banner.id} className={index===slide?'active':''} onClick={()=>setSlide(index)} aria-label={'Ir para banner '+(index+1)} />)}</div>
              </div> : null}
              </div>
            </div> : <div className="home-hero-art-empty"><ImageIcon size={30}/><strong>CADASTRE SEU BANNER</strong><span>Marketing → Banners da Home</span></div>}
          </div>
        </div>
      </section>

      <section className="home-paths">
        <div className="home-container">
          <div className="home-path-heading"><p className="home-eyebrow">ESCOLHA O QUE VOCÊ PRECISA</p><h2>COMPRE OU RESOLVA.</h2><span>Produtos e serviços da 2P Box em um só lugar.</span></div>
          <div className="home-path-grid">
            <Link href="/loja" className="home-path-card"><div className="home-path-icon"><ShoppingBag /></div><div className="home-path-content"><p>01 · LOJA</p><h3>PRODUTOS</h3><span>Papelaria, eletrônicos, acessórios para celular e variedades.</span></div><div className="home-path-action">EXPLORAR PRODUTOS <ArrowRight /></div></Link>
            {printEnabled ? <Link href="/impressao" className="home-path-card print"><div className="home-path-icon"><Printer /></div><div className="home-path-content"><p>02 · SERVIÇO</p><h3>CENTRAL DE IMPRESSÃO</h3><span>Envie seus arquivos, escolha as configurações e faça seu pedido.</span></div><div className="home-path-action">ACESSAR CENTRAL <ArrowRight /></div></Link> : null}
          </div>
        </div>
      </section>

      <section id="categorias" className="home-section home-category-section">
        <div className="home-container">
          <div className="home-section-head">
            <div><p className="home-eyebrow">ENCONTRE O QUE PRECISA</p><h2>COMPRE POR CATEGORIA</h2></div>
            <Link href="/loja" className="home-section-link">VER TODAS <ArrowRight size={15} /></Link>
          </div>
          <div className="home-category-grid">
            {visibleCategories.map((category, index) => (
              <Link key={category.id || category.name} href={`/loja?categoria=${encodeURIComponent(category.id)}`} className="home-category-card">
                <div className="home-category-icon"><CategoryIcon index={index} /></div>
                <div className="home-category-copy"><p>{String(index + 1).padStart(2, '0')}</p><h3>{category.name}</h3><span>{category.description || 'Confira as subcategorias e produtos deste departamento.'}</span></div>
                <ArrowRight className="home-category-arrow" size={18} />
              </Link>
            ))}
          </div>
          <p className="home-category-hint">Selecione um departamento para ver suas subcategorias e produtos.</p>
        </div>
      </section>

      <section id="catalogo" className="home-section home-catalog">
        <div className="home-container">
          <div className="home-section-head"><div><p className="home-eyebrow">CATÁLOGO 2P BOX</p><h2>PRODUTOS</h2></div><Link href="/loja" className="home-section-link">VER CATÁLOGO <ArrowRight size={15} /></Link></div>
          {loading ? <SkeletonGrid count={4} height={300} /> : products.length ? <div className="home-product-grid">{products.map((product) => <Link href={`/produto/${product.slug}`} key={product.id} className="home-product-card"><div className="home-product-image"><ProductImage src={productCover(product)} alt={product.name} sizes="(max-width:900px) 50vw, 270px" /></div><div className="home-product-info"><small>2P BOX</small><h3>{product.name}</h3><strong>{money(product.price)}</strong></div></Link>)}</div> : <div className="home-empty"><ShoppingBag size={28} /><h3>Catálogo em atualização</h3><p>Os produtos cadastrados aparecerão aqui.</p><Link href="/loja" className="home-primary">ACESSAR A LOJA <ArrowRight size={16} /></Link></div>}
        </div>
      </section>

      <section className="home-benefits"><div className="home-container home-benefits-grid"><div className="home-benefit-intro"><p className="home-eyebrow">A 2P BOX</p><h2>TUDO QUE VOCÊ PRECISA.</h2><p>Escolha seus produtos, finalize o pedido e retire na loja ou fale conosco para calcular o frete pelo WhatsApp.</p></div><div className="home-benefit"><Truck size={25} /><h3>Retire na loja</h3><p>Prático e sem custo de entrega.</p></div><div className="home-benefit"><Headphones size={25} /><h3>Atendimento próximo</h3><p>Fale diretamente com a nossa equipe.</p></div><div className="home-benefit"><Star size={25} /><h3>Qualidade</h3><p>Produtos selecionados para você.</p></div></div></section>

      <footer id="contato" className="home-footer"><div className="home-container home-footer-grid"><div><Image src="/logo.pnh.png" alt="2P Box" width={705} height={487} /><p>Tudo que você precisa,<br />em um só lugar.</p></div><div><p className="home-eyebrow">LOJA</p><Link href="/loja">Produtos</Link><Link href="#categorias">Categorias</Link><Link href="/impressao">Central de Impressão</Link><Link href="/carrinho">Carrinho</Link><Link href="/acompanhar-pedido">Acompanhar pedido</Link></div><div><p className="home-eyebrow">ATENDIMENTO</p><span>WhatsApp: {whatsapp}</span><span>{hours}</span></div></div><div className="home-container home-footer-bottom">© 2026 2P Box. Todos os direitos reservados.</div></footer>

      <style jsx global>{`
        .home-page{--gold:#e7ad00;--yellow:#ffc400;--ink:#111;--muted:#707070;--line:#e7e7e7;min-height:100vh;background:#fff;color:var(--ink);font-family:Inter,Arial,sans-serif}.home-container{width:min(1180px,calc(100% - 56px));margin:0 auto}.home-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--line);background:linear-gradient(105deg,#fff 0%,#fff 58%,#fffdf2 100%)}.home-hero-grid{position:relative;z-index:1;min-height:540px;display:grid;grid-template-columns:minmax(0,1.02fr) minmax(420px,.98fr);align-items:center;gap:46px;padding:52px 0}.home-hero-copy{padding:12px 0}.home-eyebrow{margin:0 0 13px;color:#9a7200;font-size:10px;font-weight:900;letter-spacing:.34em}.home-hero h1{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:74px;line-height:.87;letter-spacing:-.025em;font-weight:800;font-style:italic;text-transform:uppercase}.home-hero h1 em{color:var(--gold);font-style:italic}.home-lead{max-width:560px;margin:25px 0 0;color:#686868;font-size:16px;line-height:1.65}.home-hero-actions{display:flex;gap:12px;margin-top:30px}.home-primary,.home-secondary{min-height:48px;padding:0 23px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border-radius:8px;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.1em}.home-primary{background:var(--yellow);border:1px solid var(--yellow);color:#111}.home-primary:hover{background:#111;border-color:#111;color:#fff}.home-secondary{background:#fff;border:1px solid #111;color:#111}.home-hero-art{width:100%;min-width:0;display:flex;align-items:center;justify-content:center;position:relative}.home-hero-art-empty{width:100%;aspect-ratio:16/10;border:1px dashed #d7d7d7;border-radius:22px;display:grid;place-items:center;align-content:center;gap:8px;color:#9a7200;background:#fff}.home-hero-art-empty strong{font-size:12px;letter-spacing:.12em}.home-hero-art-empty span{font-size:10px;color:#888}.home-carousel{width:100%;min-width:0;aspect-ratio:16/10;position:relative;overflow:hidden;border-radius:22px;background:#f4f4f2;box-shadow:0 20px 45px rgba(0,0,0,.10);isolation:isolate}.home-carousel-shell{position:absolute;inset:0;overflow:hidden}.home-carousel-media,.home-carousel-media picture,.home-carousel-media img{position:absolute;inset:0;width:100%;height:100%;display:block}.home-carousel-media{z-index:1;overflow:hidden}.home-carousel-image{object-fit:cover;object-position:center;animation:homeCarouselFade .45s ease both}.home-carousel-controls{height:30px;display:flex;align-items:center;justify-content:center;gap:10px;margin-top:8px;color:#888;font-size:9px;font-weight:900;letter-spacing:.12em}.home-carousel-controls>span{min-width:34px;text-align:center}.home-carousel-controls .home-carousel-dots{position:static;transform:none;display:flex;align-items:center;gap:6px;padding:0;border:0;background:transparent;backdrop-filter:none}.home-carousel-controls .home-carousel-dots button{width:7px;height:7px;border:0;border-radius:50%;background:#d5d5d5;padding:0;cursor:pointer}.home-carousel-controls .home-carousel-dots button.active{width:22px;border-radius:999px;background:#ffc400}.home-carousel-arrow{position:absolute;z-index:4;top:50%;transform:translateY(-50%);width:40px;height:40px;border:1px solid rgba(255,255,255,.45);border-radius:50%;background:rgba(0,0,0,.25);backdrop-filter:blur(10px);color:#fff;display:grid;place-items:center;cursor:pointer;transition:transform .18s,background .18s}.home-carousel-arrow:hover{transform:translateY(-50%) scale(1.06);background:rgba(0,0,0,.55)}.home-carousel-arrow.left{left:12px}.home-carousel-arrow.right{right:12px}.home-carousel-dots{position:absolute;z-index:4;bottom:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(0,0,0,.2);backdrop-filter:blur(8px)}.home-carousel-dots button{width:7px;height:7px;border:0;border-radius:50%;background:rgba(255,255,255,.65);padding:0;cursor:pointer}.home-carousel-dots button.active{width:22px;border-radius:999px;background:#ffc400}@keyframes homeCarouselFade{from{opacity:.72;transform:scale(1.015)}to{opacity:1;transform:scale(1)}}.home-paths{padding:70px 0 64px;background:#fafaf7;border-bottom:1px solid var(--line)}.home-path-heading{margin-bottom:24px}.home-path-heading h2{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:48px;line-height:.92;font-weight:800;font-style:italic;text-transform:uppercase}.home-path-heading>span{display:block;color:#777;font-size:12px;margin-top:8px}.home-path-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.home-path-card{min-height:190px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;position:relative;text-decoration:none;color:#111;background:#fff;border:1px solid #e1e1dd;border-radius:16px;transition:transform .18s,box-shadow .18s,border-color .18s;overflow:hidden}.home-path-card:after{content:'';position:absolute;right:-55px;top:-70px;width:170px;height:170px;border-radius:50%;background:#fff8d8}.home-path-card:hover{transform:translateY(-3px);box-shadow:0 15px 35px rgba(0,0,0,.08);border-color:#d9c77a}.home-path-card.print{background:#111;color:#fff;border-color:#111}.home-path-card.print:after{background:#1d1d1d}.home-path-icon{position:relative;z-index:1;width:48px;height:48px;border-radius:13px;background:#ffc400;display:grid;place-items:center}.home-path-content{position:relative;z-index:1}.home-path-card p{margin:0 0 5px;color:#a07800;font-size:9px;font-weight:900;letter-spacing:.16em}.home-path-card.print p{color:#ffc400}.home-path-card h3{margin:0 0 7px;font:italic 32px/.9 'Barlow Condensed';text-transform:uppercase;max-width:430px}.home-path-card span{display:block;max-width:500px;color:#777;font-size:12px;line-height:1.55;padding-right:34px}.home-path-card.print span{color:#aaa}.home-path-action{position:relative;z-index:2;display:flex;align-items:center;gap:7px;margin-top:20px;font-size:9px;font-weight:900;letter-spacing:.1em}.home-path-action svg{width:16px;height:16px}.home-print{padding:78px 0;background:#111;color:#fff}.home-print-grid{display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:50px}.home-print h2{margin:0;font:italic 58px/.9 'Barlow Condensed';text-transform:uppercase}.home-print p:not(.home-eyebrow){max-width:590px;color:#aaa;font-size:15px;line-height:1.65}.home-print-features{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}.home-print-features span{padding:8px 10px;border:1px solid #333;border-radius:999px;color:#ccc;font-size:10px}.home-print-art{min-height:330px;display:grid;place-items:center}.home-print-art>img{width:100%;max-height:390px;object-fit:contain;border-radius:18px}.home-print-placeholder{width:min(390px,100%);aspect-ratio:1;display:grid;place-items:center;align-content:center;gap:18px;border:1px solid #333;border-radius:24px;background:linear-gradient(145deg,#191919,#0d0d0d);color:#ffc400}.home-print-placeholder strong{text-align:center;font:italic 30px/.9 'Barlow Condensed';color:#fff}.home-print-placeholder b{color:#ffc400}.home-section{padding:78px 0}.home-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:30px}.home-section-head h2{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:46px;line-height:.92;font-weight:800;font-style:italic;text-transform:uppercase}.home-section-link{display:flex;align-items:center;gap:7px;text-decoration:none;color:#111;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}.home-category-grid{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);border-left:1px solid var(--line)}.home-category-card{min-height:205px;padding:27px 23px;display:flex;flex-direction:column;justify-content:space-between;position:relative;text-decoration:none;color:#111;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.home-category-card:hover{background:#fffdf2}.home-category-icon{width:50px;height:50px;display:grid;place-items:center;background:var(--yellow);border-radius:50%}.home-category-copy p{margin:0 0 5px;color:#a37b00;font-size:9px;font-weight:900}.home-category-copy h3{margin:0 0 7px;font-family:'Barlow Condensed',sans-serif;font-size:26px;line-height:.95;text-transform:uppercase}.home-category-copy span{display:block;color:#777;font-size:11px;line-height:1.45}.home-category-arrow{position:absolute;right:22px;bottom:27px}.home-category-hint{margin:15px 0 0;color:#888;font-size:10px;text-align:right}.home-catalog{background:#fafafa;border-top:1px solid var(--line)}.home-product-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.home-product-card{overflow:hidden;background:#fff;border:1px solid #e2e2e2;border-radius:14px;color:#111;text-decoration:none;transition:border-color .18s,box-shadow .18s}.home-product-card:hover{border-color:#dcd0a0;box-shadow:0 10px 26px rgba(0,0,0,.06)}.home-product-image{aspect-ratio:1/1;background:#f5f5f3;overflow:hidden}.home-product-info{padding:17px}.home-product-info small{font-size:8px;color:#999;font-weight:900}.home-product-info h3{margin:8px 0 13px;font-family:'Barlow Condensed',sans-serif;font-size:22px;line-height:1;text-transform:uppercase}.home-product-info strong{font-size:18px}.home-empty{text-align:center;border:1px solid var(--line);background:#fff;padding:55px;border-radius:14px}.home-empty h3{margin:14px 0 6px;font-size:20px}.home-empty p{margin:0 0 20px;color:#777;font-size:13px}.home-benefits{background:#111;color:#fff;padding:60px 0}.home-benefits-grid{display:grid;grid-template-columns:1.45fr repeat(3,1fr)}.home-benefit-intro,.home-benefit{padding:0 30px;border-left:1px solid #333}.home-benefit-intro{padding-left:0;border-left:0}.home-benefit-intro h2{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:34px;font-style:italic}.home-benefit-intro>p:last-child{color:#aaa;font-size:12px;line-height:1.6}.home-benefit svg{color:var(--yellow)}.home-benefit h3{margin:15px 0 5px;font-family:'Barlow Condensed',sans-serif;font-size:25px;text-transform:uppercase}.home-benefit p{color:#aaa;font-size:11px}.home-footer{background:#0b0b0b;color:#fff;padding:52px 0 0}.home-footer-grid{display:grid;grid-template-columns:1.5fr .7fr 1fr;gap:55px;padding-bottom:42px}.home-footer-grid img{width:105px;height:65px;object-fit:contain}.home-footer-grid p:not(.home-eyebrow),.home-footer-grid a,.home-footer-grid span{display:block;color:#aaa;font-size:11px;line-height:1.9;text-decoration:none}.home-footer-grid a:hover{color:var(--yellow)}.home-footer .home-eyebrow{color:var(--yellow)}.home-footer-bottom{border-top:1px solid #242424;padding:17px 0;color:#666;font-size:9px}@media(max-width:900px){.home-hero-grid{grid-template-columns:1fr;gap:28px;min-height:auto}.home-hero-copy{padding:38px 0 0}.home-hero h1{font-size:58px}.home-hero-art{width:100%}.home-carousel{width:100%}.home-path-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home-path-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home-path-card{min-height:180px;padding:20px}.home-path-card h3{font-size:29px}.home-path-card span{font-size:11px}.home-print-grid{grid-template-columns:1fr}.home-print-art{min-height:260px}.home-container{width:min(100% - 40px,1180px)}.home-hero h1{font-size:58px}.home-category-grid{grid-template-columns:repeat(2,1fr)}.home-product-grid{grid-template-columns:repeat(2,1fr)}.home-benefits-grid{grid-template-columns:1fr 1fr;gap:28px}.home-benefit-intro{grid-column:1/-1}.home-footer-grid{grid-template-columns:1fr 1fr;gap:30px}}@media(max-width:680px){.home-hero-grid{gap:24px;padding:0 0 34px}.home-hero-copy{padding:38px 0 0}.home-hero h1{font-size:46px}.home-lead{font-size:14px;margin-top:20px}.home-hero-actions{margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.home-primary,.home-secondary{min-height:48px;padding:0 12px;font-size:9px}.home-hero-art{width:100%}.home-carousel{width:100%;aspect-ratio:16/10;border-radius:18px;box-shadow:0 14px 30px rgba(0,0,0,.09)}.home-carousel-arrow{width:36px;height:36px}.home-carousel-arrow.left{left:9px}.home-carousel-arrow.right{right:9px}.home-carousel-dots{bottom:10px;padding:5px 7px}.home-carousel-image{width:100%;max-width:100%;height:100%;object-fit:cover}.home-paths{padding:48px 0 50px}.home-path-heading{margin-bottom:20px}.home-path-heading h2{font-size:40px}.home-path-heading>span{font-size:12px;margin-top:6px}.home-path-grid{grid-template-columns:1fr;gap:10px}.home-path-card{min-height:145px;padding:17px 16px;border-radius:13px}.home-path-icon{width:42px;height:42px;border-radius:11px}.home-path-card p{font-size:8px;margin:0 0 3px}.home-path-card h3{font-size:26px;margin:0 0 3px}.home-path-card span{font-size:10px;line-height:1.35}.home-path-action{font-size:8px;gap:4px}.home-path-action svg{width:15px;height:15px}.home-carousel{min-height:0;aspect-ratio:16/10;width:100%;max-width:100vw}.home-carousel-arrow{width:38px;height:38px}.home-carousel-arrow.left{left:12px}.home-carousel-arrow.right{right:12px}.home-paths{padding:52px 0}.home-path-card{min-height:190px}.home-print{padding:55px 0}.home-print h2{font-size:47px}.home-container{width:calc(100% - 28px)}.home-hero-grid{min-height:auto;display:flex;flex-direction:column}.home-hero-copy{width:100%;padding:42px 0 10px}.home-hero h1{font-size:46px}.home-lead{font-size:14px}.home-hero-actions{margin-top:24px;display:grid;grid-template-columns:1fr 1fr}.home-hero-art{width:100%;min-height:0;height:auto}.home-hero-art img{width:min(100%,460px)}.home-section{padding:54px 0}.home-section-head{margin-bottom:24px}.home-section-head h2{font-size:37px}.home-category-card{min-height:180px;padding:20px 16px}.home-product-grid{gap:10px}.home-product-info{padding:13px}.home-product-info h3{font-size:19px}.home-benefits-grid{grid-template-columns:1fr 1fr;gap:26px 0}.home-benefit{padding:0 15px}.home-footer-grid>div:first-child{grid-column:1/-1}}@media(max-width:390px){.home-hero h1{font-size:41px}.home-hero-actions{grid-template-columns:1fr}.home-carousel{aspect-ratio:16/10}.home-category-grid{grid-template-columns:1fr}.home-category-copy h3{font-size:22px}.home-product-grid{grid-template-columns:1fr}.home-section-head{display:block}.home-section-link{margin-top:12px}}
      `}</style>
    </main>
  );
}
