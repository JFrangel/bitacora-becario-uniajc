import { describe, expect, it } from 'vitest';
import type { EventDto } from '../../../convex/lib/events';
import { dayLabel, eventLine } from './eventLine';

// Bogotá es UTC−5: 14:42 UTC son las 09:42 en Bogotá.
const at = (iso: string, hh: number, mm: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d, hh + 5, mm);
};
const NOW = at('2026-10-21', 12, 0);

describe('dayLabel', () => {
  it('writes «Hoy · 09:42», «Ayer · 17:30» and «19 oct · 16:20» in Bogotá time', () => {
    expect(dayLabel(at('2026-10-21', 9, 42), NOW)).toBe('Hoy · 09:42');
    expect(dayLabel(at('2026-10-20', 17, 30), NOW)).toBe('Ayer · 17:30');
    expect(dayLabel(at('2026-10-19', 16, 20), NOW)).toBe('19 oct · 16:20');
  });

  it('uses the Bogotá day at 23:30, which is already the next day in UTC', () => {
    const lateTonight = Date.UTC(2026, 9, 22, 4, 30); // 23:30 del 21 en Bogotá
    expect(dayLabel(lateTonight, NOW)).toBe('Hoy · 23:30');
    expect(dayLabel(lateTonight, Date.UTC(2026, 9, 22, 6, 0))).toBe('Ayer · 23:30');
  });

  it('pads the time and uses 24 hours', () => {
    expect(dayLabel(at('2026-10-21', 0, 5), NOW)).toBe('Hoy · 00:05');
    expect(dayLabel(at('2026-10-21', 23, 59), at('2026-10-21', 23, 59))).toBe('Hoy · 23:59');
  });

  it('adds the year for dates far from today', () => {
    expect(dayLabel(at('2025-12-31', 8, 0), NOW)).toBe('31 dic 2025 · 08:00');
  });
});

const event = (patch: Record<string, unknown> & { type: EventDto['type'] }): EventDto =>
  ({ id: 'e1', at: NOW, actorId: 'm2', actorName: 'Ana', actorRole: 'Directora', subjectKind: 'task', ...patch }) as unknown as EventDto;

describe('eventLine', () => {
  it('names the person in the read-only link even for their own events (meId is null)', () => {
    expect(eventLine(event({ type: 'task.moved', subjectTitle: 'X', detail: { from: 'todo', to: 'doing' } }), null).who).toBe('Ana');
  });

  it('writes your own events in second person', () => {
    const mine = event({ actorId: 'm1', type: 'task.moved', subjectTitle: 'Informe', detail: { from: 'todo', to: 'doing' } });
    expect(eventLine(mine, 'm1')).toMatchObject({ who: 'Tú', verb: 'moviste', subject: '«Informe»', detail: 'Por hacer → En curso' });
    expect(eventLine(mine, 'm9')).toMatchObject({ who: 'Ana', verb: 'movió' });
  });

  it.each([
    ['task.completed', 'completó', 'completaste', '✓'],
    ['task.deleted', 'eliminó', 'eliminaste', '×'],
    ['journal.documented', 'documentó', 'documentaste', '✎'],
    ['journal.deleted', 'eliminó el registro', 'eliminaste el registro', '×'],
    ['journal.edited', 'editó el registro', 'editaste el registro', '✎'],
    ['journal.draft_created', 'creó un borrador', 'creaste un borrador', '+'],
  ] as const)('%s → «%s» / «%s»', (type, other, you, glyph) => {
    expect(eventLine(event({ type, subjectTitle: 'Algo' }), 'm9')).toMatchObject({ verb: other, glyph, who: 'Ana' });
    expect(eventLine(event({ type, subjectTitle: 'Algo', actorId: 'm1' }), 'm1')).toMatchObject({ verb: you, who: 'Tú' });
  });

  it('writes a creation with the assignee and the due date, or «Sin responsable»', () => {
    const withBoth = event({ type: 'task.created', subjectTitle: 'Revisar', detail: { projectName: 'P', status: 'todo', assigneeName: 'Laura', dueDate: '2026-10-24' } });
    expect(eventLine(withBoth, null)).toMatchObject({ verb: 'añadió', glyph: '+', detail: 'Asignada a Laura · vence el 24 oct' });
    const bare = event({ type: 'task.created', subjectTitle: 'Revisar', detail: { projectName: 'P', status: 'todo', assigneeName: null, dueDate: null } });
    expect(eventLine(bare, null).detail).toBe('Sin responsable');
  });

  it('describes what an edit changed, with before and after for date, priority and assignee', () => {
    const edit = (fields: string[], changes: Record<string, unknown> = {}) => eventLine(event({ type: 'task.edited', subjectTitle: 'Tarea', detail: { fields, changes } }), null).detail;
    expect(edit(['dueDate'], { dueDate: { from: null, to: '2026-10-28' } })).toBe('Cambió la fecha límite al 28 oct');
    expect(edit(['dueDate'], { dueDate: { from: '2026-10-20', to: null } })).toBe('Quitó la fecha límite');
    expect(edit(['priority'], { priority: { from: 2, to: 3 } })).toBe('Cambió la prioridad de media a alta');
    expect(edit(['assigneeId'], { assigneeId: { from: null, to: 'm1' }, assigneeName: { from: null, to: 'Laura' } })).toBe('Asignó a Laura');
    expect(edit(['assigneeId'], { assigneeId: { from: 'm1', to: null }, assigneeName: { from: 'Laura', to: null } })).toBe('Quitó al responsable');
    expect(edit(['title'], { title: { from: 'A', to: 'B' } })).toBe('Cambió el nombre');
    expect(edit(['description'])).toBe('Cambió la descripción');
    expect(edit(['subtasks'])).toBe('Cambió las subtareas');
    expect(edit(['projectId'], { projectName: { from: 'A', to: 'B' } })).toBe('Cambió el proyecto a B');
  });

  it('lists several changes together', () => {
    const detail = eventLine(event({ type: 'task.edited', subjectTitle: 'T', detail: { fields: ['title', 'priority', 'subtasks'], changes: { priority: { from: 1, to: 2 } } } }), null).detail;
    expect(detail).toBe('Cambió el nombre, la prioridad y las subtareas');
  });

  it('writes the other kinds of event', () => {
    expect(eventLine(event({ type: 'project.created', subjectKind: 'project', subjectTitle: 'SECOP II' }), null)).toMatchObject({ verb: 'creó el proyecto', subject: '«SECOP II»' });
    expect(eventLine(event({ type: 'invite.created', subjectKind: 'invite' }), null)).toMatchObject({ verb: 'invitó a alguien', subject: '', detail: 'Enlace de un solo uso' });
    expect(eventLine(event({ type: 'member.joined', subjectKind: 'member', subjectTitle: 'Ana' }), null)).toMatchObject({ verb: 'aceptó una invitación', glyph: '↗' });
    expect(eventLine(event({ type: 'member.updated', subjectKind: 'member', subjectTitle: 'Ana' }), null).verb).toBe('actualizó su perfil');
    expect(eventLine(event({ type: 'member.revoked', subjectKind: 'member', subjectTitle: 'Luis' }), null)).toMatchObject({ verb: 'retiró el acceso de', subject: '«Luis»', glyph: '×' });
    expect(eventLine(event({ type: 'share.changed', subjectKind: 'share', detail: { enabled: true } }), null)).toMatchObject({ verb: 'cambió el enlace de solo lectura', detail: 'Lo activó' });
    expect(eventLine(event({ type: 'share.changed', subjectKind: 'share', detail: { enabled: false } }), null).detail).toBe('Lo desactivó');
    expect(eventLine(event({ type: 'share.changed', subjectKind: 'share', detail: { regenerated: true } }), null).detail).toBe('Creó un enlace nuevo; el anterior dejó de funcionar');
    expect(eventLine(event({ type: 'share.changed', subjectKind: 'share', detail: { includesJournal: false } }), null).detail).toBe('Ya no incluye la Bitácora');
    expect(eventLine(event({ type: 'share.changed', subjectKind: 'share', detail: { showsDescriptions: true } }), null).detail).toBe('Ahora muestra las descripciones');
  });

  it('copes with an event that has no title or detail', () => {
    expect(eventLine(event({ type: 'task.deleted' }), null)).toMatchObject({ subject: '', detail: '' });
  });
});
