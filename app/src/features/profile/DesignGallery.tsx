import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { BadgeData } from '../../../convex/lib/profile';
import { useAppearance } from '../../appearance/AppearanceProvider';
import { DESIGN_ORDER, DESIGNS } from './badgeDesigns';
import type { BadgeDesignId } from './badgeDesigns';
import type { Faces } from './badgeFaces';
import { dataKeyOf, facesFor } from './useBadge';

type DesignGalleryProps = {
  data: BadgeData;
  current: BadgeDesignId;
  /** Si la elección es solo de este navegador (personas invitadas y enlace de solo lectura), el texto lo dice. */
  local: boolean;
  onPick: (id: BadgeDesignId) => void;
  onClose: () => void;
};

const THUMB_SCALE = 0.5;

function Tile({ id, data, current, onPick }: { id: BadgeDesignId; data: BadgeData; current: boolean; onPick: (id: BadgeDesignId) => void }) {
  const { appearance } = useAppearance();
  const [faces, setFaces] = useState<Faces | null>(null);
  const dataKey = dataKeyOf(data);

  useEffect(() => {
    let alive = true;
    facesFor(data, id, THUMB_SCALE, appearance)
      .then((result) => alive && setFaces(result))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dataKey, appearance.style, appearance.mode]);

  return (
    <article className={`design-tile${current ? ' current' : ''}`} data-design={id} aria-current={current ? 'true' : undefined}>
      <div className="design-faces">
        {faces ? (
          <>
            <img src={faces.front} alt={`Frente del diseño ${DESIGNS[id].label}`} />
            <img src={faces.back} alt={`Reverso del diseño ${DESIGNS[id].label}`} />
          </>
        ) : (
          <span className="loading">Dibujando…</span>
        )}
      </div>
      <h3>{DESIGNS[id].label}</h3>
      <p>{DESIGNS[id].note}</p>
      <button type="button" className="fill primary" disabled={current} onClick={() => onPick(id)}>
        {current ? 'Diseño en uso' : 'Usar este diseño'}
      </button>
    </article>
  );
}

/** «Ver diseños»: frente y reverso de los cinco diseños con los datos y los colores del estilo activo. */
export function DesignGallery({ data, current, local, onPick, onClose }: DesignGalleryProps) {
  const root = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => {
    close.current?.focus();
    const back = opener.current;
    return () => {
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // El foco se queda dentro de la galería mientras está abierta.
  const trap = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !root.current) return;
    const items = [...root.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
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
    <div className="gallery" ref={root} role="dialog" aria-modal="true" aria-labelledby="galleryTitle" onKeyDown={trap}>
      <header className="gallery-head">
        <h2 id="galleryTitle">Diseños del carné</h2>
        <button ref={close} className="x" type="button" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
      </header>
      <p className="gallery-note">
        Frente y reverso de cada diseño, con {local ? 'los datos del carné' : 'tus datos'} y los colores del estilo activo. Elige uno y se aplica a {local ? 'tu vista (solo en este navegador)' : 'tu carné'}.
      </p>
      <div className="design-grid">
        {DESIGN_ORDER.map((id) => (
          <Tile key={id} id={id} data={data} current={current === id} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
