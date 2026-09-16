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
  const [catalogFit, setCatalogFit] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!source) {
      setState('failed');
      return;
    }
    setState('loading');

    const node = imageRef.current;
    if (node?.complete) setState(node.naturalWidth > 0 ? 'ready' : 'failed');
  }, [source]);

  useEffect(() => {
    const node = imageRef.current;
    if (!node) return;

    const container = node.closest('.home-product-image, .product-image, .fav-image');
    setCatalogFit(Boolean(container));
  }, [source]);

  if (!source || state === 'failed') {
    return (
      <span className={`ui-product-image is-empty ${className}`} role="img" aria-label={alt}>
        <span className="ui-product-fallback">2P</span>
      </span>
    );
  }

  // No catálogo, a foto sempre deve aparecer inteira. O espaço excedente fica como margem.
  const resolvedFit = catalogFit ? 'contain' : fit;
  const resolvedPadding = catalogFit ? true : padded;

  return (
    <>
      <style>{`
        .home-promotion-product-image img {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          object-position: center center !important;
          padding: 8px !important;
          box-sizing: border-box !important;
        }
      `}</style>
      <span className={`ui-product-image ${state === 'loading' ? 'is-loading' : ''} ${className}`}>
        <img
          ref={imageRef}
          src={source}
          alt={alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          style={{ objectFit: resolvedFit, padding: resolvedPadding ? undefined : 0 }}
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
        />
      </span>
    </>
  );
}
