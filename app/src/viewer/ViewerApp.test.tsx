import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../appearance/AppearanceProvider';
import { LOCAL_DESIGN_KEYS } from '../features/profile/useBadge';
import { clearFaceCache, drawBadgeFaces } from '../features/profile/badgeFaces';
import { AppRoot } from '../shell/AppRoot';
import { Root } from '../shell/Root';
import { ToastProvider } from '../shell/Toast';
import { appError, fake } from '../test/fakeConvex';
import { OWNER_BADGE } from '../test/badgeFixtures';

const env = vi.hoisted(() => ({ webgl: false }));
vi.mock('convex/react', async () => (await import('../test/fakeConvex')).convexReactMock);
vi.mock('@convex-dev/auth/react', async () => (await import('../test/fakeConvex')).convexAuthMock);
vi.mock('../features/profile/badgeSupport', async (original) => ({ ...(await original<typeof import('../features/profile/badgeSupport')>()), hasWebGL: () => env.webgl }));
vi.mock('../features/profile/photo', async (original) => ({ ...(await original<typeof import('../features/profile/photo')>()), loadImage: vi.fn(async () => null) }));
vi.mock('../features/profile/badgeFaces', async (original) => ({
  ...(await original<typeof import('../features/profile/badgeFaces')>()),
  loadBadgeFonts: async () => {},
  drawBadgeFaces: vi.fn(async () => (await import('../test/badgeFixtures')).FACES),
}));
vi.mock('../reactbits/Lanyard/Lanyard', async () => {
  const { createElement } = await import('react');
  return { default: () => createElement('canvas', { 'data-testid': 'lanyard' }) };
});

const task = (patch: Record<string, unknown>) => ({ projectId: 'p1', projectName: 'iMujer', projectColorSlot: 1, priority: 2, status: 'todo', order: 1, subtasks: [], ...patch });
const entry = (patch: Record<string, unknown>) => ({
  projectId: 'p1', projectName: 'iMujer', projectColorSlot: 1, hours: 2, docStatus: 'complete', isDraft: false, activityStatus: 'Completada', links: [], photos: [], dayOrder: 1, createdAt: 1, updatedAt: Date.UTC(2026, 9, 18, 14, 32), result: 'Quedó listo', ...patch,
});

const draw = (hash = '#/ver/tok') => {
  window.location.hash = hash;
  return render(
    <AppearanceProvider>
      <ToastProvider>
        <AppRoot>
          <Root />
        </AppRoot>
      </ToastProvider>
    </AppearanceProvider>,
  );
};
const wide = (matches: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches: matches && query.includes('min-width: 1101px'), addEventListener() {}, removeEventListener() {} }));

/** Todo lo que sirve para editar: ninguno puede existir en la vista de solo lectura. */
const EDIT_CONTROLS = [
  'Invitar',
  '＋ Nueva tarea',
  /^Nueva tarea en /,
  /^Nueva tarea el /,
  /^Mover a /,
  /^Mover «/,
  '＋ Registrar actividad',
  'Editar registro',
  'Completar detalles',
  'Descargar copia',
  'Restaurar copia',
  'Editar perfil',
  'Cerrar sesión',
  'Acceso',
];
const noEditControls = () => {
  for (const name of EDIT_CONTROLS) expect(screen.queryByRole('button', { name }), String(name)).toBeNull();
};

/** Un error de consulta que el límite de errores atrapa no debe ensuciar la salida de las pruebas. */
const quiet = (event: ErrorEvent) => event.preventDefault();

beforeEach(() => {
  window.addEventListener('error', quiet);
  fake.reset();
  env.webgl = false;
  clearFaceCache();
  vi.mocked(drawBadgeFaces).mockClear();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0));
  fake.setQuery('viewer:access', { includesJournal: true, showsDescriptions: false });
  fake.setQuery('viewer:board', {
    tasks: [task({ id: 't1', title: 'Revisar convenio', dueDate: '2026-10-24', assigneeName: 'Jose Padilla' }), task({ id: 't2', title: 'Informe semanal', status: 'done', completedAt: Date.now(), order: 2, hours: 1.5 })],
    projects: [{ id: 'p1', name: 'iMujer', colorSlot: 1 }],
    summary: { activities: 2, hours: 3.5, completed: 2, drafts: 1 },
  });
  fake.setQuery('viewer:calendar', { tasks: [], hoursByDay: { '2026-10-15': 2.5 } });
  fake.setQuery('viewer:journal', {
    entries: [entry({ id: 'j1', date: '2026-10-18', activity: 'Revisión inicial', objective: 'Meta' }), entry({ id: 'j2', date: '2026-10-21', activity: 'Informe', isDraft: true, docStatus: 'draft', hours: undefined, result: undefined })],
    summary: { activities: 2, hours: 3.5, completed: 2, drafts: 1 },
  });
  fake.setQuery('viewer:events', { items: [], nextCursor: null });
  fake.setQuery('viewer:profile', OWNER_BADGE);
});
afterEach(() => {
  window.removeEventListener('error', quiet);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('read-only link · access', () => {
  it('asks the server with the token of the link and shows «Este enlace ya no está activo» when it is not valid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.setQuery('viewer:access', () => {
      throw appError('FORBIDDEN', 'Este enlace ya no está activo.');
    });
    draw('#/ver/viejo');
    expect(await screen.findByRole('heading', { name: 'Este enlace ya no está activo' })).toBeTruthy();
    expect(fake.asked.find((q) => q.name === 'viewer:access')!.args).toEqual({ shareToken: 'viejo' });
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).toBeNull();
  });

  it('shows the same screen if the owner turns the link off while the page is open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    draw();
    expect(await screen.findByText('Revisar convenio')).toBeTruthy();
    act(() =>
      fake.setQuery('viewer:board', () => {
        throw appError('FORBIDDEN', 'Este enlace ya no está activo.');
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Este enlace ya no está activo' })).toBeTruthy();
  });

  it('offers to retry on any other failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.setQuery('viewer:board', () => {
      throw new Error('Server Error');
    });
    draw();
    expect(await screen.findByRole('heading', { name: 'No se pudo abrir tu bitácora' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('shows nothing, not a flash of content, while the server has not answered', () => {
    fake.queries = {};
    draw();
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).toBeNull();
  });
});

describe('read-only link · what it shows', () => {
  it('has the four tabs by default, says «Solo lectura» instead of a name and has no «Invitar»', async () => {
    draw();
    await screen.findByText('Revisar convenio');
    const tabs = within(screen.getByRole('navigation', { name: 'Secciones' }));
    expect(['Tablero', 'Calendario', /^Bitácora/, 'Historial'].map((name) => tabs.getByRole('button', { name }).textContent)).toHaveLength(4);
    expect(document.querySelector('.who-text')!.textContent).toBe('Solo lectura');
    expect(await screen.findByText('De Jose Frangel Padilla Camacho')).toBeTruthy();
    expect(document.querySelector('.brand-text')!.textContent).toBe('Bitácora');
    expect(screen.getByRole('button', { name: 'Ver el perfil de quien registra' })).toBeTruthy();
    expect(document.querySelector('.app')!.getAttribute('data-readonly')).toBe('true');
    expect(document.querySelector('.app')!.getAttribute('data-mode')).toBe('light');
  });

  it('shows the board with the hours and the drafts of the Bitácora, and the drafts in the tab badge', async () => {
    draw();
    expect(await screen.findByText('Revisar convenio')).toBeTruthy();
    expect(screen.getByText('Horas registradas').parentElement!.querySelector('b')!.getAttribute('data-value')).toBe('3.5');
    expect(document.querySelector('.tab .badge')!.textContent).toBe('1');
  });

  it('has no control that edits anything on the board', async () => {
    draw();
    await screen.findByText('Revisar convenio');
    noEditControls();
    expect(document.querySelector('[aria-roledescription]')).toBeNull();
    expect(document.querySelector('.card[draggable="true"]')).toBeNull();
  });

  it('opens a task as a detail with every field disabled and no save or delete', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByText('Revisar convenio'));
    const dialog = await screen.findByRole('dialog', { name: 'Detalle de la tarea' });
    const fields = [...dialog.querySelectorAll<HTMLInputElement>('input, select, textarea')];
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.filter((field) => !field.disabled)).toEqual([]);
    expect(within(dialog).queryByRole('button', { name: /Guardar|Eliminar|Agregar/ })).toBeNull();
  });

  it('does not show descriptions the server did not send', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByText('Revisar convenio'));
    const dialog = await screen.findByRole('dialog', { name: 'Detalle de la tarea' });
    expect(dialog.querySelector('textarea')).toBeNull();
  });

  it('shows the calendar with the hours of the days', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Calendario' }));
    expect(await screen.findByRole('grid')).toBeTruthy();
    expect(window.location.hash).toBe('#/ver/tok/calendario');
    noEditControls();
  });

  it('shows the history', async () => {
    fake.setQuery('viewer:events', {
      items: [{ id: 'e1', at: Date.now() - 60_000, actorId: 'm1', actorName: 'Jose Padilla', actorRole: 'Becario', type: 'task.moved', subjectKind: 'task', subjectTitle: 'Revisar convenio', detail: { from: 'todo', to: 'doing' } }],
      nextCursor: null,
    });
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Historial' }));
    await waitFor(() => expect(document.querySelector('.hist-text')).not.toBeNull());
    expect(document.querySelector('.hist-text')!.textContent).toContain('Jose Padilla movió «Revisar convenio»');
  });

  it('shows the Bitácora with its records, hours and drafts, read-only', async () => {
    draw('#/ver/tok/bitacora');
    expect(await screen.findByText('Revisión inicial')).toBeTruthy();
    expect(screen.getByText('Informe')).toBeTruthy();
    expect(screen.getByText('2 registros')).toBeTruthy();
    expect(screen.getByText('Vista de solo lectura')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Bitácora/ }).getAttribute('aria-current')).toBe('page');
    noEditControls();
  });

  it('opens straight on the section named in the address', async () => {
    draw('#/ver/tok/historial');
    expect(await screen.findByRole('button', { name: 'Historial' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Historial' }).getAttribute('aria-current')).toBe('page'));
  });

  it('hides the Bitácora tab, and the section itself, when the link does not include it', async () => {
    fake.setQuery('viewer:access', { includesJournal: false, showsDescriptions: false });
    fake.setQuery('viewer:board', { tasks: [task({ id: 't1', title: 'Revisar convenio' })], projects: [{ id: 'p1', name: 'iMujer', colorSlot: 1 }] });
    draw('#/ver/tok/bitacora');
    expect(await screen.findByText('Revisar convenio')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Bitácora/ })).toBeNull();
    expect(screen.queryByText('Horas registradas')).toBeNull();
    expect(fake.asked.some((q) => q.name === 'viewer:journal')).toBe(false);
  });

  it('«Apariencia» works: the style and the theme are local to the browser', async () => {
    const user = userEvent.setup();
    draw();
    await screen.findByText('Revisar convenio');
    await user.click(screen.getByRole('button', { name: 'Apariencia' }));
    await user.click(screen.getByRole('button', { name: /^Papel/ }));
    expect(document.querySelector('.app')!.getAttribute('data-theme')).toBe('papel');
    expect(fake.calls).toEqual([]);
  });
});

describe('read-only link · the owner\'s badge', () => {
  it('hangs it in the Bitácora column on wide screens, with its pointer zones, so it can be dragged and thrown', async () => {
    env.webgl = true;
    wide(true);
    draw('#/ver/tok/bitacora');
    expect(await screen.findByTestId('lanyard')).toBeTruthy();
    expect(fake.asked.find((q) => q.name === 'viewer:profile')!.args).toEqual({ shareToken: 'tok' });
    await waitFor(() => expect(document.querySelectorAll('.badge-hit:not([hidden])')).toHaveLength(2));
    expect(document.querySelector('.badge-hit.strap')).toBeTruthy();
  });

  it('opens the owner\'s profile as «Perfil» with only «Ver diseños»', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Ver el perfil de quien registra' }));
    const dialog = await screen.findByRole('dialog', { name: 'Perfil' });
    expect(await within(dialog).findByAltText('Carné de Jose Frangel Padilla Camacho')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Ver diseños' })).toBeTruthy();
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['×', 'Ver diseños']);
    noEditControls();
  });

  it('lets the viewer pick a design only for themself: it is kept in this browser, survives a reload and is never sent to the server', async () => {
    const user = userEvent.setup();
    const first = draw();
    await user.click(await screen.findByRole('button', { name: 'Ver el perfil de quien registra' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Perfil' })).getByRole('button', { name: 'Ver diseños' }));
    const gallery = await screen.findByRole('dialog', { name: 'Diseños del carné' });
    await user.click(within(gallery.querySelector('[data-design="clasico"]') as HTMLElement).getByRole('button', { name: 'Usar este diseño' }));
    expect(localStorage.getItem(LOCAL_DESIGN_KEYS.viewer)).toBe('clasico');
    expect(fake.calls).toEqual([]);

    // «Recargar»: se vuelve a montar todo desde cero y la elección sigue ahí (la dueña tiene Olimpo).
    first.unmount();
    clearFaceCache();
    vi.mocked(drawBadgeFaces).mockClear();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Ver el perfil de quien registra' }));
    await waitFor(() => expect(drawBadgeFaces).toHaveBeenCalled());
    expect(vi.mocked(drawBadgeFaces).mock.calls.at(-1)![0].design).toBe('clasico');
    expect(fake.calls).toEqual([]);
  });

  it('redraws the badge with the new data, keeping the design the viewer chose, when the owner updates her profile', async () => {
    localStorage.setItem(LOCAL_DESIGN_KEYS.viewer, 'suizo');
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole('button', { name: 'Ver el perfil de quien registra' }));
    await screen.findByAltText('Carné de Jose Frangel Padilla Camacho');
    expect(vi.mocked(drawBadgeFaces)).toHaveBeenCalledTimes(1);
    act(() => fake.setQuery('viewer:profile', { ...OWNER_BADGE, name: 'Jose F. Padilla', updatedAt: 99 }));
    await screen.findByAltText('Carné de Jose F. Padilla');
    expect(vi.mocked(drawBadgeFaces)).toHaveBeenCalledTimes(2);
    const [call] = vi.mocked(drawBadgeFaces).mock.calls.at(-1)!;
    expect(call.design).toBe('suizo');
    expect(call.data.name).toBe('Jose F. Padilla');
  });
});

describe('read-only link · it never writes', () => {
  it('calls no server function at all while it is used', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByText('Revisar convenio'));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Calendario' }));
    await user.click(await screen.findByRole('button', { name: /^Bitácora/ }));
    await user.click(screen.getByRole('button', { name: 'Historial' }));
    await user.click(screen.getByRole('button', { name: 'Ver el perfil de quien registra' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Perfil' })).getByRole('button', { name: 'Ver diseños' }));
    expect(fake.calls).toEqual([]);
  });
});
