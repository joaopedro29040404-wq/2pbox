import Link from 'next/link';
import { ArrowRight, Headphones, Laptop, Printer, Search, ShoppingBag, Star, Truck } from 'lucide-react';

const categories = [
  { title: 'Papelaria', description: 'Tudo para estudos e escritório.', icon: ShoppingBag },
  { title: 'Eletrônicos', description: 'Acessórios e tecnologia para seu dia a dia.', icon: Laptop },
  { title: 'Impressão', description: 'Impressões de qualidade com rapidez.', icon: Printer },
];

export default function Home() {
  return (
    <main>
      <div className="topbar">Qualidade <span>•</span> Variedade <span>•</span> Confiança</div>
      <header className="header container">
        <Link href="/" className="brand" aria-label="2P Box"><div className="brand-mark">2P</div><div><strong>2P BOX</strong><small>TUDO QUE VOCÊ PRECISA, EM UM SÓ LUGAR.</small></div></Link>
        <nav><Link href="#categorias">Categorias</Link><Link href="/loja">Produtos</Link><Link href="#contato">Contato</Link></nav>
        <div className="header-actions"><button className="icon-btn" aria-label="Buscar"><Search size={20}/></button><Link className="cart-btn" href="/carrinho"><ShoppingBag size={19}/> Carrinho <b>0</b></Link></div>
      </header>

      <section className="hero container">
        <div className="hero-copy"><p className="eyebrow">PAPELARIA • ELETRÔNICOS • IMPRESSÃO</p><h1>Tudo que você precisa,<br/><em>em um só lugar!</em></h1><p className="lead">Variedade, qualidade e o melhor atendimento para facilitar o seu dia a dia.</p><div className="hero-actions"><Link className="primary" href="/loja">Comprar agora <ArrowRight size={18}/></Link><Link className="secondary" href="#categorias">Ver categorias</Link></div></div>
        <div className="hero-card"><div className="speed">2P</div><div className="hero-box">Tudo para você</div><div className="hero-wheel one"/><div className="hero-wheel two"/></div>
      </section>

      <section id="categorias" className="container section"><div className="section-head"><div><p className="eyebrow">ENCONTRE O QUE PRECISA</p><h2>Compre por categoria</h2></div><Link href="/loja">Ver tudo <ArrowRight size={16}/></Link></div><div className="category-grid">{categories.map(({title,description,icon:Icon}) => <Link className="category" href="/loja" key={title}><div className="category-icon"><Icon size={28}/></div><h3>{title}</h3><p>{description}</p><span>Explorar <ArrowRight size={15}/></span></Link>)}</div></section>

      <section id="produtos" className="container section"><div className="section-head"><div><p className="eyebrow">CATÁLOGO 2P BOX</p><h2>Produtos</h2><p>Confira os produtos disponíveis no catálogo da 2P Box.</p></div><Link className="primary" href="/loja">Ver catálogo <ArrowRight size={16}/></Link></div><div className="category" style={{textAlign:'center',padding:'42px 24px'}}><ShoppingBag size={34}/><h3>Seu próximo produto está aqui</h3><p>Acesse o catálogo para ver produtos, preços, imagens e disponibilidade atualizados.</p><Link className="secondary" href="/loja">Acessar a loja <ArrowRight size={16}/></Link></div></section>

      <section className="benefits"><div className="container benefits-grid"><div><Truck size={25}/><h3>Retire na loja</h3><p>Compre online e retire com praticidade.</p></div><div><Headphones size={25}/><h3>Atendimento próximo</h3><p>Fale com a 2P Box pelo WhatsApp.</p></div><div><Star size={25}/><h3>Qualidade</h3><p>Produtos selecionados para você.</p></div></div></section>

      <footer id="contato"><div className="container footer-grid"><div><div className="footer-brand">2P BOX</div><p>Tudo que você precisa,<br/>em um só lugar.</p></div><div><h4>Loja</h4><Link href="/loja">Produtos</Link><Link href="#categorias">Categorias</Link><Link href="/carrinho">Carrinho</Link></div><div><h4>Atendimento</h4><p>WhatsApp: (11) 9 9999-9999</p><p>Seg–Sex • 9h às 18h</p></div></div><div className="footer-bottom container">© 2026 2P Box. Todos os direitos reservados.</div></footer>
    </main>
  );
}
