'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Headphones, Laptop, Menu, Printer, ShoppingBag, Star, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Category = { id?: string; name: string; description?: string | null };
type Product = { id: string; name: string; slug: string; price: number; image_url?: string | null; active?: boolean };

const fallbackCategories: Category[] = [
  { name: 'Papelaria', description: 'Tudo para estudos e escritório.' },
  { name: 'Eletrônicos', description: 'Acessórios e tecnologia para o dia a dia.' },
  { name: 'Impressão', description: 'Impressões com rapidez e qualidade.' },
];

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from('categories').select('id,name,description').eq('active', true).order('name'),
        supabase.from('products').select('id,name,slug,price,image_url,active').eq('active', true).order('created_at', { ascending: false }).limit(8),
      ]);
      if (cats) setCategories(cats as Category[]);
      if (prods) setProducts(prods as Product[]);
    }
    load();
  }, []);

  const visibleCategories = categories.length ? categories : fallbackCategories;

  return (
    <main className="two-p-home">
      <div className="two-p-topbar">
        <div className="two-p-container">QUALIDADE <span>•</span> VARIEDADE <span>•</span> CONFIANÇA</div>
      </div>

      <header className="two-p-header">
        <div className="two-p-container two-p-header-inner">
          <Link href="/" className="two-p-brand" aria-label="2P Box">
            <Image src="/logo.pnh.png" alt="2P Box" width={705} height={487} priority className="two-p-logo" />
          </Link>

          <nav className={`two-p-nav ${menuOpen ? 'is-open' : ''}`}>
            <Link href="#categorias" onClick={() => setMenuOpen(false)}>Categorias</Link>
            <Link href="#catalogo" onClick={() => setMenuOpen(false)}>Catálogo</Link>
            <Link href="#contato" onClick={() => setMenuOpen(false)}>Contato</Link>
            <Link href="/admin" className="two-p-nav-admin" onClick={() => setMenuOpen(false)}>Admin</Link>
          </nav>

          <div className="two-p-header-actions">
            <Link href="/carrinho" className="two-p-cart"><ShoppingBag size={18} /><span>Carrinho</span><b>0</b></Link>
            <button className="two-p-menu-button" type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(v => !v)}>
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      <section className="two-p-hero">
        <div className="two-p-hero-glow" />
        <div className="two-p-hero-lines" />
        <div className="two-p-container two-p-hero-grid">
          <div className="two-p-hero-copy">
            <div className="two-p-hero-businesses" aria-label="Categorias de produtos e serviços">
              <span>PAPELARIA</span><i>•</i><span>ELETRÔNICOS</span><i>•</i><span>UTILIDADES</span><i>•</i><span>IMPRESSÃO</span>
            </div>
            <h1>Tudo que você precisa,<br /><em>em um só lugar.</em></h1>
            <p className="two-p-hero-lead">Papelaria, eletrônicos, utilidades e serviços de impressão para facilitar o seu dia a dia.</p>
            <div className="two-p-hero-actions">
              <Link href="/loja" className="two-p-primary">Comprar agora <ArrowRight size={18} /></Link>
              <Link href="#categorias" className="two-p-secondary">Ver categorias</Link>
            </div>
          </div>
          <div className="two-p-hero-art" aria-hidden="true">
            <div className="two-p-logo-glow" />
            <Image src="/logo.pnh.png" alt="" width={705} height={487} priority className="two-p-hero-logo" />
          </div>
        </div>
      </section>

      <section id="categorias" className="two-p-section two-p-categories">
        <div className="two-p-container">
          <div className="two-p-section-head">
            <div><p className="two-p-eyebrow">ENCONTRE O QUE PRECISA</p><h2>Compre por categoria</h2></div>
            <Link href="/loja" className="two-p-text-link">Ver tudo <ArrowRight size={16} /></Link>
          </div>
          <div className="two-p-category-grid">
            {visibleCategories.map((category, index) => (
              <Link key={category.id || category.name} href={category.id ? `/loja?categoria=${encodeURIComponent(category.id)}` : '/loja'} className="two-p-category-card">
                <div className="two-p-category-icon">{index === 1 ? <Laptop size={25} /> : index === 2 ? <Printer size={25} /> : <ShoppingBag size={25} />}</div>
                <div className="two-p-category-content"><h3>{category.name}</h3><p>{category.description || 'Confira os produtos desta categoria.'}</p><span>Explorar <ArrowRight size={15} /></span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="catalogo" className="two-p-section two-p-catalog">
        <div className="two-p-container">
          <div className="two-p-section-head">
            <div><p className="two-p-eyebrow">CATÁLOGO 2P BOX</p><h2>Produtos</h2></div>
            <Link href="/loja" className="two-p-text-link">Ver catálogo <ArrowRight size={16} /></Link>
          </div>
          {products.length ? (
            <div className="two-p-product-grid">
              {products.map(product => (
                <Link href={`/produto/${product.slug}`} className="two-p-product-card" key={product.id}>
                  <div className="two-p-product-image">
                    {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <span>2P</span>}
                  </div>
                  <div className="two-p-product-info"><small>2P BOX</small><h3>{product.name}</h3><strong>R$ {Number(product.price).toFixed(2).replace('.', ',')}</strong></div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="two-p-empty"><ShoppingBag size={30} /><h3>Catálogo em atualização</h3><p>Os produtos cadastrados aparecerão aqui automaticamente.</p><Link href="/loja" className="two-p-primary">Acessar a loja <ArrowRight size={17} /></Link></div>
          )}
        </div>
      </section>

      <section className="two-p-benefits">
        <div className="two-p-container two-p-benefits-grid">
          <div className="two-p-benefits-intro"><p className="two-p-eyebrow">POR QUE 2P BOX?</p><h2>Comprar deve ser simples.</h2><p>Escolha seus produtos, finalize o pedido e retire na loja ou fale conosco para calcular o frete pelo WhatsApp.</p></div>
          <div className="two-p-benefit-list">
            <div className="two-p-benefit"><div><Truck size={23} /></div><span><strong>Retire na loja</strong><small>Prático e sem custo de entrega.</small></span></div>
            <div className="two-p-benefit"><div><Headphones size={23} /></div><span><strong>Atendimento próximo</strong><small>Fale diretamente com a nossa equipe.</small></span></div>
            <div className="two-p-benefit"><div><Star size={23} /></div><span><strong>Qualidade</strong><small>Produtos selecionados para você.</small></span></div>
          </div>
        </div>
      </section>

      <footer id="contato" className="two-p-footer">
        <div className="two-p-container two-p-footer-grid">
          <div><Image src="/logo.pnh.png" alt="2P Box" width={705} height={487} className="two-p-footer-logo" /><p>Tudo que você precisa,<br />em um só lugar.</p></div>
          <div><h4>Loja</h4><Link href="/loja">Produtos</Link><Link href="#categorias">Categorias</Link><Link href="/carrinho">Carrinho</Link></div>
          <div><h4>Atendimento</h4><p>WhatsApp: (11) 9 9999-9999</p><p>Seg–Sex • 9h às 18h</p></div>
        </div>
        <div className="two-p-container two-p-footer-bottom">© 2026 2P Box. Todos os direitos reservados.</div>
      </footer>

      <style jsx global>{`
        .two-p-home{background:#030303;color:#fff;min-height:100vh;overflow-x:hidden}
        .two-p-container{width:min(1180px,calc(100% - 48px));margin:0 auto}
        .two-p-topbar{height:32px;background:#050505;border-bottom:1px solid rgba(255,196,0,.16);display:flex;align-items:center;font-size:9px;font-weight:900;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.52)}
        .two-p-topbar span{color:#ffc400;margin:0 12px}
        .two-p-header{position:sticky;top:0;z-index:50;background:rgba(3,3,3,.96);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,196,0,.18)}
        .two-p-header-inner{height:82px;display:flex;align-items:center;gap:28px}
        .two-p-brand{display:flex;align-items:center;flex:0 0 auto;text-decoration:none}
        .two-p-logo{width:112px;height:68px;object-fit:contain}
        .two-p-nav{display:flex;align-items:center;gap:30px;margin-left:auto}
        .two-p-nav a{color:rgba(255,255,255,.8);font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;transition:.2s}
        .two-p-nav a:hover,.two-p-nav-admin{color:#ffc400}
        .two-p-header-actions{display:flex;align-items:center;gap:10px;margin-left:8px}
        .two-p-cart{display:flex;align-items:center;gap:8px;padding:11px 15px;background:#ffc400;color:#050505;border-radius:7px;text-decoration:none;font-size:12px;font-weight:900}
        .two-p-cart b{min-width:18px;text-align:center}
        .two-p-menu-button{display:none;background:transparent;color:#fff;border:1px solid rgba(255,196,0,.5);border-radius:7px;padding:9px}
        .two-p-hero{position:relative;overflow:hidden;border-bottom:1px solid rgba(255,196,0,.18);background:#030303}
        .two-p-hero-glow{position:absolute;width:520px;height:520px;right:6%;top:50%;transform:translateY(-50%);border-radius:50%;background:rgba(255,196,0,.11);filter:blur(85px)}
        .two-p-hero-lines{position:absolute;inset:0;opacity:.35;background:linear-gradient(125deg,transparent 38%,rgba(255,196,0,.09) 39%,transparent 40%,transparent 62%,rgba(255,196,0,.06) 63%,transparent 64%)}
        .two-p-hero-grid{position:relative;display:grid;grid-template-columns:1.12fr .88fr;align-items:center;gap:45px;min-height:560px;padding:70px 0}
        .two-p-hero-copy{max-width:690px}
        .two-p-hero-businesses{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 18px;color:#fff;font-size:13px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
        .two-p-hero-businesses span{color:#fff}.two-p-hero-businesses i{font-style:normal;color:#ffc400;font-size:12px}
        .two-p-hero h1{margin:0;font-size:clamp(48px,6vw,76px);line-height:.93;letter-spacing:-.035em;font-weight:950;text-transform:uppercase}
        .two-p-hero h1 em{font-style:italic;color:#ffc400}
        .two-p-hero-lead{max-width:570px;margin:24px 0 0;color:rgba(255,255,255,.62);font-size:17px;line-height:1.65}
        .two-p-hero-actions{display:flex;gap:12px;margin-top:30px}
        .two-p-primary,.two-p-secondary{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:0 22px;border-radius:7px;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
        .two-p-primary{background:#ffc400;color:#050505;border:1px solid #ffc400}
        .two-p-secondary{border:1px solid rgba(255,255,255,.45);color:#fff;background:transparent}
        .two-p-primary:hover{background:#ffd12a}.two-p-secondary:hover{border-color:#ffc400;color:#ffc400}
        .two-p-hero-art{position:relative;display:flex;justify-content:center;align-items:center;min-height:380px}
        .two-p-logo-glow{position:absolute;width:310px;height:310px;border-radius:50%;background:rgba(255,196,0,.12);filter:blur(55px)}
        .two-p-hero-logo{position:relative;width:min(100%,390px);height:auto;max-height:350px;object-fit:contain;filter:drop-shadow(0 16px 35px rgba(0,0,0,.4))}
        .two-p-section{border-bottom:1px solid rgba(255,196,0,.15)}
        .two-p-categories{background:#080808}
        .two-p-catalog{background:#030303}
        .two-p-section{padding:72px 0}
        .two-p-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:30px}
        .two-p-section-head h2{margin:0;color:#fff;font-size:42px;line-height:1;font-weight:950;letter-spacing:-.025em;text-transform:uppercase}
        .two-p-text-link{display:inline-flex;align-items:center;gap:6px;color:#ffc400;text-decoration:none;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}
        .two-p-category-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        .two-p-category-card{display:flex;align-items:center;gap:18px;min-height:158px;padding:24px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012));text-decoration:none;color:#fff;transition:.2s}
        .two-p-category-card:hover{border-color:rgba(255,196,0,.55);transform:translateY(-2px)}
        .two-p-category-icon{width:58px;height:58px;flex:0 0 58px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#020202;border:1px solid rgba(255,196,0,.4);color:#ffc400}
        .two-p-category-content{min-width:0}.two-p-category-content h3{margin:0 0 6px;font-size:22px;font-weight:950;text-transform:uppercase}.two-p-category-content p{margin:0;color:rgba(255,255,255,.5);font-size:12px;line-height:1.5}.two-p-category-content span{display:flex;align-items:center;gap:5px;margin-top:13px;color:#ffc400;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}
        .two-p-product-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .two-p-product-card{overflow:hidden;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:#080808;text-decoration:none;color:#fff;transition:.2s}.two-p-product-card:hover{border-color:rgba(255,196,0,.5);transform:translateY(-2px)}
        .two-p-product-image{height:250px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}.two-p-product-image img{width:100%;height:100%;object-fit:contain;display:block}.two-p-product-image span{font-size:42px;font-weight:950;color:#111}
        .two-p-product-info{padding:15px}.two-p-product-info small{color:rgba(255,255,255,.35);font-size:8px;font-weight:900;letter-spacing:.18em}.two-p-product-info h3{margin:7px 0 9px;font-size:15px;line-height:1.25;color:#fff}.two-p-product-info strong{color:#ffc400;font-size:16px}
        .two-p-empty{padding:55px 25px;text-align:center;border:1px dashed rgba(255,196,0,.3);border-radius:12px;color:#fff}.two-p-empty svg{color:#ffc400}.two-p-empty h3{margin:15px 0 5px}.two-p-empty p{color:rgba(255,255,255,.5);margin:0 0 22px}
        .two-p-benefits{background:#070707;border-bottom:1px solid rgba(255,196,0,.18)}.two-p-benefits-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:80px;align-items:center;padding:72px 0}.two-p-benefits-intro h2{font-size:43px;line-height:1;margin:0 0 15px;font-weight:950}.two-p-benefits-intro>p:last-child{max-width:460px;margin:0;color:rgba(255,255,255,.55);line-height:1.7}.two-p-benefit-list{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.two-p-benefit{min-height:150px;padding:20px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.025)}.two-p-benefit>div{display:flex;width:40px;height:40px;align-items:center;justify-content:center;border-radius:8px;background:#020202;color:#ffc400;margin-bottom:18px}.two-p-benefit span{display:grid;gap:7px}.two-p-benefit strong{font-size:12px}.two-p-benefit small{font-size:10px;line-height:1.5;color:rgba(255,255,255,.45)}
        .two-p-footer{background:#020202;padding:55px 0 20px}.two-p-footer-grid{display:grid;grid-template-columns:2fr 1fr 1.2fr;gap:40px}.two-p-footer-logo{width:110px;height:70px;object-fit:contain}.two-p-footer p,.two-p-footer a{display:block;color:rgba(255,255,255,.48);font-size:11px;line-height:1.7;text-decoration:none}.two-p-footer h4{margin:0 0 12px;color:#ffc400;font-size:11px;text-transform:uppercase;letter-spacing:.14em}.two-p-footer-bottom{margin-top:42px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.28);font-size:9px}
        @media(max-width:900px){.two-p-container{width:min(100% - 32px,680px)}.two-p-nav{gap:18px}.two-p-hero-grid{grid-template-columns:1fr;min-height:0;padding:55px 0 35px}.two-p-hero-copy{max-width:none}.two-p-hero-art{min-height:280px}.two-p-hero-logo{width:310px;max-height:280px}.two-p-category-grid{grid-template-columns:1fr}.two-p-product-grid{grid-template-columns:repeat(2,1fr)}.two-p-benefits-grid{grid-template-columns:1fr;gap:35px}.two-p-benefit-list{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:640px){.two-p-topbar{height:28px;font-size:7px;letter-spacing:.18em}.two-p-topbar span{margin:0 7px}.two-p-container{width:calc(100% - 28px)}.two-p-header-inner{height:68px;gap:10px}.two-p-logo{width:88px;height:54px}.two-p-nav{display:none;position:absolute;left:14px;right:14px;top:calc(100% + 1px);padding:18px;border:1px solid rgba(255,196,0,.18);border-radius:0 0 10px 10px;background:#050505;flex-direction:column;align-items:stretch;gap:0;box-shadow:0 18px 35px rgba(0,0,0,.4)}.two-p-nav.is-open{display:flex}.two-p-nav a{padding:13px 8px}.two-p-header-actions{margin-left:auto}.two-p-cart{padding:10px 11px;font-size:10px}.two-p-cart span{display:none}.two-p-menu-button{display:flex;align-items:center;justify-content:center}.two-p-hero-grid{padding-top:38px}.two-p-hero-businesses{gap:6px;margin-bottom:14px;font-size:9px;letter-spacing:.1em}.two-p-hero-businesses i{font-size:9px}.two-p-hero h1{font-size:43px}.two-p-hero-lead{font-size:14px;line-height:1.55;margin-top:18px}.two-p-hero-actions{display:grid;grid-template-columns:1fr 1fr;margin-top:23px}.two-p-primary,.two-p-secondary{min-height:47px;padding:0 10px;font-size:10px}.two-p-hero-art{min-height:245px}.two-p-hero-logo{width:270px;max-height:230px}.two-p-logo-glow{width:220px;height:220px}.two-p-section{padding:48px 0}.two-p-section-head{align-items:flex-end;margin-bottom:22px}.two-p-section-head h2{font-size:31px}.two-p-text-link{font-size:9px}.two-p-category-card{min-height:125px;padding:17px;gap:14px}.two-p-category-icon{width:52px;height:52px;flex-basis:52px}.two-p-category-content h3{font-size:19px}.two-p-category-content p{font-size:11px}.two-p-category-content span{margin-top:9px}.two-p-product-grid{gap:9px}.two-p-product-image{height:175px}.two-p-product-info{padding:11px}.two-p-product-info h3{font-size:12px;min-height:30px}.two-p-product-info strong{font-size:14px}.two-p-benefits-grid{padding:48px 0}.two-p-benefits-intro h2{font-size:34px}.two-p-benefit-list{grid-template-columns:1fr}.two-p-benefit{min-height:0;padding:16px;display:flex;gap:13px;align-items:flex-start}.two-p-benefit>div{margin:0;flex:0 0 40px}.two-p-footer-grid{grid-template-columns:1fr 1fr;gap:28px}.two-p-footer-grid>div:first-child{grid-column:1/-1}.two-p-footer{padding-top:42px}}
      `}</style>
    </main>
  );
}
