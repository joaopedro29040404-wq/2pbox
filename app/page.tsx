'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Facebook, Heart, Instagram, Music2, PackageCheck, Headphones, Image as ImageIcon, Printer, ShoppingBag, ShoppingCart, Star, Truck, Youtube } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getStoreSettings, StoreSettings } from '@/lib/store-settings';
import { SiteHeader } from '@/components/site-header';
import { ProductImage, productCover } from '@/components/ui/product-image';
import { SkeletonGrid } from '@/components/ui/loader';
import { money } from '@/lib/order-format';

type Category = { id: string; name: string; description?: string | null; parent_id?: string | null };
type Product = { id: string; name: string; slug: string; price: number; image_url?: string | null; promotionalPrice?: number | null };
type Banner = { id: string; image_url: string; mobile_image_url?: string; title?: string; description?: string; button_label?: string; link_url?: string; active?: boolean; sort_order?: number };

const MAIN_CATEGORY_ORDER = ['Papelaria', 'Eletrônicos', 'Acessórios para celular', 'Informática'];
const FALLBACK_MAIN_CATEGORIES: Category[] = [
  { id: 'papelaria', name: 'Papelaria', description: 'Material escolar, escritório, artes e papelaria.' },
  { id: 'eletronicos', name: 'Eletrônicos', description: 'Tecnologia, conectividade, energia e periféricos.' },
  { id: 'acessorios-para-celular', name: 'Acessórios para celular', description: 'Acessórios e itens para dispositivos móveis.' },
  { id: 'informatica', name: 'Informática', description: 'Monitores, periféricos, acessórios e tecnologia.' },
];

const CATEGORY_CARD_ART = [
  '/categories/papelaria.svg',
  '/categories/eletronicos.svg',
  '/categories/celular.svg',
  '/categories/informatica.svg',
] as const;


export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [slide, setSlide] = useState(0);
  const [bannerImageLoaded, setBannerImageLoaded] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const [printEnabled, setPrintEnabled] = useState(true);

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
        client.from('products').select('id,name,slug,price,image_url,promotions(promotional_price,starts_at,ends_at,active)').eq('active', true).order('created_at', { ascending: false }).limit(8),
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
      if (productRows) setProducts((productRows as any[]).map((product) => { const now=Date.now(); const active=(Array.isArray(product.promotions)?product.promotions:[]).find((p:any)=>p?.active && Number(p.promotional_price)>0 && Number(p.promotional_price)<Number(product.price) && new Date(p.starts_at).getTime()<=now && new Date(p.ends_at).getTime()>=now); const { promotions, ...clean }=product; return { ...clean, promotionalPrice: active ? Number(active.promotional_price) : null }; }) as Product[]);
      setStoreSettings(settings);
      const config = homeConfig as any;
      const activeBanners = Array.isArray(config?.home_banners) ? config.home_banners.filter((b: Banner) => b?.active !== false && b?.image_url).sort((a: Banner, b: Banner) => Number(a.sort_order || 0) - Number(b.sort_order || 0)) : [];
      setBanners(activeBanners.slice(0, 4));
      setPrintEnabled(true);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const image = document.querySelector<HTMLImageElement>('.home-carousel-image');
    if (image?.complete) setBannerImageLoaded(true);
  }, [banners, slide]);

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
  const socialLinks: StoreSettings['socialLinks'] = storeSettings?.socialLinks || { instagram: '', tiktok: '', facebook: '', youtube: '', whatsapp: '' };
  const socialItems = [
    { key: 'instagram', label: 'Instagram', href: socialLinks.instagram, icon: Instagram },
    { key: 'tiktok', label: 'TikTok', href: socialLinks.tiktok, icon: Music2 },
    { key: 'facebook', label: 'Facebook', href: socialLinks.facebook, icon: Facebook },
    { key: 'youtube', label: 'YouTube', href: socialLinks.youtube, icon: Youtube },
  ].filter((item) => item.href);

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
            {loading ? <div className="home-carousel home-carousel-loading" aria-hidden="true"><div className="home-carousel-shell"><div className="home-carousel-skeleton"><span /></div></div></div> : banners.length ? <div className="home-carousel" onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { const startX = touchStartX.current; const endX = event.changedTouches[0]?.clientX ?? null; touchStartX.current = null; if (startX === null || endX === null || banners.length < 2) return; const distance = endX - startX; if (Math.abs(distance) < 45) return; setSlide(current => distance < 0 ? (current + 1) % banners.length : (current - 1 + banners.length) % banners.length); }}>
              <div className="home-carousel-shell">
                {!bannerImageLoaded ? <div className="home-carousel-skeleton" aria-hidden="true"><span /></div> : null}
                <Link href={banners[slide]?.link_url || '/loja'} className="home-carousel-media" aria-label={'Abrir banner promocional ' + (slide + 1)}>
                  <picture>
                    {banners[slide]?.mobile_image_url ? <source media="(max-width: 680px)" srcSet={banners[slide].mobile_image_url} /> : null}
                    <Image key={banners[slide].id} src={banners[slide].image_url} alt="Banner promocional 2P Box" className="home-carousel-image" width={1920} height={700} sizes="(max-width:680px) 100vw, 580px" priority={slide === 0} fetchPriority={slide === 0 ? 'high' : 'auto'} onLoad={() => setBannerImageLoaded(true)} />
                  </picture>
                </Link>
                {banners.length > 1 ? (() => {
                  const nextBanner = banners[(slide + 1) % banners.length];
                  return (
                    <Image
                      src={nextBanner.image_url}
                      alt=""
                      aria-hidden="true"
                      width={1920}
                      height={700}
                      sizes="(max-width:680px) 100vw, 580px"
                      priority
                      className="home-carousel-preload"
                    />
                  );
                })() : null}
              </div>
              {bannerImageLoaded && banners.length > 1 ? <div className="home-carousel-controls" aria-label="Controles do carrossel">
                <button type="button" className="home-carousel-arrow" onClick={()=>setSlide(current=>(current-1+banners.length)%banners.length)} aria-label="Banner anterior"><ChevronLeft size={18}/></button>
                <div className="home-carousel-dots">{banners.map((banner,index)=><button type="button" key={banner.id} className={index===slide?'active':''} onClick={()=>setSlide(index)} aria-label={'Ir para banner '+(index+1)} />)}</div>
                <button type="button" className="home-carousel-arrow" onClick={()=>setSlide(current=>(current+1)%banners.length)} aria-label="Próximo banner"><ChevronRight size={18}/></button>
              </div> : null}
            </div> : <div className="home-hero-art-empty"><ImageIcon size={30}/><strong>NOVAS OFERTAS EM BREVE</strong><span>Estamos preparando novidades para você.</span></div>}
          </div>
        </div>
      </section>

      <section className="home-paths">
        <div className="home-container">
          <div className="home-path-heading"><p className="home-eyebrow">ACESSO RÁPIDO</p><h2>O QUE VOCÊ PRECISA HOJE?</h2><span>Escolha a solução ideal da 2P Box.</span></div>
          <div className="home-path-grid">
            <Link href="/loja" className="home-path-card home-path-products">
              <div className="home-path-icon" aria-hidden="true"><ShoppingBag size={25} strokeWidth={1.8} /></div>
              <Image className="home-path-art home-path-products-art" src="/images/home/quick-products.svg" alt="" width={300} height={190} sizes="(max-width:680px) 24vw, 250px" aria-hidden="true" />
              <div className="home-path-content"><h3>PRODUTOS</h3><span>Eletrônicos, acessórios, papelaria e muito mais.</span></div>
              <div className="home-path-action">COMPRAR AGORA <ArrowRight /></div>
            </Link>
            {printEnabled ? <Link href="/impressao" className="home-path-card print">
              <div className="home-path-icon" aria-hidden="true"><Printer size={25} strokeWidth={1.8} /></div>
              <Image className="home-path-art home-path-print-art" src="/images/home/quick-print.svg" alt="" width={300} height={190} sizes="(max-width:680px) 24vw, 250px" aria-hidden="true" />
              <div className="home-path-content"><h3>CENTRAL DE IMPRESSÃO</h3><span>Imprima seus arquivos de forma rápida, fácil e com qualidade.</span></div>
              <div className="home-path-action">ACESSAR AGORA <ArrowRight /></div>
            </Link> : null}
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
              <Link key={category.id || category.name} href={`/loja?categoria=${encodeURIComponent(category.id)}`} className={`home-category-card category-${index + 1}`}>
                <div className="home-category-visual" aria-hidden="true">
                  <Image
                    src={CATEGORY_CARD_ART[index] ?? CATEGORY_CARD_ART[0]}
                    alt=""
                    width={240}
                    height={160}
                    sizes="(max-width: 680px) 25vw, 260px"
                    className="home-category-art"
                  />
                </div>
                <div className="home-category-copy">
                  <h3>{category.name}</h3>
                </div>
              </Link>
            ))}
          </div>
          <p className="home-category-hint">Toque em uma categoria para explorar os produtos.</p>
        </div>
      </section>

      <section id="catalogo" className="home-section home-catalog">
        <div className="home-container">
          <div className="home-section-head"><div><p className="home-eyebrow">2P BOX</p><h2>DESTAQUES</h2></div><Link href="/loja" className="home-section-link">VER CATÁLOGO <ArrowRight size={15} /></Link></div>
          {loading ? <SkeletonGrid count={4} height={300} /> : products.length ? <div className="home-product-grid">{products.slice(0,4).map((product) => { const promo=product.promotionalPrice != null && product.promotionalPrice > 0 && product.promotionalPrice < product.price; return <Link href={`/produto/${product.slug}`} key={product.id} className="home-product-card"><div className="home-product-image">{promo ? <span className="home-product-badge">OFERTA</span> : null}<span className="home-product-favorite" aria-hidden="true"><Heart size={15} /></span><ProductImage src={productCover(product)} alt={product.name} sizes="(max-width:900px) 50vw, 270px" /><span className="home-product-cart" aria-hidden="true"><ShoppingCart size={15} /></span></div><div className="home-product-info"><small>2P BOX</small><h3>{product.name}</h3>{promo ? <del className="home-product-price-original">{money(product.price)}</del> : null}<strong className={promo ? 'is-promo' : ''}>{money(promo ? product.promotionalPrice! : product.price)}</strong></div></Link>; })}</div> : <div className="home-empty"><ShoppingBag size={28} /><h3>Catálogo em atualização</h3><p>Os produtos cadastrados aparecerão aqui.</p><Link href="/loja" className="home-primary">ACESSAR A LOJA <ArrowRight size={16} /></Link></div>}
        </div>
      </section>

      <section className="home-benefits"><div className="home-container home-benefits-grid"><div className="home-benefit"><ShoppingCart size={24} /><h3>Compra segura</h3><p>Seus dados protegidos.</p></div><div className="home-benefit"><PackageCheck size={24} /><h3>Entrega rápida</h3><p>Para todo o Brasil.</p></div><div className="home-benefit"><Headphones size={24} /><h3>Atendimento via WhatsApp</h3><p>Fale diretamente com nossa equipe.</p></div><div className="home-benefit"><Star size={24} /><h3>Qualidade garantida</h3><p>Produtos selecionados para você.</p></div></div></section>

      <footer id="contato" className="home-footer"><div className="home-container home-footer-grid"><div className="home-footer-brand"><Image src="/logo.pnh.png" alt="2P Box" width={705} height={487} /><p>Tudo que você precisa,<br />em um só lugar.</p><div className="home-socials">{socialItems.map((item) => { const Icon=item.icon; return <a key={item.key} href={item.href} target="_blank" rel="noreferrer" aria-label={item.label}><Icon size={17} /></a>; })}</div></div><div><p className="home-eyebrow">LOJA</p><Link href="/loja">Destaques</Link><Link href="#categorias">Categorias</Link><Link href="/impressao">Central de Impressão</Link><Link href="/carrinho">Carrinho</Link><Link href="/acompanhar-pedido">Acompanhar pedido</Link></div><div><p className="home-eyebrow">ATENDIMENTO</p><span>WhatsApp: {whatsapp}</span><span>{hours}</span></div></div><div className="home-container home-footer-bottom">© 2026 2P Box. Todos os direitos reservados.</div></footer>

      <style jsx global>{`
        .home-page{--gold:#e7ad00;--yellow:#ffc400;--ink:#111;--muted:#707070;--line:#e7e7e7;min-height:100vh;background:#fff;color:var(--ink);font-family:Inter,Arial,sans-serif}.home-container{width:min(1180px,calc(100% - 56px));margin:0 auto}.home-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--line);background:linear-gradient(105deg,#fff 0%,#fff 58%,#fffdf2 100%)}.home-hero-grid{position:relative;z-index:1;min-height:540px;display:grid;grid-template-columns:minmax(0,1.02fr) minmax(420px,.98fr);align-items:center;gap:46px;padding:52px 0}.home-hero-copy{padding:12px 0}.home-eyebrow{margin:0 0 13px;color:#9a7200;font-size:10px;font-weight:900;letter-spacing:.34em}.home-hero h1{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:74px;line-height:.87;letter-spacing:-.025em;font-weight:800;font-style:italic;text-transform:uppercase}.home-hero h1 em{color:var(--gold);font-style:italic}.home-lead{max-width:560px;margin:25px 0 0;color:#686868;font-size:16px;line-height:1.65}.home-hero-actions{display:flex;gap:12px;margin-top:30px}.home-primary,.home-secondary{min-height:48px;padding:0 23px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border-radius:8px;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.1em}.home-primary{background:var(--yellow);border:1px solid var(--yellow);color:#111}.home-primary:hover{background:#111;border-color:#111;color:#fff}.home-secondary{background:#fff;border:1px solid #111;color:#111}.home-hero-art{width:100%;min-width:0;display:flex;align-items:center;justify-content:center;position:relative}.home-hero-art-empty{width:100%;aspect-ratio:16/10;border:1px dashed #d7d7d7;border-radius:22px;display:grid;place-items:center;align-content:center;gap:8px;color:#9a7200;background:#fff}.home-hero-art-empty strong{font-size:12px;letter-spacing:.12em}.home-hero-art-empty span{font-size:10px;color:#888}.home-carousel{width:100%;min-width:0;position:relative}.home-carousel-loading{animation:none}.home-carousel-skeleton{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:linear-gradient(110deg,#f1f1ef 8%,#fafaf8 18%,#f1f1ef 33%);background-size:200% 100%;animation:homeBannerSkeleton 1.35s linear infinite}.home-carousel-skeleton span{width:28%;height:9px;border-radius:999px;background:rgba(17,17,17,.07)}@keyframes homeBannerSkeleton{to{background-position:-200% 0}}.home-carousel-shell{position:relative;width:100%;aspect-ratio:16/10;overflow:hidden;border-radius:22px;background:#f4f4f2;box-shadow:0 20px 45px rgba(0,0,0,.10);isolation:isolate}.home-carousel-media,.home-carousel-media picture,.home-carousel-media img{position:absolute;inset:0;width:100%;height:100%;display:block}.home-carousel-media{z-index:1;overflow:hidden;transition:opacity .22s ease}.home-carousel-image{object-fit:cover;object-position:center;animation:homeCarouselFade .45s ease both}.home-carousel-controls{height:38px;display:flex;align-items:center;justify-content:center;gap:14px;margin-top:8px;color:#888;font-size:9px;font-weight:900;letter-spacing:.12em}.home-carousel-controls .home-carousel-dots{position:static;transform:none;display:flex;align-items:center;gap:6px;padding:0;border:0;background:transparent}.home-carousel-controls .home-carousel-dots button{width:7px;height:7px;border:0;border-radius:50%;background:#d5d5d5;padding:0;cursor:pointer}.home-carousel-controls .home-carousel-dots button.active{width:22px;border-radius:999px;background:#ffc400}.home-carousel-arrow{position:static;width:32px;height:32px;border:1px solid #d8d8d4;border-radius:50%;background:#fff;color:#111;display:grid;place-items:center;flex:none;cursor:pointer;transition:transform .18s,background .18s,border-color .18s}.home-carousel-arrow:hover{transform:scale(1.06);background:#ffc400;border-color:#ffc400}.home-carousel-dots{display:flex;align-items:center;gap:6px}@keyframes homeCarouselFade{from{opacity:.72;transform:scale(1.015)}to{opacity:1;transform:scale(1)}}.home-paths{padding:70px 0 64px;background:#fafaf7;border-bottom:1px solid var(--line)}.home-path-heading{margin-bottom:24px}.home-path-heading h2{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:48px;line-height:.92;font-weight:800;font-style:italic;text-transform:uppercase}.home-path-heading>span{display:block;color:#777;font-size:12px;margin-top:8px}.home-path-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.home-path-card{min-height:210px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;position:relative;text-decoration:none;color:#111;background:#fff;border:1px solid #e5e5e2;border-radius:20px;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;overflow:hidden}.home-path-card:after{content:'';position:absolute;right:-70px;top:-85px;width:190px;height:190px;border-radius:50%;background:#fff8d8;pointer-events:none}.home-path-card:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(0,0,0,.08);border-color:#e5c94f}.home-path-card.print{background:#fff;border-color:#e5e5e2;color:#111}.home-path-card.print:after{background:#f4f4f1}.home-path-card .home-path-content,.home-path-card .home-path-action{position:relative;z-index:2}.home-path-card .home-path-content{max-width:78%}.home-path-icon{position:relative;z-index:2;width:52px;height:52px;border-radius:16px;background:#ffc400;color:#111;display:grid;place-items:center;box-shadow:0 8px 18px rgba(255,196,0,.18)}.home-path-card p{margin:0 0 5px;color:#a07800;font-size:9px;font-weight:900;letter-spacing:.16em}.home-path-card.print p{color:#a07800}.home-path-content{position:relative;z-index:1}.home-path-card h3{margin:0 0 7px;font:italic 32px/.9 'Barlow Condensed';text-transform:uppercase;max-width:430px}.home-path-card span{display:block;max-width:500px;color:#777;font-size:12px;line-height:1.55;padding-right:20px}.home-path-card.print span{color:#777}.home-path-action{position:relative;z-index:2;display:flex;align-items:center;gap:7px;margin-top:20px;font-size:9px;font-weight:900;letter-spacing:.1em;color:#111}.home-path-action svg{width:16px;height:16px}.home-print{padding:78px 0;background:#111;color:#fff}.home-print-grid{display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:50px}.home-print h2{margin:0;font:italic 58px/.9 'Barlow Condensed';text-transform:uppercase}.home-print p:not(.home-eyebrow){max-width:590px;color:#aaa;font-size:15px;line-height:1.65}.home-print-features{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}.home-print-features span{padding:8px 10px;border:1px solid #333;border-radius:999px;color:#ccc;font-size:10px}.home-print-art{min-height:330px;display:grid;place-items:center}.home-print-art>img{width:100%;max-height:390px;object-fit:contain;border-radius:18px}.home-print-placeholder{width:min(390px,100%);aspect-ratio:1;display:grid;place-items:center;align-content:center;gap:18px;border:1px solid #333;border-radius:24px;background:linear-gradient(145deg,#191919,#0d0d0d);color:#ffc400}.home-print-placeholder strong{text-align:center;font:italic 30px/.9 'Barlow Condensed';color:#fff}.home-print-placeholder b{color:#ffc400}.home-section{padding:78px 0}.home-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:30px}.home-section-head h2{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:46px;line-height:.92;font-weight:800;font-style:italic;text-transform:uppercase}.home-section-link{display:flex;align-items:center;gap:7px;text-decoration:none;color:#111;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}.home-category-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.home-category-card{min-height:150px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;text-decoration:none;color:#111;background:#fff;border:1px solid #e5e5e2;border-radius:18px;box-shadow:0 7px 20px rgba(0,0,0,.035);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.home-category-card:hover{transform:translateY(-4px);border-color:#e5c94f;box-shadow:0 18px 35px rgba(0,0,0,.08)}.home-category-card:active{transform:translateY(-1px) scale(.99)}.home-category-card-top{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between}.home-category-number{font-size:9px;font-weight:900;letter-spacing:.18em;color:#a37b00}.home-category-icon{width:52px;height:52px;display:grid;place-items:center;background:#fff8d8;border:1px solid #f0df91;border-radius:15px;color:#111;transition:transform .2s ease,background .2s ease}.home-category-card:hover .home-category-icon{transform:translateY(-2px);background:#ffc400}.home-category-arrow{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:#111;color:#fff;transition:transform .2s ease,background .2s ease}.home-category-card:hover .home-category-arrow{transform:translateX(3px);background:#ffc400;color:#111}.home-category-copy{position:relative;z-index:2;margin-top:auto;padding-top:20px;text-align:left}.home-category-copy h3{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:24px;line-height:.92;text-transform:uppercase}.home-category-copy span,.home-category-cta,.home-category-glow{display:none}.home-category-hint{margin:16px 0 0;color:#888;font-size:10px;text-align:right}.home-catalog{background:#fafafa;border-top:1px solid var(--line)}.home-product-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.home-product-card{overflow:hidden;background:#fff;border:1px solid #e2e2e2;border-radius:14px;color:#111;text-decoration:none;transition:border-color .18s,box-shadow .18s}.home-product-card:hover{border-color:#dcd0a0;box-shadow:0 10px 26px rgba(0,0,0,.06)}.home-product-image{position:relative;aspect-ratio:1/1;background:#f5f5f3;overflow:hidden}.home-product-badge{position:absolute;top:9px;left:9px;z-index:2;padding:5px 8px;border-radius:999px;background:#ffc400;color:#111;font-size:7px;font-weight:900;letter-spacing:.08em}.home-product-favorite{position:absolute;top:8px;right:8px;z-index:2;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#fff;border:1px solid #e4e4e4}.home-product-cart{position:absolute;right:9px;bottom:9px;z-index:2;width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:#ffc400;color:#111}.home-product-info{padding:13px}.home-product-info small{font-size:7px;color:#999;font-weight:900}.home-product-info h3{margin:7px 0 8px;font-family:'Barlow Condensed',sans-serif;font-size:20px;line-height:.95;text-transform:uppercase;min-height:38px}.home-product-price-original{display:block;color:#999;font-size:10px;line-height:1.1;text-decoration:line-through;margin:0 0 2px;font-weight:400}.home-product-info::after{content:none!important;display:none!important}.home-product-info strong{font-size:18px}.home-product-info strong.is-promo{color:#e7ad00}.home-empty{text-align:center;border:1px solid var(--line);background:#fff;padding:55px;border-radius:14px}.home-empty h3{margin:14px 0 6px;font-size:20px}.home-empty p{margin:0 0 20px;color:#777;font-size:13px}.home-benefits{background:#111;color:#fff;padding:48px 0}.home-benefits-grid{display:grid;grid-template-columns:repeat(4,1fr)}.home-benefit{padding:0 24px;border-left:1px solid #333}.home-benefit:first-child{border-left:0;padding-left:0}.home-benefit svg{color:var(--yellow)}.home-benefit h3{margin:12px 0 4px;font-family:'Barlow Condensed',sans-serif;font-size:22px;text-transform:uppercase}.home-benefit p{margin:0;color:#aaa;font-size:10px;line-height:1.45}.home-footer{background:#0b0b0b;color:#fff;padding:52px 0 0}.home-footer-grid{display:grid;grid-template-columns:1.5fr .7fr 1fr;gap:55px;padding-bottom:42px}.home-footer-grid img{width:105px;height:65px;object-fit:contain}.home-footer-grid p:not(.home-eyebrow),.home-footer-grid a,.home-footer-grid span{display:block;color:#aaa;font-size:11px;line-height:1.9;text-decoration:none}.home-footer-grid a:hover{color:var(--yellow)}.home-footer .home-eyebrow{color:var(--yellow)}.home-socials{display:flex;gap:8px;margin-top:14px}.home-socials a{width:34px;height:34px;display:grid!important;place-items:center;border:1px solid #333;border-radius:50%;color:#fff!important;line-height:1!important}.home-socials a:hover{background:var(--yellow);border-color:var(--yellow);color:#111!important}.home-footer-bottom{border-top:1px solid #242424;padding:17px 0;color:#666;font-size:9px}@media(max-width:900px){.home-hero-grid{grid-template-columns:1fr;gap:28px;min-height:auto}.home-hero-copy{padding:38px 0 0}.home-hero h1{font-size:58px}.home-hero-art{width:100%}.home-carousel{width:100%}.home-path-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home-path-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home-path-card{min-height:180px;padding:20px}.home-path-card h3{font-size:29px}.home-path-card span{font-size:11px}.home-path-card.print h3{font-size:25px;line-height:.9}.home-path-card.print .home-path-icon{margin-bottom:2px}.home-print-grid{grid-template-columns:1fr}.home-print-art{min-height:260px}.home-container{width:min(100% - 40px,1180px)}.home-hero h1{font-size:58px}.home-category-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home-product-grid{grid-template-columns:repeat(2,1fr)}.home-benefits-grid{grid-template-columns:1fr 1fr;gap:28px}.home-benefit-intro{grid-column:1/-1}.home-footer-grid{grid-template-columns:1fr 1fr;gap:30px}}@media(max-width:680px){.home-hero{border-bottom:0;overflow:visible}.home-carousel-controls{position:relative;z-index:5;margin-bottom:8px}.home-hero-grid{gap:24px;padding:0 0 34px}.home-hero-copy{padding:38px 0 10px}.home-hero h1{font-size:46px}.home-lead{font-size:14px;margin-top:18px}.home-hero-actions{margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.home-primary,.home-secondary{min-height:48px;padding:0 12px;font-size:9px}.home-hero-art{width:100%}.home-carousel{width:100%;aspect-ratio:16/10;border-radius:18px;box-shadow:0 14px 30px rgba(0,0,0,.09)}.home-carousel-arrow{width:32px;height:32px}.home-carousel-image{width:100%;max-width:100%;height:100%;object-fit:cover}.home-carousel-preload{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important}.home-paths{padding:46px 0 48px}.home-path-heading{margin-bottom:19px}.home-path-heading h2{font-size:38px;line-height:.9}.home-path-heading>span{font-size:11px;margin-top:6px}.home-path-grid{grid-template-columns:1fr 1fr;gap:10px}.home-path-card{min-height:172px;padding:15px 14px;border-radius:14px}.home-path-icon{width:40px;height:40px;border-radius:11px}.home-path-card p{font-size:7px;margin:0 0 4px}.home-path-card h3{font-size:24px;margin:0 0 5px}.home-path-card span{font-size:9px;line-height:1.35;padding-right:0}.home-path-action{font-size:7px;gap:4px;margin-top:12px}.home-path-action svg{width:14px;height:14px}.home-container{width:calc(100% - 28px)}.home-hero-grid{min-height:auto;display:flex;flex-direction:column}.home-hero-copy{width:100%}.home-hero h1{font-size:46px}.home-lead{font-size:14px}.home-hero-art{width:100%;min-height:0;height:auto}.home-hero-art img{width:min(100%,460px)}.home-section{padding:50px 0}.home-section-head{margin-bottom:21px}.home-section-head h2{font-size:37px}.home-category-card{min-height:205px;padding:16px}.home-category-copy h3{font-size:28px}.home-category-grid{gap:10px}.home-product-grid{gap:10px}.home-product-info{padding:12px}.home-product-info h3{font-size:18px;line-height:.98;margin:7px 0 10px}.home-product-info strong{font-size:17px}.home-benefits-grid{grid-template-columns:1fr 1fr;gap:22px 0}.home-benefit{padding:0 12px}.home-benefit:first-child{padding-left:0}.home-category-section{padding:42px 0 44px}.home-category-section .home-section-head{margin-bottom:20px}.home-category-section .home-section-head h2{font-size:39px;line-height:.88}.home-category-section .home-section-link{font-size:8px}.home-category-grid{display:flex;gap:9px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 1px 7px;scrollbar-width:none}.home-category-grid::-webkit-scrollbar{display:none}.home-category-card{min-width:118px;flex:0 0 118px;min-height:118px;padding:11px;border-radius:15px;background:#fff;border:1px solid #e5e5e2;box-shadow:0 5px 14px rgba(0,0,0,.05);scroll-snap-align:start}.home-category-card-top{align-items:center}.home-category-number{font-size:7px}.home-category-icon{width:38px;height:38px;border-radius:11px}.home-category-icon svg{width:19px;height:19px}.home-category-arrow{width:27px;height:27px}.home-category-arrow svg{width:14px;height:14px}.home-category-copy{padding-top:10px}.home-category-copy h3{font-size:18px}.home-category-hint{margin-top:11px;font-size:8px;text-align:center}.home-catalog{padding:42px 0 44px}.home-catalog .home-section-head{align-items:flex-end}.home-catalog .home-section-link{font-size:8px}.home-product-grid{gap:9px}.home-product-card{border-radius:12px;border-color:#deded9;box-shadow:0 6px 16px rgba(0,0,0,.04)}.home-product-image{aspect-ratio:.93/1}.home-product-info small{font-size:7px}.home-product-info h3{font-size:16px;min-height:30px;margin:5px 0 7px}.home-product-info strong{font-size:17px}.home-benefits{padding:40px 0}.home-benefits-grid{gap:19px 0}.home-benefit-intro h2{font-size:31px}.home-benefit-intro>p:last-child{font-size:10px}.home-benefit h3{font-size:20px}.home-benefit p{font-size:9px}.home-footer{padding-top:34px}.home-footer-grid{grid-template-columns:1.15fr .85fr;gap:20px;padding-bottom:24px}.home-footer-grid img{width:90px;height:55px}.home-socials{gap:6px;margin-top:10px}.home-socials a{width:30px;height:30px}.home-footer-grid p:not(.home-eyebrow),.home-footer-grid a,.home-footer-grid span{font-size:8.5px;line-height:1.55}.home-footer-bottom{font-size:7.5px;padding:11px 0}}@media(max-width:680px){.home-category-image{width:100%;height:96px;border-radius:12px;margin-bottom:8px;background-size:400% 100%}}@media(max-width:390px){.home-hero h1{font-size:41px}.home-hero-actions{grid-template-columns:1fr}.home-carousel{aspect-ratio:16/10}.home-category-grid{grid-template-columns:1fr 1fr}.home-category-card{min-height:205px;padding:15px;border-radius:15px}.home-category-icon{width:46px;height:46px;border-radius:13px}.home-category-arrow{width:34px;height:34px}.home-category-copy h3{font-size:24px}.home-category-copy span{font-size:10px}.home-category-cta{margin-top:15px;font-size:7px}.home-product-grid{grid-template-columns:1fr}.home-section-head{display:block}.home-section-link{margin-top:12px}}
        /* Professional visual refinement — preserves the existing component layout. */
        .home-paths{background:#f8f8f6}
        .home-path-heading{margin-bottom:24px}
        .home-path-heading h2{font-size:48px;letter-spacing:-.015em}
        .home-path-grid{gap:16px}
        .home-path-card{min-height:210px;padding:24px;border-radius:20px;background:#fff;border-color:#e3e3df;justify-content:space-between}
        .home-path-card:after{right:-70px;top:-85px;width:190px;height:190px;background:#fff8d8}
        .home-path-card.print{background:#111;color:#fff;border-color:#111}
        .home-path-card.print:after{background:#222}
        .home-path-card .home-path-content{max-width:78%}
        .home-path-card h3{font-size:32px;line-height:.9}
        .home-path-card span{font-size:12px;line-height:1.5}
        .home-path-action{font-size:9px;letter-spacing:.11em}
        .home-path-card.print .home-path-content span{color:#bdbdbd}
        .home-path-card.print .home-path-action{color:#111;background:#fff;border-radius:999px;padding:9px 13px;width:max-content}
        .home-path-card.print .home-path-action svg{color:#111}
        .home-category-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .home-category-card{min-height:150px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;text-decoration:none;color:#111;background:#fff;border:1px solid #e5e5e2;border-radius:18px;box-shadow:0 7px 20px rgba(0,0,0,.035);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
        .home-category-card:hover{transform:translateY(-4px);border-color:#e5c94f;box-shadow:0 18px 35px rgba(0,0,0,.08)}
        .home-category-card:active{transform:translateY(-1px) scale(.99)}
        .home-category-card-top{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between}
        .home-category-number{font-size:9px;font-weight:900;letter-spacing:.18em;color:#a37b00}
        .home-category-icon{width:52px;height:52px;display:grid;place-items:center;background:#fff8d8;border:1px solid #f0df91;border-radius:15px;color:#111;transition:transform .2s ease,background .2s ease}
        .home-category-card:hover .home-category-icon{transform:translateY(-2px);background:#ffc400}
        .home-category-arrow{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:#111;color:#fff;transition:transform .2s ease,background .2s ease}
        .home-category-card:hover .home-category-arrow{transform:translateX(3px);background:#ffc400;color:#111}
        .home-category-copy{position:relative;z-index:2;margin-top:auto;padding-top:20px;text-align:left}
        .home-category-copy h3{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:24px;line-height:.92;text-transform:uppercase}
        .home-category-copy span,.home-category-cta,.home-category-glow{display:none}
        @media(max-width:900px){.home-category-card{min-height:205px;padding:16px}.home-category-copy h3{font-size:28px}.home-category-grid{gap:10px}}
        @media(max-width:680px){.home-category-section{padding:42px 0 44px}.home-category-section .home-section-head{margin-bottom:20px}.home-category-section .home-section-head h2{font-size:39px;line-height:.88}.home-category-section .home-section-link{font-size:8px}.home-category-grid{display:flex;gap:9px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 1px 7px;scrollbar-width:none}.home-category-grid::-webkit-scrollbar{display:none}.home-category-card{min-width:118px;flex:0 0 118px;min-height:118px;padding:11px;border-radius:15px;background:#fff;border:1px solid #e5e5e2;box-shadow:0 5px 14px rgba(0,0,0,.05);scroll-snap-align:start}.home-category-card-top{align-items:center}.home-category-number{font-size:7px}.home-category-icon{width:38px;height:38px;border-radius:11px}.home-category-icon svg{width:19px;height:19px}.home-category-arrow{width:27px;height:27px}.home-category-arrow svg{width:14px;height:14px}.home-category-copy{padding-top:10px}.home-category-copy h3{font-size:18px}.home-category-hint{margin-top:11px;font-size:8px;text-align:center}}
        @media(max-width:390px){.home-category-grid{grid-template-columns:1fr 1fr}.home-category-card{min-height:205px;padding:15px;border-radius:15px}.home-category-icon{width:46px;height:46px;border-radius:13px}.home-category-arrow{width:34px;height:34px}.home-category-copy h3{font-size:24px}}
        /* Category cards — compact, balanced and visually secondary to the section heading. */
        .home-category-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .home-category-card,
        .home-category-card.category-1,
        .home-category-card.category-2,
        .home-category-card.category-3,
        .home-category-card.category-4{min-height:136px;height:136px;padding:14px 15px;border-radius:16px;background:#fff;border:1px solid #e4e4e1;box-shadow:0 5px 16px rgba(0,0,0,.035);isolation:isolate}
        .home-category-card:before{content:'';position:absolute;z-index:0;right:-32px;bottom:-38px;width:125px;height:125px;border-radius:50%;background:radial-gradient(circle,#fff4bd 0%,#fff9df 48%,rgba(255,249,223,0) 72%);pointer-events:none;transition:transform .22s ease,opacity .22s ease}
        .home-category-card:hover{transform:translateY(-2px);border-color:#d8c26b;box-shadow:0 10px 22px rgba(0,0,0,.06)}
        .home-category-card:hover:before{transform:scale(1.08);opacity:.9}
        .home-category-card-top{align-items:center}
        .home-category-number{font-size:8px;letter-spacing:.16em;color:#a37b00}
        .home-category-icon{width:44px;height:44px;border-radius:12px;background:#ffc400;border:1px solid #efb900;color:#111;box-shadow:0 5px 12px rgba(255,196,0,.16)}
        .home-category-icon svg{width:21px;height:21px}
        .home-category-arrow{width:29px;height:29px;background:#111;transition:transform .2s ease,background .2s ease}
        .home-category-card:hover .home-category-arrow{transform:translateX(3px);background:#ffc400;color:#111}
        .home-category-arrow svg{width:15px;height:15px}
        .home-category-copy{padding-top:12px;position:relative;z-index:1}
        .home-category-copy:before{content:'';display:block;width:22px;height:3px;margin-bottom:7px;border-radius:99px;background:#ffc400}
        .home-category-copy h3{font-size:21px;line-height:.95;letter-spacing:-.01em}
        .home-category-hint{margin-top:13px}
        @media(max-width:900px){
          .home-category-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
          .home-category-card,
          .home-category-card.category-1,
          .home-category-card.category-2,
          .home-category-card.category-3,
          .home-category-card.category-4{min-height:132px;height:132px}
        }
        @media(max-width:680px){
          .home-category-grid{display:flex;gap:9px;overflow-x:auto}
          .home-category-card,
          .home-category-card.category-1,
          .home-category-card.category-2,
          .home-category-card.category-3,
          .home-category-card.category-4{min-width:142px;flex:0 0 142px;min-height:126px;height:126px;padding:11px 12px;border-radius:14px}
          .home-category-number{font-size:7px}
          .home-category-icon{width:36px;height:36px;border-radius:10px}
          .home-category-icon svg{width:18px;height:18px}
          .home-category-arrow{width:26px;height:26px}
          .home-category-arrow svg{width:13px;height:13px}
          .home-category-copy{padding-top:9px}
          .home-category-copy:before{width:18px;height:2px;margin-bottom:5px}
          .home-category-copy h3{font-size:17px}
        }
        @media(max-width:390px){
          .home-category-card,
          .home-category-card.category-1,
          .home-category-card.category-2,
          .home-category-card.category-3,
          .home-category-card.category-4{min-width:132px;flex-basis:132px;min-height:120px;height:120px}
          .home-category-copy h3{font-size:16px}
        }

        /* Category cards — compact reference layout. */
        .home-category-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
        .home-category-card,
        .home-category-card.category-1,
        .home-category-card.category-2,
        .home-category-card.category-3,
        .home-category-card.category-4{height:210px;min-height:210px;padding:12px 12px 14px;display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden;border-radius:18px;background:#fff9dc;border:1px solid #efe1a5;box-shadow:0 6px 18px rgba(0,0,0,.045);isolation:isolate;text-align:center}
        .home-category-card:before{content:none}
        .home-category-card:hover{transform:translateY(-3px);border-color:#e1c85d;box-shadow:0 14px 28px rgba(0,0,0,.075)}
        .home-category-card:hover:before{transform:none;opacity:1}
        .home-category-visual{position:relative;width:100%;height:148px;flex:0 0 148px;margin:0;display:grid;place-items:center;overflow:hidden;background:transparent;border:0}
        .home-category-art{position:static!important;inset:auto!important;width:100%!important;height:100%!important;display:block;object-fit:contain;padding:4px;transition:transform .2s ease}
        .home-category-card:hover .home-category-art{transform:translateY(-2px) scale(1.025)}
        .home-category-copy{position:relative;z-index:2;width:100%;flex:1;margin:0;padding:9px 3px 0;display:flex;align-items:center;justify-content:center;text-align:center}
        .home-category-copy:before{content:none}
        .home-category-copy h3{margin:0;max-width:100%;font-family:'Barlow Condensed',sans-serif;font-size:21px;line-height:.95;letter-spacing:-.01em;font-weight:800;text-transform:uppercase;text-align:center}
        .home-category-chevron{display:none!important}
        @media(max-width:900px){
          .home-category-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
          .home-category-card,
          .home-category-card.category-1,
          .home-category-card.category-2,
          .home-category-card.category-3,
          .home-category-card.category-4{height:174px;min-height:174px;padding:9px 8px 11px;border-radius:15px}
          .home-category-visual{height:118px;flex-basis:118px}
          .home-category-copy{padding-top:6px}
          .home-category-copy h3{font-size:17px}
        }
        @media(max-width:680px){
          .home-category-section{padding:34px 0 38px}
          .home-category-section .home-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:9px;margin-bottom:13px}
          .home-category-section .home-section-head>div{min-width:0}
          .home-category-section .home-eyebrow{margin-bottom:6px;font-size:7px;letter-spacing:.28em}
          .home-category-section .home-section-head h2{font-size:27px;line-height:.92;white-space:nowrap}
          .home-category-section .home-section-link{margin:0 0 2px;font-size:7px;gap:4px}
          .home-category-section .home-section-link svg{width:12px;height:12px}
          .home-category-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;overflow:visible;padding:0}
          .home-category-card,
          .home-category-card.category-1,
          .home-category-card.category-2,
          .home-category-card.category-3,
          .home-category-card.category-4{position:relative!important;min-width:0;width:auto;flex:none;height:126px;min-height:126px;padding:7px 5px 8px;border-radius:12px;background:#fff8d3;border-color:#f0df99;box-shadow:0 4px 12px rgba(0,0,0,.045);scroll-snap-align:none}
          .home-category-visual{height:78px;flex-basis:78px}
          .home-category-art{padding:1px}
          .home-category-copy{position:absolute!important;left:0!important;right:0!important;bottom:6px!important;width:100%!important;height:36px!important;min-height:36px!important;margin:0!important;padding:0 4px!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important}
          .home-category-copy h3{display:block!important;width:100%!important;max-width:100%!important;margin:0 auto!important;padding:0!important;font-size:9px;line-height:1.03;letter-spacing:0;overflow:visible!important;overflow-wrap:normal;word-break:normal;white-space:normal;text-wrap:balance;text-align:center!important}
          .home-category-hint{display:none}
        }
        @media(max-width:390px){
          .home-category-section .home-section-head h2{font-size:24px}
          .home-category-grid{gap:5px}
          .home-category-card,
          .home-category-card.category-1,
          .home-category-card.category-2,
          .home-category-card.category-3,
          .home-category-card.category-4{height:120px;min-height:120px;padding:6px 4px 7px;border-radius:11px}
          .home-category-visual{height:73px;flex-basis:73px}
          .home-category-copy{bottom:5px!important;height:35px!important;min-height:35px!important;padding:0 3px!important}
          .home-category-copy h3{font-size:8px;line-height:1.03;text-align:center!important}
        }

        /* Quick access cards — compact reference layout. */
        .home-path-card.home-path-products,
        .home-path-card.print{min-height:258px;padding:20px 22px 18px;justify-content:flex-start;border-radius:20px;isolation:isolate}
        .home-path-card.home-path-products{background:#fff9df;border-color:#f0dfa2}
        .home-path-card.print{background:#111;color:#fff;border-color:#111}
        .home-path-card.home-path-products:after{right:-42px;top:-66px;width:205px;height:205px;background:#fff2b8}
        .home-path-card.print:after{right:-42px;top:-66px;width:205px;height:205px;background:#242424}
        .home-path-art{position:absolute!important;z-index:1!important;right:8px;top:17px;width:47%!important;height:132px!important;object-fit:contain!important;pointer-events:none}
        .home-path-print-art{right:-2px!important;top:10px!important;width:52%!important;height:142px!important}
        .home-path-card .home-path-icon{z-index:3;width:50px;height:50px;border-radius:15px}
        .home-path-card .home-path-content{z-index:3;max-width:54%!important;margin-top:18px}
        .home-path-card h3{font-size:33px;line-height:.9;margin-bottom:6px}
        .home-path-card.print h3{font-size:29px;line-height:.9;color:#fff}
        .home-path-card span{font-size:12px;line-height:1.42;padding-right:0}
        .home-path-card.print span{color:#c5c5c5}
        .home-path-card .home-path-action{z-index:3;margin-top:auto;min-height:38px;padding:0 16px;border-radius:999px;width:max-content;display:inline-flex;justify-content:center;font-size:8.5px;letter-spacing:.09em}
        .home-path-card.home-path-products .home-path-action{background:#ffc400;color:#111;box-shadow:0 7px 16px rgba(255,196,0,.18);width:max-content!important;max-width:max-content!important;align-self:flex-start!important;padding:9px 13px!important}
        .home-path-card.print .home-path-action{background:#fff;color:#111}
        @media(max-width:680px){
          .home-path-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
          .home-path-card.home-path-products,
          .home-path-card.print{position:relative;display:block;height:204px;min-height:204px;padding:12px 11px 11px;border-radius:15px}
          .home-path-card.home-path-products:after,
          .home-path-card.print:after{right:-42px;top:-56px;width:145px;height:145px}
          .home-path-card .home-path-icon{position:absolute;left:12px;top:12px;width:40px;height:40px;border-radius:11px}
          .home-path-art{top:7px!important;right:4px!important;width:49%!important;height:86px!important}
          .home-path-print-art{top:5px!important;right:-3px!important;width:53%!important;height:91px!important}
          .home-path-card .home-path-content{position:absolute;z-index:3;left:12px;top:68px;max-width:62%!important;margin:0!important}
          .home-path-card h3{font-size:23px;line-height:.92;margin:0 0 4px}
          .home-path-card.print h3{font-size:20px;line-height:.9;margin-bottom:4px}
          .home-path-card span{font-size:9.2px;line-height:1.3}
          .home-path-card .home-path-action{position:absolute;z-index:4;left:12px;right:12px;bottom:11px;width:auto;min-height:32px;margin:0;padding:0 8px;font-size:7.5px;letter-spacing:.075em}
          .home-path-card.home-path-products .home-path-action{width:auto!important;max-width:none!important;align-self:auto!important;padding:0 8px!important}
          .home-path-card .home-path-action svg{width:13px;height:13px}
        }
        @media(max-width:390px){
          .home-path-grid{gap:8px}
          .home-path-card.home-path-products,
          .home-path-card.print{height:194px;min-height:194px;padding:10px 9px;border-radius:14px}
          .home-path-card .home-path-icon{left:10px;top:10px;width:37px;height:37px;border-radius:10px}
          .home-path-art{top:5px!important;right:2px!important;width:48%!important;height:80px!important}
          .home-path-print-art{right:-4px!important;width:52%!important;height:84px!important}
          .home-path-card .home-path-content{left:10px;top:62px;max-width:64%!important}
          .home-path-card h3{font-size:21px}
          .home-path-card.print h3{font-size:18px}
          .home-path-card span{font-size:8.6px;line-height:1.27}
          .home-path-card .home-path-action{left:10px;right:10px;bottom:10px;min-height:30px;font-size:7px}
        }
       `}
</style>
    </main>
  );
}
