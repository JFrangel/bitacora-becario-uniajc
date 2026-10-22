import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JournalDto } from '../../../convex/lib/journalDto';
import { Journal } from './Journal';
import type { JournalProps } from './Journal';

let seq = 0;
const entry = (patch: Record<string, unknown> & { activity: string }): JournalDto =>
  ({
    id: `j${++seq}`, date: '2026-10-18', projectId: 'p1', projectName: 'iMujer', projectColorSlot: 1, hours: 2, docStatus: 'complete', isDraft: false, activityStatus: 'Completada',
    links: [], photos: [], dayOrder: seq, createdAt: 1, updatedAt: Date.UTC(2026, 9, 18, 14, 32), result: 'Quedó listo', ...patch,
  }) as unknown as JournalDto;

const projects = [{ id: 'p1', name: 'iMujer' }, { id: 'p2', name: 'SECOP II' }];
const summary = { activities: 4, hours: 10.5, completed: 3, drafts: 1 };

const draw = (entries: JournalDto[], extra: Partial<JournalProps> = {}) => {
  const handlers = { onNew: vi.fn(), onEdit: vi.fn(), onReorder: vi.fn(), onExport: vi.fn(), onImport: vi.fn() };
  render(<Journal entries={entries} summary={summary} projects={projects} readOnly={false} {...handlers} {...extra} />);
  return handlers;
};
const titles = () => [...document.querySelectorAll('.entry h3')].map((h) => h.textContent);

describe('Journal · header', () => {
  it('shows the section header and the four indicators', () => {
    draw([]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bitácora.');
    expect(screen.getByText('Institución Universitaria Antonio José Camacho')).toBeTruthy();
    expect(screen.getByText('Privada · solo tú escribes aquí')).toBeTruthy();
    const stat = (label: string) => screen.getByText(label).parentElement!.querySelector('b')!.getAttribute('data-value');
    expect([stat('Actividades'), stat('Horas registradas'), stat('Completadas'), stat('Por documentar')]).toEqual(['4', '10.5', '3', '1']);
  });
});

describe('Journal · tools', () => {
  const all = () => [
    entry({ activity: 'Análisis Jurídico', projectId: 'p1', projectName: 'iMujer', result: 'Contrato revisado' }),
    entry({ activity: 'Landing', projectId: 'p2', projectName: 'SECOP II', activityStatus: 'En progreso', observations: 'falta el logo' }),
    entry({ activity: 'Borrador de prueba', isDraft: true, docStatus: 'draft', hours: undefined, result: undefined }),
  ];

  it('counts the records', () => {
    draw(all());
    expect(screen.getByText('3 registros')).toBeTruthy();
    draw([entry({ activity: 'Una' })]);
    expect(screen.getByText('1 registro')).toBeTruthy();
  });

  it('searches activities and results ignoring accents', async () => {
    draw(all());
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Buscar en actividades' }), 'analisis');
    expect(titles()).toEqual(['Análisis Jurídico']);
    expect(screen.getByText('1 registro')).toBeTruthy();
  });

  it('filters by area, by status and by drafts', async () => {
    const user = userEvent.setup();
    draw(all());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por área' }), 'p2');
    expect(titles()).toEqual(['Landing']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por área' }), '');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por estado' }), 'En progreso');
    expect(titles()).toEqual(['Landing']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por estado' }), '');
    await user.click(screen.getByRole('button', { name: 'Solo borradores' }));
    expect(titles()).toEqual(['Borrador de prueba']);
    expect(screen.getByRole('button', { name: 'Solo borradores' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('says there is nothing yet, and then that there are no results', async () => {
    draw([]);
    expect(screen.getByText('Todavía no hay actividades')).toBeTruthy();
    draw(all());
    await userEvent.setup().type(screen.getAllByRole('searchbox')[1], 'zzzz');
    expect(screen.getByText('No hay resultados')).toBeTruthy();
    expect(screen.getByText('Prueba otra búsqueda o cambia los filtros.')).toBeTruthy();
  });

  it('opens the form from «＋ Registrar actividad»', async () => {
    const { onNew } = draw([]);
    await userEvent.setup().click(screen.getByRole('button', { name: '＋ Registrar actividad' }));
    expect(onNew).toHaveBeenCalled();
  });
});

describe('Journal · cards', () => {
  const full = () =>
    entry({
      activity: 'Revisión inicial', objective: 'Conocer el alcance', development: 'Se recorrió la plataforma', result: 'Documentos pendientes identificados', hours: 1.5,
      links: [{ label: 'Plataforma', url: 'https://example.com/p' }],
      photos: [{ storageId: 's1', name: 'captura.jpg', url: 'https://x/full.jpg', thumbUrl: 'https://x/thumb.jpg' }],
    });

  it('shows the date with the weekday, the project, the status and the hours', () => {
    draw([full()]);
    const card = document.querySelector('.entry')!;
    expect(within(card as HTMLElement).getByText('domingo, 18 de octubre de 2026')).toBeTruthy();
    expect(card.querySelector('.proj')!.textContent).toBe('iMujer');
    expect(card.querySelector('.stag')!.textContent).toBe('Completada');
    expect(card.querySelector('.hours')!.textContent).toBe('1,5 horas');
  });

  it('shows a preview of the result and unfolds the full detail with «Ver detalle»', async () => {
    const user = userEvent.setup();
    draw([full()]);
    const card = document.querySelector<HTMLElement>('.entry')!;
    expect(card.querySelector('.entry-result')!.textContent).toBe('ResultadoDocumentos pendientes identificados');
    const more = within(card).getByRole('button', { name: 'Ver detalle' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    await user.click(more);
    expect(card.classList.contains('open')).toBe(true);
    expect(within(card).getByRole('button', { name: 'Ocultar detalle' }).getAttribute('aria-expanded')).toBe('true');
    expect([...card.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Objetivo', 'Desarrollo', 'Resultado']);
    expect(within(card).getByText(/Última actualización: 18 oct 2026, 09:32 a\. m\./)).toBeTruthy();
    expect(within(card).getByRole('link', { name: '↗ Plataforma' }).getAttribute('href')).toBe('https://example.com/p');
    expect(within(card).getByRole('link', { name: '↗ Plataforma' }).getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('lists only the fields that have text', async () => {
    draw([entry({ activity: 'Mínimo', result: 'Solo esto' })]);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect([...document.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Resultado']);
  });

  it('enlarges a thumbnail in a viewer that closes with Escape', async () => {
    const user = userEvent.setup();
    draw([full()]);
    await user.click(screen.getByRole('button', { name: 'Ver detalle' }));
    await user.click(screen.getByRole('button', { name: 'Ampliar captura.jpg' }));
    expect(screen.getByRole('dialog', { name: 'captura.jpg' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'captura.jpg' }).querySelector('img')!.getAttribute('src')).toBe('https://x/full.jpg');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'captura.jpg' })).toBeNull();
  });

  it('shows a draft as «— horas», with the invitation to complete it', async () => {
    const user = userEvent.setup();
    const { onEdit } = draw([entry({ activity: 'Informe', isDraft: true, docStatus: 'draft', hours: undefined, result: undefined })]);
    const card = document.querySelector<HTMLElement>('.entry')!;
    expect(card.classList.contains('pending')).toBe(true);
    expect(card.querySelector('.hours')!.textContent).toBe('— horas');
    expect(within(card).getByText('Completa los detalles de esta tarea')).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Completar detalles' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(card.querySelector('.entry-more')).toBeNull();
  });

  it('notes that the task of a record was deleted', () => {
    draw([entry({ activity: 'Huérfano', taskDeleted: true, taskTitle: 'Huérfano' })]);
    expect(screen.getByText('Tarea eliminada')).toBeTruthy();
  });

  it('edits with the pencil', async () => {
    const { onEdit } = draw([full()]);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Editar registro' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe('Journal · order inside a day', () => {
  it('moves a record up or down within its own day and sends the whole new order', async () => {
    const user = userEvent.setup();
    const a = entry({ activity: 'A', date: '2026-10-20' });
    const b = entry({ activity: 'B', date: '2026-10-20' });
    const c = entry({ activity: 'C', date: '2026-10-20' });
    const { onReorder } = draw([a, b, c]);
    const second = document.querySelectorAll<HTMLElement>('.entry')[1];
    await user.click(within(second).getByRole('button', { name: 'Subir en el día' }));
    expect(onReorder).toHaveBeenCalledWith('2026-10-20', [b.id, a.id, c.id]);
    await user.click(within(second).getByRole('button', { name: 'Bajar en el día' }));
    expect(onReorder).toHaveBeenLastCalledWith('2026-10-20', [a.id, c.id, b.id]);
  });

  it('disables the arrows at the ends of the day', () => {
    draw([entry({ activity: 'A', date: '2026-10-20' }), entry({ activity: 'B', date: '2026-10-20' })]);
    const [first, last] = [...document.querySelectorAll<HTMLElement>('.entry')];
    expect(within(first).getByRole('button', { name: 'Subir en el día' })).toHaveProperty('disabled', true);
    expect(within(last).getByRole('button', { name: 'Bajar en el día' })).toHaveProperty('disabled', true);
  });

  it('disables reordering while a filter is active, and says why', async () => {
    draw([entry({ activity: 'A', date: '2026-10-20' }), entry({ activity: 'B', date: '2026-10-20' })]);
    await userEvent.setup().type(screen.getByRole('searchbox'), 'a');
    const up = screen.getAllByRole('button', { name: 'Subir en el día' })[0];
    expect(up).toHaveProperty('disabled', true);
    expect(up.getAttribute('title')).toBe('Quita los filtros para reordenar');
  });
});

describe('Journal · copy and read-only', () => {
  it('offers to download and restore a copy to the owner', async () => {
    const user = userEvent.setup();
    const { onExport, onImport } = draw([]);
    await user.click(screen.getByRole('button', { name: 'Descargar copia' }));
    expect(onExport).toHaveBeenCalled();
    const file = new File(['{}'], 'copia.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Archivo de la copia'), file);
    expect(onImport).toHaveBeenCalledWith(file);
  });

  it('shows the read-only link everything and no control to write', () => {
    draw([entry({ activity: 'Hecha' }), entry({ activity: 'Pendiente', isDraft: true, docStatus: 'draft', hours: undefined, result: undefined })], { readOnly: true });
    expect(screen.getByText('Vista de solo lectura')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Registrar actividad|Editar registro|Completar detalles|Descargar copia|Restaurar copia|Subir|Bajar/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Ver detalle' })).toHaveLength(1);
    expect(screen.getByText('Completa los detalles de esta tarea')).toBeTruthy();
  });

  it('leaves room for the badge column', () => {
    draw([], { badge: <div data-testid="carne" /> });
    expect(document.querySelector('aside.journal-badge')!.contains(screen.getByTestId('carne'))).toBe(true);
  });
});
