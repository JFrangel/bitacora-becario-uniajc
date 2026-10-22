import { describe, expect, it } from 'vitest';
import type { TaskDto } from '../../../convex/lib/audience';
import { diffTask, emptyForm, formFromTask, toCreateArgs, validateTaskForm } from './taskForm';

const original = {
  id: 't1',
  title: 'Revisar convenio',
  description: 'Detalle',
  projectId: 'p1',
  projectName: 'iMujer',
  projectColorSlot: 1,
  assigneeId: 'm1',
  assigneeName: 'Ana',
  dueDate: '2026-10-24',
  priority: 2,
  status: 'doing',
  order: 1,
  subtasks: [{ id: 's1', text: 'Leer', done: true }, { id: 's2', text: 'Marcar', done: false }],
} as unknown as TaskDto;

describe('emptyForm', () => {
  it('starts with the column status, Media priority and three empty subtask rows', () => {
    const form = emptyForm('review', '2026-11-02');
    expect(form).toMatchObject({ title: '', description: '', projectName: '', assigneeId: '', dueDate: '2026-11-02', priority: 2, status: 'review' });
    expect(form.subtasks).toEqual([{ text: '', done: false }, { text: '', done: false }, { text: '', done: false }]);
  });

  it('defaults to Por hacer', () => {
    expect(emptyForm().status).toBe('todo');
  });
});

describe('formFromTask', () => {
  it('fills every field, keeps the subtask ids and pads the list to three rows', () => {
    expect(formFromTask(original)).toEqual({
      title: 'Revisar convenio',
      description: 'Detalle',
      projectName: 'iMujer',
      assigneeId: 'm1',
      dueDate: '2026-10-24',
      priority: 2,
      status: 'doing',
      subtasks: [{ id: 's1', text: 'Leer', done: true }, { id: 's2', text: 'Marcar', done: false }, { text: '', done: false }],
    });
  });

  it('turns missing optional fields into empty strings and always offers at least three subtask rows', () => {
    const form = formFromTask({ ...original, description: undefined, assigneeId: undefined, dueDate: undefined, subtasks: [] } as unknown as TaskDto);
    expect(form).toMatchObject({ description: '', assigneeId: '', dueDate: '' });
    expect(form.subtasks).toHaveLength(3);
  });
});

describe('validateTaskForm', () => {
  const ok = { ...emptyForm(), title: 'Algo', projectName: 'iMujer' };

  it('needs a name and a project, with the exact messages', () => {
    expect(validateTaskForm({ ...ok, title: '   ' })).toEqual({ ok: false, field: 'title', message: 'Escribe el nombre de la tarea.' });
    expect(validateTaskForm({ ...ok, projectName: ' ' })).toEqual({ ok: false, field: 'project', message: 'Elige o escribe un proyecto.' });
    expect(validateTaskForm(ok)).toEqual({ ok: true });
  });

  it('checks the title first when both are missing', () => {
    expect(validateTaskForm(emptyForm())).toMatchObject({ field: 'title' });
  });

  it('holds the limits of the spec', () => {
    expect(validateTaskForm({ ...ok, title: 'x'.repeat(201) })).toMatchObject({ ok: false, field: 'title' });
    expect(validateTaskForm({ ...ok, projectName: 'p'.repeat(101) })).toMatchObject({ ok: false, field: 'project' });
    expect(validateTaskForm({ ...ok, title: 'x'.repeat(200) })).toEqual({ ok: true });
  });
});

describe('diffTask', () => {
  it('returns nothing when nothing changed, even with empty extra subtask rows', () => {
    const form = formFromTask(original);
    expect(diffTask(original, { ...form, subtasks: [...form.subtasks, { text: '', done: false }] })).toEqual({});
  });

  it('returns only the date when only the date changed', () => {
    expect(diffTask(original, { ...formFromTask(original), dueDate: '2026-11-01' })).toEqual({ dueDate: '2026-11-01' });
  });

  it('clears optional fields with null', () => {
    const form = { ...formFromTask(original), dueDate: '', description: '  ', assigneeId: '' };
    expect(diffTask(original, form)).toEqual({ dueDate: null, description: null, assigneeId: null });
  });

  it('sends the title, project, priority and assignee when they change', () => {
    const form = { ...formFromTask(original), title: ' Nuevo ', projectName: 'SECOP II', priority: 3 as const, assigneeId: 'm2' };
    expect(diffTask(original, form)).toEqual({ title: 'Nuevo', projectName: 'SECOP II', priority: 3, assigneeId: 'm2' });
  });

  it('does not treat a different capitalization of the same project as a change', () => {
    expect(diffTask(original, { ...formFromTask(original), projectName: ' IMUJER ' })).toEqual({});
  });

  it('never includes the status: moving a card is its own operation', () => {
    expect(diffTask(original, { ...formFromTask(original), status: 'done' })).toEqual({});
  });

  it('sends the whole subtask list, without empty rows, when one is ticked, edited, added or removed', () => {
    const base = formFromTask(original);
    expect(diffTask(original, { ...base, subtasks: [{ id: 's1', text: 'Leer', done: true }, { id: 's2', text: 'Marcar', done: true }] }).subtasks).toEqual([
      { id: 's1', text: 'Leer', done: true },
      { id: 's2', text: 'Marcar', done: true },
    ]);
    expect(diffTask(original, { ...base, subtasks: [...base.subtasks, { text: 'Nueva', done: false }] }).subtasks).toHaveLength(3);
    expect(diffTask(original, { ...base, subtasks: [base.subtasks[0]] }).subtasks).toEqual([{ id: 's1', text: 'Leer', done: true }]);
  });
});

describe('toCreateArgs', () => {
  it('drops empty optional fields and empty subtask rows', () => {
    const form = { ...emptyForm('doing'), title: ' Nueva ', projectName: ' iMujer ', subtasks: [{ text: 'a', done: false }, { text: ' ', done: false }, { text: 'b', done: true }] };
    expect(toCreateArgs(form)).toEqual({ title: 'Nueva', projectName: 'iMujer', priority: 2, status: 'doing', subtasks: [{ text: 'a', done: false }, { text: 'b', done: true }] });
  });

  it('includes description, assignee and date when given', () => {
    const form = { ...emptyForm(), title: 'T', projectName: 'P', description: ' Texto ', assigneeId: 'm1', dueDate: '2026-11-02', priority: 3 as const };
    expect(toCreateArgs(form)).toMatchObject({ description: 'Texto', assigneeId: 'm1', dueDate: '2026-11-02', priority: 3 });
  });
});
