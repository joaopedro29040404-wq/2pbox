'use client';

import { useEffect, useRef, useState } from 'react';

export type ProductImageProps = {
  src?: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  fit?: 'contain' | 'cover';
  padded?: boolean;
};

/**
 * As imagens do produto vivem em `images`; `image_url` e apenas a capa
 * derivada. Ler sempre por aqui evita telas divergindo sobre qual foto mostrar.
 */
export function productGallery(product?: { image_url?: string | null; images?: string[] | null } | null) {
  const list = Array.isArray(product?.images) ? product!.images! : [];
  const all = [...list, product?.image_url].map((value) => String(value || '').trim()).filter(Boolean);
  return Array.from(new Set(all));
}

export function productCover(product?: { image_url?: string | null; images?: string[] | null } | null) {
  return productGallery(product)[0] || null;
}

export function ProductImage({ src, alt, sizes = '(max-width:700px) 50vw, 300px', className = '', priority = false, fit = 'contain', padded = true }: ProductImageProps) {
  const source = String(src || '').trim();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(source ? 'loading' : 'failed');
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!source) {
      setState('failed');
      return;
    }
    setState('loading');

    // Imagem em cache termina de carregar antes do React ligar o onLoad: sem
    // esta checagem ela ficaria invisivel sob o shimmer para sempre.
    const node = imageRef.current;
    if (node?.complete) setState(node.naturalWidth > 0 ? 'ready' : 'failed');
  }, [source]);

  if (!source || state === 'failed') {
    return (
      <span className={`ui-product-image is-empty ${className}`} role="img" aria-label={alt}>
        <span className="ui-product-fallback">2P</span>
      </span>
    );
  }

  return (
    <span className={`ui-product-image ${state === 'loading' ? 'is-loading' : ''} ${className}`}>
      <img
        ref={imageRef}
        src={source}
        alt={alt}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        style={{ objectFit: fit, padding: padded ? undefined : 0 }}
        onLoad={() => setState('ready')}
        onError={() => setState('failed')}
      />
    </span>
  );
}
