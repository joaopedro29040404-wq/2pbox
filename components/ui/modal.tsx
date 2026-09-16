'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  description?: string;
  size?: 'md' | 'lg';
  footer?: ReactNode;
  children: ReactNode;
};

export function Modal({ open, onClose, title, eyebrow, description, size = 'lg', footer, children }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateViewportHeight = () => {
      document.documentElement.style.setProperty('--ui-modal-vh', `${viewport.height}px`);
    };

    const keepFocusedFieldVisible = () => {
      const active = document.activeElement;
      if (!active || !body.current?.contains(active)) return;
      if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)) return;

      window.setTimeout(() => {
        active.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }, 80);
    };

    updateViewportHeight();
    viewport.addEventListener('resize', updateViewportHeight);
    body.current?.addEventListener('focusin', keepFocusedFieldVisible);

    return () => {
      viewport.removeEventListener('resize', updateViewportHeight);
      body.current?.removeEventListener('focusin', keepFocusedFieldVisible);
      document.documentElement.style.removeProperty('--ui-modal-vh');
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .ui-modal-overlay {
            height: var(--ui-modal-vh, 100dvh);
            min-height: var(--ui-modal-vh, 100dvh);
            padding: 0;
            align-items: flex-end;
          }

          .ui-modal {
            height: var(--ui-modal-vh, 100dvh);
            max-height: var(--ui-modal-vh, 100dvh);
            min-height: 0;
            border-radius: 18px 18px 0 0;
          }

          .ui-modal-head {
            flex: none;
            padding: 14px 16px 12px;
          }

          .ui-modal-head h2 {
            font-size: 24px;
            line-height: 1;
          }

          .ui-modal-description {
            max-width: 100%;
            font-size: 12px;
            line-height: 1.45;
          }

          .ui-modal-body {
            min-height: 0;
            padding: 16px;
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            scroll-padding-top: 20px;
            scroll-padding-bottom: 180px;
          }

          .ui-modal-body input,
          .ui-modal-body textarea,
          .ui-modal-body select {
            scroll-margin-top: 20px;
            scroll-margin-bottom: 180px;
          }

          .ui-modal-foot {
            flex: none;
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
          }
        }
      `}</style>
      <div className="ui-modal-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <div
          className={`ui-modal ui-modal-${size}`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          ref={panel}
        >
          <header className="ui-modal-head">
            <div>
              {eyebrow && <p className="ui-modal-eyebrow">{eyebrow}</p>}
              <h2>{title}</h2>
              {description && <p className="ui-modal-description">{description}</p>}
            </div>
            <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Fechar">
              <X size={20} />
            </button>
          </header>

          <div className="ui-modal-body" ref={body}>{children}</div>

          {footer && <footer className="ui-modal-foot">{footer}</footer>}
        </div>
      </div>
    </>
  );
}
