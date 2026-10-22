import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../appearance/AppearanceProvider';
import { fake } from '../test/fakeConvex';
import { AppRoot } from '../shell/AppRoot';
import { MemberApp } from '../shell/MemberApp';
import { ToastProvider } from '../shell/Toast';

vi.mock('convex/react', async () => (await import('../test/fakeConvex')).convexReactMock);
vi.mock('@convex-dev/auth/react', async () => (await import('../test/fakeConvex')).convexAuthMock);

type ActiveMe = Parameters<typeof MemberApp>[0]['me'];
const owner = { status: 'active', memberId: 'm1', name: 'Jose Padilla', roleLabel: 'Becario', isOwner: true } as unknown as ActiveMe;

const entry = (patch: Record<string, unknown>) => ({
  projectId: 'p1', projectName: 'iMujer', projectColorSlot: 1, hours: 2, docStatus: 'complete', isDraft: false, activityStatus: 'Completada', links: [], photos: [], dayOrder: 1, createdAt: 1, updatedAt: Date.UTC(2026, 9, 18, 14, 32), result: 'Quedó listo', ...patch,
});

const draw = () =>
  render(
    <AppearanceProvider>
      <ToastProvider>
        <AppRoot>
          <MemberApp me={owner} />
        </AppRoot>
      </ToastProvider>
    </AppearanceProvider>,
  );

beforeEach(() => {
  fake.reset();
  window.location.hash = '#/bitacora';
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0));
  fake.setQuery('tasks:list', []);
  fake.setQuery('projects:list', [{ id: 'p1', name: 'iMujer', colorSlot: 1 }]);
  fake.setQuery('members:directory', []);
  fake.setQuery('journal:summary', { activities: 1, hours: 2, completed: 1, drafts: 1 });
  fake.setQuery('journal:list', [
    entry({ id: 'j1', date: '2026-10-18', activity: 'Revisión inicial', objective: 'Meta' }),
    entry({ id: 'j2', date: '2026-10-21', activity: 'Informe', isDraft: true, docStatus: 'draft', hours: undefined, result: undefined, taskId: 't1', taskTitle: 'Informe' }),
  ]);
  fake.onMutation('journal:createManual', async () => 'nuevo');
});

describe('JournalPage', () => {
  it('shows the owner her records and indicators, with the draft counted in the tab badge', async () => {
    draw();
    expect(await screen.findByText('Revisión inicial')).toBeTruthy();
    expect(screen.getByText('Informe')).toBeTruthy();
    expect(screen.getByText('2 registros')).toBeTruthy();
    expect(document.querySelector('.tab .badge')!.textContent).toBe('1');
    expect(screen.getByRole('button', { name: /^Bitácora/ }).getAttribute('aria-current')).toBe('page');
  });

  it('creates a record from the side panel', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: '＋ Registrar actividad' }));
    await user.type(screen.getByLabelText('Proyecto o área'), 'iMujer');
    await user.type(screen.getByLabelText('Título de la actividad'), 'Reunión');
    await user.type(screen.getByLabelText('Resultado obtenido'), 'Acuerdos');
    await user.click(screen.getByRole('button', { name: '＋ Agregar a la bitácora' }));
    await waitFor(() => expect(fake.called('journal:createManual')).toHaveLength(1));
    const { fields } = fake.called('journal:createManual')[0].args as { fields: Record<string, unknown> };
    expect(fields).toMatchObject({ hours: '2', projectName: 'iMujer', activity: 'Reunión', result: 'Acuerdos', activityStatus: 'Completada', links: [], photos: [] });
    expect(document.querySelector('.toast')!.textContent).toBe('Actividad agregada a tu bitácora.');
  });

  it('edits a record with the pencil', async () => {
    const user = userEvent.setup();
    draw();
    const card = (await screen.findByText('Revisión inicial')).closest('.entry') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Editar registro' }));
    await user.clear(screen.getByLabelText('Horas trabajadas'));
    await user.type(screen.getByLabelText('Horas trabajadas'), '3,5');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(fake.called('journal:update')).toHaveLength(1));
    expect(fake.called('journal:update')[0].args).toMatchObject({ id: 'j1', fields: { hours: '3,5', activity: 'Revisión inicial' } });
  });

  it('completes a draft with «Completar detalles»', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Completar detalles' }));
    expect(screen.getByRole('dialog', { name: 'Completar detalles' })).toBeTruthy();
    await user.type(screen.getByLabelText('Horas trabajadas'), '1,5');
    await user.type(screen.getByLabelText('Resultado obtenido'), 'Terminado');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(fake.called('journal:documentDraft')).toHaveLength(1));
    expect(fake.called('journal:documentDraft')[0].args).toMatchObject({ id: 'j2', fields: { hours: '1,5', result: 'Terminado', activity: 'Informe' } });
  });

  it('deletes a record after confirming', async () => {
    const user = userEvent.setup();
    draw();
    const card = (await screen.findByText('Revisión inicial')).closest('.entry') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Editar registro' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar actividad' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(fake.called('journal:remove')).toHaveLength(1));
    expect(fake.called('journal:remove')[0].args).toEqual({ id: 'j1' });
  });

  it('saves a new order inside a day', async () => {
    fake.setQuery('journal:list', [entry({ id: 'a', date: '2026-10-20', activity: 'A' }), entry({ id: 'b', date: '2026-10-20', activity: 'B', dayOrder: 2 })]);
    draw();
    const second = (await screen.findByText('B')).closest('.entry') as HTMLElement;
    await userEvent.setup().click(within(second).getByRole('button', { name: 'Subir en el día' }));
    await waitFor(() => expect(fake.called('journal:reorder')).toHaveLength(1));
    expect(fake.called('journal:reorder')[0].args).toEqual({ date: '2026-10-20', orderedIds: ['b', 'a'] });
  });

  it('restores a copy of the published site after asking, without duplicating on a second run', async () => {
    const user = userEvent.setup();
    fake.onMutation('journal:restore', async () => ({ created: 1, updated: 0 }));
    draw();
    await screen.findByText('Revisión inicial');
    const copy = JSON.stringify({ format: 'bitacora-iterativa', version: 1, entries: [{ id: 'old1', date: '2026-10-16', hours: 3.5, project: 'SECOP II', activity: 'Búsqueda', result: 'Lista', status: 'En progreso', links: [], photos: [] }] });
    await user.upload(screen.getByLabelText('Archivo de la copia'), new File([copy], 'copia.json', { type: 'application/json' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Restaurar esta copia?' });
    expect(dialog.textContent).toContain('1 registros');
    await user.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(fake.called('journal:restore')).toHaveLength(1));
    expect(fake.called('journal:restore')[0].args).toMatchObject({ entries: [{ legacyId: 'old1', fields: { hours: '3.5', projectName: 'SECOP II', activityStatus: 'En progreso' } }] });
    await waitFor(() => expect(document.querySelector('.toast')!.textContent).toBe('Copia restaurada: 1 registros.'));
  });

  it('says so when the file is not a copy of the journal', async () => {
    const user = userEvent.setup();
    draw();
    await screen.findByText('Revisión inicial');
    await user.upload(screen.getByLabelText('Archivo de la copia'), new File(['{"hola":1}'], 'otra.json', { type: 'application/json' }));
    await waitFor(() => expect(document.querySelector('.toast')!.textContent).toBe('El archivo no es una copia válida de la bitácora.'));
    expect(fake.called('journal:restore')).toHaveLength(0);
  });
});
