'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, FileText, Image as ImageIcon, Minus, Plus, Printer, Trash2, Upload, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/components/cart-provider';
import { SiteHeader } from '@/components/site-header';
import { useToast } from '@/components/ui/toast';

type Paper={id:string;name:string;size:string};
type Tier={id:string;paper_type_id:string;color_mode:'bw'|'color';min_sheets:number;max_sheets:number|null;price_per_sheet:number};
type Service={id:string;name:string;description:string|null;charge_type:string;price:number;service_group:'binding'|'lamination'|'other';selection_group:string|null;min_sheets:number|null;max_sheets:number|null};
type FileCfg={id:string;name:string;path:string;mime:string;pages:number;paperId:string;color:'bw'|'color';duplex:boolean;copies:number;serviceIds:string[]};

const money=(n:number)=>'R$ '+Number(n||0).toFixed(2).replace('.',',');
const pdfPages=(bytes:ArrayBuffer)=>Math.max(1,(new TextDecoder('latin1').decode(bytes).match(/\/Type\s*\/Page\b/g)||[]).length);
const calcSheets=(f:FileCfg)=>Math.ceil(f.pages/(f.duplex?2:1))*f.copies;
function calcFile(f:FileCfg,tiers:Tier[],services:Service[]){
  const sheets=calcSheets(f);
  const tier=tiers.filter(t=>t.paper_type_id===f.paperId&&t.color_mode===f.color&&t.min_sheets<=sheets&&(t.max_sheets==null||t.max_sheets>=sheets)).sort((a,b)=>b.min_sheets-a.min_sheets)[0];
  let servicesTotal=0;
  for(const id of f.serviceIds){
    const s=services.find(v=>v.id===id); if(!s) continue;
    const qty=s.charge_type==='per_page'?f.pages*f.copies:s.charge_type==='per_sheet'?s.name.toLowerCase().includes('encaderna')?1:sheets:s.charge_type==='per_document'?f.copies:1;
    servicesTotal+=qty*Number(s.price);
  }
  return {sheets,tier,base:tier?sheets*Number(tier.price_per_sheet):0,servicesTotal,total:(tier?sheets*Number(tier.price_per_sheet):0)+servicesTotal};
}
function serviceRange(s:Service){return s.min_sheets&&s.max_sheets?(`${s.min_sheets} a ${s.max_sheets} folhas`):s.min_sheets?(`a partir de ${s.min_sheets} folhas`):s.max_sheets?(`até ${s.max_sheets} folhas`):''}

export default function ImpressaoPage(){
  const toast=useToast(); const {addPrint}=useCart(); const input=useRef<HTMLInputElement>(null);
  const [papers,setPapers]=useState<Paper[]>([]); const [tiers,setTiers]=useState<Tier[]>([]); const [services,setServices]=useState<Service[]>([]);
  const [files,setFiles]=useState<FileCfg[]>([]); const [busy,setBusy]=useState(false); const [openExtras,setOpenExtras]=useState<Record<string,boolean>>({});
  useEffect(()=>{if(!supabase)return;Promise.all([
    supabase.from('print_paper_types').select('id,name,size').eq('active',true).order('sort_order'),
    supabase.from('print_price_tiers').select('*'),
    supabase.from('print_services').select('id,name,description,charge_type,price,service_group,selection_group,min_sheets,max_sheets').eq('active',true).order('sort_order')
  ]).then(([a,b,c])=>{setPapers((a.data||[]) as Paper[]);setTiers((b.data||[]) as Tier[]);setServices((c.data||[]) as Service[]);});},[]);
  const hasColor=useMemo(()=>tiers.some(t=>t.color_mode==='color'),[tiers]);
  const finishing=services.filter(s=>s.selection_group==='finishing'||s.service_group==='binding'||s.service_group==='lamination');
  const binding=services.filter(s=>s.service_group==='binding');
  const lamination=services.filter(s=>s.service_group==='lamination');
  const other=services.filter(s=>s.service_group==='other'&&s.selection_group!=='finishing');
  const total=useMemo(()=>files.reduce((sum,f)=>sum+calcFile(f,tiers,services).total,0),[files,tiers,services]);
  const totalSheets=useMemo(()=>files.reduce((sum,f)=>sum+calcSheets(f),0),[files]);

  async function upload(list:FileList|null){
    if(!list)return; setBusy(true);
    try{for(const file of Array.from(list)){
      if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Envie PDF, JPG, PNG ou WEBP.');
      if(file.size>20*1024*1024)throw new Error('Cada arquivo pode ter no máximo 20 MB.');
      const pages=file.type==='application/pdf'?pdfPages(await file.arrayBuffer()):1;
      const form=new FormData(); form.append('file',file);
      const res=await fetch('/api/impressao/upload',{method:'POST',body:form}); const data=await res.json();
      if(!res.ok)throw new Error(data?.error||'Não foi possível enviar o arquivo.');
      setFiles(v=>[...v,{id:crypto.randomUUID(),name:file.name,path:data.path,mime:file.type,pages,paperId:papers[0]?.id||'',color:hasColor?'bw':'bw',duplex:false,copies:1,serviceIds:[]}]);
    }}catch(e){toast.error('Não foi possível adicionar o arquivo',e instanceof Error?e.message:undefined);}finally{setBusy(false);}
  }
  const update=(id:string,patch:Partial<FileCfg>)=>setFiles(v=>v.map(f=>f.id===id?{...f,...patch}:f));
  function chooseFinish(f:FileCfg,id:string){update(f.id,{serviceIds:[...f.serviceIds.filter(x=>!finishing.some(s=>s.id===x)),id]});}
  function clearFinish(f:FileCfg){update(f.id,{serviceIds:f.serviceIds.filter(x=>!finishing.some(s=>s.id===x))});}
  function toggleOther(f:FileCfg,id:string){update(f.id,{serviceIds:f.serviceIds.includes(id)?f.serviceIds.filter(x=>x!==id):[...f.serviceIds,id]});}
  function applicableBinding(f:FileCfg){const sheets=calcSheets(f);return binding.find(s=>(s.min_sheets==null||s.min_sheets<=sheets)&&(s.max_sheets==null||s.max_sheets>=sheets));}
  function selectedFinish(f:FileCfg){return f.serviceIds.map(id=>services.find(s=>s.id===id)).find(Boolean) as Service|undefined;}

  async function finish(){
    if(!files.length)return;
    for(const f of files){
      if(!f.paperId)return toast.error('Escolha o papel',f.name);
      const c=calcFile(f,tiers,services); if(!c.tier)return toast.error('Não conseguimos calcular o preço',`Não há preço cadastrado para ${c.sheets} folhas em ${papers.find(p=>p.id===f.paperId)?.name||'este papel'}.`);
      const selected=selectedFinish(f);
      if(selected&&selected.service_group==='binding'&&!((selected.min_sheets==null||selected.min_sheets<=c.sheets)&&(selected.max_sheets==null||selected.max_sheets>=c.sheets)))return toast.error('Encadernação inválida',`A opção escolhida não atende ${c.sheets} folhas.`);
    }
    const normalizedFiles=files.map(f=>({original_name:f.name,storage_path:f.path,mime_type:f.mime,pages:f.pages,copies:f.copies,paper_type_id:f.paperId,color_mode:f.color,duplex:f.duplex,services:f.serviceIds.map(service_id=>({service_id,selected_pages:Array.from({length:f.pages},(_,i)=>i+1)})),metadata:{}}));
    addPrint({name:'Impressão ('+files.length+' arquivo'+(files.length>1?'s':'')+')',price:total,quantity:1,stock:1,metadata:{files:normalizedFiles,metadata:{created_at:new Date().toISOString()}}});
    toast.success('Impressão adicionada ao carrinho','Agora é só conferir o pedido e finalizar.');
  }

  return <main className="print-page"><SiteHeader subtitle="CENTRAL DE IMPRESSÃO"/><section className="print-shell">
    <Link href="/loja" className="back"><ArrowLeft size={16}/> Voltar para a loja</Link>
    <header className="hero"><div><p>CENTRAL DE IMPRESSÃO</p><h1>Envie seu arquivo.<br/>A gente calcula o resto.</h1><span>Você só precisa escolher o que quer. As regras de quantidade e acabamento são feitas automaticamente.</span></div><div className="mark"><Printer size={27}/></div></header>

    <section className="upload-box" onClick={()=>input.current?.click()}><div className="upload-icon"><Upload size={28}/></div><strong>{busy?'Enviando arquivo...':'1. Envie seu arquivo'}</strong><span>PDF, JPG, PNG ou WEBP · até 20 MB por arquivo</span><button type="button">{busy?'Aguarde...':'Escolher arquivo'}</button><input ref={input} type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>{void upload(e.target.files);e.currentTarget.value='';}}/></section>

    {files.length>0&&<div className="tip"><span>✓</span><div><b>Você não precisa entender as regras.</b><small>Escolha as opções abaixo e o sistema calcula a quantidade de folhas, o preço e o acabamento correto.</small></div></div>}

    <div className="files">{files.map((f,index)=>{const c=calcFile(f,tiers,services);const finish=selectedFinish(f);const applicable=applicableBinding(f);const finishMode=finish?.service_group;const paper=papers.find(p=>p.id===f.paperId);
      return <section className="file-card" key={f.id}>
        <div className="file-head"><div className="file-icon">{f.mime==='application/pdf'?<FileText/>:<ImageIcon/>}</div><div><span>ARQUIVO {index+1}</span><strong>{f.name}</strong><small>{f.pages} {f.pages===1?'página':'páginas'} · {c.sheets} {c.sheets===1?'folha física':'folhas físicas'}</small></div><button className="remove" onClick={()=>setFiles(v=>v.filter(x=>x.id!==f.id))} aria-label="Remover arquivo"><X/></button></div>

        <div className="block"><h2>Como você quer imprimir?</h2>
          <div className="choices two">
            <button className={f.color==='bw'?'choice active':'choice'} onClick={()=>update(f.id,{color:'bw'})}><b>Preto e branco</b><small>Mais comum para documentos</small>{f.color==='bw'&&<Check/>}</button>
            {hasColor&&<button className={f.color==='color'?'choice active':'choice'} onClick={()=>update(f.id,{color:'color'})}><b>Colorido</b><small>Impressão em cores</small>{f.color==='color'&&<Check/>}</button>}
          </div>
        </div>

        <div className="block"><h2>Frente ou frente e verso?</h2><div className="choices two">
          <button className={!f.duplex?'choice active':'choice'} onClick={()=>update(f.id,{duplex:false})}><b>Somente frente</b><small>1 página = 1 folha</small>{!f.duplex&&<Check/>}</button>
          <button className={f.duplex?'choice active':'choice'} onClick={()=>update(f.id,{duplex:true})}><b>Frente e verso</b><small>2 páginas = 1 folha</small>{f.duplex&&<Check/>}</button>
        </div></div>

        {papers.length>1?<div className="block"><h2>Qual papel você quer?</h2><div className="choices paper-choices">{papers.map(p=><button key={p.id} className={f.paperId===p.id?'choice active':'choice'} onClick={()=>update(f.id,{paperId:p.id})}><b>{p.name}</b><small>{p.size}</small>{f.paperId===p.id&&<Check/>}</button>)}</div></div>:<div className="paper-fixed"><b>Papel</b><span>{paper?.name||'Papel padrão'}{paper?.size?' · '+paper.size:''}</span></div>}

        <div className="block copies-block"><h2>Quantas cópias?</h2><div className="qty"><button onClick={()=>update(f.id,{copies:Math.max(1,f.copies-1)})} aria-label="Diminuir cópias"><Minus/></button><strong>{f.copies}</strong><button onClick={()=>update(f.id,{copies:f.copies+1})} aria-label="Aumentar cópias"><Plus/></button></div><small>{f.copies===1?'Uma cópia':'Você receberá '+f.copies+' cópias'}</small></div>

        {finishing.length>0&&<div className="block finish-block"><div className="block-title"><div><h2>Quer algum acabamento?</h2><small>Você pode escolher <b>um</b> acabamento. Não precisa escolher a faixa de folhas.</small></div></div>
          <div className="choices finish-types">
            <button className={!finish?'choice active':'choice'} onClick={()=>clearFinish(f)}><b>Nenhum</b><small>Somente a impressão</small>{!finish&&<Check/>}</button>
            {lamination.length>0&&<button className={finishMode==='lamination'?'choice active':'choice'} onClick={()=>chooseFinish(f,lamination[0].id)}><b>Plastificar</b><small>Escolha o tipo abaixo</small>{finishMode==='lamination'&&<Check/>}</button>}
            {binding.length>0&&<button className={finishMode==='binding'?'choice active':'choice'} onClick={()=>{if(applicable)chooseFinish(f,applicable.id);}} disabled={!applicable}><b>Encadernar</b><small>{applicable?serviceRange(applicable):'Não disponível para esta quantidade'}</small>{finishMode==='binding'&&<Check/>}</button>}
          </div>

          {finishMode==='lamination'&&<div className="finish-options"><div className="finish-label">Qual plastificação?</div>{lamination.map(s=><button key={s.id} className={finish?.id===s.id?'finish-option active':'finish-option'} onClick={()=>chooseFinish(f,s.id)}><span><b>{s.name.replace(/^Plastificação\s*—\s*/i,'')}</b><small>{s.description||'Serviço de plastificação'}</small></span><strong>{money(s.price)}{s.charge_type==='per_sheet'?' / folha':' / unidade'}</strong>{finish?.id===s.id&&<Check/>}</button>)}</div>}

          {finishMode==='binding'&&<div className="auto-rule"><Check size={17}/><span><b>Encadernação escolhida automaticamente.</b> Para {c.sheets} {c.sheets===1?'folha':'folhas'}, a faixa aplicada é <strong>{applicable?.name.replace('Encadernação ','')}</strong> · {money(applicable?.price||0)}.</span></div>}
          {finishMode==='binding'&&!applicable&&<div className="auto-rule warning"><span>Para mais de 200 folhas, a encadernação online não está disponível. Você pode fazer somente a impressão ou falar conosco.</span></div>}
        </div>}

        {other.length>0&&<div className="extras"><button className="extras-toggle" onClick={()=>setOpenExtras(v=>({...v,[f.id]:!v[f.id]}))}><span>Outros serviços</span><ChevronDown className={openExtras[f.id]?'up':''}/></button>{openExtras[f.id]&&<div className="extra-list">{other.map(s=>{const on=f.serviceIds.includes(s.id);return <button key={s.id} className={on?'extra active':'extra'} onClick={()=>toggleOther(f,s.id)}><span><b>{s.name}</b><small>{s.description||'Serviço adicional'}</small></span><strong>{money(s.price)}</strong>{on&&<Check/>}</button>})}</div>}</div>}

        <div className="file-total"><div><span>Impressão</span><b>{money(c.base)}</b></div>{c.servicesTotal>0&&<div><span>Serviços</span><b>{money(c.servicesTotal)}</b></div>}<div className="main-total"><span>Total deste arquivo</span><strong>{money(c.total)}</strong></div></div>
      </section>})}</div>

    {files.length>0&&<aside className="summary"><div><span>SEU PEDIDO</span><b>{files.length} {files.length===1?'arquivo':'arquivos'} · {totalSheets} {totalSheets===1?'folha':'folhas'}</b></div><strong>{money(total)}</strong><button disabled={busy} onClick={()=>void finish()}>Adicionar ao carrinho</button></aside>}
  </section>
  <style jsx global>{`
    .print-page{min-height:100vh;background:#f5f5f2;color:#111;font-family:Inter,Arial,sans-serif}.print-shell{width:min(1040px,calc(100% - 24px));margin:auto;padding:24px 0 80px}.back{display:inline-flex;gap:7px;align-items:center;color:#666;text-decoration:none;font:800 12px Inter;margin-bottom:22px}
    .hero{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:20px}.hero p{margin:0 0 6px;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.18em}.hero h1{margin:0;font:italic 48px/1 'Barlow Condensed';text-transform:uppercase}.hero span{display:block;margin-top:9px;color:#6d6d68;font-size:13px;line-height:1.45;max-width:700px}.mark{width:58px;height:58px;border-radius:15px;background:#ffc400;display:grid;place-items:center;flex:none}
    .upload-box{border:2px dashed #cfcfca;background:#fff;border-radius:15px;padding:25px 18px;text-align:center;display:grid;place-items:center;gap:7px;cursor:pointer}.upload-icon{width:48px;height:48px;border-radius:13px;background:#fff1ae;display:grid;place-items:center}.upload-box strong{font-size:17px}.upload-box span{font-size:11px;color:#777}.upload-box button{border:0;background:#ffc400;border-radius:9px;padding:10px 17px;font:900 12px Inter;cursor:pointer}
    .tip{display:flex;gap:9px;align-items:flex-start;margin-top:12px;background:#111;color:#fff;border-radius:12px;padding:12px 14px}.tip>span{width:23px;height:23px;border-radius:50%;background:#ffc400;color:#111;display:grid;place-items:center;font-weight:900;flex:none}.tip div{display:grid;gap:3px}.tip b{font-size:12px}.tip small{color:#bbb;font-size:10px;line-height:1.4}
    .files{display:grid;gap:14px;margin-top:14px}.file-card{background:#fff;border:1px solid #dddcd7;border-radius:16px;padding:18px}.file-head{display:flex;align-items:center;gap:11px;padding-bottom:15px;border-bottom:1px solid #eee}.file-head>div:nth-child(2){display:grid;gap:3px;flex:1}.file-head span{font-size:9px;color:#9b7600;font-weight:900;letter-spacing:.12em}.file-head strong{font-size:15px;word-break:break-word}.file-head small{font-size:11px;color:#777}.file-icon{width:43px;height:43px;border-radius:10px;background:#fff1ae;display:grid;place-items:center}.remove{border:0;background:#f3f3f0;border-radius:8px;padding:7px;cursor:pointer}
    .block{padding-top:17px}.block h2{font-size:14px;margin:0 0 9px}.block h2+small{color:#777}.choices{display:grid;gap:8px}.choices.two{grid-template-columns:1fr 1fr}.choice{position:relative;border:1px solid #dcdad5;background:#fff;border-radius:11px;padding:13px 40px 13px 13px;text-align:left;min-height:62px;cursor:pointer}.choice.active{border:2px solid #ffc400;background:#fffbea}.choice:disabled{opacity:.5;cursor:not-allowed}.choice b{display:block;font-size:12px}.choice small{display:block;margin-top:3px;color:#777;font-size:10px;line-height:1.35}.choice svg{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#7a5b00}.paper-choices{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
    .paper-fixed{margin-top:17px;background:#f6f6f3;border-radius:10px;padding:11px 13px;display:flex;justify-content:space-between;gap:12px;align-items:center}.paper-fixed b{font-size:11px}.paper-fixed span{font-size:11px;color:#555}
    .copies-block{display:grid;grid-template-columns:1fr auto;gap:5px 15px;align-items:center}.copies-block h2{margin:0}.copies-block small{grid-column:1;color:#777;font-size:10px}.qty{height:46px;border:1px solid #d8d7d2;border-radius:10px;display:flex;align-items:center;overflow:hidden}.qty button{width:44px;height:100%;border:0;background:#f5f5f2;display:grid;place-items:center;cursor:pointer}.qty strong{min-width:42px;text-align:center;font-size:16px}
    .finish-block{border-top:1px solid #eee;margin-top:18px}.block-title{display:flex;justify-content:space-between;gap:10px}.block-title h2{margin:0}.block-title small{font-size:10px;color:#777}.finish-types{grid-template-columns:repeat(3,1fr)}.finish-options{margin-top:9px;padding:10px;background:#f7f7f4;border-radius:10px}.finish-label{font-size:9px;font-weight:900;color:#666;margin-bottom:7px;text-transform:uppercase;letter-spacing:.08em}.finish-option{width:100%;border:1px solid #ddd;background:#fff;border-radius:9px;padding:10px;text-align:left;display:flex;gap:8px;align-items:center;margin-top:6px;cursor:pointer}.finish-option.active{border:2px solid #ffc400;background:#fffbea}.finish-option span{display:grid;gap:2px;flex:1}.finish-option b{font-size:11px}.finish-option small{font-size:9px;color:#777}.finish-option strong{font-size:11px;white-space:nowrap}.auto-rule{margin-top:9px;display:flex;gap:8px;align-items:flex-start;padding:10px;background:#f6f6f3;border-radius:9px;color:#555;font-size:10px;line-height:1.4}.auto-rule svg{flex:none}.auto-rule.warning{background:#fff4dc;color:#765c00}
    .extras{border-top:1px solid #eee;margin-top:17px;padding-top:12px}.extras-toggle{width:100%;border:0;background:transparent;display:flex;justify-content:space-between;align-items:center;padding:5px 0;font:900 11px Inter;cursor:pointer}.extras-toggle svg{width:16px}.extras-toggle .up{transform:rotate(180deg)}.extra-list{display:grid;gap:6px;margin-top:7px}.extra{border:1px solid #ddd;background:#fff;border-radius:9px;padding:10px;text-align:left;display:flex;gap:8px;align-items:center;cursor:pointer}.extra.active{border-color:#ffc400;background:#fffbea}.extra span{display:grid;gap:2px;flex:1}.extra b{font-size:10px}.extra small{font-size:9px;color:#777}.extra strong{font-size:10px}
    .file-total{display:flex;align-items:flex-end;gap:18px;border-top:1px solid #eee;margin-top:16px;padding-top:13px}.file-total>div{display:grid;gap:3px}.file-total span{font-size:9px;color:#888}.file-total b{font-size:12px}.main-total{margin-left:auto;text-align:right}.main-total strong{font-size:21px}.summary{position:sticky;bottom:8px;margin-top:14px;background:#111;color:#fff;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:18px;box-shadow:0 7px 25px rgba(0,0,0,.16)}.summary>div{display:grid;gap:3px;flex:1}.summary span{font-size:8px;color:#aaa;letter-spacing:.08em}.summary b{font-size:12px}.summary>strong{font-size:21px}.summary button{border:0;background:#ffc400;color:#111;border-radius:9px;padding:12px 17px;font:900 11px Inter;cursor:pointer}.summary button:disabled{opacity:.5}
    @media(max-width:700px){.hero{align-items:flex-start}.hero h1{font-size:39px}.choices.two,.finish-types{grid-template-columns:1fr}.summary{flex-wrap:wrap}.summary button{width:100%}.file-total{display:grid;grid-template-columns:1fr 1fr}.main-total{margin-left:0;text-align:left;grid-column:1/-1}.paper-choices{grid-template-columns:1fr 1fr}}
    @media(max-width:430px){.print-shell{width:calc(100% - 16px)}.hero h1{font-size:34px}.hero span{font-size:12px}.paper-choices{grid-template-columns:1fr}.file-card{padding:14px}}
  `}</style></main>
}
