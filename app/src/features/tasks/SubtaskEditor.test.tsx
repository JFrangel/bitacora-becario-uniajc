import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SubtaskEditor } from './SubtaskEditor';
import type { SubtaskRow } from './taskForm';

const rows = (n: number): SubtaskRow[] => Array.from({ length: n }, () => ({ text: '', done: false }));

function Harness({ initial = rows(3), onLimit, readOnly }: { initial?: SubtaskRow[]; onLimit?: () => void; readOnly?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SubtaskEditor value={value} onChange={setValue} onLimit={onLimit} readOnly={readOnly} />
      <output data-testid="state">{JSON.stringify(value)}</output>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId('state').textContent!) as SubtaskRow[];
const placeholders = () => screen.getAllByRole('textbox').map((input) => input.getAttribute('placeholder'));

describe('SubtaskEditor', () => {
  it('starts with the rows it is given, numbered «Tarea 1», «Tarea 2», «Tarea 3»', () => {
    render(<Harness />);
    expect(placeholders()).toEqual(['Tarea 1', 'Tarea 2', 'Tarea 3']);
    expect(screen.getByLabelText('Marcar la tarea 2 como hecha')).toBeTruthy();
  });

  it('writes the text and ticks the box', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Tarea 2'), 'Leer las cláusulas');
    await user.click(screen.getByLabelText('Marcar la tarea 2 como hecha'));
    expect(state()[1]).toEqual({ text: 'Leer las cláusulas', done: true });
    expect(state()[0]).toEqual({ text: '', done: false });
  });

  it('removes a row and renumbers the ones after it', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[{ text: 'a', done: false }, { text: 'b', done: false }, { text: 'c', done: true }]} />);
    await user.click(screen.getAllByRole('button', { name: 'Quitar esta subtarea' })[0]);
    expect(state().map((row) => row.text)).toEqual(['b', 'c']);
    expect(placeholders()).toEqual(['Tarea 1', 'Tarea 2']);
    expect(screen.getByLabelText('Marcar la tarea 2 como hecha')).toHaveProperty('checked', true);
  });

  it('adds rows with «＋ Añadir otra» up to 20 and then says so', async () => {
    const user = userEvent.setup();
    const onLimit = vi.fn();
    render(<Harness initial={rows(19)} onLimit={onLimit} />);
    await user.click(screen.getByRole('button', { name: '＋ Añadir otra' }));
    expect(state()).toHaveLength(20);
    expect(onLimit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '＋ Añadir otra' }));
    expect(state()).toHaveLength(20);
    expect(onLimit).toHaveBeenCalledTimes(1);
  });

  it('limits each subtask to 200 characters', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Tarea 1').getAttribute('maxlength')).toBe('200');
  });

  it('is only readable when read-only: disabled, nothing to add or remove', () => {
    render(<Harness readOnly initial={[{ text: 'a', done: true }]} />);
    expect(screen.getByLabelText('Tarea 1')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Marcar la tarea 1 como hecha')).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
