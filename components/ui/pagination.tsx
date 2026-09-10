'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function usePagination<T>(items: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  const from = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, items.length);

  return { page, setPage, totalPages, pageItems, from, to, total: items.length };
}

function pageWindow(page: number, totalPages: number) {
  const pages: Array<number | 'gap'> = [];
  const push = (value: number | 'gap') => {
    if (value === 'gap' && pages[pages.length - 1] === 'gap') return;
    pages.push(value);
  };

  for (let index = 1; index <= totalPages; index += 1) {
    if (index === 1 || index === totalPages || Math.abs(index - page) <= 1) push(index);
    else push('gap');
  }
  return pages;
}

export type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  from?: number;
  to?: number;
  total?: number;
  label?: string;
  scrollTargetId?: string;
};

export function Pagination({ page, totalPages, onPageChange, from, to, total, label = 'itens', scrollTargetId }: PaginationProps) {
  if (totalPages <= 1) return null;

  const go = (next: number) => {
    const target = Math.min(Math.max(1, next), totalPages);
    if (target === page) return;
    onPageChange(target);
    if (typeof window === 'undefined') return;
    const anchor = scrollTargetId ? document.getElementById(scrollTargetId) : null;
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="ui-pagination" aria-label="Paginação">
      {typeof from === 'number' && typeof to === 'number' && typeof total === 'number' && (
        <p className="ui-pagination-count">
          Mostrando <strong>{from}</strong>–<strong>{to}</strong> de <strong>{total}</strong> {label}
        </p>
      )}
      <div className="ui-pagination-controls">
        <button type="button" onClick={() => go(page - 1)} disabled={page === 1} aria-label="Página anterior">
          <ChevronLeft size={16} />
        </button>
        {pageWindow(page, totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <span key={`gap-${index}`} className="ui-pagination-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              className={entry === page ? 'is-current' : ''}
              aria-current={entry === page ? 'page' : undefined}
              onClick={() => go(entry)}
            >
              {entry}
            </button>
          ),
        )}
        <button type="button" onClick={() => go(page + 1)} disabled={page === totalPages} aria-label="Próxima página">
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
