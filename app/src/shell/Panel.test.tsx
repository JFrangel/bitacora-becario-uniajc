import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Panel } from './Panel';

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>abrir</button>
      <Panel
        open={open}
        title="Nueva tarea"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <form>
          <input aria-label="Nombre" />
          <input aria-label="Proyecto" />
          <button type="button">Guardar</button>
        </form>
      </Panel>
    </div>
  );
}

afterEach(() => vi.useRealTimers());

describe('Panel', () => {
  it('is a labelled modal dialog that appears only while open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByText('abrir'));
    const dialog = screen.getByRole('dialog', { name: 'Nueva tarea' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.classList.contains('open')).toBe(true);
  });

  it('puts the focus on the first field when it opens and gives it back when it closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByText('abrir');
    await user.click(opener);
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre'));
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(opener);
  });

  it('keeps Tab and Shift+Tab inside the panel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('abrir'));
    const close = screen.getByRole('button', { name: 'Cerrar' });
    const save = screen.getByText('Guardar');
    save.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(save);
  });

  it('closes with Escape and by clicking the dimmed background, and says so once each time', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByText('abrir'));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText('abrir'));
    await user.click(document.querySelector('.scrim')!);
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.click(screen.getByText('abrir'));
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('leaves the DOM once the exit animation is over', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Panel open title="X" onClose={() => {}}><input aria-label="a" /></Panel>);
    expect(screen.getByRole('dialog')).toBeTruthy();
    rerender(<Panel open={false} title="X" onClose={() => {}}><input aria-label="a" /></Panel>);
    expect(document.querySelector('.drawer')!.classList.contains('open')).toBe(false);
    act(() => vi.advanceTimersByTime(500));
    expect(document.querySelector('.drawer')).toBeNull();
  });
});
