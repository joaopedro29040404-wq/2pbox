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

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
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

        <div className="ui-modal-body">{children}</div>

        {footer && <footer className="ui-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}
