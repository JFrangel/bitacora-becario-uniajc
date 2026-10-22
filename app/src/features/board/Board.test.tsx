import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../../../convex/lib/audience';
import { Board } from './Board';
import type { BoardProps } from './Board';

const TODAY = '2026-10-21';
const NOW = Date.UTC(2026, 9, 21, 17);
const daysAgo = (n: number) => NOW - n * 86_400_000;

let seq = 0;
const task = (patch: Record<string, unknown> & { title: string }): TaskDto =>
  ({ id: `t${++seq}`, projectId: 'p1', projectName: 'iMujer', projectColorSlot: 1, priority: 2, status: 'todo', order: seq, subtasks: [], ...patch }) as unknown as TaskDto;

const projects = [
  { id: 'p1', name: 'iMujer', colorSlot: 1 },
  { id: 'p2', name: 'SECOP II', colorSlot: 2 },
];
const people = [
  { id: 'me', name: 'Jose' },
  { id: 'ana', name: 'Ana' },
];

const draw = (tasks: TaskDto[], extra: Partial<BoardProps> = {}) => {
  const handlers = { onOpenTask: vi.fn(), onNewTask: vi.fn(), onMove: vi.fn() };
  render(<Board tasks={tasks} projects={projects} people={people} today={TODAY} me="me" canEdit {...handlers} {...extra} />);
  return handlers;
};
const column = (id: string) => document.querySelector<HTMLElement>(`.col[data-col="${id}"]`)!;
const titlesIn = (id: string) => [...column(id).querySelectorAll('.card h3')].map((h) => h.textContent);

let phone = false;
beforeEach(() => {
  seq = 0;
  phone = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width: 640px') ? phone : false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0));
});
afterEach(() => vi.unstubAllGlobals());

describe('Board · header', () => {
  it('shows today, the title and the four columns with their real totals', () => {
    draw([task({ title: 'a' }), task({ title: 'b' }), task({ title: 'c', status: 'doing' })]);
    expect(screen.getByText('Miércoles, 21 de octubre')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tablero.');
    expect([...document.querySelectorAll('.col-name')].map((h) => h.textContent)).toEqual(['Por hacer', 'En curso', 'En revisión', 'Completada']);
    expect([...document.querySelectorAll('.col-count')].map((h) => h.textContent)).toEqual(['2', '1', '0', '0']);
  });

  it('shows Activas and Vencen esta semana, and no hours indicators without journal access', () => {
    draw([task({ title: 'a', dueDate: '2026-10-19' }), task({ title: 'b', status: 'doing' }), task({ title: 'c', status: 'done' })]);
    const stat = (label: string) => screen.getByText(label).parentElement!.querySelector('b')!.getAttribute('data-value');
    expect(stat('Activas')).toBe('2');
    expect(stat('Vencen esta semana')).toBe('1');
    expect(screen.queryByText('Horas registradas')).toBeNull();
    expect(screen.queryByText('Por documentar')).toBeNull();
  });

  it('adds Horas registradas and Por documentar when the audience has the journal', () => {
    draw([task({ title: 'a' })], { summary: { hours: 17.5, drafts: 2 } });
    const stat = (label: string) => screen.getByText(label).parentElement!.querySelector('b')!.getAttribute('data-value');
    expect(stat('Horas registradas')).toBe('17.5');
    expect(stat('Por documentar')).toBe('2');
  });
});

describe('Board · filters', () => {
  const tasks = () => [
    task({ title: 'Análisis jurídico', projectId: 'p1', projectName: 'iMujer', assigneeId: 'me', assigneeName: 'Jose', priority: 3 }),
    task({ title: 'Mapear SECOP', projectId: 'p2', projectName: 'SECOP II', assigneeId: 'ana', assigneeName: 'Ana', priority: 1 }),
    task({ title: 'Otra de SECOP', projectId: 'p2', projectName: 'SECOP II', status: 'doing' }),
  ];

  it('applies a project chip before counting', async () => {
    draw(tasks());
    await userEvent.setup().click(screen.getByRole('button', { name: 'SECOP II' }));
    expect([...document.querySelectorAll('.col-count')].map((h) => h.textContent)).toEqual(['1', '1', '0', '0']);
    expect(screen.getByRole('button', { name: 'SECOP II' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Todos' }));
    expect([...document.querySelectorAll('.col-count')].map((h) => h.textContent)).toEqual(['2', '1', '0', '0']);
  });

  it('collapses long project lists and expands them again', async () => {
    const manyProjects = Array.from({ length: 5 }, (_, index) => ({ id: `p${index + 1}`, name: `Área ${index + 1}`, colorSlot: index + 1 }));
    const user = userEvent.setup();
    draw([], { projects: manyProjects });

    expect(screen.getByRole('button', { name: 'Área 5' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Mostrar menos proyectos' }));
    expect(screen.queryByRole('button', { name: 'Área 4' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Área 5' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mostrar 2 proyectos más' }).getAttribute('aria-expanded')).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Mostrar 2 proyectos más' }));
    expect(screen.getByRole('button', { name: 'Área 4' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Área 5' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar menos proyectos' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('offers collapse and expand controls to the read-only board', async () => {
    const manyProjects = Array.from({ length: 5 }, (_, index) => ({ id: `p${index + 1}`, name: `Área ${index + 1}`, colorSlot: index + 1 }));
    const user = userEvent.setup();
    draw([], { projects: manyProjects, me: null, canEdit: false });

    await user.click(screen.getByRole('button', { name: 'Mostrar menos proyectos' }));
    expect(screen.queryByRole('button', { name: 'Área 5' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mostrar 2 proyectos más' }).getAttribute('aria-expanded')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Mostrar 2 proyectos más' }));
    expect(screen.getByRole('button', { name: 'Área 5' })).toBeTruthy();
  });

  it('keeps the selected project visible when the list is collapsed', async () => {
    const manyProjects = Array.from({ length: 5 }, (_, index) => ({ id: `p${index + 1}`, name: `Área ${index + 1}`, colorSlot: index + 1 }));
    const user = userEvent.setup();
    draw([], { projects: manyProjects });

    await user.click(screen.getByRole('button', { name: 'Área 5' }));
    await user.click(screen.getByRole('button', { name: 'Mostrar menos proyectos' }));
    expect(screen.getByRole('button', { name: 'Área 5' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Mostrar 2 proyectos más' })).toBeTruthy();
  });

  it('searches ignoring accents', async () => {
    draw(tasks());
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Buscar tarea' }), 'analisis');
    expect(titlesIn('todo')).toEqual(['Análisis jurídico']);
    expect(column('todo').querySelector('.col-count')!.textContent).toBe('1');
  });

  it('filters by assignee, by priority and with «Solo mías»', async () => {
    const user = userEvent.setup();
    draw(tasks());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Asignada a' }), 'ana');
    expect(titlesIn('todo')).toEqual(['Mapear SECOP']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Asignada a' }), '');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Prioridad' }), '3');
    expect(titlesIn('todo')).toEqual(['Análisis jurídico']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Prioridad' }), '');
    await user.click(screen.getByRole('button', { name: 'Solo mías' }));
    expect(titlesIn('todo')).toEqual(['Análisis jurídico']);
    expect(titlesIn('doing')).toEqual([]);
  });

  it('offers no «Solo mías» to the read-only link', () => {
    draw(tasks(), { me: null, canEdit: false });
    expect(screen.queryByRole('button', { name: 'Solo mías' })).toBeNull();
  });
});

describe('Board · cards', () => {
  it('shows a completed card with the check, the subtask bar and the hours only when the DTO carries them', () => {
    draw([
      task({ title: 'Con horas', status: 'done', completedAt: daysAgo(1), hours: 1.5, subtasks: [{ id: 'a', text: 'x', done: true }, { id: 'b', text: 'y', done: false }, { id: 'c', text: 'z', done: false }] }),
      task({ title: 'Sin horas', status: 'done', completedAt: daysAgo(1) }),
    ]);
    const [withHours, without] = [...column('done').querySelectorAll<HTMLElement>('.card')];
    expect(within(withHours).getByLabelText('Completada').textContent).toBe('✓');
    expect(within(withHours).getByText('1/3')).toBeTruthy();
    expect(withHours.querySelector('.subs-bar i')!.getAttribute('style')).toContain('--s: 0.333');
    expect(within(withHours).getByText('1,5 h')).toBeTruthy();
    expect(without.querySelector('.hrs')).toBeNull();
    expect(without.querySelector('.subs')).toBeNull();
  });

  it('shows the draft label only when the DTO says draft, and never anything about hours otherwise', () => {
    draw([task({ title: 'Borrador', status: 'done', completedAt: daysAgo(1), draft: true }), task({ title: 'Normal', status: 'done', completedAt: daysAgo(1) })]);
    const [draft, normal] = [...column('done').querySelectorAll<HTMLElement>('.card')];
    expect(within(draft).getByText('Falta documentar en tu bitácora')).toBeTruthy();
    expect(normal.textContent).not.toMatch(/documentar| h$/);
  });

  it('writes «Vencida 20 oct» only for open tasks', () => {
    draw([task({ title: 'Abierta', dueDate: '2026-10-20' }), task({ title: 'Hecha', dueDate: '2026-10-20', status: 'done', completedAt: daysAgo(1) }), task({ title: 'Futura', dueDate: '2026-10-25' })]);
    const dues = [...document.querySelectorAll('.due')].map((el) => el.textContent);
    expect(dues).toEqual(['Vencida 20 oct', '25 oct', '20 oct']);
    expect(document.querySelectorAll('.due.late')).toHaveLength(1);
  });

  it('shows the assignee, «Tú» for the person looking, «Sin asignar» and a note for someone who lost access', () => {
    draw([
      task({ title: 'Mía', assigneeId: 'me', assigneeName: 'Jose Padilla' }),
      task({ title: 'De Ana', assigneeId: 'ana', assigneeName: 'Ana Gómez', assigneeRevoked: true }),
      task({ title: 'De nadie' }),
    ]);
    expect([...document.querySelectorAll('.who-name')].map((el) => el.textContent)).toEqual(['Tú', 'Ana Gómez (sin acceso)', 'Sin asignar']);
    expect(document.querySelectorAll('.avatar.none')).toHaveLength(1);
  });

  it('opens the detail with a click and with Enter', async () => {
    const user = userEvent.setup();
    const { onOpenTask } = draw([task({ title: 'Abrir' })]);
    await user.click(screen.getByText('Abrir'));
    expect(onOpenTask).toHaveBeenCalledTimes(1);
    document.querySelector<HTMLElement>('.card')!.focus();
    await user.keyboard('{Enter}');
    expect(onOpenTask).toHaveBeenCalledTimes(2);
  });

  it('moves a card to the next column with the arrow, and not from the last one', async () => {
    const user = userEvent.setup();
    const { onMove } = draw([task({ id: 'x', title: 'Mover' }), task({ id: 'y', title: 'Hecha', status: 'done', completedAt: daysAgo(1) })]);
    await user.click(screen.getByRole('button', { name: 'Mover a En curso' }));
    expect(onMove).toHaveBeenCalledWith('x', 'doing');
    expect(column('done').querySelector('.next')).toBeNull();
  });
});

describe('Board · columns', () => {
  it('invites to drop a card on an empty column', () => {
    draw([task({ title: 'a' })]);
    expect(within(column('doing')).getByText('Suelta una tarjeta aquí')).toBeTruthy();
    expect(within(column('todo')).queryByText('Suelta una tarjeta aquí')).toBeNull();
  });

  it('has no drop message and no add buttons for the read-only link', () => {
    draw([task({ title: 'a' })], { canEdit: false });
    expect(screen.queryByText('Suelta una tarjeta aquí')).toBeNull();
    expect(screen.queryByRole('button', { name: /Nueva tarea/ })).toBeNull();
    expect(document.querySelector('.next')).toBeNull();
  });

  it('creates a task from the button and from the plus of a column, with that column’s status', async () => {
    const user = userEvent.setup();
    const { onNewTask } = draw([]);
    await user.click(screen.getByRole('button', { name: '＋ Nueva tarea' }));
    expect(onNewTask).toHaveBeenLastCalledWith();
    await user.click(screen.getByRole('button', { name: 'Nueva tarea en En revisión' }));
    expect(onNewTask).toHaveBeenLastCalledWith('review');
  });

  it('shows only the last 30 days of Completada and offers the older ones', async () => {
    const user = userEvent.setup();
    draw([
      task({ title: 'Reciente', status: 'done', completedAt: daysAgo(2) }),
      task({ title: 'Antigua', status: 'done', completedAt: daysAgo(45) }),
      task({ title: 'Más antigua', status: 'done', completedAt: daysAgo(90) }),
    ]);
    expect(titlesIn('done')).toEqual(['Reciente']);
    expect(column('done').querySelector('.col-count')!.textContent).toBe('3');
    await user.click(screen.getByRole('button', { name: 'Mostrar anteriores (2)' }));
    expect(titlesIn('done')).toEqual(['Reciente', 'Antigua', 'Más antigua']);
    await user.click(screen.getByRole('button', { name: 'Ocultar anteriores' }));
    expect(titlesIn('done')).toEqual(['Reciente']);
  });

  it('lets you reach the older ones even when nothing is recent', async () => {
    draw([task({ title: 'Antigua', status: 'done', completedAt: daysAgo(45) })]);
    expect(titlesIn('done')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Mostrar anteriores (1)' })).toBeTruthy();
  });

  it('on a phone shows 5 cards per column with «Mostrar 8 más» and «Mostrar menos»', async () => {
    phone = true;
    const user = userEvent.setup();
    draw(Array.from({ length: 13 }, (_, i) => task({ title: `Tarea ${i + 1}` })));
    await act(async () => {});
    expect(titlesIn('todo')).toHaveLength(5);
    expect(column('todo').querySelector('.col-count')!.textContent).toBe('13');
    await user.click(screen.getByRole('button', { name: 'Mostrar 8 más' }));
    expect(titlesIn('todo')).toHaveLength(13);
    await user.click(screen.getByRole('button', { name: 'Mostrar menos' }));
    expect(titlesIn('todo')).toHaveLength(5);
  });

  it('does not trim on a desktop', () => {
    draw(Array.from({ length: 13 }, (_, i) => task({ title: `Tarea ${i + 1}` })));
    expect(titlesIn('todo')).toHaveLength(13);
    expect(screen.queryByRole('button', { name: /Mostrar/ })).toBeNull();
  });
});

describe('Board · density', () => {
  it('remembers the compact view in this browser', async () => {
    const user = userEvent.setup();
    draw([task({ title: 'a' })]);
    const button = screen.getByRole('button', { name: 'Compacta' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('.board')!.classList.contains('compact')).toBe(false);
    await user.click(button);
    expect(document.querySelector('.board')!.classList.contains('compact')).toBe(true);
    expect(localStorage.getItem('bitacora.boardCompact')).toBe('1');
  });

  it('starts compact when it was left that way', () => {
    localStorage.setItem('bitacora.boardCompact', '1');
    draw([task({ title: 'a' })]);
    expect(document.querySelector('.board')!.classList.contains('compact')).toBe(true);
  });
});

describe('Board · styles', () => {
  const read = (path: string) => readFileSync(join(__dirname, path), 'utf8');

  it('(punto 2) lets a 300-letter word wrap instead of overflowing the card', () => {
    expect(read('board.css')).toMatch(/\.card h3 \{[^}]*overflow-wrap: anywhere/);
    draw([task({ title: 'x'.repeat(300) })]);
    expect(document.querySelector('.card h3')!.textContent).toHaveLength(300);
  });

  it('in Grafito mixes the column color at 6% into the border and 7% into the light, with no background tint', () => {
    const css = read('../../styles/components.css');
    const rule = css.split('\n').find((line) => line.startsWith('.app[data-theme="grafito"] .card {'))!;
    expect(rule).toContain('border-color: color-mix(in srgb, var(--c) 6%, var(--line))');
    expect(rule).toContain('color-mix(in srgb, var(--c) 7%, transparent)');
    expect(rule).not.toMatch(/background-color|background:/);
  });
});
