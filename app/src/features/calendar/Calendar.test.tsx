import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../../../convex/lib/audience';
import { Calendar } from './Calendar';
import type { CalendarProps } from './Calendar';

let seq = 0;
const task = (patch: Record<string, unknown> & { title: string }): TaskDto =>
  ({ id: `t${++seq}`, projectName: 'iMujer', projectColorSlot: 1, priority: 2, status: 'todo', order: seq, subtasks: [], ...patch }) as unknown as TaskDto;

const draw = (tasks: TaskDto[], extra: Partial<CalendarProps> = {}) => {
  const handlers = { onPrev: vi.fn(), onNext: vi.fn(), onOpenTask: vi.fn(), onNewTask: vi.fn() };
  render(<Calendar year={2026} month={9} tasks={tasks} today="2026-10-21" me="me" canEdit {...handlers} {...extra} />);
  return handlers;
};
const cell = (day: string) => [...document.querySelectorAll<HTMLElement>('.cal-cell')].find((c) => c.querySelector('.cal-num')?.textContent === String(Number(day.slice(8))))!;

describe('Calendar', () => {
  it('shows the month and year, the Monday-first headings and 35 cells for October 2026', () => {
    draw([]);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('octubre 2026');
    expect([...document.querySelectorAll('.cal-dow')].map((d) => d.textContent)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
    expect(document.querySelectorAll('.cal-cell')).toHaveLength(35);
    expect(document.querySelectorAll('.cal-cell.blank')).toHaveLength(4);
  });

  it('marks today', () => {
    draw([]);
    expect(cell('2026-10-21').classList.contains('today')).toBe(true);
    expect(document.querySelectorAll('.cal-cell.today')).toHaveLength(1);
  });

  it('navigates between months', async () => {
    const user = userEvent.setup();
    const { onPrev, onNext } = draw([]);
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('shows up to 2 tasks per day and «+n más» for the rest', async () => {
    const user = userEvent.setup();
    draw([1, 2, 3, 4].map((i) => task({ title: `Tarea ${i}`, dueDate: '2026-10-22' })));
    const day = cell('2026-10-22');
    expect(within(day).getAllByRole('button', { name: /^Tarea/ })).toHaveLength(2);
    await user.click(within(day).getByRole('button', { name: '+2 más' }));
    const list = screen.getByRole('region', { name: /Tareas del jueves, 22 de octubre de 2026/ });
    expect(within(list).getAllByRole('button', { name: /Tarea \d/ })).toHaveLength(4);
  });

  it('does not show tasks without a date, or from another month', () => {
    draw([task({ title: 'Sin fecha' }), task({ title: 'Noviembre', dueDate: '2026-11-02' }), task({ title: 'Octubre', dueDate: '2026-10-05' })]);
    const chips = [...document.querySelectorAll('.cal-chip')].map((c) => c.textContent);
    expect(chips).toEqual(['Octubre']);
  });

  it('shows the documented hours of a day only when the data has them', () => {
    draw([], { hoursByDay: { '2026-10-15': 4.75 } });
    expect(within(cell('2026-10-15')).getByText('4,75 h')).toBeTruthy();
    expect(document.querySelectorAll('.cal-hours')).toHaveLength(1);
  });

  it('has no hours badge at all when the audience cannot see the journal', () => {
    draw([task({ title: 'A', dueDate: '2026-10-15' })]);
    expect(document.querySelector('.cal-hours')).toBeNull();
  });

  it('opens the detail when a task is touched', async () => {
    const { onOpenTask } = draw([task({ id: 'x', title: 'Abrir', dueDate: '2026-10-22' })]);
    await userEvent.setup().click(within(cell('2026-10-22')).getByRole('button', { name: 'Abrir' }));
    expect(onOpenTask).toHaveBeenCalledWith('x');
  });

  it('opens «Nueva tarea» with that date when an empty day is touched, only if you can edit', async () => {
    const user = userEvent.setup();
    const { onNewTask } = draw([task({ title: 'Ocupado', dueDate: '2026-10-22' })]);
    await user.click(screen.getByRole('button', { name: /Nueva tarea el viernes, 23 de octubre de 2026/ }));
    expect(onNewTask).toHaveBeenCalledWith('2026-10-23');
    expect(within(cell('2026-10-22')).queryByRole('button', { name: /Nueva tarea el/ })).toBeNull();
  });

  it('lets a read-only visitor look but not create', () => {
    draw([], { canEdit: false });
    expect(screen.queryByRole('button', { name: /Nueva tarea/ })).toBeNull();
  });

  it('lists the upcoming deadlines: at most 6, not completed, overdue ones flagged', () => {
    const tasks = [
      task({ title: 'Vencida', dueDate: '2026-10-19', assigneeId: 'me' }),
      ...[22, 23, 24, 25, 26, 27].map((d) => task({ title: `Día ${d}`, dueDate: `2026-10-${d}`, assigneeId: 'ana', assigneeName: 'Ana' })),
      task({ title: 'Hecha', dueDate: '2026-10-20', status: 'done' }),
    ];
    draw(tasks);
    const items = [...document.querySelectorAll('.up-item')];
    expect(items).toHaveLength(6);
    expect(items[0].textContent).toContain('Vencida');
    expect(items[0].textContent).toContain('iMujer · Tú · vencida');
    expect(items[1].textContent).toContain('iMujer · Ana');
    expect(items.some((i) => i.textContent!.includes('Hecha'))).toBe(false);
    expect(within(items[0] as HTMLElement).getByText('oct')).toBeTruthy();
  });

  it('says so when nothing is coming up', () => {
    draw([]);
    expect(screen.getByText('No hay vencimientos próximos.')).toBeTruthy();
  });
});

describe('Calendar · phone', () => {
  it('turns each task into a dot, with the list of the touched day below the grid', () => {
    const css = readFileSync(join(__dirname, '../../styles/layout.css'), 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 640px)'));
    expect(phone).toMatch(/\.cal-chip \{ font-size: 0;/);
  });

  it('touching a day shows its tasks in the list under the grid', async () => {
    const user = userEvent.setup();
    draw([task({ title: 'Una', dueDate: '2026-10-22' })]);
    await user.click(cell('2026-10-22'));
    expect(screen.getByRole('region', { name: /Tareas del jueves, 22 de octubre de 2026/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '＋ Nueva tarea este día' })).toBeTruthy();
  });
});
