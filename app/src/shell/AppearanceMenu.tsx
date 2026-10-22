import { useEffect, useId, useRef, useState } from 'react';
import { useAppearance } from '../appearance/AppearanceProvider';
import type { Mode, Style } from '../appearance/appearance';

const STYLE_OPTIONS: ReadonlyArray<{ id: Style; label: string; swatch: string; note?: string }> = [
  { id: 'grafito', label: 'Grafito', swatch: 'sw-b', note: 'predeterminado' },
  { id: 'papel', label: 'Papel', swatch: 'sw-a' },
  { id: 'tinta', label: 'Tinta viva', swatch: 'sw-c' },
];
const MODE_OPTIONS: ReadonlyArray<{ id: Mode; label: string }> = [
  { id: 'dark', label: 'Oscuro' },
  { id: 'light', label: 'Claro' },
];

/** Selector «Apariencia»: tres estilos × oscuro y claro. Es local del navegador, también en la vista de solo lectura. */
export function AppearanceMenu() {
  const { appearance, setStyle, setMode } = useAppearance();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="appearance" ref={root}>
      <button className="invite" id="appBtn" type="button" aria-haspopup="true" aria-expanded={open} aria-controls={popId} onClick={() => setOpen((o) => !o)}>
        Apariencia
      </button>
      <div className="pop" id={popId} hidden={!open}>
        <p className="pop-label">Estilo</p>
        <div className="pop-styles">
          {STYLE_OPTIONS.map((option) => (
            <button key={option.id} type="button" className={`opt${appearance.style === option.id ? ' on' : ''}`} aria-pressed={appearance.style === option.id} onClick={() => setStyle(option.id)}>
              <span className={`sw ${option.swatch}`} />
              {option.label}
              {option.note && <small>{option.note}</small>}
            </button>
          ))}
        </div>
        <p className="pop-label">Tema</p>
        <div className="pop-mode">
          {MODE_OPTIONS.map((option) => (
            <button key={option.id} type="button" className={`mode${appearance.mode === option.id ? ' on' : ''}`} aria-pressed={appearance.mode === option.id} onClick={() => setMode(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
        <p className="pop-note">Los tres estilos tienen tema oscuro y tema claro.</p>
      </div>
    </div>
  );
}
