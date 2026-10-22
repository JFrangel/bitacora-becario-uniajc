import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sparks } from '../../lib/sparks';
import { LandedProvider, useLanded } from './landed';

vi.mock('../../lib/sparks', () => ({ sparks: vi.fn() }));

let api: ReturnType<typeof useLanded>;
function Probe() {
  api = useLanded();
  return <output data-testid="landed">{api.landedId ?? ''}</output>;
}

const addCard = (id: string, column: string) => {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = id;
  card.dataset.col = column;
  document.body.append(card);
  return card;
};
const frames = async (count: number) => {
  for (let i = 0; i < count; i += 1) await act(async () => void vi.advanceTimersByTime(17));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.mocked(sparks).mockClear();
  render(
    <LandedProvider>
      <Probe />
    </LandedProvider>,
  );
});
afterEach(() => {
  document.querySelectorAll('.card').forEach((card) => card.remove());
  vi.useRealTimers();
});

describe('LandedProvider · where the sparks go', () => {
  it('lets them off at the card as soon as it is in its new column', async () => {
    const card = addCard('t1', 'doing');
    act(() => api.mark('t1', 'doing'));
    await frames(2);
    expect(sparks).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sparks).mock.calls[0][0]).toBe(card);
  });

  it('waits while the card is still in the old row, and does not let them off there', async () => {
    const card = addCard('t1', 'todo');
    act(() => api.mark('t1', 'doing'));
    await frames(10);
    expect(sparks).not.toHaveBeenCalled();
    card.dataset.col = 'doing'; // el servidor ya movió la tarjeta en pantalla
    await frames(2);
    expect(sparks).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sparks).mock.calls[0][0]).toBe(card);
  });

  it('follows the card when it is replaced by a new element in the new column', async () => {
    addCard('t1', 'todo');
    act(() => api.mark('t1', 'review'));
    await frames(4);
    document.querySelector('.card')!.remove();
    const arrived = addCard('t1', 'review');
    await frames(2);
    expect(vi.mocked(sparks).mock.calls[0][0]).toBe(arrived);
  });

  it('gives up after a while instead of letting them off in the wrong place', async () => {
    addCard('t1', 'todo');
    act(() => api.mark('t1', 'doing'));
    await act(async () => void vi.advanceTimersByTime(4000));
    expect(sparks).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="landed"]')!.textContent).toBe('');
  });

  it('waits for a created card to exist before letting them off', async () => {
    act(() => api.mark('nueva', 'todo'));
    await frames(5);
    expect(sparks).not.toHaveBeenCalled();
    const card = addCard('nueva', 'todo');
    await frames(2);
    expect(vi.mocked(sparks).mock.calls[0][0]).toBe(card);
  });

  it('makes the card bounce only once it has landed, for under a second', async () => {
    const card = addCard('t1', 'todo');
    act(() => api.mark('t1', 'doing'));
    await frames(5);
    expect(document.querySelector('[data-testid="landed"]')!.textContent).toBe('');
    card.dataset.col = 'doing';
    await frames(2);
    expect(document.querySelector('[data-testid="landed"]')!.textContent).toBe('t1');
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(document.querySelector('[data-testid="landed"]')!.textContent).toBe('');
  });

  it('without a destination column it works as before: the card just has to exist', async () => {
    const card = addCard('t1', 'todo');
    act(() => api.mark('t1'));
    await frames(2);
    expect(vi.mocked(sparks).mock.calls[0][0]).toBe(card);
  });
});
