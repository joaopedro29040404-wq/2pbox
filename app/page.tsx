'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Headphones, Laptop, PencilLine, Printer, ShoppingBag, Smartphone, Star, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getStoreSettings, StoreSettings } from '@/lib/store-settings';
import { SiteHeader } from '@/components/site-header';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { ProductImage } from '@/components/ui/product-image';
import { SkeletonGrid } from '@/components/ui/loader';
import { money } from '@/lib/order-format';

type Category = { id?: string; name: string; description?: string | null };
type Product = { id: string; name: string; slug: string; price: number; image_url?: string | null };

const CATEGORIES_PER_PAGE = 8;

const fallbackCategories: Category[] = [
  { name: 'Papelaria', description: 'Tudo para estudos e escritório.' },
  { name: 'Eletrônicos', description: 'Tecnologia para o dia a dia.' },
  { name: 'Acessórios para celular', description: 'Acessórios para seu celular.' },
  { name: 'Xerox', description: 'Cópias e serviços de impressão.' },
];

function CategoryIcon({ index }: { index: number }) {
  const position = index % 4;
  if (position === 1) return <Laptop size={25} strokeWidth={1.8} />;
  if (position === 2) return <Smartphone size={25} strokeWidth={1.8} />;
  if (position === 3) return <Printer size={25} strokeWidth={1.8} />;
  return <PencilLine size={25} strokeWidth={1.8} />;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    let mounted = true;

    (async () => {
      const [{ data: categoryRows }, { data: productRows }, settings] = await Promise.all([
        client.from('categories').select('id,name,description').eq('active', true).order('name'),
        client.from('products').select('id,name,slug,price,image_url').eq('active', true).order('created_at', { ascending: false }).limit(8),
        getStoreSettings(),
      ]);
      if (!mounted) return;
      if (categoryRows) setCategories(categoryRows as Category[]);
      if (productRows) setProducts(productRows as Product[]);
      setStoreSettings(settings);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleCategories = useMemo(() => (categories.length ? categories : fallbackCategories), [categories]);
  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(visibleCategories, CATEGORIES_PER_PAGE);

  const whatsapp = storeSettings?.whatsapp?.trim() || '(11) 9 9999-9999';
  const hours = storeSettings?.hours?.trim() || 'Seg–Sex • 9h às 18h';

  return (
    <main className="home-page">
      <SiteHeader />

      <section className="home-hero">
        <div className="home-container home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-eyebrow">2P BOX</p>
            <h1>
              TUDO QUE VOCÊ PRECISA,
              <br />
              <em>EM UM SÓ LUGAR.</em>
            </h1>
            <p className="home-lead">Papelaria, eletrônicos, acessórios para celular e Xerox para facilitar o seu dia a dia.</p>
            <div className="home-hero-actions">
              <Link href="/loja" className="home-primary">
                COMPRAR AGORA <ArrowRight size={18} />
              </Link>
              <Link href="#categorias" className="home-secondary">
                VER CATEGORIAS
              </Link>
            </div>
          </div>
          <div className="home-hero-art" aria-hidden="true">
            <div className="home-art-shadow" />
            <Image src="/logo.pnh.png" alt="" width={705} height={487} priority />
          </div>
        </div>
      </section>

      <section id="categorias" className="home-section home-category-section">
        <div className="home-container">
          <div className="home-section-head">
            <div>
              <p className="home-eyebrow">ENCONTRE O QUE PRECISA</p>
              <h2>COMPRE POR CATEGORIA</h2>
            </div>
            <Link href="/loja" className="home-section-link">
              VER TODAS <ArrowRight size={15} />
            </Link>
          </div>
          <div className="home-category-grid">
            {pageItems.map((category, index) => (
              <Link
                key={category.id || category.name}
                href={category.id ? `/loja?categoria=${encodeURIComponent(category.id)}` : '/loja'}
                className="home-category-card"
              >
                <div className="home-category-icon">
                  <CategoryIcon index={(page - 1) * CATEGORIES_PER_PAGE + index} />
                </div>
                <div className="home-category-copy">
                  <p>{String((page - 1) * CATEGORIES_PER_PAGE + index + 1).padStart(2, '0')}</p>
                  <h3>{category.name}</h3>
                  <span>{category.description || 'Confira os produtos desta categoria.'}</span>
                </div>
                <ArrowRight className="home-category-arrow" size={18} />
              </Link>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} label="categorias" scrollTargetId="categorias" />
        </div>
      </section>

      <section id="catalogo" className="home-section home-catalog">
        <div className="home-container">
          <div className="home-section-head">
            <div>
              <p className="home-eyebrow">CATÁLOGO 2P BOX</p>
              <h2>PRODUTOS</h2>
            </div>
            <Link href="/loja" className="home-section-link">
              VER CATÁLOGO <ArrowRight size={15} />
            </Link>
          </div>
          {loading ? (
            <SkeletonGrid count={4} height={300} />
          ) : products.length ? (
            <div className="home-product-grid">
              {products.map((product) => (
                <Link href={`/produto/${product.slug}`} key={product.id} className="home-product-card">
                  <div className="home-product-image">
                    <ProductImage src={product.image_url} alt={product.name} sizes="(max-width:900px) 50vw, 270px" />
                  </div>
                  <div className="home-product-info">
                    <small>2P BOX</small>
                    <h3>{product.name}</h3>
                    <strong>{money(product.price)}</strong>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-empty">
              <ShoppingBag size={28} />
              <h3>Catálogo em atualização</h3>
              <p>Os produtos cadastrados aparecerão aqui.</p>
              <Link href="/loja" className="home-primary">
                ACESSAR A LOJA <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="home-benefits">
        <div className="home-container home-benefits-grid">
          <div className="home-benefit-intro">
            <p className="home-eyebrow">A 2P BOX</p>
            <h2>TUDO QUE VOCÊ PRECISA.</h2>
            <p>Escolha seus produtos, finalize o pedido e retire na loja ou fale conosco para calcular o frete pelo WhatsApp.</p>
          </div>
          <div className="home-benefit">
            <Truck size={25} />
            <h3>Retire na loja</h3>
            <p>Prático e sem custo de entrega.</p>
          </div>
          <div className="home-benefit">
            <Headphones size={25} />
            <h3>Atendimento próximo</h3>
            <p>Fale diretamente com a nossa equipe.</p>
          </div>
          <div className="home-benefit">
            <Star size={25} />
            <h3>Qualidade</h3>
            <p>Produtos selecionados para você.</p>
          </div>
        </div>
      </section>

      <footer id="contato" className="home-footer">
        <div className="home-container home-footer-grid">
          <div>
            <Image src="/logo.pnh.png" alt="2P Box" width={705} height={487} />
            <p>
              Tudo que você precisa,
              <br />
              em um só lugar.
            </p>
          </div>
          <div>
            <p className="home-eyebrow">LOJA</p>
            <Link href="/loja">Produtos</Link>
            <Link href="#categorias">Categorias</Link>
            <Link href="/carrinho">Carrinho</Link>
            <Link href="/acompanhar-pedido">Acompanhar pedido</Link>
          </div>
          <div>
            <p className="home-eyebrow">ATENDIMENTO</p>
            <span>WhatsApp: {whatsapp}</span>
            <span>{hours}</span>
          </div>
        </div>
        <div className="home-container home-footer-bottom">© 2026 2P Box. Todos os direitos reservados.</div>
      </footer>

      <style jsx global>{`
        .home-page{--gold:#e7ad00;--yellow:#ffc400;--ink:#111;--muted:#707070;--line:#e7e7e7;min-height:100vh;background:#fff;color:var(--ink);font-family:Inter,Arial,sans-serif}
        .home-container{width:min(1180px,calc(100% - 56px));margin:0 auto}
        .home-hero{position:relative;overflow:hidden;min-height:540px;border-bottom:1px solid var(--line);background:linear-gradient(105deg,#fff 0%,#fff 54%,#fffdf2 100%)}
        .home-hero-grid{position:relative;z-index:1;min-height:540px;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:30px}
        .home-hero-copy{padding:56px 0}
        .home-eyebrow{margin:0 0 13px;color:#9a7200;font-size:10px;font-weight:900;letter-spacing:.34em}
        .home-hero h1{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:74px;line-height:.87;letter-spacing:-.025em;font-weight:800;font-style:italic;text-transform:uppercase}
        .home-hero h1 em{color:var(--gold);font-style:italic}
        .home-lead{max-width:560px;margin:25px 0 0;color:#686868;font-size:16px;line-height:1.65}
        .home-hero-actions{display:flex;gap:12px;margin-top:30px}
        .home-primary,.home-secondary{min-height:48px;padding:0 23px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border-radius:8px;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.1em}
        .home-primary{background:var(--yellow);border:1px solid var(--yellow);color:#111}
        .home-primary:hover{background:#111;border-color:#111;color:#fff}
        .home-secondary{background:#fff;border:1px solid #111;color:#111}
        .home-hero-art{height:100%;min-height:440px;display:flex;align-items:center;justify-content:center;position:relative}
        .home-hero-art img{position:relative;z-index:2;width:min(100%,580px);height:auto;object-fit:contain}
        .home-art-shadow{position:absolute;z-index:1;width:430px;height:110px;bottom:20%;border-radius:50%;background:rgba(0,0,0,.09);filter:blur(30px)}
        .home-section{padding:78px 0}
        .home-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:30px}
        .home-section-head h2{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:46px;line-height:.92;font-weight:800;font-style:italic;text-transform:uppercase}
        .home-section-link{display:flex;align-items:center;gap:7px;text-decoration:none;color:#111;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}
        .home-category-grid{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);border-left:1px solid var(--line)}
        .home-category-card{min-height:205px;padding:27px 23px;display:flex;flex-direction:column;justify-content:space-between;position:relative;text-decoration:none;color:#111;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
        .home-category-card:hover{background:#fffdf2}
        .home-category-icon{width:50px;height:50px;display:grid;place-items:center;background:var(--yellow);border-radius:50%}
        .home-category-copy p{margin:0 0 5px;color:#a37b00;font-size:9px;font-weight:900}
        .home-category-copy h3{margin:0 0 7px;font-family:'Barlow Condensed',sans-serif;font-size:26px;line-height:.95;text-transform:uppercase}
        .home-category-copy span{display:block;color:#777;font-size:11px;line-height:1.45}
        .home-category-arrow{position:absolute;right:22px;bottom:27px}
        .home-catalog{background:#fafafa;border-top:1px solid var(--line)}
        .home-product-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .home-product-card{overflow:hidden;background:#fff;border:1px solid #e2e2e2;border-radius:14px;color:#111;text-decoration:none;transition:border-color .18s,box-shadow .18s}
        .home-product-card:hover{border-color:#dcd0a0;box-shadow:0 10px 26px rgba(0,0,0,.06)}
        .home-product-image{aspect-ratio:1/1;background:#f5f5f3;overflow:hidden}
        .home-product-info{padding:17px}
        .home-product-info small{font-size:8px;color:#999;font-weight:900}
        .home-product-info h3{margin:8px 0 13px;font-family:'Barlow Condensed',sans-serif;font-size:22px;line-height:1;text-transform:uppercase}
        .home-product-info strong{font-size:18px}
        .home-empty{text-align:center;border:1px solid var(--line);background:#fff;padding:55px;border-radius:14px}
        .home-empty h3{margin:14px 0 6px;font-size:20px}
        .home-empty p{margin:0 0 20px;color:#777;font-size:13px}
        .home-benefits{background:#111;color:#fff;padding:60px 0}
        .home-benefits-grid{display:grid;grid-template-columns:1.45fr repeat(3,1fr)}
        .home-benefit-intro,.home-benefit{padding:0 30px;border-left:1px solid #333}
        .home-benefit-intro{padding-left:0;border-left:0}
        .home-benefit-intro h2{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:34px;font-style:italic}
        .home-benefit-intro>p:last-child{color:#aaa;font-size:12px;line-height:1.6}
        .home-benefit svg{color:var(--yellow)}
        .home-benefit h3{margin:15px 0 5px;font-family:'Barlow Condensed',sans-serif;font-size:25px;text-transform:uppercase}
        .home-benefit p{color:#aaa;font-size:11px}
        .home-footer{background:#0b0b0b;color:#fff;padding:52px 0 0}
        .home-footer-grid{display:grid;grid-template-columns:1.5fr .7fr 1fr;gap:55px;padding-bottom:42px}
        .home-footer-grid img{width:105px;height:65px;object-fit:contain}
        .home-footer-grid p:not(.home-eyebrow),.home-footer-grid a,.home-footer-grid span{display:block;color:#aaa;font-size:11px;line-height:1.9;text-decoration:none}
        .home-footer-grid a:hover{color:var(--yellow)}
        .home-footer .home-eyebrow{color:var(--yellow)}
        .home-footer-bottom{border-top:1px solid #242424;padding:17px 0;color:#666;font-size:9px}
        .home-category-section .ui-pagination{border-top:0;margin-top:20px}
        @media(max-width:900px){
          .home-container{width:min(100% - 40px,1180px)}
          .home-hero h1{font-size:58px}
          .home-category-grid{grid-template-columns:repeat(2,1fr)}
          .home-product-grid{grid-template-columns:repeat(2,1fr)}
          .home-benefits-grid{grid-template-columns:1fr 1fr;gap:28px}
          .home-benefit-intro{grid-column:1/-1}
          .home-footer-grid{grid-template-columns:1fr 1fr;gap:30px}
        }
        @media(max-width:680px){
          .home-container{width:calc(100% - 28px)}
          .home-hero-grid{min-height:auto;display:flex;flex-direction:column}
          .home-hero-copy{width:100%;padding:42px 0 10px}
          .home-hero h1{font-size:46px}
          .home-lead{font-size:14px}
          .home-hero-actions{margin-top:24px;display:grid;grid-template-columns:1fr 1fr}
          .home-hero-art{width:100%;min-height:320px;height:320px}
          .home-hero-art img{width:min(100%,460px)}
          .home-section{padding:54px 0}
          .home-section-head{margin-bottom:24px}
          .home-section-head h2{font-size:37px}
          .home-category-card{min-height:180px;padding:20px 16px}
          .home-product-grid{gap:10px}
          .home-product-info{padding:13px}
          .home-product-info h3{font-size:19px}
          .home-benefits-grid{grid-template-columns:1fr 1fr;gap:26px 0}
          .home-benefit{padding:0 15px}
          .home-footer-grid>div:first-child{grid-column:1/-1}
        }
        @media(max-width:390px){
          .home-hero h1{font-size:41px}
          .home-hero-actions{grid-template-columns:1fr}
          .home-hero-art{min-height:280px;height:280px}
          .home-category-grid{grid-template-columns:1fr}
          .home-category-copy h3{font-size:22px}
          .home-product-grid{grid-template-columns:1fr}
          .home-section-head{display:block}
          .home-section-link{margin-top:12px}
        }
      `}</style>
    </main>
  );
}
