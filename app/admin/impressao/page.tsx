'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, Printer, RefreshCw, Search, Clock3, CheckCircle2, PackageCheck, Settings2 } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { useToast } from '@/components/ui/toast';

const money=(value:number)=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const STATUS=[{value:'pending',label:'Pendente'},{value:'confirmed',label:'Confirmado'},{value:'preparing',label:'Preparando'},{value:'ready',label:'Pronto'},{value:'out_for_delivery',label:'Saiu para entrega'},{value:'delivered',label:'Entregue'},{value:'completed',label:'Concluído'},{value:'cancelled',label:'Cancelado'}];
const statusLabel=(value:string)=>STATUS.find(x=>x.value===value)?.label||value;

export default function AdminPrintOrders(){
  const toast=useToast();
  const [jobs,setJobs]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [query,setQuery]=useState(''); const [filter,setFilter]=useState('all'); const [updating,setUpdating]=useState<string|null>(null);
  async function load(){setLoading(true);try{const response=await fetch('/api/admin/impressao/pedidos',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data?.error||'Não foi possível carregar os pedidos.');setJobs(data.jobs||[]);}catch(error){toast.error('Pedidos de impressão indisponíveis',error instanceof Error?error.message:undefined);}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  async function updateStatus(id:string,status:string){setUpdating(id);try{const response=await fetch('/api/admin/impressao/pedidos',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});const data=await response.json();if(!response.ok)throw new Error(data?.error||'Não foi possível atualizar o status.');setJobs(rows=>rows.map(row=>row.id===id?{...row,status}:row));toast.success('Status atualizado','O pedido principal também foi atualizado e o cliente será notificado por e-mail.');}catch(error){toast.error('Não foi possível atualizar',error instanceof Error?error.message:undefined);}finally{setUpdating(null);}}
  const counts=useMemo(()=>({
    all:jobs.length,
    pending:jobs.filter(job=>job.status==='pending').length,
    confirmed:jobs.filter(job=>job.status==='confirmed').length,
    preparing:jobs.filter(job=>job.status==='preparing').length,
    ready:jobs.filter(job=>job.status==='ready').length,
    out_for_delivery:jobs.filter(job=>job.status==='out_for_delivery').length,
    delivered:jobs.filter(job=>job.status==='delivered').length,
    completed:jobs.filter(job=>job.status==='completed').length,
    cancelled:jobs.filter(job=>job.status==='cancelled').length,
  }),[jobs]);
  const visible=useMemo(()=>{const term=query.trim().toLowerCase();return jobs.filter(job=>{if(filter!=='all'&&job.status!==filter)return false;if(!term)return true;const order=Array.isArray(job.orders)?job.orders[0]:job.orders;const files=(job.print_files||[]).map((f:any)=>f.original_name).join(' ');return [job.id,job.order_id,order?.customer_name,order?.customer_email,files].some(value=>String(value||'').toLowerCase().includes(term));});},[jobs,query,filter]);

  return <main className="print-admin"><SiteHeader variant="admin" subtitle="CENTRAL DE IMPRESSÃO"/><section className="print-admin-shell">
    <Link href="/admin" className="back"><ArrowLeft size={15}/> Painel</Link>
    <header className="head"><div><p>CENTRAL DE IMPRESSÃO</p><h1>Pedidos para produzir</h1><span>Aqui você recebe o arquivo, confere as configurações escolhidas pelo cliente, baixa e imprime.</span></div><button className="refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> Atualizar</button></header>
    <nav className="print-tabs" aria-label="Central de impressão">
      <Link href="/admin/impressao" className="tab active"><PackageCheck size={15}/> Pedidos <b>{counts.all}</b></Link>
      <Link href="/admin/impressao/configuracoes" className="tab"><Settings2 size={15}/> Configurações</Link>
    </nav>
    <div className="summary">
      <button className="summary-card received" onClick={()=>setFilter('pending')}><span><Clock3 size={17}/></span><div><small>Pendentes</small><strong>{counts.pending}</strong></div></button>
      <button className="summary-card printing" onClick={()=>setFilter('preparing')}><span><Printer size={17}/></span><div><small>Preparando</small><strong>{counts.preparing}</strong></div></button>
      <button className="summary-card ready" onClick={()=>setFilter('ready')}><span><CheckCircle2 size={17}/></span><div><small>Prontos</small><strong>{counts.ready}</strong></div></button>
      <button className="summary-card all" onClick={()=>setFilter('all')}><span><PackageCheck size={17}/></span><div><small>Total</small><strong>{counts.all}</strong></div></button>
    </div>
    <div className="filters"><label><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente, pedido ou arquivo..."/></label><div className="status-filters">
      <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todos <b>{counts.all}</b></button>
      <button className={filter==='pending'?'active':''} onClick={()=>setFilter('pending')}>Pendentes <b>{counts.pending}</b></button>
      <button className={filter==='preparing'?'active':''} onClick={()=>setFilter('preparing')}>Preparando <b>{counts.preparing}</b></button>
      <button className={filter==='ready'?'active':''} onClick={()=>setFilter('ready')}>Prontos <b>{counts.ready}</b></button>
    </div></div>
    {loading?<div className="empty">Carregando pedidos...</div>:visible.length===0?<div className="empty"><Printer size={25}/><b>Nenhum pedido de impressão encontrado.</b><span>Quando um cliente finalizar uma impressão, ela aparecerá aqui.</span></div>:<div className="jobs">{visible.map(job=>{const order=Array.isArray(job.orders)?job.orders[0]:job.orders;return <article className="job" key={job.id}>
      <div className="job-head"><div><span className="eyebrow">PEDIDO DE IMPRESSÃO</span><h2>#{String(job.order_id||job.id).slice(0,8).toUpperCase()}</h2><small>{new Date(job.created_at).toLocaleString('pt-BR')}</small></div><div className="status-wrap"><span className={'status '+job.status}>{statusLabel(job.status)}</span><select disabled={updating===job.id} value={job.status} onChange={e=>void updateStatus(job.id,e.target.value)}>{STATUS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></div></div>
      <div className="customer"><div><span>CLIENTE</span><strong>{order?.customer_name||'Cliente'}</strong><small>{order?.customer_phone||''}{order?.customer_email?' · '+order.customer_email:''}</small></div><div><span>VALOR</span><strong>{money(job.subtotal)}</strong><small>{order?.payment_status||'Pagamento pendente'}</small></div></div>
      {order?.notes&&<div className="notes"><b>Observações do pedido</b><span>{order.notes}</span></div>}
      <div className="files"><div className="files-title"><FileText size={17}/><b>Arquivos e configurações</b></div>{(job.print_files||[]).map((file:any)=><div className="file" key={file.id}><div className="file-main"><div className="file-icon"><FileText size={18}/></div><div><strong>{file.original_name}</strong><span>{file.pages} páginas · {file.sheets} folhas · {file.copies} cópia(s) · {file.color_mode==='color'?'Colorido':'Preto e branco'} · {file.duplex?'Frente e verso':'Somente frente'} · {file.print_paper_types?.name||'Papel'}</span></div></div><a href={'/api/admin/impressao/download?path='+encodeURIComponent(file.storage_path)} target="_blank" rel="noreferrer"><Download size={15}/> Baixar arquivo</a></div>)}</div>
    </article>})}</div>}
  </section><style jsx global>{`
    .print-admin{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}
    .print-admin-shell{width:min(1180px,calc(100% - 40px));margin:auto;padding:38px 0 70px}
    .back{display:inline-flex;align-items:center;gap:7px;color:#666;text-decoration:none;font-size:11px;font-weight:800;margin-bottom:24px}
    .back:hover{color:#111}
    .head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:20px}
    .head p{margin:0 0 8px;color:#a07800;font-size:10px;font-weight:900;letter-spacing:.22em}
    .head h1{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:64px;line-height:.86;font-style:italic;text-transform:uppercase;letter-spacing:-.02em}
    .head span{display:block;color:#777;font-size:13px;margin-top:12px;max-width:650px;line-height:1.5}
    .refresh{height:48px;padding:0 15px;border:1px solid #111;border-radius:11px;background:#111;color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:800 11px Inter,Arial,sans-serif;cursor:pointer;transition:transform .18s,background .18s}
    .refresh:hover:not(:disabled){background:#ffc400;color:#111;transform:translateY(-1px)}
    .refresh:disabled{opacity:.6;cursor:wait}
    .print-tabs{display:flex;gap:4px;padding:4px;background:#ebeae5;border:1px solid #deddd7;border-radius:12px;margin:0 0 18px}
    .tab{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 15px;border-radius:9px;color:#666;text-decoration:none;font:900 10px Inter;flex:1;transition:background .18s,color .18s,transform .18s}
    .tab:hover{color:#111;background:#f7f7f4}
    .tab.active{background:#111;color:#fff}
    .tab b{background:#ffc400;color:#111;border-radius:999px;padding:3px 7px;font-size:8px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 24px}
    .summary-card{min-height:92px;border:1px solid #e2e2de;background:#fff;border-radius:16px;padding:18px;display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.025);transition:transform .18s,box-shadow .18s,border-color .18s}
    .summary-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.07);border-color:#d1d1cb}
    .summary-card:focus-visible{outline:2px solid #ffc400;outline-offset:2px}
    .summary-card>span{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;flex:none}
    .summary-card div{display:grid;gap:3px}
    .summary-card small{font:800 10px Inter;color:#777}
    .summary-card strong{font:900 27px 'Barlow Condensed',sans-serif;line-height:1}
    .summary-card.received>span{background:#fff1c7;color:#8d6900}
    .summary-card.printing>span{background:#e9f1ff;color:#42618e}
    .summary-card.ready>span{background:#e7f6eb;color:#347044}
    .summary-card.all>span{background:#f0f0ed;color:#555}
    .filters{display:flex;gap:12px;margin-bottom:14px}
    .filters label{flex:1;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #ddd;border-radius:11px;padding:0 13px;box-shadow:0 3px 12px rgba(0,0,0,.02)}
    .filters label:focus-within{border-color:#b99a32;box-shadow:0 0 0 3px rgba(255,196,0,.12)}
    .filters input{width:100%;height:46px;border:0;outline:0;font:12px Inter}
    .status-filters{display:flex;gap:5px;overflow:auto;padding-bottom:1px}
    .status-filters button{border:1px solid #ddd;background:#fff;border-radius:10px;padding:0 13px;height:46px;white-space:nowrap;font:800 10px Inter;color:#666;cursor:pointer;transition:background .18s,color .18s,transform .18s}
    .status-filters button:hover{border-color:#bbb;color:#111}
    .status-filters button.active{background:#111;color:#fff;border-color:#111}
    .status-filters button:active{transform:scale(.98)}
    .status-filters b{margin-left:4px;opacity:.7}
    .jobs{display:grid;gap:12px}
    .job{background:#fff;border:1px solid #e1e1dc;border-radius:16px;padding:20px;box-shadow:0 4px 16px rgba(0,0,0,.025);transition:box-shadow .18s,border-color .18s}
    .job:hover{border-color:#d1d1cb;box-shadow:0 10px 28px rgba(0,0,0,.06)}
    .job-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
    .eyebrow,.customer span{display:block;color:#a07800;font-size:9px;font-weight:900;letter-spacing:.14em}
    .job h2{margin:6px 0 4px;font:700 29px/1 'Barlow Condensed',sans-serif}
    .job-head small{color:#888;font-size:10px}
    .status-wrap{width:220px;display:grid;gap:7px;flex:none}
    .status{display:inline-flex;align-items:center;justify-content:center;padding:8px 10px;border-radius:999px;background:#f3f3f0;font-size:10px;font-weight:800}
    .status.received{background:#fff5cc}.status.printing{background:#e9f1ff}.status.ready{background:#e3f6e9}.status.completed{background:#e9e9e6}.status.cancelled{background:#ffe7e7;color:#a22}
    .status-wrap select{height:42px;border:1px solid #ddd;border-radius:10px;background:#fff;padding:0 10px;font:800 10px Inter;cursor:pointer}
    .customer{display:grid;grid-template-columns:1.5fr 1fr;gap:24px;margin-top:17px;padding:15px;background:#f8f8f5;border-radius:11px}
    .customer div{display:grid;gap:4px}.customer strong{font-size:13px}.customer small{color:#777;font-size:10px}
    .notes{display:grid;gap:4px;padding:14px 0;border-bottom:1px solid #eee}.notes b{font-size:10px}.notes span{font-size:10px;color:#666;white-space:pre-wrap;line-height:1.5}
    .files{margin-top:15px}.files-title{display:flex;align-items:center;gap:7px;font-size:11px;margin-bottom:9px}
    .file{display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid #eee;border-radius:11px;padding:12px;transition:border-color .18s,background .18s}
    .file:hover{border-color:#ddd;background:#fdfdfb}
    .file-main{display:flex;align-items:center;gap:10px;min-width:0}.file-icon{width:36px;height:36px;background:#fff1c7;border-radius:9px;display:grid;place-items:center;flex:none}
    .file-main>div:last-child{display:grid;gap:4px;min-width:0}.file-main strong{font-size:11px;overflow-wrap:anywhere}.file-main span{font-size:9px;color:#777;line-height:1.5}
    .file a{display:flex;align-items:center;justify-content:center;gap:6px;background:#ffc400;color:#111;text-decoration:none;border-radius:9px;padding:10px 13px;font:900 9px Inter;white-space:nowrap;transition:background .18s,transform .18s}
    .file a:hover{background:#111;color:#fff;transform:translateY(-1px)}
    .empty{min-height:240px;background:#fff;border:1px dashed #d5d5d0;border-radius:16px;padding:50px 20px;text-align:center;display:grid;justify-items:center;align-content:center;gap:8px;color:#777}.empty b{color:#111;font-size:13px}.empty span{font-size:10px}
    .spin{animation:print-spin .8s linear infinite}@keyframes print-spin{to{transform:rotate(360deg)}}
    @media(max-width:900px){.print-admin-shell{width:min(100% - 28px,760px)}.summary{grid-template-columns:1fr 1fr}.head{align-items:flex-start;flex-direction:column}.head h1{font-size:52px}.refresh{width:100%}.filters{flex-direction:column}.status-filters{width:100%}.status-filters button{flex:1}.job-head{flex-direction:column}.status-wrap{width:100%}.customer{grid-template-columns:1fr}}
    @media(max-width:560px){.print-admin-shell{padding:28px 0 50px}.head h1{font-size:46px}.summary{gap:8px}.summary-card{min-height:84px;padding:13px}.summary-card strong{font-size:24px}.summary-card>span{width:34px;height:34px}.print-tabs{position:sticky;top:8px;z-index:5}.tab{padding:12px 8px}.filters{gap:8px}.status-filters button{flex:0 0 auto}.job{padding:16px}.customer{padding:13px}.file{align-items:flex-start;flex-direction:column}.file a{width:100%}}
    `}</style></main>;
}
