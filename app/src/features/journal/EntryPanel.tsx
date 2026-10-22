import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { JournalDto } from '../../../convex/lib/journalDto';
import { LIMITS } from '../../../convex/lib/limits';
import type { ActivityStatus } from '../../../convex/lib/types';
import { errorMessage } from '../../convexClient';
import { ConfirmDialog } from '../../shell/ConfirmDialog';
import { Panel } from '../../shell/Panel';
import { useToast } from '../../shell/Toast';
import { entryFormFrom, newEntryForm, pendingLink, toFieldsArgs, validateEntryForm } from './entryForm';
import type { EntryForm, PendingPhoto, SavedPhoto } from './entryForm';
import { checkImageFile, compressImage, ImageReadError } from './images';

export type EntrySubmit = { mode: 'create' | 'update' | 'document'; id?: string; fields: ReturnType<typeof toFieldsArgs> };

export type EntryPanelProps = {
  open: boolean;
  /** Para editar o completar un borrador; sin él, es un registro nuevo. */
  entry?: JournalDto;
  today: string;
  projects: Array<{ id: string; name: string }>;
  onClose: () => void;
  /** Sube las imágenes pendientes (archivo y miniatura) y devuelve cómo quedaron guardadas. */
  upload: (pending: PendingPhoto[]) => Promise<SavedPhoto[]>;
  onSubmit: (submit: EntrySubmit) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const STATUSES: ActivityStatus[] = ['Completada', 'En progreso', 'Pendiente de revisión'];
const F = LIMITS.journalField;

/** «Registrar actividad», «Editar registro» y «Completar detalles»: el mismo formulario, con los campos de la bitácora publicada. */
export function EntryPanel({ open, entry, today, projects, onClose, upload, onSubmit, onDelete }: EntryPanelProps) {
  const toast = useToast();
  const [form, setForm] = useState<EntryForm>(() => (entry ? entryFormFrom(entry) : newEntryForm(today)));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const refs = { date: useRef<HTMLInputElement>(null), hours: useRef<HTMLInputElement>(null), project: useRef<HTMLInputElement>(null), activity: useRef<HTMLTextAreaElement>(null), result: useRef<HTMLTextAreaElement>(null), linkUrl: useRef<HTMLInputElement>(null) };

  const isDraft = Boolean(entry?.isDraft);
  const mode: EntrySubmit['mode'] = !entry ? 'create' : entry.isDraft ? 'document' : 'update';

  useEffect(() => {
    if (!open) return;
    setForm(entry ? entryFormFrom(entry) : newEntryForm(today));
    setMessage('');
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id, today]);

  const set = (patch: Partial<EntryForm>) => setForm((current) => ({ ...current, ...patch }));
  const text = (name: keyof EntryForm) => ({ value: form[name] as string, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ [name]: event.target.value }) });
  const attached = form.photos.length + form.pending.length;

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    let notice = '';
    let count = attached;
    const added: PendingPhoto[] = [];
    for (const file of files) {
      const problem = checkImageFile(file, count);
      if (problem) {
        notice = problem;
        if (problem.startsWith('Puedes adjuntar')) break;
        continue;
      }
      try {
        const { full, thumb } = await compressImage(file);
        let previewUrl = '';
        try {
          previewUrl = URL.createObjectURL(thumb);
        } catch {
          /* sin vista previa: solo se muestra el nombre */
        }
        added.push({ key: `${file.name}-${file.size}-${file.lastModified}-${added.length}`, name: file.name, full, thumb, previewUrl });
        count += 1;
      } catch (error) {
        notice = error instanceof ImageReadError ? error.message : 'No se pudo leer esa imagen. Prueba con un JPG o un PNG.';
      }
    }
    if (added.length > 0) setForm((current) => ({ ...current, pending: [...current.pending, ...added] }));
    setMessage(notice);
  };

  const addLink = (): boolean => {
    try {
      const link = pendingLink(form.linkLabel, form.linkUrl);
      if (!link) return true;
      if (form.links.length >= LIMITS.links) {
        setMessage(`Puedes añadir hasta ${LIMITS.links} enlaces por registro.`);
        return false;
      }
      setForm((current) => ({ ...current, links: [...current.links, link], linkLabel: '', linkUrl: '' }));
      setMessage('');
      refs.linkUrl.current?.focus();
      return true;
    } catch (error) {
      setMessage((error as Error).message);
      refs.linkUrl.current?.focus();
      return false;
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    // Un enlace escrito pero no añadido se añade al guardar.
    let working = form;
    try {
      const link = pendingLink(form.linkLabel, form.linkUrl);
      if (link) working = { ...form, links: [...form.links, link], linkLabel: '', linkUrl: '' };
    } catch (error) {
      setMessage((error as Error).message);
      refs.linkUrl.current?.focus();
      return;
    }
    const check = validateEntryForm(working);
    if (!check.ok) {
      setMessage(check.message);
      ({ date: refs.date, hours: refs.hours, project: refs.project, activity: refs.activity, result: refs.result })[check.field].current?.focus();
      return;
    }
    setMessage('');
    setBusy(true);
    try {
      const uploaded = working.pending.length > 0 ? await upload(working.pending) : [];
      const photos = [...working.photos, ...uploaded].map(({ storageId, thumbStorageId, name }) => ({ storageId, thumbStorageId, name }));
      await onSubmit({ mode, id: entry?.id, fields: toFieldsArgs(working, photos) });
      toast(mode === 'create' ? 'Actividad agregada a tu bitácora.' : mode === 'document' ? 'Cambios guardados · las horas suman ahora a tus indicadores' : 'Cambios guardados.');
      onClose();
    } catch (error) {
      setMessage(errorMessage(error) ?? 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    setBusy(true);
    try {
      await onDelete(entry.id);
      toast('Registro eliminado.');
      setConfirming(false);
      onClose();
    } catch (error) {
      setMessage(errorMessage(error) ?? 'No se pudo eliminar. Inténtalo de nuevo.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel open={open} onClose={onClose} title={!entry ? 'Nuevo registro' : isDraft ? 'Completar detalles' : 'Editar registro'}>
        {isDraft && (
          <div className="draft">
            <span className="dot" />
            Completa los detalles de esta tarea
          </div>
        )}
        <form className="fill-form drawer-form" noValidate onSubmit={(event) => void submit(event)}>
          <div className="grid2">
            <label>
              <span className="lbl">Fecha</span>
              <input ref={refs.date} type="date" required {...text('date')} />
            </label>
            <label>
              <span className="lbl">Horas trabajadas</span>
              <input ref={refs.hours} type="text" inputMode="decimal" maxLength={5} placeholder="Ej. 0,5" required data-autofocus={isDraft ? '' : undefined} {...text('hours')} />
            </label>
          </div>
          <label>
            <span className="lbl">Proyecto o área</span>
            <input ref={refs.project} type="text" list="entryProjects" maxLength={LIMITS.projectName} placeholder="Escribe o elige un proyecto" autoComplete="off" required {...text('projectName')} />
            <datalist id="entryProjects">
              {projects.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </label>
          <label>
            <span className="lbl">Título de la actividad</span>
            <textarea ref={refs.activity} rows={2} maxLength={F} placeholder="Ej. Revisión inicial de la plataforma y sus funcionalidades" required {...text('activity')} />
          </label>
          <label>
            <span className="lbl">Objetivo</span>
            <textarea rows={2} maxLength={F} placeholder="¿Qué se buscaba lograr con esta actividad?" {...text('objective')} />
          </label>
          <label>
            <span className="lbl">Desarrollo</span>
            <textarea rows={3} maxLength={F} placeholder="Describe el proceso, las tareas y los pasos realizados." {...text('development')} />
          </label>
          <label>
            <span className="lbl">Resultado obtenido</span>
            <textarea ref={refs.result} rows={3} maxLength={F} placeholder="Ej. Identifiqué los documentos pendientes y dejé las dudas para revisión." required {...text('result')} />
          </label>
          <label>
            <span className="lbl">Observaciones</span>
            <textarea rows={2} maxLength={F} placeholder="Anota hallazgos, pendientes o comentarios relevantes." {...text('observations')} />
          </label>
          <fieldset className="status-set">
            <legend>Estado</legend>
            {STATUSES.map((status) => (
              <label className="radio" key={status}>
                <input type="radio" name="status" value={status} checked={form.activityStatus === status} onChange={() => set({ activityStatus: status })} />
                <span>{status}</span>
              </label>
            ))}
          </fieldset>
          <div className="evidence">
            <div>
              <h4>Evidencias</h4>
              <p>Adjunta imágenes o enlaces relacionados con esta actividad.</p>
            </div>
            <div className="ev-actions">
              <label className="filebtn" htmlFor="entryPhotos">
                ＋ Añadir imágenes
              </label>
              <input id="entryPhotos" className="sr-only" type="file" accept="image/*" multiple onChange={(event) => void addFiles(event)} />
              <div className="link-row">
                <input type="text" maxLength={80} placeholder="Nombre del enlace" aria-label="Nombre del enlace" value={form.linkLabel} onChange={(event) => set({ linkLabel: event.target.value })} />
                <input ref={refs.linkUrl} type="url" placeholder="https://..." aria-label="Dirección web" value={form.linkUrl} onChange={(event) => set({ linkUrl: event.target.value })} />
                <button type="button" className="ghost2" onClick={addLink}>
                  Añadir enlace
                </button>
              </div>
            </div>
            <p className="ev-hint">Máximo 4 imágenes por registro. Se optimizan al cargarlas.</p>
            <div className="rchips">
              {form.photos.map((photo, index) => (
                <span className="rchip" key={photo.storageId}>
                  <b>IMG</b> {photo.name}
                  <button type="button" aria-label="Quitar evidencia" onClick={() => set({ photos: form.photos.filter((_, i) => i !== index) })}>
                    ×
                  </button>
                </span>
              ))}
              {form.pending.map((photo) => (
                <span className="rchip" key={photo.key}>
                  {photo.previewUrl ? <img src={photo.previewUrl} alt="" /> : <b>IMG</b>} {photo.name}
                  <button type="button" aria-label="Quitar evidencia" onClick={() => set({ pending: form.pending.filter((p) => p.key !== photo.key) })}>
                    ×
                  </button>
                </span>
              ))}
              {form.links.map((link, index) => (
                <span className="rchip" key={`${link.url}-${index}`}>
                  ↗ {link.label}
                  <button type="button" aria-label="Quitar evidencia" onClick={() => set({ links: form.links.filter((_, i) => i !== index) })}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <p className="form-error" role="alert">
            {message}
          </p>
          <div className="form-actions">
            <button type="submit" className="fill primary" disabled={busy}>
              {entry ? 'Guardar cambios' : '＋ Agregar a la bitácora'}
            </button>
            <button type="button" className="ghost" onClick={onClose}>
              Cancelar
            </button>
            {entry && (
              <button type="button" className="ghost danger" disabled={busy} onClick={() => setConfirming(true)}>
                Eliminar actividad
              </button>
            )}
          </div>
        </form>
      </Panel>
      {confirming && (
        <ConfirmDialog title="¿Eliminar esta actividad?" text="Esta acción es permanente y también eliminará sus evidencias." confirmLabel="Eliminar" busy={busy} onConfirm={() => void remove()} onCancel={() => setConfirming(false)} />
      )}
    </>
  );
}
