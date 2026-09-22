'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ImageDown, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';

type ImageFile = {
  bucket: 'products' | 'home-banners';
  path: string;
  size: number;
};

type ResultItem = ImageFile & {
  status: 'optimized' | 'skipped' | 'error';
  oldSize: number;
  newSize: number;
  message?: string;
};

const BUCKETS: ImageFile['bucket'][] = ['products', 'home-banners'];
const IMAGE_TYPES = /^(image\/(jpeg|png|webp))$/i;

async function listImages(bucket: ImageFile['bucket'], prefix = ''): Promise<ImageFile[]> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(`${bucket}: ${error.message}`);

  const files: ImageFile[] = [];
  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      files.push(...await listImages(bucket, path));
      continue;
    }
    const type = String(item.metadata?.mimetype || '');
    if (!IMAGE_TYPES.test(type)) continue;
    files.push({
      bucket,
      path,
      size: Number(item.metadata?.size || 0),
    });
  }
  return files;
}

async function optimizeFile(file: ImageFile): Promise<ResultItem> {
  const base = { ...file, oldSize: file.size, newSize: file.size };
  const { data, error } = await supabase.storage.from(file.bucket).download(file.path);
  if (error || !data) {
    return { ...base, status: 'error', message: error?.message || 'Não foi possível baixar a imagem.' };
  }

  try {
    const bitmap = await createImageBitmap(data);
    const maxDimension = file.bucket === 'home-banners' ? 1920 : 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return { ...base, status: 'error', message: 'O navegador não disponibilizou o canvas.' };
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', file.bucket === 'home-banners' ? 0.84 : 0.82);
    });

    if (!blob) return { ...base, status: 'error', message: 'Não foi possível gerar a versão otimizada.' };

    // Só substitui quando há ganho real. A URL/caminho do arquivo permanece exatamente igual.
    if (blob.size >= file.size * 0.95) {
      return { ...base, status: 'skipped', newSize: file.size, message: 'Já está suficientemente pequeno.' };
    }

    const { error: uploadError } = await supabase.storage.from(file.bucket).update(file.path, blob, {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: false,
    });

    if (uploadError) {
      return { ...base, status: 'error', message: uploadError.message };
    }

    return { ...base, status: 'optimized', newSize: blob.size };
  } catch (error) {
    return {
      ...base,
      status: 'error',
      message: error instanceof Error ? error.message : 'Falha ao processar a imagem.',
    };
  }
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function ImageOptimizationPage() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState('');
  const [error, setError] = useState('');
  const stopRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        window.location.href = '/admin/login';
        return;
      }
      setAllowed(true);
      setChecking(false);
    }).catch(() => {
      if (mounted) {
        setError('Não foi possível validar o acesso administrativo.');
        setChecking(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    const oldSize = results.reduce((sum, item) => sum + item.oldSize, 0);
    const newSize = results.reduce((sum, item) => sum + item.newSize, 0);
    const saved = Math.max(0, oldSize - newSize);
    return { oldSize, newSize, saved };
  }, [results]);

  async function scan() {
    setLoadingFiles(true);
    setError('');
    setResults([]);
    try {
      const found = (await Promise.all(BUCKETS.map((bucket) => listImages(bucket)))).flat();
      setFiles(found);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Não foi possível listar as imagens.');
    } finally {
      setLoadingFiles(false);
    }
  }

  async function run() {
    if (!files.length || running) return;
    stopRef.current = false;
    setRunning(true);
    setError('');
    setResults([]);

    for (const file of files) {
      if (stopRef.current) break;
      setCurrent(`${file.bucket}/${file.path}`);
      const result = await optimizeFile(file);
      setResults((currentResults) => [...currentResults, result]);
    }

    setCurrent('');
    setRunning(false);
    await scan();
  }

  function stop() {
    stopRef.current = true;
  }

  if (checking) {
    return <main className="image-optimization-page"><SiteHeader variant="admin" subtitle="OTIMIZAÇÃO DE IMAGENS" /><div className="optimization-card">Verificando acesso…</div></main>;
  }

  if (!allowed) {
    return <main className="image-optimization-page"><SiteHeader variant="admin" subtitle="OTIMIZAÇÃO DE IMAGENS" /><div className="optimization-card"><ShieldAlert size={30} /><h1>Acesso restrito</h1><p>Entre no Admin para continuar.</p><Link href="/admin/login" className="optimization-primary">Entrar</Link></div></main>;
  }

  return (
    <main className="image-optimization-page">
      <SiteHeader variant="admin" subtitle="OTIMIZAÇÃO DE IMAGENS" />
      <section className="optimization-container">
        <Link href="/admin/configuracoes" className="optimization-back"><ArrowLeft size={16} /> Voltar para configurações</Link>

        <div className="optimization-heading">
          <div>
            <span className="optimization-eyebrow">STORAGE • 2P BOX</span>
            <h1>Otimização de imagens</h1>
            <p>Reduza imagens antigas do Storage sem alterar os caminhos usados pelo site.</p>
          </div>
          <ImageDown size={42} />
        </div>

        <div className="optimization-warning">
          <ShieldAlert size={18} />
          <div><strong>Operação segura:</strong> cada imagem é processada uma por vez e só é substituída se a nova versão ficar pelo menos 5% menor. O caminho/URL permanece o mesmo.</div>
        </div>

        <div className="optimization-actions">
          <button type="button" className="optimization-secondary" onClick={scan} disabled={loadingFiles || running}>
            {loadingFiles ? <Loader2 className="spin" size={17} /> : null}
            {loadingFiles ? 'Lendo Storage…' : 'Verificar imagens'}
          </button>
          <button type="button" className="optimization-primary" onClick={run} disabled={!files.length || running || loadingFiles}>
            {running ? <Loader2 className="spin" size={17} /> : <ImageDown size={17} />}
            {running ? 'Otimizando…' : `Otimizar ${files.length ? `${files.length} imagens` : 'imagens'}`}
          </button>
          {running && <button type="button" className="optimization-stop" onClick={stop}>Parar após a imagem atual</button>}
        </div>

        {error && <div className="optimization-error"><XCircle size={18} /> {error}</div>}

        {files.length > 0 && (
          <div className="optimization-progress">
            <div><strong>{results.length}</strong> de <strong>{files.length}</strong> processadas {current ? <span>• {current}</span> : null}</div>
            <div className="optimization-bar"><span style={{ width: `${Math.min(100, (results.length / files.length) * 100)}%` }} /></div>
          </div>
        )}

        {results.length > 0 && (
          <div className="optimization-summary">
            <div><strong>{results.filter((item) => item.status === 'optimized').length}</strong><span>otimizadas</span></div>
            <div><strong>{results.filter((item) => item.status === 'skipped').length}</strong><span>mantidas</span></div>
            <div><strong>{results.filter((item) => item.status === 'error').length}</strong><span>erros</span></div>
            <div><strong>{formatBytes(totals.saved)}</strong><span>economizados</span></div>
          </div>
        )}

        <div className="optimization-list">
          {results.slice(-12).reverse().map((item) => (
            <div className="optimization-row" key={`${item.bucket}/${item.path}`}>
              {item.status === 'optimized' ? <CheckCircle2 size={17} /> : item.status === 'error' ? <XCircle size={17} /> : <span className="optimization-dot" />}
              <div className="optimization-row-name">{item.bucket}/{item.path}</div>
              <div>{formatBytes(item.oldSize)} → {formatBytes(item.newSize)}</div>
              {item.message && <small>{item.message}</small>}
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .image-optimization-page{min-height:100vh;background:#f7f7f3;color:#111}
        .optimization-container{width:min(100% - 32px,980px);margin:0 auto;padding:34px 0 70px}
        .optimization-back{display:inline-flex;align-items:center;gap:7px;color:#555;text-decoration:none;font:700 12px Inter,Arial,sans-serif;margin-bottom:28px}
        .optimization-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:22px}
        .optimization-heading h1{margin:7px 0 8px;font:900 46px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:-.02em}
        .optimization-heading p{margin:0;color:#666;font:400 14px/1.6 Inter,Arial,sans-serif}
        .optimization-heading>svg{color:#d9ae00;background:#fff2a8;border-radius:14px;padding:12px;width:50px;height:50px}
        .optimization-eyebrow{font:900 10px Inter,Arial,sans-serif;letter-spacing:.15em;color:#9b7d00}
        .optimization-warning{display:flex;gap:10px;padding:15px 16px;background:#fff8d6;border:1px solid #edd36b;border-radius:12px;color:#5f5100;font:500 12px/1.5 Inter,Arial,sans-serif}
        .optimization-warning svg{flex:none;margin-top:1px}
        .optimization-actions{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}
        .optimization-primary,.optimization-secondary,.optimization-stop{min-height:44px;padding:0 17px;border-radius:10px;border:1px solid #111;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:800 12px Inter,Arial,sans-serif;cursor:pointer;text-decoration:none}
        .optimization-primary{background:#111;color:#fff}
        .optimization-secondary{background:#fff;color:#111;border-color:#ddd}
        .optimization-stop{background:#fff;color:#a22;border-color:#e4bcbc}
        button:disabled{opacity:.5;cursor:not-allowed}
        .optimization-error{display:flex;gap:9px;align-items:center;padding:13px 15px;border:1px solid #edc3c3;background:#fff1f1;color:#9a2424;border-radius:10px;font:600 12px Inter,Arial,sans-serif}
        .optimization-progress{background:#fff;border:1px solid #e5e5df;border-radius:14px;padding:17px;margin:18px 0}
        .optimization-progress>div:first-child{font:700 12px Inter,Arial,sans-serif;color:#555}
        .optimization-progress span{font-weight:500;color:#888;overflow-wrap:anywhere}
        .optimization-bar{height:7px;background:#ecece7;border-radius:999px;overflow:hidden;margin-top:12px}
        .optimization-bar span{display:block;height:100%;background:#e4bd00;border-radius:999px;transition:width .2s}
        .optimization-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
        .optimization-summary>div{background:#fff;border:1px solid #e5e5df;border-radius:12px;padding:15px}
        .optimization-summary strong{display:block;font:900 22px Inter,Arial,sans-serif}
        .optimization-summary span{display:block;color:#777;font:600 10px Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;margin-top:3px}
        .optimization-list{display:grid;gap:7px}
        .optimization-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;background:#fff;border:1px solid #e8e8e3;border-radius:10px;padding:11px 13px;font:600 11px Inter,Arial,sans-serif}
        .optimization-row>svg:first-child{color:#2b8a4a}
        .optimization-row:has(>svg:first-child:last-child){color:#a22}
        .optimization-row-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .optimization-row small{grid-column:2/-1;color:#888}
        .optimization-dot{width:9px;height:9px;border-radius:50%;background:#aaa}
        .spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .optimization-card{width:min(100% - 32px,520px);margin:60px auto;background:#fff;border:1px solid #e5e5df;border-radius:18px;padding:32px;text-align:center}
        .optimization-card h1{font:900 30px Barlow Condensed,Inter,sans-serif;text-transform:uppercase}
        .optimization-card p{color:#777;font:13px Inter,Arial,sans-serif}
        .optimization-card svg{color:#a52626}
        .optimization-card .optimization-primary{margin-top:10px}
        @media(max-width:620px){
          .optimization-container{width:min(100% - 24px,980px);padding-top:24px}
          .optimization-heading h1{font-size:36px}
          .optimization-heading>svg{width:44px;height:44px}
          .optimization-summary{grid-template-columns:repeat(2,1fr)}
          .optimization-row{grid-template-columns:auto 1fr}
          .optimization-row>div:nth-child(3){grid-column:2}
          .optimization-row small{grid-column:2}
          .optimization-actions>*{width:100%}
        }
      `}</style>
    </main>
  );
}
