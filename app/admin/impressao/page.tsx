'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, HelpCircle, Plus, Save, Trash2, Printer, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { useToast } from '@/components/ui/toast';

const money = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SERVICE_TYPES = [
  { value: 'per_page', label: 'Por página', help: 'Cobra o valor para cada página selecionada. Ex.: R$ 0,20 por página.' },
  { value: 'per_sheet', label: 'Por folha', help: 'Cobra o valor para cada folha física. Ex.: plastificação por folha.' },
  { value: 'per_document', label: 'Por documento', help: 'Cobra uma vez por documento. Se forem 2 cópias, cobra 2 vezes.' },
  { value: 'flat', label: 'Valor fixo', help: 'Cobra o valor uma única vez pelo serviço.' },
];

export default function AdminImpressao() {
  const toast = useToast();
  const [papers, setPapers] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!supabase) return;
    const [a, b, c] = await Promise.all([
      supabase.from('print_paper_types').select('*').order('sort_order'),
      supabase.from('print_price_tiers').select('*').order('paper_type_id').order('color_mode').order('min_sheets'),
      supabase.from('print_services').select('*').order('sort_order'),
    ]);
    setPapers(a.data || []);
    setTiers(b.data || []);
    setServices(c.data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  async function save(table: string, row: any) {
    if (!supabase) return;
    const payload = { ...row };
    for (const key of ['min_sheets', 'max_sheets', 'sort_order']) if (payload[key] === '') payload[key] = null;
    for (const key of ['min_sheets', 'max_sheets', 'sort_order']) if (payload[key] != null) payload[key] = Number(payload[key]);
    if (payload.price_per_sheet != null) payload.price_per_sheet = Number(payload.price_per_sheet);
    if (payload.price != null) payload.price = Number(payload.price);
    const { error } = await supabase.from(table).upsert(payload);
    if (error) toast.error('Não foi possível salvar', error.message);
    else { toast.success('Salvo com sucesso'); void load(); }
  }

  async function del(table: string, id: string) {
    if (!supabase) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) toast.error('Não foi possível excluir', error.message);
    else { toast.success('Excluído'); void load(); }
  }

  const paperName = (id: string) => papers.find((p) => p.id === id)?.name || 'Papel não encontrado';
  const tiersByPaper = useMemo(() => papers.map((paper) => ({
    paper,
    bw: tiers.filter((t) => t.paper_type_id === paper.id && t.color_mode === 'bw'),
    color: tiers.filter((t) => t.paper_type_id === paper.id && t.color_mode === 'color'),
  })), [papers, tiers]);

  if (loading) return <main><SiteHeader variant="admin" subtitle="IMPRESSÃO" /><div className="loading">Carregando...</div></main>;

  return (
    <main className="pa">
      <SiteHeader variant="admin" subtitle="IMPRESSÃO" />
      <section className="shell">
        <div className="admin-nav"><Link href="/admin" className="back"><ArrowLeft size={15} /> Painel</Link><Link href="/admin/impressao/pedidos" className="orders-link"><Printer size={14} /> Pedidos de impressão</Link></div>

        <header className="hero">
          <div className="hero-icon"><Printer size={25} /></div>
          <div>
            <p>IMPRESSÃO</p>
            <h1>Configuração da impressão</h1>
            <span>Configure o que sua loja oferece e quanto o cliente vai pagar.</span>
          </div>
        </header>

        <section className="how card">
          <div className="section-heading">
            <div><span className="step">COMO FUNCIONA</span><h2>Você só precisa configurar 3 coisas</h2></div>
          </div>
          <div className="how-grid">
            <div><b>1. Papel</b><p>Cadastre os tipos de papel que sua loja oferece, como papel comum A4, fotográfico ou Canson.</p></div>
            <div><b>2. Preço</b><p>Defina o preço por folha. Você pode cobrar valores diferentes conforme a quantidade e entre P&B e colorido.</p></div>
            <div><b>3. Serviços extras</b><p>Cadastre serviços como encadernação, plastificação, capa ou outros adicionais.</p></div>
          </div>
        </section>

        <section className="card">
          <div className="title">
            <div>
              <span className="step">1 · PAPÉIS</span>
              <h2>Quais papéis você oferece?</h2>
              <small>O cliente poderá escolher um desses papéis ao enviar o arquivo.</small>
            </div>
            <button className="primary" onClick={() => setPapers(v => [...v, { id: crypto.randomUUID(), name: 'Novo papel', size: 'A4', active: true, sort_order: v.length }])}><Plus size={15} /> Adicionar papel</button>
          </div>

          <div className="paper-list">
            {papers.map((p) => (
              <div className="paper-card" key={p.id}>
                <div className="paper-main">
                  <div className="paper-badge">A4</div>
                  <div>
                    <input className="big-input" value={p.name} onChange={e => setPapers(v => v.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} aria-label="Nome do papel" />
                    <div className="hint">Nome que aparecerá para o cliente.</div>
                  </div>
                </div>
                <label className="field"><span>Tamanho</span><input value={p.size} onChange={e => setPapers(v => v.map(x => x.id === p.id ? { ...x, size: e.target.value } : x))} placeholder="Ex.: A4" /></label>
                <label className="toggle"><input type="checkbox" checked={p.active} onChange={e => setPapers(v => v.map(x => x.id === p.id ? { ...x, active: e.target.checked } : x))} /><span>Disponível para o cliente</span></label>
                <div className="actions"><button className="icon-btn save" onClick={() => void save('print_paper_types', p)} title="Salvar"><Save size={15} /></button><button className="icon-btn danger" onClick={() => void del('print_paper_types', p.id)} title="Excluir"><Trash2 size={15} /></button></div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="title">
            <div>
              <span className="step">2 · PREÇOS</span>
              <h2>Quanto cobrar pela impressão?</h2>
              <small>O sistema calcula automaticamente o valor conforme o número de folhas.</small>
            </div>
          </div>

          <div className="example-box">
            <b>Exemplo</b>
            <span>Se você colocar <strong>R$ 0,50</strong> para 1–10 folhas, um arquivo de 8 folhas custará <strong>R$ 4,00</strong>.</span>
          </div>

          {tiersByPaper.map(({ paper, bw, color }) => (
            <div className="price-paper" key={paper.id}>
              <div className="price-paper-head"><div><h3>{paper.name}</h3><span>{paper.size} · configure os preços abaixo</span></div><span className={paper.active ? 'status on' : 'status'}>{paper.active ? 'Ativo' : 'Desativado'}</span></div>
              {[
                { mode: 'bw', title: 'Preto e branco', subtitle: 'Impressão comum, sem cores.', rows: bw },
                { mode: 'color', title: 'Colorido', subtitle: 'Impressão em cores.', rows: color },
              ].map(group => (
                <div className="mode" key={group.mode}>
                  <div className="mode-head"><div><b>{group.title}</b><small>{group.subtitle}</small></div><button className="small-primary" onClick={() => setTiers(v => [...v, { id: crypto.randomUUID(), paper_type_id: paper.id, color_mode: group.mode, min_sheets: group.rows.length ? Math.max(...group.rows.map((r:any) => Number(r.max_sheets) || Number(r.min_sheets))) + 1 : 1, max_sheets: '', price_per_sheet: 0 }])}><Plus size={13} /> Adicionar faixa</button></div>
                  <div className="price-rows">
                    {group.rows.map((t: any) => (
                      <div className="price-row" key={t.id}>
                        <label><span>De</span><input type="number" min="1" value={t.min_sheets} onChange={e => setTiers(v => v.map(x => x.id === t.id ? { ...x, min_sheets: e.target.value } : x))} /><em>folhas</em></label>
                        <label><span>Até</span><input type="number" min="1" value={t.max_sheets ?? ''} placeholder="sem limite" onChange={e => setTiers(v => v.map(x => x.id === t.id ? { ...x, max_sheets: e.target.value } : x))} /><em>folhas</em></label>
                        <label className="money-field"><span>Preço por folha</span><div><b>R$</b><input type="number" min="0" step="0.01" value={t.price_per_sheet} onChange={e => setTiers(v => v.map(x => x.id === t.id ? { ...x, price_per_sheet: e.target.value } : x))} /></div></label>
                        <div className="actions"><button className="icon-btn save" onClick={() => void save('print_price_tiers', t)} title="Salvar faixa"><Save size={15} /></button><button className="icon-btn danger" onClick={() => void del('print_price_tiers', t.id)} title="Excluir faixa"><Trash2 size={15} /></button></div>
                      </div>
                    ))}
                    {!group.rows.length && <div className="empty-price">Nenhum preço cadastrado. Clique em <b>Adicionar faixa</b> para começar.</div>}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="duplex-info"><HelpCircle size={17} /><div><b>E frente e verso?</b><span>Você não precisa cadastrar outro preço. No site, quando o cliente escolher frente e verso, 2 páginas serão calculadas como 1 folha física. O sistema faz essa conta automaticamente.</span></div></div>
        </section>

        <section className="card">
          <div className="title">
            <div>
              <span className="step">3 · SERVIÇOS EXTRAS</span>
              <h2>Quer oferecer algo além da impressão?</h2>
              <small>Ex.: encadernação, plastificação, capa, corte e acabamento.</small>
            </div>
            <button className="primary" onClick={() => setServices(v => [...v, { id: crypto.randomUUID(), name: 'Novo serviço', description: '', charge_type: 'per_document', price: 0, active: true, sort_order: v.length }])}><Plus size={15} /> Adicionar serviço</button>
          </div>

          <div className="service-help">
            <b>Como funciona a cobrança?</b>
            <div className="service-help-grid">{SERVICE_TYPES.map(type => <div key={type.value}><strong>{type.label}</strong><span>{type.help}</span></div>)}</div>
          </div>

          <div className="services-list">
            {services.map(s => (
              <div className="service-card" key={s.id}>
                <div className="service-fields">
                  <label className="field"><span>Nome do serviço</span><input value={s.name} onChange={e => setServices(v => v.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} placeholder="Ex.: Encadernação" /></label>
                  <label className="field"><span>Descrição para o cliente</span><input value={s.description || ''} onChange={e => setServices(v => v.map(x => x.id === s.id ? { ...x, description: e.target.value } : x))} placeholder="Ex.: Encadernação com espiral" /></label>
                  <label className="field"><span>Como cobrar?</span><select value={s.charge_type} onChange={e => setServices(v => v.map(x => x.id === s.id ? { ...x, charge_type: e.target.value } : x))}>{SERVICE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                  <label className="field money-field"><span>Valor</span><div><b>R$</b><input type="number" min="0" step="0.01" value={s.price} onChange={e => setServices(v => v.map(x => x.id === s.id ? { ...x, price: e.target.value } : x))} /></div></label>
                  <label className="toggle"><input type="checkbox" checked={s.active} onChange={e => setServices(v => v.map(x => x.id === s.id ? { ...x, active: e.target.checked } : x))} /><span>Disponível para o cliente</span></label>
                </div>
                <div className="service-actions"><button className="save-wide" onClick={() => void save('print_services', s)}><Save size={15} /> Salvar serviço</button><button className="delete-text" onClick={() => void del('print_services', s.id)}><Trash2 size={14} /> Excluir</button></div>
              </div>
            ))}
            {!services.length && <div className="empty-price">Nenhum serviço adicional cadastrado. Se você só oferece impressão, pode deixar esta seção vazia.</div>}
          </div>
        </section>

        <section className="card final-note">
          <b>Pronto.</b>
          <span>Depois de configurar os preços, o cliente escolhe o arquivo, papel, P&B ou colorido, frente ou frente e verso e os serviços extras. O sistema calcula o valor automaticamente.</span>
        </section>
      </section>

      <style jsx global>{`
        .pa{min-height:100vh;background:#f5f5f2;color:#111;font-family:Inter,Arial,sans-serif}
        .shell{width:min(1120px,calc(100% - 30px));margin:auto;padding:28px 0 70px}
        .admin-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px}.back{display:inline-flex;gap:7px;align-items:center;color:#666;text-decoration:none;font:800 11px Inter}.orders-link{display:inline-flex;align-items:center;gap:7px;background:#ffc400;color:#111;text-decoration:none;border-radius:9px;padding:10px 12px;font:900 10px Inter}
        .hero{display:flex;gap:15px;align-items:center;margin-bottom:18px}.hero-icon{width:52px;height:52px;border-radius:15px;background:#ffc400;display:grid;place-items:center}.hero p{margin:0 0 5px;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.2em}.pa h1{margin:0;font:italic 48px/1 'Barlow Condensed';text-transform:uppercase}.hero span{display:block;margin-top:8px;color:#777;font-size:12px}
        .card{background:#fff;border:1px solid #dddcd7;border-radius:17px;padding:20px;margin-top:15px}.section-heading h2,.title h2{margin:3px 0 0;font-size:18px}.step{display:block;color:#9b7600;font-size:9px;font-weight:900;letter-spacing:.16em}.title{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:17px}.title small{display:block;color:#888;font-size:10px;margin-top:6px}
        .primary,.small-primary{border:0;background:#ffc400;border-radius:9px;padding:10px 12px;font:900 10px Inter;display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}.small-primary{padding:8px 10px;font-size:9px}
        .how{background:#111;color:#fff;border-color:#111}.how h2{margin:3px 0 0;font-size:18px}.how-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:15px}.how-grid>div{background:#1b1b1b;border:1px solid #333;border-radius:11px;padding:14px}.how-grid b{font-size:11px}.how-grid p{margin:7px 0 0;color:#bbb;font-size:10px;line-height:1.5}
        .paper-list{display:grid;gap:9px}.paper-card{border:1px solid #e4e3df;border-radius:12px;padding:12px;display:grid;grid-template-columns:1.5fr .6fr auto auto;gap:12px;align-items:center}.paper-main{display:flex;align-items:center;gap:11px}.paper-badge{width:40px;height:48px;border:1px solid #ddd;border-radius:5px;display:grid;place-items:center;font-size:9px;font-weight:900}.big-input{border:0;outline:0;font-size:13px;font-weight:900;width:100%;background:transparent}.hint,.field span,.service-help span{font-size:9px;color:#888}.field{display:grid;gap:5px}.field>span{font-weight:800}.field input,.field select,.big-input{height:36px;border:1px solid #ddd;border-radius:8px;padding:0 9px;background:#fff;font:10px Inter}.big-input{border:0;height:32px;padding:0}.toggle{font-size:9px;color:#666;display:flex;align-items:center;gap:6px;white-space:nowrap}.actions{display:flex;gap:5px}.icon-btn{height:34px;width:34px;border:1px solid #ddd;background:#fff;border-radius:8px;display:grid;place-items:center;cursor:pointer}.icon-btn.save:hover{background:#ffc400;border-color:#ffc400}.icon-btn.danger:hover{background:#ffe7e7}
        .example-box{background:#fff9db;border:1px solid #f0d86b;border-radius:11px;padding:12px;margin-bottom:16px;display:flex;gap:8px;align-items:flex-start;font-size:10px}.example-box span{color:#555}.price-paper{border:1px solid #e4e3df;border-radius:13px;margin-top:11px;overflow:hidden}.price-paper-head{padding:12px 14px;background:#fafafa;display:flex;justify-content:space-between;align-items:center}.price-paper-head h3{margin:0;font-size:12px}.price-paper-head span{font-size:9px;color:#888}.status{font-size:8px!important;font-weight:900;padding:5px 7px;border-radius:20px;background:#eee;color:#777}.status.on{background:#e7f6dc;color:#477522}.mode{padding:13px 14px;border-top:1px solid #eee}.mode-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.mode-head b{font-size:11px}.mode-head small{display:block;color:#888;font-size:9px;margin-top:3px}.price-rows{display:grid;gap:7px;margin-top:9px}.price-row{display:grid;grid-template-columns:1fr 1fr 1.2fr auto;gap:8px;align-items:end;padding:10px;background:#f8f8f6;border-radius:9px}.price-row label{display:grid;gap:4px}.price-row label>span{font-size:8px;font-weight:800;color:#777}.price-row input{height:34px;border:1px solid #ddd;border-radius:7px;padding:0 8px;font:10px Inter;min-width:0}.price-row em{font-style:normal;font-size:8px;color:#999}.money-field>div{display:flex;height:34px}.money-field b{display:grid;place-items:center;padding:0 8px;background:#eee;border:1px solid #ddd;border-right:0;border-radius:7px 0 0 7px;font-size:9px}.money-field input{border-radius:0 7px 7px 0!important;width:100%}.empty-price{padding:13px;border:1px dashed #ddd;border-radius:9px;color:#888;font-size:10px}.duplex-info{display:flex;gap:9px;margin-top:15px;padding:13px;border-radius:10px;background:#f5f5f2;color:#555}.duplex-info svg{flex:none}.duplex-info div{display:grid;gap:4px}.duplex-info b{font-size:10px;color:#222}.duplex-info span{font-size:9px;line-height:1.5}
        .service-help{background:#f8f8f6;border-radius:11px;padding:13px;margin-bottom:13px}.service-help>b{font-size:10px}.service-help-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:9px}.service-help-grid div{background:#fff;border:1px solid #e4e3df;border-radius:8px;padding:9px;display:grid;gap:4px}.service-help-grid strong{font-size:9px}.service-help-grid span{line-height:1.4}.services-list{display:grid;gap:9px}.service-card{border:1px solid #e4e3df;border-radius:12px;padding:13px}.service-fields{display:grid;grid-template-columns:1fr 1.3fr .8fr .55fr auto;gap:10px;align-items:end}.service-actions{display:flex;gap:10px;align-items:center;margin-top:11px}.save-wide{border:0;background:#ffc400;border-radius:8px;padding:9px 12px;font:900 9px Inter;display:flex;align-items:center;gap:5px;cursor:pointer}.delete-text{border:0;background:transparent;color:#a33;font:800 9px Inter;display:flex;gap:5px;align-items:center;cursor:pointer}
        .final-note{display:flex;gap:9px;background:#111;color:#fff;border-color:#111;font-size:10px}.final-note span{color:#bbb}.loading{padding:80px;text-align:center;color:#888}
        @media(max-width:900px){.paper-card{grid-template-columns:1fr 1fr}.service-fields{grid-template-columns:1fr 1fr}.service-actions{justify-content:space-between}.how-grid,.service-help-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:620px){.admin-nav{align-items:flex-start;flex-direction:column}.orders-link{width:100%;justify-content:center}.shell{width:min(100% - 20px,1120px);padding-top:18px}.pa h1{font-size:35px}.hero{align-items:flex-start}.title{flex-direction:column}.primary,.small-primary{width:100%;justify-content:center}.how-grid,.service-help-grid{grid-template-columns:1fr}.paper-card,.price-row,.service-fields{grid-template-columns:1fr}.mode-head{align-items:flex-start;flex-direction:column}.mode-head .small-primary{width:100%}.price-row .actions{justify-content:flex-end}.final-note{display:grid}}
      `}</style>
    </main>
  );
}
