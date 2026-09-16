'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

declare global {
  interface Window {
    Html5Qrcode?: new (elementId: string) => {
      start: (
        cameraConfig: { facingMode: string },
        config: { fps: number; qrbox: { width: number; height: number }; aspectRatio?: number },
        onSuccess: (decodedText: string) => void,
        onError?: (errorMessage: string) => void,
      ) => Promise<void>;
      stop: () => Promise<void>;
      clear: () => void;
    };
  }
}

const SCRIPT_SRC = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
const SCRIPT_INTEGRITY = 'sha512-r6rDA7W6ZeQhvl8S7yRVQUKVHdexq+GAlNkNNqVC7YyIV+NwqCTJe2hDWCiffTyRNOeGEzRRJ9ifvRm/HCzGYg==';

let scriptPromise: Promise<void> | null = null;

function loadScannerScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Scanner indisponível.'));
  if (window.Html5Qrcode) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-2pbox-ean-scanner]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o leitor de código de barras.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.integrity = SCRIPT_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.dataset['2pboxEanScanner'] = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o leitor de código de barras.'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function putBarcodeInSearch(barcode: string) {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Buscar produto"]');
  if (!input) return false;

  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, barcode);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.focus();
  return true;
}

export function MobileEanScanner() {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<InstanceType<NonNullable<typeof window.Html5Qrcode>> | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  async function stopScanner() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      // A câmera pode já ter sido encerrada pelo navegador.
    }
    try {
      scanner.clear();
    } catch {
      // O elemento pode já ter sido desmontado.
    }
  }

  async function close() {
    await stopScanner();
    setOpen(false);
    setStarting(false);
  }

  async function start() {
    if (!isMobile || open || starting) return;
    setOpen(true);
    setStarting(true);
    setError('');
    handledRef.current = false;

    try {
      await loadScannerScript();
      if (!window.Html5Qrcode) throw new Error('Leitor de código de barras indisponível.');

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const scanner = new window.Html5Qrcode('2pbox-ean-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 300, height: 150 },
          aspectRatio: 4 / 3,
        },
        async (decodedText) => {
          if (handledRef.current) return;
          const barcode = decodedText.replace(/\D/g, '');
          if (barcode.length < 8 || barcode.length > 14) return;

          handledRef.current = true;
          await stopScanner();
          setOpen(false);
          setStarting(false);
          const found = putBarcodeInSearch(barcode);
          if (!found) setError('Não encontrei o campo de busca. Recarregue a página e tente novamente.');
        },
        () => {
          // Falhas de leitura são esperadas enquanto a câmera procura o código.
        },
      );
      setStarting(false);
    } catch (scanError) {
      await stopScanner();
      setStarting(false);
      setError(scanError instanceof Error ? scanError.message : 'Não foi possível acessar a câmera.');
    }
  }

  useEffect(() => () => {
    void stopScanner();
  }, []);

  if (!isMobile) return null;

  return (
    <>
      <button type="button" className="mobile-ean-trigger" onClick={() => void start()} aria-label="Escanear EAN pela câmera">
        <Camera size={18} />
        <span>Escanear EAN</span>
      </button>

      {open && (
        <div className="mobile-ean-overlay" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
          <div className="mobile-ean-modal">
            <div className="mobile-ean-head">
              <div>
                <strong>Escanear EAN</strong>
                <span>Aponte a câmera para o código de barras do produto.</span>
              </div>
              <button type="button" className="mobile-ean-close" onClick={() => void close()} aria-label="Fechar scanner">
                <X size={20} />
              </button>
            </div>

            <div className="mobile-ean-reader-wrap">
              <div id="2pbox-ean-reader" className="mobile-ean-reader" />
              {starting && <div className="mobile-ean-status">Abrindo a câmera...</div>}
            </div>

            {error && <div className="mobile-ean-error">{error}</div>}

            <button type="button" className="mobile-ean-cancel" onClick={() => void close()}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .mobile-ean-trigger{display:none}
        .mobile-ean-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;padding:12px}
        .mobile-ean-modal{width:100%;max-width:520px;background:#fff;border-radius:20px 20px 14px 14px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
        .mobile-ean-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
        .mobile-ean-head strong,.mobile-ean-head span{display:block}
        .mobile-ean-head strong{font-size:18px}
        .mobile-ean-head span{font-size:12px;color:#777;margin-top:3px;line-height:1.4}
        .mobile-ean-close{width:38px;height:38px;border:0;border-radius:50%;background:#f1f1ee;display:grid;place-items:center;cursor:pointer;flex:none}
        .mobile-ean-reader-wrap{position:relative;overflow:hidden;border-radius:14px;background:#111;min-height:250px}
        .mobile-ean-reader{width:100%;min-height:250px}
        .mobile-ean-reader video{width:100%!important;height:auto!important;display:block}
        .mobile-ean-reader img{display:none!important}
        .mobile-ean-reader__dashboard_section{display:none!important}
        .mobile-ean-reader__scan_region{border:0!important}
        .mobile-ean-status{position:absolute;left:12px;right:12px;bottom:12px;background:rgba(0,0,0,.72);color:#fff;padding:9px 12px;border-radius:9px;text-align:center;font-size:12px}
        .mobile-ean-error{margin-top:10px;padding:10px 12px;border-radius:9px;background:#fff0f0;color:#a22;font-size:12px}
        .mobile-ean-cancel{width:100%;margin-top:10px;height:44px;border:1px solid #ddd;border-radius:10px;background:#fff;font-weight:800;cursor:pointer}
        @media(max-width:640px){
          .mobile-ean-trigger{display:inline-flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:46px;margin-top:8px;border:1px solid #ddd;border-radius:10px;background:#111;color:#fff;font-weight:800;font-size:12px;cursor:pointer}
        }
      `}</style>
    </>
  );
}
