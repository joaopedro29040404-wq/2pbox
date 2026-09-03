import Link from 'next/link';

export default function CarrinhoPage() {
  return (
    <main>
      <div className="topbar">Qualidade <span>•</span> Variedade <span>•</span> Confiança</div>
      <header className="header container">
        <Link href="/" className="brand"><div className="brand-mark">2P</div><div><strong>2P BOX</strong><small>TUDO QUE VOCÊ PRECISA, EM UM SÓ LUGAR.</small></div></Link>
        <Link className="secondary" href="/">Continuar comprando</Link>
      </header>
      <section className="container section">
        <p className="eyebrow">SEU PEDIDO</p>
        <h1 style={{fontFamily:'Barlow Condensed',fontSize:52,textTransform:'uppercase',fontStyle:'italic',marginTop:0}}>Carrinho</h1>
        <div className="category" style={{maxWidth:760}}>
          <h3>Seu carrinho está vazio</h3>
          <p>Os produtos adicionados ao carrinho aparecerão aqui.</p>
          <Link className="primary" href="/#produtos">Explorar produtos</Link>
        </div>
      </section>
    </main>
  );
}
