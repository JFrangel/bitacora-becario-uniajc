import { useEffect, useRef } from 'react';

/** Visor ampliado de una imagen de evidencia. Se cierra con `Esc`, con la × o pulsando fuera de la imagen. */
export function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <button ref={close} className="x" type="button" aria-label="Cerrar" onClick={onClose}>
        ×
      </button>
      <img src={url} alt={name} onClick={(event) => event.stopPropagation()} />
    </div>
  );
}
