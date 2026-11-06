import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ titleId, onClose, children, className = 'max-w-xl' }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlayRef.current)
      .map(element => ({ element, inert: element.inert, hidden: element.getAttribute('aria-hidden') }));
    background.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = 'hidden';
    dialog.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
      )).filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert, hidden }) => {
        element.inert = inert;
        if (hidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', hidden);
      });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  const content = (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`relative w-full ${className} max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-[#141414] border border-neutral-800 p-6 sm:p-7 shadow-2xl flex flex-col text-neutral-300 font-sans outline-none`}>
        {children}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
