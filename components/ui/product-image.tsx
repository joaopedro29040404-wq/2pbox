'use client';

import { useEffect, useState } from 'react';

export type ProductImageProps = {
  src?: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  fit?: 'contain' | 'cover';
  padded?: boolean;
};

export function ProductImage({ src, alt, sizes = '(max-width:700px) 50vw, 300px', className = '', priority = false, fit = 'contain', padded = true }: ProductImageProps) {
  const source = String(src || '').trim();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(source ? 'loading' : 'failed');

  useEffect(() => {
    setState(source ? 'loading' : 'failed');
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
