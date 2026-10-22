import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appError, fake } from '../../test/fakeConvex';
import { ToastProvider } from '../../shell/Toast';
import { boardCoordinates } from './BoardDnd';
import { MoveMenu } from './MoveMenu';
import { useMoveTask } from './useMoveTask';

vi.mock('convex/react', async () => (await import('../../test/fakeConvex')).convexReactMock);
vi.mock('@convex-dev/auth/react', async () => (await import('../../test/fakeConvex')).convexAuthMock);

beforeEach(() => fake.reset());

describe('MoveMenu', () => {
  it('lists the other three columns and moves the card to the one you pick', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<MoveMenu taskId="t1" status="doing" title="Informe" onMove={onMove} />);
    const button = screen.getByRole('button', { name: 'Mover «Informe» a…' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await user.click(button);
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(items).toEqual(['Por hacer', 'En revisión', 'Completada']);
    await user.click(screen.getByRole('menuitem', { name: 'En revisión' }));
    expect(onMove).toHaveBeenCalledWith('t1', 'review');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('puts the focus on the first option and closes with Escape giving the focus back', async () => {
    const user = userEvent.setup();
    render(<MoveMenu taskId="t1" status="todo" title="Informe" onMove={vi.fn()} />);
    const button = screen.getByRole('button', { name: /Mover/ });
    await user.click(button);
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'En curso' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('closes when clicking elsewhere', async () => {
    const user = userEvent.setup();
    render(<MoveMenu taskId="t1" status="todo" title="Informe" onMove={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Mover/ }));
    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('useMoveTask', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

  it('sends the move to the server with the neighbour it should land before', async () => {
    const { result } = renderHook(() => useMoveTask(), { wrapper });
    await expect(result.current('t1', 'review', 't2')).resolves.toBe(true);
    expect(fake.called('tasks:move')[0].args).toEqual({ id: 't1', status: 'review', beforeId: 't2' });
  });

  it('(punto 1) says «Esa tarea ya no existe.» when someone deleted the task meanwhile', async () => {
    fake.onMutation('tasks:move', async () => {
      throw appError('TASK_NOT_FOUND');
    });
    function Inner() {
      const move = useMoveTask();
      return <button onClick={() => void move('t1', 'done')}>mover</button>;
    }
    render(<ToastProvider><Inner /></ToastProvider>);
    await userEvent.setup().click(screen.getByText('mover'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Esa tarea ya no existe.'));
  });

  it('says it could not move the card for any other failure, and reports false', async () => {
    fake.onMutation('tasks:move', async () => {
      throw new Error('sin red');
    });
    let outcome: boolean | undefined;
    function Inner() {
      const move = useMoveTask();
      return <button onClick={() => void move('t1', 'done').then((ok) => { outcome = ok; })}>mover</button>;
    }
    render(<ToastProvider><Inner /></ToastProvider>);
    await userEvent.setup().click(screen.getByText('mover'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No se pudo mover la tarea. Inténtalo de nuevo.'));
    expect(outcome).toBe(false);
  });
});

describe('boardCoordinates (arrow keys while a card is lifted)', () => {
  const rect = (left: number, top: number, width = 200, height = 80) => ({ left, top, width, height, right: left + width, bottom: top + height });
  // Dos columnas de dos tarjetas: a b | c d
  const rects = new Map<string, ReturnType<typeof rect>>([
    ['a', rect(0, 0)], ['b', rect(0, 100)], ['c', rect(300, 0)], ['d', rect(300, 100)], ['active', rect(0, 200)],
  ]);
  const context = (collisionRect: ReturnType<typeof rect>) =>
    ({
      context: {
        active: { id: 'active' },
        droppableRects: rects,
        droppableContainers: { getEnabled: () => [...rects.keys()].map((id) => ({ id })) },
        collisionRect,
      },
      currentCoordinates: { x: 0, y: 0 },
    }) as never;
  const press = (code: string, from: ReturnType<typeof rect>) => {
    const event = { code, preventDefault: vi.fn() } as unknown as KeyboardEvent;
    return { result: boardCoordinates(event, context(from)), event };
  };

  it('ArrowUp goes to the closest card above in the same column', () => {
    const { result } = press('ArrowUp', rect(0, 200));
    expect(result).toEqual({ x: 0, y: 100 });
  });

  it('ArrowRight goes to the closest card of the next column at the same height', () => {
    const { result } = press('ArrowRight', rect(0, 100));
    expect(result).toEqual({ x: 300, y: 100 });
  });

  it('does nothing when there is nowhere to go, and ignores other keys', () => {
    expect(press('ArrowLeft', rect(0, 100)).result).toBeUndefined();
    const other = press('KeyA', rect(0, 100));
    expect(other.result).toBeUndefined();
    expect(other.event.preventDefault).not.toHaveBeenCalled();
  });
});
