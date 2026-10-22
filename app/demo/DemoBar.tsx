import { useEffect, useState, useSyncExternalStore } from 'react';
import { getWho, setWho, subscribeWho, WHO_LABELS } from './identity';
import type { Who } from './identity';

/**
 * La barrita de la vista previa (abajo a la izquierda, fuera de la aplicación): cambia quién «inició sesión» y abre el enlace
 * de solo lectura y la invitación de ejemplo. Nada de esto existe en la aplicación real.
 */
export function DemoBar() {
  const who = useSyncExternalStore(subscribeWho, getWho);
  const [links, setLinks] = useState<{ shareToken: string; inviteToken: string }>();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    void fetch('/__demo/info')
      .then((response) => response.json())
      .then((info) => setLinks(info as { shareToken: string; inviteToken: string }));
  }, []);

  const go = (hash: string) => {
    window.location.hash = hash;
  };

  return (
    <div className="demo-bar" role="region" aria-label="Vista previa local" data-open={open}>
      <button type="button" className="demo-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        Vista previa local {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="demo-body">
          <label>
            Iniciar sesión como
            <select value={who} onChange={(event) => { setWho(event.target.value as Who); go('#/'); }}>
              {(Object.keys(WHO_LABELS) as Who[]).map((id) => (
                <option key={id} value={id}>
                  {WHO_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <div className="demo-links">
            <button type="button" disabled={!links} onClick={() => links && go(`#/ver/${links.shareToken}`)}>
              Abrir el enlace de solo lectura
            </button>
            <button type="button" disabled={!links} onClick={() => links && (setWho('anonymous'), go(`#/invitacion/${links.inviteToken}`))}>
              Abrir la invitación
            </button>
          </div>
          <p>Datos de ejemplo en memoria; se reinician al reiniciar la vista previa. El inicio de sesión de Google está simulado.</p>
        </div>
      )}
      <style>{`
        .demo-bar { position: fixed; left: 12px; bottom: 12px; z-index: 200; max-width: 300px; font: 12px/1.4 system-ui, sans-serif; color: #e8e8e8; background: #151515; border: 1px solid #333; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.4); }
        .demo-toggle { all: unset; display: block; padding: 8px 12px; cursor: pointer; font-weight: 600; }
        .demo-body { display: grid; gap: 8px; padding: 0 12px 12px; }
        .demo-body label { display: grid; gap: 4px; }
        .demo-body select, .demo-body button { font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid #444; background: #222; color: inherit; cursor: pointer; }
        .demo-links { display: grid; gap: 6px; }
        .demo-body p { margin: 0; color: #9a9a9a; font-size: 11px; }
      `}</style>
    </div>
  );
}
