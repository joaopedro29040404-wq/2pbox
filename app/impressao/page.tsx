'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronDown, FileText, Image as ImageIcon, Minus, Plus, Printer, Trash2, Upload, X, HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/components/cart-provider';
import { SiteHeader } from '@/components/site-header';
import { useToast } from '@/components/ui/toast';

type Paper = { id: string; name: string; size: string };
type Tier = { id: string; paper_type_id: string; color_mode: 'bw' | 'color'; min_sheets: number; max_sheets: number | null; price_per_sheet: number };
type Service = { id: string; name: string; description: string | null; charge_type: string; price: number };
type FileCfg = {
  id: string; name: string; path: string; mime: string; pages: number; paperId: string;
  color: 'bw' | 'color'; duplex: boolean; copies: number; serviceIds: string[];
};

const money = (n: number) => 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
const isBinding = (s: Service) => s.name.toLowerCase().startsWith('encadernação');
const isLamination = (s: Service) => s.name.toLowerCase().startsWith('plastificação');

function pdfPages(bytes: ArrayBuffer) {
  const text = new TextDecoder('latin1').decode(bytes);
  return Math.max(1, (text.match(/\/Type\s*\/Page\b/g) || []).length);
}
function calcSheets(f: FileCfg) {
  return Math.ceil(f.pages / (f.duplex ? 2 : 1)) * f.copies;
}
function applicableBinding(services: Service[], sheets: number) {
  return services.find(s => isBinding(s) && (() => {
    const m = s.name.match(/(\d+)\s*a\s*(\d+)/i);
    return m ? sheets >= Number(m[1]) && sheets <= Number(m[2]) : false;
  })());
}
function calcFile(f: FileCfg, tiers: Tier[], services: Service[]) {
  const sheets = calcSheets(f);
  const tier = tiers
    .filter(t => t.paper_type_id === f.paperId && t.color_mode === f.color && t.min_sheets <= sheets && (t.max_sheets == null || t.max_sheets >= sheets))
    .sort((a, b) => b.min_sheets - a.min_sheets)[0];
  const base = tier ? sheets * Number(tier.price_per_sheet) : 0;
  let servicesTotal = 0;
  for (const id of f.serviceIds) {
    const s = services.find(v => v.id === id);
    if (!s) continue;
    const qty = s.charge_type === 'per_sheet' ? sheets : s.charge_type === 'per_document' ? f.copies : 1;
    servicesTotal += qty * Number(s.price);
  }
  return { sheets, tier, base, servicesTotal, total: base + servicesTotal };
}

export default function ImpressaoPage() {
  const toast = useToast();
  const { addPrint } = useCart();
  const input = useRef<HTMLInputElement>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [files, setFiles] = useState<FileCfg[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from('print_paper_types').select('id,name,size').eq('active', true).order('sort_order'),
      supabase.from('print_price_tiers').select('*'),
      supabase.from('print_services').select('*').eq('active', true).order('sort_order'),
    ]).then(([a, b, c]) => {
      setPapers((a.data || []) as Paper[]);
      setTiers((b.data || []) as Tier[]);
      setServices((c.data || []) as Service[]);
    });
  }, []);

  const hasColor = useMemo(() => tiers.some(t => t.color_mode === 'color'), [tiers]);
  const total = useMemo(() => files.reduce((sum, f) => sum + calcFile(f, tiers, services).total, 0), [files, tiers, services]);
  const totalSheets = useMemo(() => files.reduce((sum, f) => sum + calcSheets(f), 0), [files]);

  async function upload(list: FileList | null) {
    if (!list) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Envie um PDF, JPG, PNG ou WEBP.');
        if (file.size > 20 * 1024 * 1024) throw new Error('Cada arquivo pode ter no máximo 20 MB.');
        let pages = 1;
        if (file.type === 'application/pdf') pages = pdfPages(await file.arrayBuffer());
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/impressao/upload', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Não foi possível enviar o arquivo.');
        setFiles(v => [...v, {
          id: crypto.randomUUID(), name: file.name, path: data.path, mime: file.type, pages,
          paperId: papers[0]?.id || '', color: 'bw', duplex: false, copies: 1, serviceIds: [],
        }]);
      }
    } catch (e) {
      toast.error('Não foi possível adicionar o arquivo', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  const update = (id: string, patch: Partial<FileCfg>) => setFiles(v => v.map(f => f.id === id ? { ...f, ...patch } : f));
  const removeFile = (id: string) => setFiles(v => v.filter(f => f.id !== id));

  function chooseService(f: FileCfg, service: Service, group: 'lamination' | 'binding') {
    const groupIds = services.filter(s => group === 'binding' ? isBinding(s) : isLamination(s)).map(s => s.id);
    const next = f.serviceIds.filter(id => !groupIds.includes(id));
    if (!f.serviceIds.includes(service.id)) next.push(service.id);
    update(f.id, { serviceIds: next });
  }

  function toggleSimpleService(f: FileCfg, service: Service) {
    update(f.id, { serviceIds: f.serviceIds.includes(service.id) ? f.serviceIds.filter(id => id !== service.id) : [...f.serviceIds, service.id] });
  }

  async function finish() {
    if (!files.length) return;
    for (const f of files) {
      if (!f.paperId) return toast.error('Escolha o papel', f.name);
      const c = calcFile(f, tiers, services);
      if (!c.tier) return toast.error('Preço não configurado', 'Não há preço para esta quantidade de folhas.');
    }
    const normalizedFiles = files.map(f => ({
      original_name: f.name, storage_path: f.path, mime_type: f.mime, pages: f.pages, copies: f.copies,
      paper_type_id: f.paperId, color_mode: f.color, duplex: f.duplex,
      services: f.serviceIds.map(service_id => ({ service_id, selected_pages: [] })),
      metadata: {},
    }));
    addPrint({
      name: 'Impressão (' + files.length + ' arquivo' + (files.length > 1 ? 's' : '') + ')',
      price: total, quantity: 1, stock: 1,
      metadata: { files: normalizedFiles, metadata: { created_at: new Date().toISOString() } },
    });
    toast.success('Impressão adicionada ao carrinho', 'Confira o resumo e finalize seu pedido.');
  }

  const bwTiers = tiers.filter(t => t.color_mode === 'bw').sort((a, b) => a.min_sheets - b.min_sheets);
  const bindingServices = services.filter(isBinding);
  const laminationServices = services.filter(isLamination);
  const otherServices = services.filter(s => !isBinding(s) && !isLamination(s));

  return (
    <main className="print-page">
      <SiteHeader subtitle="CENTRAL DE IMPRESSÃO" />
      <section className="print-shell">
        <Link href="/loja" className="back"><ArrowLeft size={17} /> Voltar para a loja</Link>

        <header className="hero">
          <div>
            <p>CENTRAL DE IMPRESSÃO</p>
            <h1>Faça sua impressão<br />sem complicação.</h1>
            <span>Envie seu arquivo, escolha as opções e veja o preço antes de colocar no carrinho.</span>
          </div>
          <div className="hero-mark"><Printer size={30} /></div>
        </header>

        <section className="steps">
          <div><b>1</b><span>Envie o arquivo</span></div>
          <div><b>2</b><span>Escolha como imprimir</span></div>
          <div><b>3</b><span>Confira o preço</span></div>
        </section>

        <section className="upload-box" onClick={() => input.current?.click()}>
          <div className="upload-icon"><Upload size={30} /></div>
          <strong>{busy ? 'Enviando arquivo...' : 'Clique aqui para enviar seu arquivo'}</strong>
          <span>Você pode enviar PDF, JPG, PNG ou WEBP · até 20 MB por arquivo</span>
          <button type="button">{busy ? 'Aguarde...' : 'Escolher arquivo'}</button>
          <input ref={input} type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => { void upload(e.target.files); e.currentTarget.value = ''; }} />
        </section>

        {!files.length && (
          <section className="price-guide">
            <div className="guide-title"><HelpCircle size={20} /><div><b>Quer saber o preço antes de enviar?</b><span>Veja nossa tabela de impressão em preto e branco.</span></div></div>
            <div className="guide-table">
              {bwTiers.map(t => <div key={t.id}><b>{t.min_sheets} a {t.max_sheets ?? '200'} folhas</b><strong>{money(Number(t.price_per_sheet))}<small> por folha</small></strong></div>)}
              {!bwTiers.length && <span>Os preços serão exibidos assim que a tabela estiver configurada.</span>}
            </div>
            <p><strong>Frente e verso:</strong> 2 páginas ocupam 1 folha física. O sistema faz essa conta automaticamente.</p>
          </section>
        )}

        <div className="files">
          {files.map((f, index) => {
            const c = calcFile(f, tiers, services);
            const binding = applicableBinding(services, c.sheets);
            const selectedBinding = f.serviceIds.find(id => isBinding(services.find(s => s.id === id)!));
            return (
              <section className="file-card" key={f.id}>
                <div className="file-head">
                  <div className="file-icon">{f.mime === 'application/pdf' ? <FileText size={24} /> : <ImageIcon size={24} />}</div>
                  <div><span className="file-number">ARQUIVO {index + 1}</span><strong>{f.name}</strong><small>{f.pages} {f.pages === 1 ? 'página' : 'páginas'} · {c.sheets} {c.sheets === 1 ? 'folha física' : 'folhas físicas'}</small></div>
                  <button className="remove" onClick={() => removeFile(f.id)} aria-label="Remover arquivo"><X size={20} /></button>
                </div>

                <div className="section-label">COMO VOCÊ QUER IMPRIMIR?</div>
                <div className="choice-grid">
                  <button className={f.color === 'bw' ? 'choice active' : 'choice'} onClick={() => update(f.id, { color: 'bw' })}><span className="choice-icon">A</span><span><b>Preto e branco</b><small>Preço conforme a quantidade de folhas</small></span>{f.color === 'bw' && <Check />}</button>
                  <button className={!hasColor ? 'choice disabled' : f.color === 'color' ? 'choice active' : 'choice'} disabled={!hasColor} onClick={() => update(f.id, { color: 'color' })}><span className="choice-icon color">●</span><span><b>Colorido</b><small>{hasColor ? 'Preço conforme a quantidade de folhas' : 'Preço colorido ainda não cadastrado'}</small></span>{hasColor && f.color === 'color' && <Check />}</button>
                </div>

                <div className="option-grid">
                  <label><span>Frente ou frente e verso?</span><select value={f.duplex ? 'duplex' : 'single'} onChange={e => update(f.id, { duplex: e.target.value === 'duplex' })}><option value="single">Somente frente</option><option value="duplex">Frente e verso — economiza folhas</option></select></label>
                  <div><span>Quantas cópias?</span><div className="qty"><button onClick={() => update(f.id, { copies: Math.max(1, f.copies - 1) })}><Minus size={17} /></button><b>{f.copies}</b><button onClick={() => update(f.id, { copies: f.copies + 1 })}><Plus size={17} /></button></div></div>
                  <label><span>Tipo de papel</span><select value={f.paperId} onChange={e => update(f.id, { paperId: e.target.value })}>{papers.map(p => <option key={p.id} value={p.id}>{p.name} — {p.size}</option>)}</select></label>
                </div>

                <div className="help-note"><HelpCircle size={17} /><span><b>Não sabe qual escolher?</b> Se você quer uma impressão comum de documentos, escolha <strong>Preto e branco</strong> e <strong>Somente frente</strong>.</span></div>

                {laminationServices.length > 0 && (
                  <div className="services-section">
                    <div className="section-label">PLASTIFICAÇÃO</div>
                    <p className="section-help">Escolha apenas se quiser proteger o documento. Para RG e cartões, escolha o tipo correspondente.</p>
                    <div className="service-grid">
                      {laminationServices.map(s => <button key={s.id} className={f.serviceIds.includes(s.id) ? 'service-choice active' : 'service-choice'} onClick={() => chooseService(f, s, 'lamination')}><span><b>{s.name.replace(/^Plastificação\s*—\s*/i, '')}</b><small>{s.charge_type === 'per_sheet' ? 'por folha' : 'por unidade'}</small></span><strong>{money(Number(s.price))}</strong>{f.serviceIds.includes(s.id) && <Check size={18} />}</button>)}
                    </div>
                  </div>
                )}

                {bindingServices.length > 0 && (
                  <div className="services-section">
                    <div className="section-label">ENCADERNAÇÃO</div>
                    <p className="section-help">O valor é escolhido automaticamente pela quantidade de folhas. Para este arquivo, a faixa é <strong>{binding ? binding.name.replace('Encadernação ', '') : 'acima de 200 folhas'}</strong>.</p>
                    {binding ? (
                      <button className={selectedBinding === binding.id ? 'service-choice active wide' : 'service-choice wide'} onClick={() => chooseService(f, binding, 'binding')}><span><b>{binding.name}</b><small>Encadernação para este arquivo</small></span><strong>{money(Number(binding.price))}</strong>{selectedBinding === binding.id && <Check size={18} />}</button>
                    ) : <div className="unavailable">A encadernação cadastrada atende até 200 folhas.</div>}
                  </div>
                )}

                {otherServices.length > 0 && (
                  <div className="services-section">
                    <div className="section-label">OUTROS SERVIÇOS</div>
                    <div className="service-grid">{otherServices.map(s => <button key={s.id} className={f.serviceIds.includes(s.id) ? 'service-choice active' : 'service-choice'} onClick={() => toggleSimpleService(f, s)}><span><b>{s.name}</b><small>{s.description || 'Serviço adicional'}</small></span><strong>{money(Number(s.price))}</strong>{f.serviceIds.includes(s.id) && <Check size={18} />}</button>)}</div>
                  </div>
                )}

                <div className="file-total">
                  <div><span>Impressão</span><b>{money(c.base)}</b></div>
                  {c.servicesTotal > 0 && <div><span>Serviços</span><b>{money(c.servicesTotal)}</b></div>}
                  <div className="total-main"><span>Total deste arquivo</span><strong>{money(c.total)}</strong></div>
                </div>
              </section>
            );
          })}
        </div>

        {files.length > 0 && (
          <aside className="summary">
            <div><span>SEU PEDIDO</span><b>{files.length} {files.length === 1 ? 'arquivo' : 'arquivos'} · {totalSheets} {totalSheets === 1 ? 'folha' : 'folhas'}</b></div>
            <strong>{money(total)}</strong>
            <button disabled={busy} onClick={() => void finish()}>Adicionar ao carrinho</button>
          </aside>
        )}
      </section>

      <style jsx global>{`
        .print-page{min-height:100vh;background:#f5f5f2;color:#111;font-family:Inter,Arial,sans-serif}
        .print-shell{width:min(1080px,calc(100% - 28px));margin:auto;padding:25px 0 80px}
        .back{display:inline-flex;gap:7px;align-items:center;color:#555;text-decoration:none;font-weight:800;font-size:13px;margin-bottom:25px}
        .hero{display:flex;justify-content:space-between;gap:25px;align-items:center;margin-bottom:24px}.hero p{margin:0 0 7px;color:#9b7600;font-size:12px;font-weight:900;letter-spacing:.18em}.hero h1{margin:0;font:italic 52px/1 'Barlow Condensed';text-transform:uppercase}.hero span{display:block;margin-top:10px;color:#666;font-size:15px;line-height:1.5;max-width:680px}.hero-mark{width:64px;height:64px;border-radius:17px;background:#ffc400;display:grid;place-items:center;flex:none}
        .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:15px}.steps>div{background:#111;color:#fff;border-radius:12px;padding:13px 15px;display:flex;align-items:center;gap:10px}.steps b{width:29px;height:29px;border-radius:50%;background:#ffc400;color:#111;display:grid;place-items:center;font-size:13px}.steps span{font-size:12px;font-weight:800}
        .upload-box{border:2px dashed #cfcfca;background:#fff;border-radius:17px;padding:28px 20px;text-align:center;display:grid;place-items:center;gap:8px;cursor:pointer}.upload-icon{width:52px;height:52px;border-radius:14px;background:#fff2b5;display:grid;place-items:center}.upload-box strong{font-size:17px}.upload-box span{font-size:12px;color:#777}.upload-box button{border:0;background:#ffc400;border-radius:10px;padding:11px 18px;font:900 12px Inter;cursor:pointer}
        .price-guide{margin-top:15px;background:#fff;border:1px solid #dddcd7;border-radius:15px;padding:16px}.guide-title{display:flex;gap:10px;align-items:center}.guide-title div{display:grid;gap:3px}.guide-title b{font-size:14px}.guide-title span,.price-guide p{font-size:12px;color:#777}.guide-table{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}.guide-table div{border:1px solid #e3e2dd;border-radius:10px;padding:11px}.guide-table b{display:block;font-size:11px}.guide-table strong{display:block;margin-top:5px;font-size:17px}.guide-table small{font-size:9px;color:#888;font-weight:400}.price-guide p{margin:12px 0 0}
        .files{display:grid;gap:16px;margin-top:16px}.file-card{background:#fff;border:1px solid #dcdad5;border-radius:17px;padding:20px}.file-head{display:flex;align-items:center;gap:12px;margin-bottom:20px}.file-head>div:nth-child(2){display:grid;gap:3px;flex:1}.file-number{font-size:10px;color:#9b7600;font-weight:900;letter-spacing:.12em}.file-head strong{font-size:16px;word-break:break-word}.file-head small{font-size:12px;color:#777}.file-icon{width:46px;height:46px;border-radius:11px;background:#fff2b5;display:grid;place-items:center}.remove{border:0;background:#f2f2ef;border-radius:9px;padding:8px;cursor:pointer}
        .section-label{font-size:11px;font-weight:900;letter-spacing:.12em;color:#555;margin-bottom:8px}.choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.choice{border:1px solid #ddd;background:#fff;border-radius:12px;padding:14px;text-align:left;display:flex;align-items:center;gap:10px;cursor:pointer;min-height:68px}.choice.active{border:2px solid #ffc400;background:#fffbea}.choice.disabled{opacity:.55;cursor:not-allowed}.choice-icon{width:34px;height:34px;border-radius:9px;background:#222;color:#fff;display:grid;place-items:center;font-weight:900}.choice-icon.color{background:linear-gradient(135deg,#f44,#4a6,#48c);font-size:15px}.choice span:not(.choice-icon){display:grid;gap:3px;flex:1}.choice b{font-size:13px}.choice small{font-size:10px;color:#777}.choice svg{color:#7a5b00}
        .option-grid{display:grid;grid-template-columns:1.2fr 1fr 1.1fr;gap:10px;margin-top:13px}.option-grid>label,.option-grid>div{display:grid;gap:6px}.option-grid span{font-size:10px;font-weight:900;color:#666}.option-grid select{height:43px;border:1px solid #d7d6d1;border-radius:9px;background:#fff;padding:0 10px;font:12px Inter}.qty{height:43px;border:1px solid #d7d6d1;border-radius:9px;display:flex;align-items:center;justify-content:space-between}.qty button{height:100%;width:45px;border:0;background:transparent;display:grid;place-items:center;cursor:pointer}
        .help-note{display:flex;gap:8px;align-items:flex-start;margin-top:12px;padding:11px 12px;background:#f6f6f3;border-radius:10px;color:#666;font-size:11px;line-height:1.45}.help-note svg{flex:none}
        .services-section{margin-top:19px;border-top:1px solid #ecebe7;padding-top:17px}.section-help{margin:0 0 10px;color:#777;font-size:11px;line-height:1.45}.service-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.service-choice{border:1px solid #ddd;background:#fff;border-radius:11px;padding:12px;text-align:left;display:flex;align-items:center;gap:9px;cursor:pointer;min-height:61px}.service-choice.active{border:2px solid #ffc400;background:#fffbea}.service-choice>span{display:grid;gap:3px;flex:1}.service-choice b{font-size:11px}.service-choice small{font-size:9px;color:#888}.service-choice>strong{font-size:12px;white-space:nowrap}.service-choice svg{flex:none}.service-choice.wide{width:100%}.unavailable{padding:12px;border-radius:10px;background:#f5f5f2;color:#777;font-size:11px}
        .file-total{display:flex;align-items:end;gap:20px;border-top:1px solid #ecebe7;margin-top:19px;padding-top:15px}.file-total>div{display:grid;gap:3px}.file-total span{font-size:10px;color:#888}.file-total b{font-size:13px}.total-main{margin-left:auto;text-align:right}.total-main strong{font-size:22px}
        .summary{position:sticky;bottom:10px;margin-top:16px;background:#111;color:#fff;border-radius:15px;padding:16px 18px;display:flex;align-items:center;gap:20px;box-shadow:0 7px 25px rgba(0,0,0,.16)}.summary>div{display:grid;gap:4px;flex:1}.summary span{font-size:9px;color:#aaa;letter-spacing:.1em}.summary b{font-size:13px}.summary>strong{font-size:23px}.summary button{border:0;background:#ffc400;color:#111;border-radius:10px;padding:13px 18px;font:900 12px Inter;cursor:pointer}.summary button:disabled{opacity:.5}
        @media(max-width:800px){.hero h1{font-size:43px}.steps span{font-size:10px}.option-grid{grid-template-columns:1fr 1fr}.service-grid{grid-template-columns:1fr 1fr}.guide-table{grid-template-columns:1fr 1fr}.summary{flex-wrap:wrap}.summary button{width:100%}}
        @media(max-width:520px){.print-shell{width:calc(100% - 18px)}.hero{align-items:flex-start}.hero-mark{width:50px;height:50px}.hero h1{font-size:37px}.hero span{font-size:13px}.steps{grid-template-columns:1fr}.steps>div{padding:10px}.choice-grid,.option-grid,.service-grid,.guide-table{grid-template-columns:1fr}.file-card{padding:15px}.file-total{display:grid;grid-template-columns:1fr 1fr}.total-main{margin-left:0;text-align:left;grid-column:1/-1}.summary{bottom:5px}}
      `}</style>
    </main>
  );
}
