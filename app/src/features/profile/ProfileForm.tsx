import { useMutation } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../../convex/_generated/api';
import type { BadgeData } from '../../../convex/lib/profile';
import { errorMessage } from '../../convexClient';
import { usePersistentFlag } from '../../lib/usePersistentFlag';
import { useToast } from '../../shell/Toast';
import { initialCrop } from './cropMath';
import { PhotoCropper } from './PhotoCropper';
import type { PhotoState } from './PhotoCropper';
import { cropToJpeg, loadImage } from './photo';

type ProfileFormProps = {
  data: BadgeData;
  /** Solo la dueña tiene foto, semestre, programa, institución y grupo; las demás personas editan su nombre y su rol. */
  isOwner: boolean;
  onDone: () => void;
  onCancel: () => void;
};

const NAME_MESSAGE = 'Escribe tu nombre (2 a 60 caracteres).';
const ROLE_MESSAGE = 'Escribe tu rol (2 a 60 caracteres).';
const SAVE_MESSAGE = 'No se pudo guardar el perfil. Intenta de nuevo.';
const noPhoto = (): PhotoState => ({ img: null, crop: null, changed: false, removed: false });

/** «Editar perfil»: nombre y rol para todas las personas; para la dueña, además, la foto encuadrada y los datos del carné. */
export function ProfileForm({ data, isOwner, onDone, onCancel }: ProfileFormProps) {
  const toast = useToast();
  const updateSelf = useMutation(api.members.updateSelf);
  const updateProfile = useMutation(api.profile.update);
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(data.name);
  const [role, setRole] = useState(data.roleLabel);
  const [term, setTerm] = useState(data.term ?? '');
  const [program, setProgram] = useState(data.program ?? '');
  const [institution, setInstitution] = useState(data.institution ?? '');
  const [group, setGroup] = useState(data.group ?? '');
  const [photo, setPhoto] = useState<PhotoState>(noPhoto);
  const [enhance, setEnhance] = usePersistentFlag('bitacora.enhancePhoto', true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // La foto guardada se abre en el encuadre: se puede mover, acercar o quitar sin volver a subirla.
  useEffect(() => {
    if (!isOwner || !data.photoDataUrl) return undefined;
    let alive = true;
    void loadImage(data.photoDataUrl).then((img) => {
      if (alive && img) setPhoto((current) => (current.changed ? current : { img, crop: initialCrop(img, 0), changed: false, removed: false }));
    });
    return () => {
      alive = false;
    };
  }, [isOwner, data.photoDataUrl]);

  const focus = (field: string) => form.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const [cleanName, cleanRole] = [name.trim(), role.trim()];
    if (cleanName.length < 2) {
      setMessage(NAME_MESSAGE);
      focus('name');
      return;
    }
    if (cleanRole.length < 2) {
      setMessage(ROLE_MESSAGE);
      focus('role');
      return;
    }
    setMessage('');
    setBusy(true);
    try {
      if (cleanName !== data.name || cleanRole !== data.roleLabel) await updateSelf({ name: cleanName, roleLabel: cleanRole });
      if (isOwner) {
        const fields = { program: program.trim(), term: term.trim(), institution: institution.trim(), group: group.trim() };
        if (photo.removed) await updateProfile({ ...fields, photoDataUrl: null });
        else if (photo.changed && photo.img && photo.crop) await updateProfile({ ...fields, photoDataUrl: cropToJpeg(photo.img, photo.crop, { enhance }) });
        else await updateProfile(fields);
      }
      toast('Perfil actualizado.');
      onDone();
    } catch (error) {
      setMessage(errorMessage(error) ?? SAVE_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="fill-form drawer-form" id="profileForm" ref={form} noValidate onSubmit={(event) => void save(event)}>
      {isOwner && (
        <>
          <PhotoCropper value={photo} name={name} onChange={setPhoto} onMessage={setMessage} />
          <label className="check">
            <input type="checkbox" checked={enhance} onChange={(event) => setEnhance(event.target.checked)} />
            <span>Mejorar imagen</span>
          </label>
          <p className="ev-hint">Arrastra la foto para encuadrar tu cara. Se guarda a 1024 × 1024 px. Sin foto se usan tus iniciales.</p>
        </>
      )}
      <label>
        <span className="lbl">Nombre</span>
        <input name="name" type="text" maxLength={60} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} data-autofocus />
      </label>
      {isOwner ? (
        <>
          <div className="grid2">
            <label>
              <span className="lbl">Rol</span>
              <input name="role" type="text" maxLength={60} autoComplete="off" value={role} onChange={(event) => setRole(event.target.value)} />
            </label>
            <label>
              <span className="lbl">
                Semestre <small>(opcional)</small>
              </span>
              <input name="term" type="text" maxLength={30} autoComplete="off" value={term} onChange={(event) => setTerm(event.target.value)} />
            </label>
          </div>
          <label>
            <span className="lbl">
              Programa <small>(opcional)</small>
            </span>
            <input name="program" type="text" maxLength={80} autoComplete="off" value={program} onChange={(event) => setProgram(event.target.value)} />
          </label>
          <label>
            <span className="lbl">
              Institución <small>(opcional)</small>
            </span>
            <input name="institution" type="text" maxLength={100} autoComplete="off" value={institution} onChange={(event) => setInstitution(event.target.value)} />
          </label>
          <label>
            <span className="lbl">
              Grupo de investigación <small>(opcional)</small>
            </span>
            <input name="group" type="text" maxLength={60} autoComplete="off" placeholder="Ej. AthenIA" value={group} onChange={(event) => setGroup(event.target.value)} />
          </label>
        </>
      ) : (
        <label>
          <span className="lbl">Rol</span>
          <input name="role" type="text" maxLength={60} autoComplete="off" value={role} onChange={(event) => setRole(event.target.value)} />
        </label>
      )}
      <p className="form-error" id="profileMsg" role="alert">
        {message}
      </p>
      <div className="form-actions">
        <button type="submit" className="fill primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar perfil'}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
