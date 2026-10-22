import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EXIT_MS = 420;

type PanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Clases extra del panel (por ejemplo `profile`). */
  className?: string;
  children: ReactNode;
};

const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hidden && el.closest('[hidden]') === null);

/**
 * Panel lateral modal: foco atrapado, `Esc` lo cierra, el fondo oscurecido también, y el foco vuelve a quien lo abrió.
 * Se monta al abrir y se desmonta cuando termina de deslizarse hacia afuera. En móvil ocupa toda la pantalla (CSS).
 */
export function Panel({ open, onClose, title, className = '', children }: PanelProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Una vez montado (todavía "cerrado") se fuerza el cálculo de estilos y se pasa a "abierto": así la transición sí corre.
  useLayoutEffect(() => {
    if (!mounted || !open || visible) return;
    void ref.current?.offsetWidth;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setVisible(true);
  }, [mounted, open, visible]);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const panel = ref.current;
    const first = panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea') ?? focusables(panel)[0];
    first?.focus({ preventScroll: true });
    return () => {
      const back = opener.current;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, [visible]);

  if (!mounted) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !ref.current) return;
    const items = focusables(ref.current);
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div className={`scrim${visible && open ? ' show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={ref}
        className={`drawer${className ? ` ${className}` : ''}${visible && open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!(visible && open)}
        onKeyDown={onKeyDown}
      >
        <header className="drawer-head">
          <h2 id={titleId}>{title}</h2>
          <button className="x" type="button" aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </aside>
    </>
  );
}
