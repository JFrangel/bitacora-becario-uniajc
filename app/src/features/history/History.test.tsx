import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EventDto } from '../../../convex/lib/events';
import { History } from './History';

const NOW = Date.UTC(2026, 9, 21, 17, 0);
const ev = (id: string, patch: Record<string, unknown>): EventDto =>
  ({ id, at: NOW - 60_000, actorId: 'm2', actorName: 'Ana', actorRole: 'Directora', type: 'task.moved', subjectKind: 'task', subjectTitle: 'Informe', detail: { from: 'todo', to: 'doing' }, ...patch }) as unknown as EventDto;

const draw = (extra: Partial<Parameters<typeof History>[0]> = {}) => {
  const handlers = { onActor: vi.fn(), onLoadMore: vi.fn() };
  render(<History events={[]} people={[{ id: 'm1', name: 'Jose' }, { id: 'm2', name: 'Ana' }]} actorId="" hasMore={false} meId="m1" now={NOW} {...handlers} {...extra} />);
  return handlers;
};

describe('History', () => {
  it('shows the title and an empty message when nothing has happened', () => {
    draw();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Historial.');
    expect(screen.getByText('Todavía no hay actividad')).toBeTruthy();
  });

  it('lists each event with its day label, glyph, person, verb, subject and detail', () => {
    draw({ events: [ev('e1', {}), ev('e2', { type: 'task.completed', actorId: 'm1', actorName: 'Jose', at: NOW - 26 * 3_600_000, detail: { from: 'review', to: 'done' } })] });
    const items = document.querySelectorAll('.hist-item');
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText('Hoy · 11:59')).toBeTruthy();
    expect(items[0].querySelector('.hist-mark span')!.textContent).toBe('→');
    expect(items[0].querySelector('.hist-text')!.textContent).toBe('Ana movió «Informe»Por hacer → En curso');
    expect(items[1].querySelector('.hist-text')!.textContent).toBe('Tú completaste «Informe»En revisión → Completada');
  });

  it('names everyone in the read-only link', () => {
    draw({ meId: null, events: [ev('e1', { actorId: 'm1', actorName: 'Jose' })] });
    expect(document.querySelector('.hist-text b')!.textContent).toBe('Jose');
  });

  it('filters by person', async () => {
    const { onActor } = draw();
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Filtrar por persona' }), 'm2');
    expect(onActor).toHaveBeenCalledWith('m2');
  });

  it('asks for 50 more with «Cargar más» only when there are more', async () => {
    const user = userEvent.setup();
    const { onLoadMore } = draw({ events: [ev('e1', {})], hasMore: true });
    await user.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not offer «Cargar más» when everything is loaded', () => {
    draw({ events: [ev('e1', {})] });
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('offers no way to edit or delete an event', () => {
    draw({ events: [ev('e1', {}), ev('e2', {})] });
    expect(screen.queryByRole('button', { name: /editar|eliminar|borrar|deshacer/i })).toBeNull();
    expect(document.querySelectorAll('.hist-item button')).toHaveLength(0);
  });
});
