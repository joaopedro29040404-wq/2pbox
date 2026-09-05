'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Headphones, Laptop, Menu, PencilLine, Printer, ShoppingBag, Smartphone, Star, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/components/cart-provider';

type Category = { id?: string; name: string; description?: string | null };
type Product = { id: string; name: string; slug: string; price: number; image_url?: string | null };
type AuthUser = { id: string; user_metadata?: { full_name?: string } };

const fallbackCategories: Category[] = [
  { name: 'Papelaria', description: 'Tudo para estudos e escritório.' },
  { name: 'Eletrônicos', description: 'Tecnologia para o dia a dia.' },
  { name: 'Acessórios para celular', description: 'Acessórios para seu celular.' },
  { name: 'Xerox', description: 'Cópias e serviços de impressão.' },
];

function CategoryIcon({ index }: { index: number }) {
  if (index === 1) return <Laptop size={25} strokeWidth={1.8} />;
  if (index === 2) return <Smartphone size={25} strokeWidth={1.8} />;
  if (index === 3) return <Printer size={25} strokeWidth={1.8} />;
  return <PencilLine size={25} strokeWidth={1.8} />;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { items } = useCart();

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let mounted = true;
    async function load() {
      const [{ data: cats }, { data: prods }, { data: auth }] = await Promise.all([
        client.from('categories').select('id,name,description').eq('active', true).order('name'),
        client.from('products').select('id,name,slug,price,image_url').eq('active', true).order('created_at', { ascending: false }).limit(8),
        client.auth.getUser(),
      ]);
      if (!mounted) return;
      if (cats) setCategories(cats as Category[]);
      if (prods) setProducts(prods as Product[]);
      setUser((auth.user ?? null) as AuthUser | null);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const visibleCategories = categories.length ? categories : fallbackCategories;
  const accountLabel = user?.user_metadata?.full_name?.trim()?.split(/\s+/)[0] || 'Entrar';
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <main className="home-page">
      <div className="home-topbar"><span>QUALIDADE</span><b>•</b><span>VARIEDADE</span><b>•</b><span>CONFIANÇA</span></div>
      <header className="home-header">
        <div className="home-container home-header-inner">
          <Link href="/" className="home-brand" aria-label="2P Box - início"><Image src="/logo.pnh.png" alt="2P Box" width={705} height={487} priority /></Link>
          <nav className={menuOpen ? 'home-nav home-nav-open' : 'home-nav'}>
            <Link href="#categorias" onClick={() => setMenuOpen(false)}>Categorias</Link>
            <Link href="#catalogo" onClick={() => setMenuOpen(false)}>Catálogo</Link>
            <Link href="#contato" onClick={() => setMenuOpen(false)}>Contato</Link>
          </nav>
          <div className="home-actions">
            <Link href="/conta" className="home-account">{accountLabel}</Link>
            <Link href="/carrinho" className="home-cart" aria-label={`Carrinho com ${cartCount} itens`}><ShoppingBag size={18} strokeWidth={1.9} /><span>Carrinho</span><b>{cartCount}</b></Link>
            <button className="home-menu" onClick={() => setMenuOpen(v => !v)} aria-label="Abrir menu">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          </div>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero-glow" /><div className="home-hero-beam" />
        <div className="home-container home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-eyebrow">2P BOX</p>
            <h1>TUDO QUE VOCÊ PRECISA,<br /><em>EM UM SÓ LUGAR.</em></h1>
            <p className="home-lead">Papelaria, eletrônicos, acessórios para celular e Xerox para facilitar o seu dia a dia.</p>
            <div className="home-hero-actions"><Link href="/loja" className="home-primary">COMPRAR AGORA <ArrowRight size={18} /></Link><Link href="#categorias" className="home-secondary">VER CATEGORIAS</Link></div>
          </div>
          <div className="home-hero-art" aria-hidden="true"><div className="home-art-shadow" /><Image src="/logo.pnh.png" alt="" width={705} height={487} priority /></div>
        </div>
      </section>

      <section id="categorias" className="home-section home-category-section">
        <div className="home-container">
          <div className="home-section-head"><div><p className="home-eyebrow">ENCONTRE O QUE PRECISA</p><h2>COMPRE POR CATEGORIA</h2></div><Link href="/loja" className="home-section-link">VER TODAS <ArrowRight size={15} /></Link></div>
          <div className="home-category-grid">
            {visibleCategories.map((category, index) => (
              <Link key={category.id || category.name} href={category.id ? `/loja?categoria=${encodeURIComponent(category.id)}` : '/loja'} className="home-category-card">
                <div className="home-category-icon"><CategoryIcon index={index} /></div>
                <div className="home-category-copy"><p>0{index + 1}</p><h3>{category.name}</h3><span>{category.description || 'Confira os produtos desta categoria.'}</span></div>
                <ArrowRight className="home-category-arrow" size={18} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="catalogo" className="home-section home-catalog">
        <div className="home-container">
          <div className="home-section-head"><div><p className="home-eyebrow">CATÁLOGO 2P BOX</p><h2>PRODUTOS</h2></div><Link href="/loja" className="home-section-link">VER CATÁLOGO <ArrowRight size={15} /></Link></div>
          {products.length ? <div className="home-product-grid">{products.map(product => <Link href={`/produto/${product.slug}`} key={product.id} className="home-product-card"><div className="home-product-image">{product.image_url ? <img src={product.image_url} alt={product.name} /> : <span>2P</span>}</div><div className="home-product-info"><small>2P BOX</small><h3>{product.name}</h3><strong>R$ {Number(product.price).toFixed(2).replace('.', ',')}</strong></div></Link>)}</div> : <div className="home-empty"><ShoppingBag size={28} /><h3>Catálogo em atualização</h3><p>Os produtos cadastrados aparecerão aqui.</p><Link href="/loja" className="home-primary">ACESSAR A LOJA <ArrowRight size={16} /></Link></div>}
        </div>
      </section>

      <section className="home-benefits"><div className="home-container home-benefits-grid"><div className="home-benefit-intro"><p className="home-eyebrow">A 2P BOX</p><h2>TUDO QUE VOCÊ PRECISA.</h2><p>Escolha seus produtos, finalize o pedido e retire na loja ou fale conosco para calcular o frete pelo WhatsApp.</p></div><div className="home-benefit"><Truck size={25} /><h3>Retire na loja</h3><p>Prático e sem custo de entrega.</p></div><div className="home-benefit"><Headphones size={25} /><h3>Atendimento próximo</h3><p>Fale diretamente com a nossa equipe.</p></div><div className="home-benefit"><Star size={25} /><h3>Qualidade</h3><p>Produtos selecionados para você.</p></div></div></section>

      <footer id="contato" className="home-footer"><div className="home-container home-footer-grid"><div><Image src="/logo.pnh.png" alt="2P Box" width={705} height={487} /><p>Tudo que você precisa,<br />em um só lugar.</p></div><div><p className="home-eyebrow">LOJA</p><Link href="/loja">Produtos</Link><Link href="#categorias">Categorias</Link><Link href="/carrinho">Carrinho</Link></div><div><p className="home-eyebrow">ATENDIMENTO</p><span>WhatsApp: (11) 9 9999-9999</span><span>Seg–Sex • 9h às 18h</span></div></div><div className="home-container home-footer-bottom">© 2026 2P Box. Todos os direitos reservados.</div></footer>

      <style jsx global>{`
        .home-page{--gold:#e7ad00;--yellow:#ffc400;--ink:#111;--muted:#707070;--line:#e7e7e7;min-height:100vh;background:#fff;color:var(--ink);font-family:Inter,Arial,sans-serif}
        .home-container{width:min(1180px,calc(100% - 56px));margin:0 auto}.home-topbar{height:34px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;gap:14px;font-size:10px;font-weight:800;letter-spacing:.25em}.home-topbar b{color:var(--yellow);font-size:9px}
        .home-header{height:86px;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:50}.home-header-inner{height:100%;display:flex;align-items:center;gap:38px}.home-brand{display:block;width:112px;height:70px;flex:none}.home-brand img{width:100%;height:100%;object-fit:contain}.home-nav{display:flex;align-items:center;gap:34px;margin-left:auto}.home-nav a,.home-account{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;text-decoration:none}.home-nav a:hover,.home-account:hover,.home-section-link:hover{color:var(--gold)}.home-actions{display:flex;align-items:center;gap:20px}.home-account{white-space:nowrap}.home-cart{height:42px;display:flex;align-items:center;gap:9px;padding:0 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:11px;font-weight:800}.home-cart b{width:20px;height:20px;display:grid;place-items:center;background:var(--yellow);color:#111;border-radius:50%;font-size:10px}.home-menu{display:none;width:42px;height:42px;background:#fff;border:1px solid #ddd;border-radius:8px}
        .home-hero{position:relative;overflow:hidden;min-height:560px;border-bottom:1px solid var(--line);background:linear-gradient(105deg,#fff 0%,#fff 54%,#fffdf2 100%)}.home-hero-glow{position:absolute;width:560px;height:420px;right:5%;top:50%;transform:translateY(-50%);background:radial-gradient(ellipse,rgba(255,196,0,.26) 0%,rgba(255,196,0,.11) 38%,transparent 70%);filter:blur(8px)}.home-hero-beam{position:absolute;inset:-20%;background:linear-gradient(118deg,transparent 43%,rgba(255,196,0,.07) 45%,transparent 48%,transparent 64%,rgba(255,196,0,.06) 66%,transparent 69%);pointer-events:none}.home-hero-grid{position:relative;z-index:1;min-height:560px;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:30px}.home-hero-copy{padding:58px 0}.home-eyebrow{margin:0 0 13px;color:#9a7200;font-size:10px;font-weight:900;letter-spacing:.34em}.home-hero h1{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:76px;line-height:.87;letter-spacing:-.025em;font-weight:800;font-style:italic;text-transform:uppercase}.home-hero h1 em{color:var(--gold);font-style:italic}.home-lead{max-width:560px;margin:25px 0 0;color:#686868;font-size:16px;line-height:1.65}.home-hero-actions{display:flex;gap:12px;margin-top:30px}.home-primary,.home-secondary{min-height:48px;padding:0 23px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border-radius:8px;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.1em}.home-primary{background:var(--yellow);border:1px solid var(--yellow);color:#111}.home-secondary{background:#fff;border:1px solid #111;color:#111}.home-hero-art{height:100%;min-height:460px;display:flex;align-items:center;justify-content:center;position:relative}.home-hero-art img{position:relative;z-index:2;width:min(100%,590px);height:auto;object-fit:contain;filter:drop-shadow(0 22px 24px rgba(0,0,0,.08))}.home-art-shadow{position:absolute;z-index:1;width:430px;height:110px;bottom:20%;border-radius:50%;background:rgba(0,0,0,.09);filter:blur(30px)}
        .home-section{padding:82px 0}.home-category-section{background:#fff}.home-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:30px}.home-section-head h2{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:48px;line-height:.92;font-weight:800;font-style:italic;text-transform:uppercase;letter-spacing:-.02em}.home-section-link{display:flex;align-items:center;gap:7px;text-decoration:none;color:#111;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.home-category-grid{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.home-category-card{min-height:205px;padding:27px 23px;display:flex;flex-direction:column;justify-content:space-between;position:relative;text-decoration:none;color:#111;border-right:1px solid var(--line);transition:.25s}.home-category-card:last-child{border-right:0}.home-category-card:hover{background:#fffdf2}.home-category-icon{width:50px;height:50px;display:grid;place-items:center;background:var(--yellow);border-radius:50%;color:#111}.home-category-copy p{margin:0 0 5px;color:#a37b00;font-size:9px;font-weight:900;letter-spacing:.15em}.home-category-copy h3{margin:0 0 7px;font-family:'Barlow Condensed',sans-serif;font-size:28px;line-height:.95;text-transform:uppercase;font-weight:700}.home-category-copy span{display:block;color:#777;font-size:11px;line-height:1.45;max-width:190px}.home-category-arrow{position:absolute;right:22px;bottom:27px;transition:.2s}.home-category-card:hover .home-category-arrow{transform:translateX(4px)}
        .home-catalog{background:#fafafa;border-top:1px solid var(--line)}.home-product-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.home-product-card{overflow:hidden;background:#fff;border:1px solid #e2e2e2;border-radius:14px;color:#111;text-decoration:none;transition:.25s}.home-product-card:hover{transform:translateY(-4px);box-shadow:0 15px 35px rgba(0,0,0,.08)}.home-product-image{aspect-ratio:1/1;background:#f5f5f3;display:grid;place-items:center;overflow:hidden}.home-product-image img{width:100%;height:100%;padding:18px;object-fit:contain}.home-product-image span{font-family:'Barlow Condensed';font-size:80px;font-weight:800;font-style:italic}.home-product-info{padding:17px}.home-product-info small{font-size:8px;letter-spacing:.2em;color:#999;font-weight:900}.home-product-info h3{margin:8px 0 13px;font-family:'Barlow Condensed';font-size:22px;line-height:1;text-transform:uppercase}.home-product-info strong{font-size:18px}.home-empty{text-align:center;border:1px solid var(--line);background:#fff;padding:55px;border-radius:14px}.home-empty h3{font-family:'Barlow Condensed';font-size:28px;text-transform:uppercase;margin:10px 0 4px}.home-empty p{color:#777;margin:0 0 20px;font-size:12px}
        .home-benefits{background:#111;color:#fff;padding:62px 0}.home-benefits-grid{display:grid;grid-template-columns:1.45fr repeat(3,1fr);gap:0}.home-benefit-intro,.home-benefit{padding:0 30px;border-left:1px solid #333}.home-benefit-intro{padding-left:0;border-left:0}.home-benefit-intro h2{margin:0;font-family:'Barlow Condensed';font-size:34px;line-height:.95;text-transform:uppercase;font-style:italic}.home-benefit-intro>p:last-child{max-width:350px;color:#aaa;font-size:12px;line-height:1.6}.home-benefit svg{color:var(--yellow)}.home-benefit h3{margin:15px 0 5px;font-family:'Barlow Condensed';font-size:25px;text-transform:uppercase}.home-benefit p{margin:0;color:#aaa;font-size:11px}.home-footer{background:#0b0b0b;color:#fff;padding:54px 0 0}.home-footer-grid{display:grid;grid-template-columns:1.5fr .7fr 1fr;gap:55px;padding-bottom:42px}.home-footer-grid img{width:105px;height:65px;object-fit:contain}.home-footer-grid p:not(.home-eyebrow),.home-footer-grid a,.home-footer-grid span{display:block;color:#aaa;font-size:11px;line-height:1.9;text-decoration:none}.home-footer .home-eyebrow{color:var(--yellow)}.home-footer-bottom{border-top:1px solid #242424;padding:17px 0;color:#666;font-size:9px}
        @media(max-width:900px){.home-container{width:min(100% - 40px,1180px)}.home-nav{gap:20px}.home-hero h1{font-size:61px}.home-category-grid{grid-template-columns:repeat(2,1fr)}.home-category-card:nth-child(2){border-right:0}.home-category-card:nth-child(-n+2){border-bottom:1px solid var(--line)}.home-product-grid{grid-template-columns:repeat(2,1fr)}.home-benefits-grid{grid-template-columns:1fr 1fr;gap:28px}.home-benefit-intro{grid-column:1/-1;padding:0;border:0}.home-benefit{padding:0 20px}.home-footer-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:680px){.home-topbar{height:31px;font-size:9px;letter-spacing:.2em;gap:10px}.home-header{height:78px}.home-header-inner{width:calc(100% - 28px);gap:10px}.home-brand{width:86px;height:62px}.home-nav{display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border-bottom:1px solid var(--line);padding:20px 22px;flex-direction:column;align-items:flex-start;gap:18px}.home-nav-open{display:flex}.home-actions{margin-left:auto;gap:9px}.home-account{font-size:10px}.home-cart{height:43px;padding:0 10px}.home-cart span{display:none}.home-menu{display:grid;place-items:center}.home-hero{min-height:auto}.home-hero-grid{min-height:auto;display:flex;flex-direction:column;gap:0}.home-hero-copy{width:100%;padding:46px 0 10px}.home-hero h1{font-size:48px;line-height:.9;letter-spacing:-.02em}.home-lead{font-size:14px;line-height:1.6;margin-top:20px}.home-hero-actions{margin-top:25px;display:grid;grid-template-columns:1fr 1fr}.home-primary,.home-secondary{padding:0 12px;min-height:49px;font-size:9px}.home-hero-art{width:100%;min-height:335px;height:335px;margin-top:-4px}.home-hero-art img{width:min(100%,470px)}.home-hero-glow{width:460px;height:330px;right:50%;transform:translate(50%,-40%)}.home-art-shadow{width:290px;bottom:13%}.home-section{padding:58px 0}.home-section-head{align-items:flex-end;margin-bottom:25px}.home-section-head h2{font-size:39px}.home-section-link{font-size:9px;white-space:nowrap}.home-category-grid{grid-template-columns:1fr 1fr}.home-category-card{min-height:180px;padding:20px 16px}.home-category-icon{width:44px;height:44px}.home-category-copy h3{font-size:23px}.home-category-copy span{font-size:10px}.home-category-arrow{right:15px;bottom:19px}.home-product-grid{gap:10px}.home-product-info{padding:13px}.home-product-info h3{font-size:19px}.home-product-info strong{font-size:16px}.home-benefits{padding:48px 0}.home-benefits-grid{grid-template-columns:1fr 1fr;gap:26px 0}.home-benefit-intro{grid-column:1/-1;padding-bottom:5px}.home-benefit{padding:0 15px}.home-benefit:nth-child(odd){border-left:0;padding-left:0}.home-benefit h3{font-size:21px}.home-footer-grid{grid-template-columns:1fr 1fr;gap:28px}.home-footer-grid>div:first-child{grid-column:1/-1}}
        @media(max-width:390px){.home-container{width:calc(100% - 28px)}.home-hero h1{font-size:43px}.home-hero-actions{grid-template-columns:1fr}.home-hero-art{min-height:295px;height:295px}.home-category-copy h3{font-size:20px}.home-category-card{min-height:170px}.home-section-head{display:block}.home-section-link{margin-top:12px}.home-product-info h3{font-size:17px}}
      `}</style>
    </main>
  );
}
