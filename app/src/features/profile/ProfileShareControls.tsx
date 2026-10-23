import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { api } from '../../../convex/_generated/api';
import { errorMessage } from '../../convexClient';
import { ConfirmDialog } from '../../shell/ConfirmDialog';
import { useToast } from '../../shell/Toast';

function ShareLinkField({ value }: { value: string }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast('Enlace del perfil copiado.');
    } catch {
      const input = document.querySelector<HTMLInputElement>('#profileShareLink');
      input?.focus();
      input?.select();
      toast('Seleccioné el enlace para que lo copies.');
    }
  };

  return (
    <div className="profile-share-link">
      <input id="profileShareLink" type="text" readOnly aria-label="Enlace de mi perfil" value={value} onFocus={(event) => event.currentTarget.select()} />
      <button type="button" className="ghost2" onClick={() => void copy()}>
        Copiar
      </button>
    </div>
  );
}

/** Comparte solo la ficha de la persona autenticada, no el tablero ni la Bitácora. */
export function ProfileShareControls() {
  const settings = useQuery(api.profile.shareSettings, {});
  const create = useMutation(api.profile.createShareLink);
  const updateVisibility = useMutation(api.profile.updateShareVisibility);
  const revoke = useMutation(api.profile.revokeShareLink);
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [visibility, setVisibility] = useState({ showPhoto: false, showAcademic: false });
  const [confirm, setConfirm] = useState<'regenerate' | 'revoke' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (settings) setVisibility({ showPhoto: settings.showPhoto, showAcademic: settings.showAcademic });
  }, [settings?.showPhoto, settings?.showAcademic]);

  if (!settings) return null;

  const createLink = async () => {
    setMessage('');
    setBusy(true);
    try {
      const result = await create(visibility);
      setLink(`${window.location.origin}${window.location.pathname}#/perfil/${result.token}`);
      toast('Enlace de perfil creado.');
    } catch (error) {
      setMessage(errorMessage(error) ?? 'No se pudo crear el enlace.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const changeVisibility = async (field: 'showPhoto' | 'showAcademic', checked: boolean) => {
    setVisibility((current) => ({ ...current, [field]: checked }));
    setMessage('');
    try {
      await updateVisibility({ [field]: checked });
    } catch (error) {
      setVisibility({ showPhoto: settings.showPhoto, showAcademic: settings.showAcademic });
      setMessage(errorMessage(error) ?? 'No se pudo actualizar la visibilidad.');
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage('');
    try {
      await revoke({});
      setLink(null);
      toast('Enlace de perfil desactivado.');
    } catch (error) {
      setMessage(errorMessage(error) ?? 'No se pudo desactivar el enlace.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <section className="profile-share" aria-labelledby="profileShareTitle">
      <h3 id="profileShareTitle">Compartir mi perfil</h3>
      <p className="ev-hint">El enlace muestra solo tu carné. No da acceso al tablero, la Bitácora ni tus datos de cuenta.</p>
      <label className="check">
        <input type="checkbox" checked={visibility.showPhoto} onChange={(event) => void changeVisibility('showPhoto', event.target.checked)} />
        <span>Incluir mi foto</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={visibility.showAcademic} onChange={(event) => void changeVisibility('showAcademic', event.target.checked)} />
        <span>Incluir programa y semestre</span>
      </label>
      {settings.enabled && link ? (
        <>
          <ShareLinkField value={link} />
          <div className="profile-share-actions">
            <button type="button" className="ghost2" disabled={busy} onClick={() => setConfirm('regenerate')}>
              Regenerar enlace
            </button>
            <button type="button" className="ghost2" disabled={busy} onClick={() => setConfirm('revoke')}>
              Desactivar enlace
            </button>
          </div>
        </>
      ) : settings.enabled ? (
        <>
          <p className="ev-hint">Ya hay un enlace activo, pero no está disponible en este navegador. Genera uno nuevo para copiarlo; el anterior dejará de funcionar.</p>
          <button type="button" className="fill primary" disabled={busy} onClick={() => setConfirm('regenerate')}>
            Generar enlace nuevo
          </button>
        </>
      ) : (
        <button type="button" className="fill primary" disabled={busy} onClick={() => void createLink()}>
          Crear enlace de perfil
        </button>
      )}
      <p className="form-error" role="alert">{message}</p>
      {confirm === 'regenerate' && (
        <ConfirmDialog
          title="¿Regenerar el enlace del perfil?"
          text="El enlace anterior dejará de funcionar de inmediato y se creará uno nuevo con los campos seleccionados."
          confirmLabel="Regenerar enlace"
          busy={busy}
          onConfirm={() => void createLink()}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'revoke' && (
        <ConfirmDialog
          title="¿Desactivar el enlace del perfil?"
          text="Quien lo tenga ya no podrá ver tu carné. Puedes crear otro enlace cuando quieras."
          confirmLabel="Desactivar enlace"
          busy={busy}
          onConfirm={() => void disable()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </section>
  );
}
