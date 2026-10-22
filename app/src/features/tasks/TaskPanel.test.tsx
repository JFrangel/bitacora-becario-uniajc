import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../../../convex/lib/audience';
import type { EventDto } from '../../../convex/lib/events';
import { ToastProvider } from '../../shell/Toast';
import { TaskPanel } from './TaskPanel';
import type { TaskPanelProps } from './TaskPanel';

const task = {
  id: 't1',
  title: 'Revisar convenio',
  description: 'Detalle del convenio',
  projectId: 'p1',
  projectName: 'iMujer',
  projectColorSlot: 1,
  assigneeId: 'm1',
  assigneeName: 'Ana',
  dueDate: '2026-10-24',
  priority: 2,
  status: 'doing',
  order: 1,
  subtasks: [{ id: 's1', text: 'Leer', done: true }],
} as unknown as TaskDto;

const history: EventDto[] = [
  { id: 'e1', at: Date.UTC(2026, 9, 21, 14, 0), actorId: 'm2', actorName: 'Luis', actorRole: 'Supervisor', type: 'task.moved', subjectKind: 'task', subjectTitle: 'Revisar convenio', detail: { from: 'todo', to: 'doing' } } as unknown as EventDto,
];

function draw(extra: Partial<TaskPanelProps> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onCreate: vi.fn(async () => {}),
    onUpdate: vi.fn(async () => {}),
    onMove: vi.fn(async () => true),
    onDelete: vi.fn(async () => {}),
  };
  const props: TaskPanelProps = {
    open: true,
    mode: 'create',
    projects: [{ id: 'p1', name: 'iMujer', colorSlot: 1 }, { id: 'p2', name: 'SECOP II', colorSlot: 2 }],
    people: [{ id: 'm1', name: 'Ana' }, { id: 'm2', name: 'Luis' }],
    readOnly: false,
    canDelete: false,
    meId: 'm9',
    now: Date.UTC(2026, 9, 21, 17),
    ...handlers,
    ...extra,
  };
  render(
    <ToastProvider>
      <TaskPanel {...props} />
    </ToastProvider>,
  );
  return handlers;
}

describe('TaskPanel · new task', () => {
  it('opens as «Nueva tarea» with the status of the column, Media priority and three empty subtasks', () => {
    draw({ initialStatus: 'review' });
    expect(screen.getByRole('dialog', { name: 'Nueva tarea' })).toBeTruthy();
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('review');
    expect((screen.getByRole('radio', { name: /Media/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByRole('textbox', { name: /^Tarea \d$/ })).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Crear tarea' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Eliminar tarea' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre de la tarea'));
  });

  it('shows the exact help texts', () => {
    draw();
    expect(screen.getByPlaceholderText('Ej. Revisar cláusulas del convenio')).toBeTruthy();
    expect(screen.getByPlaceholderText('¿Qué hay que hacer y qué se espera como resultado?')).toBeTruthy();
    expect(screen.getByText('Evita datos personales de terceros.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Escribe o elige un proyecto')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Sin asignar' })).toBeTruthy();
  });

  it('suggests the existing projects', () => {
    draw();
    expect([...document.querySelectorAll('datalist option')].map((o) => o.getAttribute('value'))).toEqual(['iMujer', 'SECOP II']);
  });

  it('does not send a blank name and says so, with the focus on it', async () => {
    const user = userEvent.setup();
    const { onCreate } = draw();
    await user.type(screen.getByLabelText('Proyecto o área'), 'iMujer');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(screen.getByRole('alert').textContent).toBe('Escribe el nombre de la tarea.');
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre de la tarea'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('does not send without a project and says so', async () => {
    const user = userEvent.setup();
    const { onCreate } = draw();
    await user.type(screen.getByLabelText('Nombre de la tarea'), '   ');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(screen.getByRole('alert').textContent).toBe('Escribe el nombre de la tarea.');
    await user.type(screen.getByLabelText('Nombre de la tarea'), 'Algo');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(screen.getByRole('alert').textContent).toBe('Elige o escribe un proyecto.');
    expect(document.activeElement).toBe(screen.getByLabelText('Proyecto o área'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('creates the task with only the name and the project (everything else is optional), then closes', async () => {
    const user = userEvent.setup();
    const { onCreate, onClose } = draw({ initialStatus: 'doing' });
    await user.type(screen.getByLabelText('Nombre de la tarea'), '  Nueva tarea ');
    await user.type(screen.getByLabelText('Proyecto o área'), 'SECOP II');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCreate).toHaveBeenCalledWith({ title: 'Nueva tarea', projectName: 'SECOP II', priority: 2, status: 'doing' });
    expect(screen.getByRole('status').textContent).toBe('Tarea creada en «En curso»');
  });

  it('sends everything that was filled in', async () => {
    const user = userEvent.setup();
    const { onCreate } = draw({ initialDate: '2026-11-02' });
    await user.type(screen.getByLabelText('Nombre de la tarea'), 'Completa');
    await user.type(screen.getByLabelText(/Descripción/), 'Texto');
    await user.type(screen.getByLabelText('Tarea 1'), 'Paso uno');
    await user.type(screen.getByLabelText('Proyecto o área'), 'iMujer');
    await user.selectOptions(screen.getByLabelText('Responsable'), 'm2');
    await user.click(screen.getByRole('radio', { name: /Alta/ }));
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Completa',
      projectName: 'iMujer',
      description: 'Texto',
      assigneeId: 'm2',
      dueDate: '2026-11-02',
      priority: 3,
      status: 'todo',
      subtasks: [{ text: 'Paso uno', done: false }],
    });
  });

  it('shows what the server answered when it refuses, and stays open', async () => {
    const user = userEvent.setup();
    const { onClose } = draw({ onCreate: vi.fn(async () => { throw Object.assign(new Error('x'), { data: { code: 'VALIDATION', message: 'Máximo 20 subtareas.' } }); }) });
    await user.type(screen.getByLabelText('Nombre de la tarea'), 'Algo');
    await user.type(screen.getByLabelText('Proyecto o área'), 'iMujer');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Máximo 20 subtareas.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('tells you when you reach 20 subtasks', async () => {
    const user = userEvent.setup();
    draw();
    for (let i = 0; i < 17; i += 1) await user.click(screen.getByRole('button', { name: '＋ Añadir otra' }));
    expect(screen.getAllByRole('textbox', { name: /^Tarea \d+$/ })).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: '＋ Añadir otra' }));
    expect(screen.getByRole('status').textContent).toBe('Máximo 20 subtareas.');
  });
});

describe('TaskPanel · task detail', () => {
  const edit = (extra: Partial<TaskPanelProps> = {}) => draw({ mode: 'edit', task, events: history, ...extra });

  it('fills the form with the task and shows its activity', () => {
    edit();
    expect(screen.getByRole('dialog', { name: 'Detalle de la tarea' })).toBeTruthy();
    expect((screen.getByLabelText('Nombre de la tarea') as HTMLInputElement).value).toBe('Revisar convenio');
    expect((screen.getByLabelText('Proyecto o área') as HTMLInputElement).value).toBe('iMujer');
    expect((screen.getByLabelText('Responsable') as HTMLSelectElement).value).toBe('m1');
    expect((screen.getByLabelText(/Fecha límite/) as HTMLInputElement).value).toBe('2026-10-24');
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('doing');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
    const log = screen.getByRole('heading', { name: 'Actividad de esta tarea' }).parentElement!;
    expect(within(log).getByText(/Luis movió/)).toBeTruthy();
  });

  it('sends only the date when only the date changed', async () => {
    const user = userEvent.setup();
    const { onUpdate, onMove, onClose } = edit();
    fireDate(screen.getByLabelText(/Fecha límite/), '2026-11-01');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onUpdate).toHaveBeenCalledWith('t1', { dueDate: '2026-11-01' });
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Cambios guardados.');
  });

  it('moves the card, not edits it, when only the status changed', async () => {
    const user = userEvent.setup();
    const { onUpdate, onMove } = edit();
    await user.selectOptions(screen.getByLabelText('Estado'), 'done');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onMove).toHaveBeenCalledWith('t1', 'done'));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('closes without calling anything when nothing changed', async () => {
    const user = userEvent.setup();
    const { onUpdate, onMove, onClose } = edit();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onClose).toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('only the owner can delete, and it asks twice', async () => {
    const user = userEvent.setup();
    const { onDelete, onClose } = edit({ canDelete: true });
    await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Pulsa de nuevo para eliminar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onDelete).toHaveBeenCalledWith('t1');
  });

  it('shows no delete button to invited people', () => {
    edit({ canDelete: false });
    expect(screen.queryByRole('button', { name: /Eliminar/ })).toBeNull();
  });
});

describe('TaskPanel · read-only link', () => {
  it('has no save, no delete, no add or remove, and every field is disabled', () => {
    draw({ mode: 'edit', task, readOnly: true, canDelete: false, events: history });
    expect(screen.queryByRole('button', { name: /Guardar|Crear|Eliminar|Añadir|Cancelar|Quitar/ })).toBeNull();
    for (const field of [...document.querySelectorAll<HTMLInputElement>('input, select, textarea')]) expect(field.disabled, field.getAttribute('aria-label') ?? field.name).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Detalle de la tarea' })).toBeTruthy();
  });

  it('shows the description only if the data carries it', () => {
    const { description: _omit, ...withoutDescription } = task as TaskDto & { description?: string };
    draw({ mode: 'edit', task: withoutDescription as TaskDto, readOnly: true });
    expect(screen.queryByLabelText(/Descripción/)).toBeNull();
  });

  it('shows the description when the data carries it', () => {
    draw({ mode: 'edit', task, readOnly: true });
    expect((screen.getByLabelText(/Descripción/) as HTMLTextAreaElement).value).toBe('Detalle del convenio');
  });
});

import { fireEvent } from '@testing-library/react';
function fireDate(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}
