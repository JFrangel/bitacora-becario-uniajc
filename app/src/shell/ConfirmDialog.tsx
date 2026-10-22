import { useEffect, useId, useRef } from 'react';

type ConfirmDialogProps = {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

/** Cuadro de confirmación para acciones permanentes. El foco empieza en «Cancelar»; `Esc` cancela. */
export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onCancel, busy = false }: ConfirmDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    cancel.current?.focus();
  }, []);

  return (
    <div
      className="confirm-layer"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}>
        <h3 id={titleId}>{title}</h3>
        <p id={textId}>{text}</p>
        <div className="confirm-actions">
          <button ref={cancel} type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="fill primary danger-fill" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
