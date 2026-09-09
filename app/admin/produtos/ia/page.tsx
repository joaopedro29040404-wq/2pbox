'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ImagePlus, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Product = { id: string; name: string; description: string | null; category_id: string | null; image_url: string | null; images: string[] | null };
type Category = { id: string; name: string };
type Copy = { title: string; shortDescription: string; description: string; features: string[] };

export default function AiProductStudio() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productId, setProductId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState('');
  const [generatedPreview, setGeneratedPreview] = useState('');
  const [copy, setCopy] = useState<Copy>({ title: '', shortDescription: '', description: '', features: [] });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('products').select('id,name,description,category_id,image_url,images').order('name'),
        supabase.from('categories').select('id,name').eq('active', true).order('name'),
      ]);
      setProducts((p || []) as Product[]);
      setCategories((c || []) as Category[]);
    }
    load();
  }, []);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const categoryName = selected ? categories.find((c) => c.id === selected.category_id)?.name || '' : '';

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!next.type.startsWith('image/')) return setMessage('Escolha uma imagem JPG, PNG ou WEBP.');
    if (next.size > 10 * 1024 * 1024) return setMessage('A foto deve ter no máximo 10 MB.');
    setFile(next);
    setSourcePreview(URL.createObjectURL(next));
    setGeneratedPreview('');
    setCopy({ title: selected?.name || '', shortDescription: '', description: '', features: [] });
    setMessage('Foto pronta para a IA.');
  }

  async function generate() {
    if (!file) return setMessage('Envie uma foto do produto primeiro.');
    setBusy(true);
    setMessage('A IA está analisando o produto e criando a arte...');
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('productName', selected?.name || '');
      body.append('category', categoryName);
      const response = await fetch('/api/admin/ai-product', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao gerar o produto.');
      setGeneratedPreview(`data:image/png;base64,${data.imageBase64}`);
      setCopy(data.copy);
      setMessage('Pronto. Revise a arte e o texto antes de publicar.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o produto.');
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!supabase || !selected || !generatedPreview) return;
    setSaving(true);
    setMessage('Publicando imagem e conteúdo no produto...');
    try {
      const binary = atob(generatedPreview.split(',')[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });
      const path = `products/ai-${selected.id}-${Date.now()}.png`;
      const upload = await supabase.storage.from('products').upload(path, blob, { contentType: 'image/png', upsert: false });
      if (upload.error) throw upload.error;
      const { data: publicUrl } = supabase.storage.from('products').getPublicUrl(path);
      const images = [publicUrl.publicUrl, ...(selected.images || []).filter((url) => url !== publicUrl.publicUrl)];
      const description = copy.description || copy.shortDescription || selected.description || null;
      const update = await supabase.from('products').update({
        name: copy.title || selected.name,
        description,
        image_url: publicUrl.publicUrl,
        images,
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id);
      if (update.error) throw update.error;
      setMessage('Produto aprovado e atualizado na loja.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível publicar o produto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="ai-studio">
      <div className="studio-topbar">Painel administrativo <span>•</span> 2P Box <span>•</span> Estúdio IA</div>
      <header className="studio-header">
        <Link href="/admin/produtos" className="studio-brand"><img src="/logo.pnh.png" alt="2P Box" /><span><strong>2P BOX</strong><small>ESTÚDIO IA</small></span></Link>
        <Link href="/admin/produtos" className="back-link"><ArrowLeft size={16} /> Produtos</Link>
      </header>

      <section className="studio-container">
        <div className="studio-hero">
          <div><p className="eyebrow"><Sparkles size={15} /> CRIAÇÃO INTELIGENTE</p><h1>Produto com IA</h1><p>Envie uma foto simples. A IA cria uma apresentação profissional no padrão visual da 2P Box e prepara o conteúdo para revisão.</p></div>
        </div>

        <div className="studio-grid">
          <section className="studio-panel setup-panel">
            <div className="panel-heading"><span>01</span><div><strong>Escolha o produto</strong><small>Use um produto já cadastrado no catálogo.</small></div></div>
            <select value={productId} onChange={(e) => { setProductId(e.target.value); setGeneratedPreview(''); setMessage(''); }}>
              <option value="">Selecione um produto...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selected && <div className="selected-product"><div><span>Categoria</span><strong>{categoryName || 'Sem categoria'}</strong></div><div><span>Preço</span><strong>R$ {Number((selected as any).price || 0).toFixed(2).replace('.', ',')}</strong></div></div>}

            <div className="panel-heading second"><span>02</span><div><strong>Envie a foto</strong><small>Uma foto simples do produto já é suficiente.</small></div></div>
            <label className="upload-area">
              {sourcePreview ? <img src={sourcePreview} alt="Foto original" /> : <><ImagePlus size={34} /><strong>Escolher foto</strong><small>JPG, PNG ou WEBP · até 10 MB</small></>}
              <input type="file" accept="image/*" hidden onChange={chooseFile} />
            </label>
            {file && <button className="replace-btn" type="button" onClick={() => document.querySelector<HTMLInputElement>('.upload-area input')?.click()}><Upload size={15} /> Trocar foto</button>}
            <button className="generate-btn" disabled={busy || !file} onClick={generate}>{busy ? <><Loader2 size={18} className="spin" /> Criando...</> : <><Sparkles size={18} /> Criar com IA</>}</button>
          </section>

          <section className="studio-panel result-panel">
            <div className="panel-heading"><span>03</span><div><strong>Resultado para revisão</strong><small>Nada é publicado antes da sua aprovação.</small></div></div>
            <div className="preview-grid">
              <div className="preview-box"><div className="preview-label">ORIGINAL</div>{sourcePreview ? <img src={sourcePreview} alt="Original" /> : <div className="empty-preview"><ImagePlus size={28} /><span>Sua foto aparecerá aqui</span></div>}</div>
              <div className="preview-box featured"><div className="preview-label">2P BOX · IA</div>{generatedPreview ? <img src={generatedPreview} alt="Arte criada pela IA" /> : <div className="empty-preview"><Sparkles size={30} /><span>A arte profissional aparecerá aqui</span></div>}</div>
            </div>

            <div className="copy-review">
              <div className="review-title"><span>CONTEÚDO GERADO</span>{generatedPreview && <span className="ready"><Check size={13} /> Pronto para revisar</span>}</div>
              <label>Título<input value={copy.title} onChange={(e) => setCopy({ ...copy, title: e.target.value })} placeholder="Título comercial" /></label>
              <label>Descrição curta<input value={copy.shortDescription} onChange={(e) => setCopy({ ...copy, shortDescription: e.target.value })} placeholder="Resumo do produto" /></label>
              <label>Descrição completa<textarea value={copy.description} onChange={(e) => setCopy({ ...copy, description: e.target.value })} placeholder="A descrição aparecerá aqui depois da geração." /></label>
              {!!copy.features.length && <div className="features"><strong>Características</strong><div>{copy.features.map((feature, index) => <span key={`${feature}-${index}`}>• {feature}</span>)}</div></div>}
            </div>

            {message && <div className="studio-message">{message}</div>}
            <div className="approval"><button className="approve-btn" disabled={saving || !generatedPreview || !selected} onClick={approve}>{saving ? <><Loader2 size={18} className="spin" /> Publicando...</> : <><Check size={18} /> Aprovar e publicar</>}</button><span>A imagem e o texto só entram no catálogo depois desta aprovação.</span></div>
          </section>
        </div>
      </section>

      <style jsx global>{`
        .ai-studio{min-height:100vh;background:#f7f7f4;color:#111}.studio-topbar{height:32px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;gap:9px;font-size:11px}.studio-header{height:78px;background:#fff;border-bottom:1px solid #e8e8e4;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100% - 1180px)/2))}.studio-brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:#111}.studio-brand img{width:54px;height:54px;object-fit:contain}.studio-brand span{display:grid;gap:2px}.studio-brand strong{font-size:15px;letter-spacing:.08em}.studio-brand small{font-size:9px;letter-spacing:.16em;color:#a87800;font-weight:800}.back-link{display:flex;align-items:center;gap:7px;text-decoration:none;color:#222;font-size:12px;font-weight:800}.studio-container{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:42px 0 70px}.studio-hero{margin-bottom:28px}.eyebrow{display:flex;align-items:center;gap:7px;color:#a87800;font-size:11px;font-weight:900;letter-spacing:.18em;margin:0 0 10px}.studio-hero h1{font-family:'Barlow Condensed',sans-serif;font-size:58px;line-height:.9;font-style:italic;text-transform:uppercase;margin:0 0 13px}.studio-hero p:not(.eyebrow){max-width:690px;color:#707070;font-size:15px;line-height:1.55;margin:0}.studio-grid{display:grid;grid-template-columns:390px 1fr;gap:20px;align-items:start}.studio-panel{background:#fff;border:1px solid #e3e3df;border-radius:18px;padding:22px;box-shadow:0 8px 30px rgba(0,0,0,.035)}.panel-heading{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}.panel-heading>span{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#ffc400;font-size:11px;font-weight:900;flex:none}.panel-heading div{display:grid;gap:3px}.panel-heading strong{font-size:14px}.panel-heading small{color:#888;font-size:11px;line-height:1.4}.panel-heading.second{margin-top:27px}.setup-panel select{width:100%;height:46px;border:1px solid #dededb;border-radius:10px;background:#fff;padding:0 12px;font:inherit;font-size:13px}.selected-product{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ecece8;border-radius:10px;margin-top:10px;overflow:hidden}.selected-product div{padding:10px 12px;display:grid;gap:4px}.selected-product div+div{border-left:1px solid #ecece8}.selected-product span{font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.1em}.selected-product strong{font-size:12px}.upload-area{height:260px;border:1.5px dashed #d5d5d0;border-radius:14px;background:#fbfbf8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;overflow:hidden;text-align:center}.upload-area svg{color:#b17d00}.upload-area strong{font-size:14px}.upload-area small{font-size:10px;color:#999}.upload-area img{width:100%;height:100%;object-fit:contain}.replace-btn{border:0;background:none;color:#666;font-size:11px;font-weight:700;display:flex;align-items:center;gap:6px;margin:9px auto 0;cursor:pointer}.generate-btn,.approve-btn{width:100%;border:0;border-radius:11px;height:48px;background:#ffc400;color:#111;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;margin-top:17px}.generate-btn:disabled,.approve-btn:disabled{opacity:.45;cursor:not-allowed}.preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.preview-box{border:1px solid #e7e7e3;border-radius:13px;overflow:hidden;background:#fafaf7;min-height:270px;position:relative}.preview-box img{display:block;width:100%;aspect-ratio:1;object-fit:cover}.preview-label{position:absolute;top:9px;left:9px;z-index:2;background:rgba(255,255,255,.9);padding:6px 8px;border-radius:7px;font-size:8px;font-weight:900;letter-spacing:.1em}.preview-box.featured{border-color:#e6c45b}.empty-preview{min-height:270px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#aaa;font-size:11px;text-align:center;padding:20px}.copy-review{border-top:1px solid #ecece8;margin-top:20px;padding-top:18px;display:grid;gap:12px}.review-title{display:flex;align-items:center;justify-content:space-between;font-size:9px;letter-spacing:.14em;font-weight:900;color:#a87800}.ready{display:flex;align-items:center;gap:4px;color:#18854b;letter-spacing:0}.copy-review label{display:grid;gap:5px;font-size:10px;font-weight:800;color:#555}.copy-review input,.copy-review textarea{width:100%;border:1px solid #dededb;border-radius:9px;padding:11px 12px;font:inherit;font-size:12px;outline:none;background:#fff}.copy-review textarea{min-height:90px;resize:vertical}.features{display:grid;gap:8px;font-size:11px}.features>div{display:flex;flex-wrap:wrap;gap:7px}.features span{padding:7px 9px;border-radius:8px;background:#faf3d8;color:#725400}.studio-message{margin-top:15px;padding:11px 13px;border-radius:9px;background:#f8f1d7;color:#665000;font-size:11px;line-height:1.4}.approval{border-top:1px solid #ecece8;margin-top:18px;padding-top:16px}.approval span{display:block;text-align:center;color:#999;font-size:9px;margin-top:8px}.approve-btn{margin-top:0;background:#111;color:#fff}.spin{animation:ai-spin .8s linear infinite}@keyframes ai-spin{to{transform:rotate(360deg)}}
        @media(max-width:850px){.studio-header{padding:0 18px}.studio-container{width:calc(100% - 28px);padding-top:28px}.studio-hero h1{font-size:48px}.studio-grid{grid-template-columns:1fr}.studio-panel{padding:18px}.preview-grid{grid-template-columns:1fr 1fr}.upload-area{height:220px}}
        @media(max-width:520px){.studio-topbar{font-size:9px}.studio-brand img{width:46px;height:46px}.studio-brand strong{font-size:13px}.studio-container{width:calc(100% - 20px)}.studio-hero h1{font-size:43px}.studio-hero p:not(.eyebrow){font-size:13px}.preview-box{min-height:170px}.empty-preview{min-height:170px}.preview-label{font-size:7px;padding:5px}.studio-panel{border-radius:14px;padding:15px}.upload-area{height:200px}}
      `}</style>
    </main>
  );
}
