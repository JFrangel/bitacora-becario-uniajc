import { useMutation } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { api } from '../../../convex/_generated/api';
import type { BadgeData } from '../../../convex/lib/profile';
import { errorMessage } from '../../convexClient';
import { MAX_IMAGE_BYTES } from '../journal/images';
import { usePersistentFlag } from '../../lib/usePersistentFlag';
import { useToast } from '../../shell/Toast';
import { initialCrop } from './cropMath';
import { PhotoCropper } from './PhotoCropper';
import type { PhotoState } from './PhotoCropper';
import { cropToJpeg, loadImage, optimizeBadgeLogo } from './photo';

type ProfileFormProps = {
  data: BadgeData;
  onDone: () => void;
  onCancel: () => void;
};

const NAME_MESSAGE = 'Escribe tu nombre (2 a 60 caracteres).';
const ROLE_MESSAGE = 'Escribe tu rol (2 a 60 caracteres).';
const SAVE_MESSAGE = 'No se pudo guardar el perfil. Intenta de nuevo.';
const noPhoto = (): PhotoState => ({ img: null, crop: null, changed: false, removed: false });
const DEFAULT_FRONT_DESCRIPTION = 'grupo de investigación en IA';
const DEFAULT_BACK_DESCRIPTION = 'Grupo de investigación en inteligencia artificial';
const DEFAULT_BACK_FOOTER = 'UNIAJC · Cali';

/** «Editar perfil»: los datos del carné pertenecen a la persona autenticada. */
export function ProfileForm({ data, onDone, onCancel }: ProfileFormProps) {
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
  const [frontDescription, setFrontDescription] = useState(data.frontDescription ?? DEFAULT_FRONT_DESCRIPTION);
  const [groupLogo, setGroupLogo] = useState({ dataUrl: data.groupLogoDataUrl ?? '', changed: false, removed: false });
  const [backTitle, setBackTitle] = useState(data.backTitle ?? data.group ?? 'AthenIA');
  const [backDescription, setBackDescription] = useState(data.backDescription ?? DEFAULT_BACK_DESCRIPTION);
  const [backFooter, setBackFooter] = useState(data.backFooter ?? DEFAULT_BACK_FOOTER);
  const [logoBusy, setLogoBusy] = useState(false);
  const [photo, setPhoto] = useState<PhotoState>(noPhoto);
  const [enhance, setEnhance] = usePersistentFlag('bitacora.enhancePhoto', true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // La foto guardada se abre en el encuadre: se puede mover, acercar o quitar sin volver a subirla.
  useEffect(() => {
    if (!data.photoDataUrl) return undefined;
    let alive = true;
    void loadImage(data.photoDataUrl).then((img) => {
      if (alive && img) setPhoto((current) => (current.changed ? current : { img, crop: initialCrop(img, 0), changed: false, removed: false }));
    });
    return () => {
      alive = false;
    };
  }, [data.photoDataUrl]);

  const focus = (field: string) => form.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus();

  const pickGroupLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage('El logo debe ser PNG, JPG o WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage(`${file.name} supera el límite de 5 MB.`);
      return;
    }
    let url = '';
    try {
      setLogoBusy(true);
      url = URL.createObjectURL(file);
      const image = await loadImage(url);
      if (!image) throw new Error('No se pudo leer esa imagen. Prueba con un PNG, JPG o WebP.');
      const dataUrl = optimizeBadgeLogo(image);
      setGroupLogo({ dataUrl, changed: true, removed: false });
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo procesar el logo.');
    } finally {
      if (url) URL.revokeObjectURL(url);
      setLogoBusy(false);
    }
  };

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
      const fields: {
        program: string;
        term: string;
        institution: string;
        group: string;
        frontDescription: string;
        backTitle: string;
        backDescription: string;
        backFooter: string;
        groupLogoDataUrl?: string | null;
        photoDataUrl?: string | null;
      } = {
        program: program.trim(),
        term: term.trim(),
        institution: institution.trim(),
        group: group.trim(),
        frontDescription: frontDescription.trim(),
        backTitle: backTitle.trim(),
        backDescription: backDescription.trim(),
        backFooter: backFooter.trim(),
      };
      if (groupLogo.changed) fields.groupLogoDataUrl = groupLogo.removed ? null : groupLogo.dataUrl;
      if (photo.removed) await updateProfile({ ...fields, photoDataUrl: null });
      else if (photo.changed && photo.img && photo.crop) await updateProfile({ ...fields, photoDataUrl: cropToJpeg(photo.img, photo.crop, { enhance }) });
      else await updateProfile(fields);
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
      <PhotoCropper value={photo} name={name} onChange={setPhoto} onMessage={setMessage} />
      <label className="check">
        <input type="checkbox" checked={enhance} onChange={(event) => setEnhance(event.target.checked)} />
        <span>Mejorar imagen</span>
      </label>
      <p className="ev-hint">Arrastra la foto para encuadrar tu cara. Se guarda a 1024 × 1024 px. Sin foto se usan tus iniciales.</p>
      <label>
        <span className="lbl">Nombre</span>
        <input name="name" type="text" maxLength={60} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} data-autofocus />
      </label>
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
      <section className="badge-edit-section" aria-labelledby="badgeLogoHeading">
        <h3 id="badgeLogoHeading">Imagen del grupo</h3>
        <div className="badge-logo-edit">
          <div className="badge-logo-preview" aria-label={groupLogo.dataUrl && !groupLogo.removed ? 'Vista previa del logo' : 'Sin logo del grupo'}>
            {groupLogo.dataUrl && !groupLogo.removed ? <img src={groupLogo.dataUrl} alt="" /> : <span>Sin logo</span>}
          </div>
          <div className="badge-logo-controls">
            <label className="filebtn" htmlFor="groupLogoFile">{logoBusy ? 'Procesando…' : 'Subir logo'}</label>
            <input id="groupLogoFile" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void pickGroupLogo(event)} />
            {(groupLogo.dataUrl || data.groupLogoDataUrl) && !groupLogo.removed && (
              <button type="button" className="ghost2" onClick={() => setGroupLogo({ dataUrl: '', changed: true, removed: true })}>Quitar logo</button>
            )}
            <small className="ev-hint">Máximo 180 KB al guardar. PNG transparente recomendado.</small>
          </div>
        </div>
      </section>
      <section className="badge-edit-section" aria-labelledby="badgeFrontHeading">
        <h3 id="badgeFrontHeading">Texto del frente</h3>
        <label>
          <span className="lbl">Descripción del grupo</span>
          <input name="frontDescription" type="text" maxLength={120} autoComplete="off" value={frontDescription} onChange={(event) => setFrontDescription(event.target.value)} />
        </label>
      </section>
      <section className="badge-edit-section" aria-labelledby="badgeBackHeading">
        <h3 id="badgeBackHeading">Textos del reverso</h3>
        <label>
          <span className="lbl">Título</span>
          <input name="backTitle" type="text" maxLength={60} autoComplete="off" value={backTitle} onChange={(event) => setBackTitle(event.target.value)} />
        </label>
        <label>
          <span className="lbl">Descripción</span>
          <input name="backDescription" type="text" maxLength={120} autoComplete="off" value={backDescription} onChange={(event) => setBackDescription(event.target.value)} />
        </label>
        <label>
          <span className="lbl">Pie de página</span>
          <input name="backFooter" type="text" maxLength={60} autoComplete="off" value={backFooter} onChange={(event) => setBackFooter(event.target.value)} />
        </label>
      </section>
      <p className="form-error" id="profileMsg" role="alert">
        {message}
      </p>
      <div className="form-actions">
        <button type="submit" className="fill primary" disabled={busy || logoBusy}>
          {busy ? 'Guardando…' : 'Guardar perfil'}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
