'use client';

export type PageLoaderProps = {
  title?: string;
  description?: string;
  variant?: 'page' | 'inline';
};

export function PageLoader({ title = 'Carregando', description = 'Preparando tudo para você...', variant = 'page' }: PageLoaderProps) {
  return (
    <div className={`ui-loader ui-loader-${variant}`} role="status" aria-live="polite">
      <div className="ui-loader-card">
        <div className="ui-loader-mark">
          <span className="ui-loader-ring" />
          <strong>2P</strong>
        </div>
        <p className="ui-loader-title">{title}</p>
        <p className="ui-loader-text">{description}</p>
        <div className="ui-loader-track">
          <i />
        </div>
      </div>
    </div>
  );
}

export function InlineLoader({ label = 'Carregando...' }: { label?: string }) {
  return (
    <span className="ui-inline-loader" role="status" aria-live="polite">
      <i />
      {label}
    </span>
  );
}

export function SkeletonGrid({ count = 8, height = 300 }: { count?: number; height?: number }) {
  return (
    <div className="ui-skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="ui-skeleton-card" key={index} style={{ height }} />
      ))}
    </div>
  );
}
