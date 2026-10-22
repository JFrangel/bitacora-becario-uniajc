import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalDto } from '../../../convex/lib/journalDto';
import { HOURS_MESSAGE } from '../../../convex/lib/hours';
import { ToastProvider } from '../../shell/Toast';
import { EntryPanel } from './EntryPanel';
import type { EntryPanelProps, EntrySubmit } from './EntryPanel';
import type { PendingPhoto, SavedPhoto } from './entryForm';

vi.mock('./images', async () => {
  const actual = await vi.importActual<typeof import('./images')>('./images');
  return { ...actual, compressImage: vi.fn(async () => ({ full: new Blob(['f'], { type: 'image/jpeg' }), thumb: new Blob(['t'], { type: 'image/jpeg' }) })) };
});
import * as images from './images';

const projects = [{ id: 'p1', name: 'iMujer' }, { id: 'p2', name: 'SECOP II' }];

function draw(extra: Partial<EntryPanelProps> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onSubmit: vi.fn(async (_submit: EntrySubmit) => {}),
    onDelete: vi.fn(async (_id: string) => {}),
    upload: vi.fn(async (_pending: PendingPhoto[]) => [] as SavedPhoto[]),
  };
  render(
    <ToastProvider>
      <EntryPanel open projects={projects} today="2026-10-21" {...handlers} {...extra} />
    </ToastProvider>,
  );
  return handlers;
}

const fill = async (user: ReturnType<typeof userEvent.setup>, values: { project?: string; activity?: string; result?: string; hours?: string } = {}) => {
  if (values.hours !== undefined) {
    await user.clear(screen.getByLabelText('Horas trabajadas'));
    if (values.hours) await user.type(screen.getByLabelText('Horas trabajadas'), values.hours);
  }
  await user.type(screen.getByLabelText('Proyecto o área'), values.project ?? 'iMujer');
  await user.type(screen.getByLabelText('Título de la actividad'), values.activity ?? 'Revisión');
  await user.type(screen.getByLabelText('Resultado obtenido'), values.result ?? 'Listo');
};

beforeEach(() => vi.mocked(images.compressImage).mockClear());

describe('EntryPanel · new record', () => {
  it('opens as «Nuevo registro» with today, 2 hours and «Completada»', () => {
    draw();
    expect(screen.getByRole('dialog', { name: 'Nuevo registro' })).toBeTruthy();
    expect((screen.getByLabelText('Fecha') as HTMLInputElement).value).toBe('2026-10-21');
    expect((screen.getByLabelText('Horas trabajadas') as HTMLInputElement).value).toBe('2');
    expect((screen.getByRole('radio', { name: 'Completada' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: '＋ Agregar a la bitácora' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Eliminar actividad' })).toBeNull();
  });

  it('keeps the labels, help texts and limits of the published form', () => {
    draw();
    expect(screen.getByPlaceholderText('Ej. 0,5')).toBeTruthy();
    expect(screen.getByPlaceholderText('Escribe o elige un proyecto')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ej. Revisión inicial de la plataforma y sus funcionalidades')).toBeTruthy();
    expect(screen.getByPlaceholderText('¿Qué se buscaba lograr con esta actividad?')).toBeTruthy();
    expect(screen.getByPlaceholderText('Describe el proceso, las tareas y los pasos realizados.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ej. Identifiqué los documentos pendientes y dejé las dudas para revisión.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Anota hallazgos, pendientes o comentarios relevantes.')).toBeTruthy();
    expect(screen.getByText('Máximo 4 imágenes por registro. Se optimizan al cargarlas.')).toBeTruthy();
    expect(screen.getByLabelText('Horas trabajadas').getAttribute('maxlength')).toBe('5');
    expect(screen.getByLabelText('Título de la actividad').getAttribute('maxlength')).toBe('1500');
    expect(screen.getByLabelText('Nombre del enlace').getAttribute('maxlength')).toBe('80');
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['Completada', 'En progreso', 'Pendiente de revisión']);
  });

  it('suggests the known projects', () => {
    draw();
    expect([...document.querySelectorAll('datalist option')].map((o) => o.getAttribute('value'))).toEqual(['iMujer', 'SECOP II']);
  });

  it.each(['25', '0,1', '', 'abc'])('does not save %s hours and shows the exact message', async (hours) => {
    const user = userEvent.setup();
    const { onSubmit } = draw();
    await fill(user, { hours });
    await user.click(screen.getByRole('button', { name: '＋ Agregar a la bitácora' }));
    expect(screen.getByRole('alert').textContent).toBe(HOURS_MESSAGE);
    expect(document.activeElement).toBe(screen.getByLabelText('Horas trabajadas'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('needs the result', async () => {
    const user = userEvent.setup();
    const { onSubmit } = draw();
    await user.type(screen.getByLabelText('Proyecto o área'), 'iMujer');
    await user.type(screen.getByLabelText('Título de la actividad'), 'Algo');
    await user.click(screen.getByRole('button', { name: '＋ Agregar a la bitácora' }));
    expect(screen.getByRole('alert').textContent).toBe(HOURS_MESSAGE);
    expect(document.activeElement).toBe(screen.getByLabelText('Resultado obtenido'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('saves a valid record with a decimal comma and closes with the confirmation', async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = draw();
    await fill(user, { hours: '1,5' });
    await user.click(screen.getByRole('button', { name: '＋ Agregar a la bitácora' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({
      mode: 'create',
      fields: { date: '2026-10-21', hours: '1,5', projectName: 'iMujer', activity: 'Revisión', result: 'Listo', activityStatus: 'Completada', links: [], photos: [] },
    });
    expect(document.querySelector('.toast')!.textContent).toBe('Actividad agregada a tu bitácora.');
  });

  it('shows what the server answered and stays open', async () => {
    const user = userEvent.setup();
    const { onClose } = draw({ onSubmit: vi.fn(async () => { throw Object.assign(new Error('x'), { data: { code: 'VALIDATION', message: 'Puedes añadir hasta 12 enlaces por registro.' } }); }) });
    await fill(user);
    await user.click(screen.getByRole('button', { name: '＋ Agregar a la bitácora' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Puedes añadir hasta 12 enlaces por registro.');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('EntryPanel · links', () => {
  it('adds a link, using the domain as the name when it is left empty', async () => {
    const user = userEvent.setup();
    draw();
    await user.type(screen.getByLabelText('Dirección web'), 'https://www.secop.gov.co/x');
    await user.click(screen.getByRole('button', { name: 'Añadir enlace' }));
    expect(screen.getByText('↗ www.secop.gov.co')).toBeTruthy();
    expect((screen.getByLabelText('Dirección web') as HTMLInputElement).value).toBe('');
  });

  it('adds a link that was typed but not added when the form is saved', async () => {
    const user = userEvent.setup();
    const { onSubmit } = draw();
    await fill(user);
    await user.type(screen.getByLabelText('Nombre del enlace'), 'Contrato');
    await user.type(screen.getByLabelText('Dirección web'), 'https://example.com/c');
    await user.click(screen.getByRole('button', { name: '＋ Agregar a la bitácora' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].fields.links).toEqual([{ label: 'Contrato', url: 'https://example.com/c' }]);
  });

  it('says what is wrong with a link instead of saving', async () => {
    const user = userEvent.setup();
    const { onSubmit } = draw();
    await user.type(screen.getByLabelText('Nombre del enlace'), 'Solo nombre');
    await user.click(screen.getByRole('button', { name: 'Añadir enlace' }));
    expect(screen.getByRole('alert').textContent).toBe('Completa la dirección web del enlace.');
    await user.type(screen.getByLabelText('Dirección web'), 'ftp://x.co');
    await user.click(screen.getByRole('button', { name: 'Añadir enlace' }));
    expect(screen.getByRole('alert').textContent).toBe('Usa un enlace que comience con http:// o https://.');
    await fill(user);
    await user.click(screen.getByRole('button', { name: '＋ Agregar a la bitácora' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('removes a link with its ×', async () => {
    const user = userEvent.setup();
    draw();
    await user.type(screen.getByLabelText('Dirección web'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Añadir enlace' }));
    await user.click(screen.getByRole('button', { name: 'Quitar evidencia' }));
    expect(screen.queryByText('↗ example.com')).toBeNull();
  });
});

describe('EntryPanel · images', () => {
  const upload = (...files: File[]) => fireEvent.change(screen.getByLabelText('＋ Añadir imágenes'), { target: { files } });
  const jpg = (name: string, size = 10) => new File([new Uint8Array(size)], name, { type: 'image/jpeg' });

  it('attaches an image after compressing it, and shows its name', async () => {
    draw();
    upload(jpg('captura.jpg'));
    expect(await screen.findByText('captura.jpg')).toBeTruthy();
    expect(images.compressImage).toHaveBeenCalledTimes(1);
  });

  it('skips a file that is not an image, with the exact message, without breaking the form', async () => {
    draw();
    upload(new File(['x'], 'nota.pdf', { type: 'application/pdf' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Se omitió un archivo que no es una imagen.');
    expect(images.compressImage).not.toHaveBeenCalled();
  });

  it('refuses an image over 5 MB', async () => {
    draw();
    upload(jpg('grande.jpg', images.MAX_IMAGE_BYTES + 1));
    expect((await screen.findByRole('alert')).textContent).toBe('grande.jpg supera el límite de 5 MB.');
  });

  it('(punto) says so, without breaking the form, when the browser cannot decode an image such as HEIC', async () => {
    vi.mocked(images.compressImage).mockRejectedValueOnce(new images.ImageReadError());
    draw();
    upload(new File(['x'], 'foto.heic', { type: 'image/heic' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo leer esa imagen. Prueba con un JPG o un PNG.');
    expect(screen.getByLabelText('Título de la actividad')).toBeTruthy();
  });

  it('stops at four images', async () => {
    draw();
    upload(jpg('1.jpg'), jpg('2.jpg'), jpg('3.jpg'), jpg('4.jpg'), jpg('5.jpg'));
    expect((await screen.findByRole('alert')).textContent).toBe('Puedes adjuntar hasta 4 imágenes por registro.');
    expect(await screen.findByText('4.jpg')).toBeTruthy();
    expect(screen.queryByText('5.jpg')).toBeNull();
  });

  it('uploads the pending images when saving, and sends the files it got back', async () => {
    const user = userEvent.setup();
    const uploadFiles = vi.fn(async (_pending: PendingPhoto[]) => [{ storageId: 'sx', thumbStorageId: 'tx', name: 'captura.jpg' }]);
    const { onSubmit } = draw({ upload: uploadFiles });
    await fill(user);
    upload(jpg('captura.jpg'));
    await screen.findByText('captura.jpg');
    await user.click(screen.getByRole('button', { name: '＋ Agregar a la bitácora' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(uploadFiles).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].fields.photos).toEqual([{ storageId: 'sx', thumbStorageId: 'tx', name: 'captura.jpg' }]);
  });
});

describe('EntryPanel · editing and completing', () => {
  const entry = {
    id: 'j1', date: '2026-10-18', projectId: 'p1', projectName: 'iMujer', projectColorSlot: 1, activity: 'Revisión inicial', objective: 'Meta', result: 'Hecho', hours: 1.5,
    docStatus: 'complete', isDraft: false, activityStatus: 'En progreso', links: [{ label: 'Doc', url: 'https://example.com' }],
    photos: [{ storageId: 's1', thumbStorageId: 't1', name: 'a.jpg', url: 'https://x/a', thumbUrl: 'https://x/t' }], dayOrder: 1, createdAt: 1, updatedAt: 2,
  } as unknown as JournalDto;

  it('opens «Editar registro» with the record, its link and its image', () => {
    draw({ entry });
    expect(screen.getByRole('dialog', { name: 'Editar registro' })).toBeTruthy();
    expect((screen.getByLabelText('Horas trabajadas') as HTMLInputElement).value).toBe('1,5');
    expect((screen.getByLabelText('Título de la actividad') as HTMLTextAreaElement).value).toBe('Revisión inicial');
    expect((screen.getByRole('radio', { name: 'En progreso' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('a.jpg')).toBeTruthy();
    expect(screen.getByText('↗ Doc')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
  });

  it('saves the changes as an update', async () => {
    const user = userEvent.setup();
    const { onSubmit } = draw({ entry });
    await user.clear(screen.getByLabelText('Horas trabajadas'));
    await user.type(screen.getByLabelText('Horas trabajadas'), '3');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ mode: 'update', id: 'j1' });
    expect(onSubmit.mock.calls[0][0].fields).toMatchObject({ hours: '3', photos: [{ storageId: 's1', thumbStorageId: 't1', name: 'a.jpg' }] });
    expect(document.querySelector('.toast')!.textContent).toBe('Cambios guardados.');
  });

  it('completes a draft: preloaded activity, project, date and objective, empty hours, and the banner', async () => {
    const user = userEvent.setup();
    const draft = { ...entry, isDraft: true, docStatus: 'draft', hours: undefined, result: undefined, activityStatus: 'Completada', links: [], photos: [] } as unknown as JournalDto;
    const { onSubmit } = draw({ entry: draft });
    expect(screen.getByRole('dialog', { name: 'Completar detalles' })).toBeTruthy();
    expect(screen.getByText('Completa los detalles de esta tarea')).toBeTruthy();
    expect((screen.getByLabelText('Horas trabajadas') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Título de la actividad') as HTMLTextAreaElement).value).toBe('Revisión inicial');
    expect((screen.getByLabelText('Objetivo') as HTMLTextAreaElement).value).toBe('Meta');
    expect(document.activeElement).toBe(screen.getByLabelText('Horas trabajadas'));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(screen.getByRole('alert').textContent).toBe(HOURS_MESSAGE);
    await user.type(screen.getByLabelText('Horas trabajadas'), '2');
    await user.type(screen.getByLabelText('Resultado obtenido'), 'Listo');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ mode: 'document', id: 'j1' });
    expect(document.querySelector('.toast')!.textContent).toBe('Cambios guardados · las horas suman ahora a tus indicadores');
  });

  it('asks before deleting, then deletes and says so', async () => {
    const user = userEvent.setup();
    const { onDelete, onClose } = draw({ entry });
    await user.click(screen.getByRole('button', { name: 'Eliminar actividad' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Eliminar esta actividad?' });
    expect(dialog.textContent).toContain('Esta acción es permanente y también eliminará sus evidencias.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Eliminar actividad' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('j1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(document.querySelector('.toast')!.textContent).toBe('Registro eliminado.');
  });
});
