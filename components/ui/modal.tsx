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
  const overlay = useRef<HTMLDivElement>(null);
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

    const viewport = window.visualViewport;
    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      const isKeyboardOpen = height < window.innerHeight - 80;

      overlay.current?.style.setProperty('--modal-viewport-height', `${height}px`);
      overlay.current?.style.setProperty('--modal-viewport-top', `${top}px`);
      panel.current?.classList.toggle('is-keyboard-open', isKeyboardOpen);
    };

    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function keepFocusedFieldVisible(target: EventTarget | null) {
    const field = target instanceof HTMLElement ? target.closest('input, textarea, select') as HTMLElement | null : null;
    const scrollArea = body.current;
    if (!field || !scrollArea) return;

    const alignField = () => {
      const areaRect = scrollArea.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const topPadding = 16;
      const bottomPadding = 24;

      if (fieldRect.bottom > areaRect.bottom - bottomPadding) {
        scrollArea.scrollTop += fieldRect.bottom - (areaRect.bottom - bottomPadding);
      } else if (fieldRect.top < areaRect.top + topPadding) {
        scrollArea.scrollTop -= areaRect.top + topPadding - fieldRect.top;
      }
    };

    requestAnimationFrame(alignField);
    window.setTimeout(alignField, 80);
    window.setTimeout(alignField, 220);
  }

  if (!open) return null;

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .ui-modal-overlay {
            height: var(--modal-viewport-height, 100dvh);
            min-height: var(--modal-viewport-height, 100dvh);
            top: var(--modal-viewport-top, 0px);
            bottom: auto;
            padding: 0;
            align-items: flex-end;
            overflow: hidden;
          }

          .ui-modal {
            height: var(--modal-viewport-height, 100dvh);
            max-height: var(--modal-viewport-height, 100dvh);
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
            scroll-padding: 20px;
          }

          .ui-modal-body input,
          .ui-modal-body textarea,
          .ui-modal-body select {
            scroll-margin: 20px;
          }

          .ui-modal-foot {
            flex: none;
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
          }

          .ui-modal.is-keyboard-open .ui-modal-foot {
            padding-bottom: 8px;
          }
        }
      `}</style>
      <div ref={overlay} className="ui-modal-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
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

          <div ref={body} className="ui-modal-body" onFocusCapture={(event) => keepFocusedFieldVisible(event.target)}>
            {children}
          </div>

          {footer && <footer className="ui-modal-foot">{footer}</footer>}
        </div>
      </div>
    </>
  );
}
