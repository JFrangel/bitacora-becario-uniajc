import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../appearance/AppearanceProvider';
import { fake } from '../test/fakeConvex';
import { AppRoot } from './AppRoot';
import { MemberApp } from './MemberApp';
import { ToastProvider } from './Toast';

vi.mock('convex/react', async () => (await import('../test/fakeConvex')).convexReactMock);
vi.mock('@convex-dev/auth/react', async () => (await import('../test/fakeConvex')).convexAuthMock);
// El logotipo no se descarga en jsdom: sin esto el dibujo del carné espera 10 s.
vi.mock('../features/profile/photo', async (original) => ({ ...(await original<typeof import('../features/profile/photo')>()), loadImage: vi.fn(async () => null) }));

type ActiveMe = Parameters<typeof MemberApp>[0]['me'];
const owner = { status: 'active', memberId: 'm1', name: 'Jose Padilla', roleLabel: 'Becario', isOwner: true } as unknown as ActiveMe;
const ana = { status: 'active', memberId: 'm2', name: 'Ana Gómez', roleLabel: 'Directora', isOwner: false } as unknown as ActiveMe;

const task = (patch: Record<string, unknown>) => ({
  projectId: 'p1', projectName: 'iMujer', projectColorSlot: 1, priority: 2, status: 'todo', order: 1, subtasks: [], ...patch,
});

function draw(me: ActiveMe = owner) {
  return render(
    <AppearanceProvider>
      <ToastProvider>
        <AppRoot>
          <MemberApp me={me} />
        </AppRoot>
      </ToastProvider>
    </AppearanceProvider>,
  );
}

beforeEach(() => {
  fake.reset();
  window.location.hash = '';
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0));
  fake.setQuery('tasks:list', [
    task({ id: 't1', title: 'Revisar convenio', dueDate: '2026-10-24', assigneeId: 'm1', assigneeName: 'Jose Padilla' }),
    task({ id: 't2', title: 'Informe semanal', status: 'done', completedAt: Date.now(), order: 2, hours: 1.5 }),
  ]);
  fake.setQuery('projects:list', [{ id: 'p1', name: 'iMujer', colorSlot: 1 }]);
  fake.setQuery('members:directory', [{ id: 'm1', name: 'Jose Padilla', roleLabel: 'Becario', isOwner: true }, { id: 'm2', name: 'Ana Gómez', roleLabel: 'Directora', isOwner: false }]);
  fake.setQuery('journal:summary', { activities: 2, hours: 3.5, completed: 2, drafts: 1 });
  fake.setQuery('calendar:month', { tasks: [], hoursByDay: { '2026-10-15': 2.5 } });
  fake.setQuery('events:list', { items: [], nextCursor: null });
  fake.onMutation('tasks:create', async () => 'nueva');
});

describe('MemberApp · board', () => {
  it('shows the tasks, projects and the hours indicators to the owner', async () => {
    draw();
    expect(await screen.findByText('Revisar convenio')).toBeTruthy();
    expect(screen.getByText('Informe semanal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'iMujer' })).toBeTruthy();
    expect(screen.getByText('Horas registradas').parentElement!.querySelector('b')!.getAttribute('data-value')).toBe('3.5');
    expect(screen.getByText('1,5 h')).toBeTruthy();
  });

  it('shows invited people the same board without the hours indicators or the Bitácora tab', async () => {
    fake.setQuery('tasks:list', [task({ id: 't1', title: 'Revisar convenio' })]);
    draw(ana);
    expect(await screen.findByText('Revisar convenio')).toBeTruthy();
    expect(screen.queryByText('Horas registradas')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bitácora' })).toBeNull();
    expect(fake.asked.some((q) => q.name === 'journal:summary' && q.args !== 'skip')).toBe(false);
  });

  it('creates a task from the button: only name and project are needed', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: '＋ Nueva tarea' }));
    await user.type(screen.getByLabelText('Nombre de la tarea'), 'Preparar acta');
    await user.type(screen.getByLabelText('Proyecto o área'), 'iMujer');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    await waitFor(() => expect(fake.called('tasks:create')).toHaveLength(1));
    expect(fake.called('tasks:create')[0].args).toEqual({ title: 'Preparar acta', projectName: 'iMujer', priority: 2, status: 'todo' });
    expect(document.querySelector('.toast')!.textContent).toBe('Tarea creada en «Por hacer»');
  });

  it('opens the detail of a card and saves only the field that changed', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByText('Revisar convenio'));
    expect(screen.getByRole('dialog', { name: 'Detalle de la tarea' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Fecha límite/), { target: { value: '2026-11-02' } });
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(fake.called('tasks:update')).toHaveLength(1));
    expect(fake.called('tasks:update')[0].args).toEqual({ id: 't1', patch: { dueDate: '2026-11-02' } });
  });

  it('moves a card with the arrow', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Mover a En curso' }));
    await waitFor(() => expect(fake.called('tasks:move')).toHaveLength(1));
    expect(fake.called('tasks:move')[0].args).toEqual({ id: 't1', status: 'doing', beforeId: undefined });
  });

  it('lets only the owner delete, and asks twice', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByText('Revisar convenio'));
    await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }));
    expect(fake.called('tasks:remove')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Pulsa de nuevo para eliminar' }));
    await waitFor(() => expect(fake.called('tasks:remove')).toHaveLength(1));
    expect(fake.called('tasks:remove')[0].args).toEqual({ id: 't1' });
  });
});

describe('MemberApp · access', () => {
  it('opens the Acceso panel from «Invitar», for the owner with the people and the read-only link', async () => {
    const user = userEvent.setup();
    fake.setQuery('invites:mine', []);
    fake.setQuery('members:list', []);
    fake.setQuery('settings:get', { enabled: false, includesJournal: true, showsDescriptions: false });
    draw();
    await user.click(await screen.findByRole('button', { name: 'Invitar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Acceso' });
    expect(within(dialog).getByText('Personas con acceso')).toBeTruthy();
    expect(within(dialog).getByText('Enlace de solo lectura')).toBeTruthy();
  });

  it('shows an invited person only the invitations', async () => {
    const user = userEvent.setup();
    fake.setQuery('invites:mine', []);
    draw(ana);
    await user.click(await screen.findByRole('button', { name: 'Invitar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Acceso' });
    expect(within(dialog).queryByText('Personas con acceso')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });
});

describe('MemberApp · profile', () => {
  beforeEach(() => {
    fake.setQuery('profile:get', { name: 'Jose Padilla', roleLabel: 'Becario', isOwner: true, since: 1, updatedAt: 5, program: 'Ingeniería de Sistemas' });
    fake.setQuery('invites:mine', []);
    fake.setQuery('members:list', []);
    fake.setQuery('settings:get', { enabled: false, includesJournal: true, showsDescriptions: false });
  });

  it('opens «Mi perfil» from the avatar with the data of the badge', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Ver mi perfil' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mi perfil' });
    expect(within(dialog).getByText('Ingeniería de Sistemas')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Editar perfil' })).toBeTruthy();
  });

  it('«Acceso» in the profile closes it and opens the Acceso panel (owner only)', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Ver mi perfil' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Mi perfil' })).getByRole('button', { name: 'Acceso' }));
    expect(await screen.findByRole('dialog', { name: 'Acceso' })).toBeTruthy();
  });

  it('«Cerrar sesión» closes the session', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Ver mi perfil' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Mi perfil' })).getByRole('button', { name: 'Cerrar sesión' }));
    expect(fake.signOut).toHaveBeenCalledTimes(1);
  });

  it('an invited person gets their own profile, without «Acceso»', async () => {
    const user = userEvent.setup();
    fake.setQuery('profile:get', { name: 'Ana Gómez', roleLabel: 'Directora', isOwner: false, since: Date.UTC(2026, 9, 19) });
    draw(ana);
    await user.click(await screen.findByRole('button', { name: 'Ver mi perfil' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mi perfil' });
    expect(within(dialog).queryByRole('button', { name: 'Acceso' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });
});

describe('MemberApp · calendar and history', () => {
  it('shows the calendar with the hours badge for the owner', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Calendario' }));
    expect(await screen.findByRole('grid')).toBeTruthy();
    expect(window.location.hash).toBe('#/calendario');
  });

  it('creates a task with the date of the day that was touched', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Calendario' }));
    const grid = await screen.findByRole('grid');
    await user.click(within(grid).getAllByRole('button', { name: /^Nueva tarea el/ })[0]);
    expect(screen.getByRole('dialog', { name: 'Nueva tarea' })).toBeTruthy();
    expect((screen.getByLabelText(/Fecha límite/) as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('lists the history, newest first, in second person for your own events', async () => {
    fake.setQuery('events:list', {
      items: [{ id: 'e1', at: Date.now() - 60_000, actorId: 'm1', actorName: 'Jose Padilla', actorRole: 'Becario', type: 'task.moved', subjectKind: 'task', subjectTitle: 'Revisar convenio', detail: { from: 'todo', to: 'doing' } }],
      nextCursor: null,
    });
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Historial' }));
    await waitFor(() => expect(document.querySelector('.hist-text')).not.toBeNull());
    expect(document.querySelector('.hist-text')!.textContent).toBe('Tú moviste «Revisar convenio»Por hacer → En curso');
  });
});
