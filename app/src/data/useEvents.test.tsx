import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../audience';
import { fake } from '../test/fakeConvex';
import { useEvents } from './useEvents';

vi.mock('convex/react', async () => (await import('../test/fakeConvex')).convexReactMock);

const renders = { count: 0 };
function Probe({ enabled = true, subjectId }: { enabled?: boolean; subjectId?: string }) {
  renders.count += 1;
  const { events, loading } = useEvents({ enabled, subjectId });
  return (
    <output data-testid="out">
      {loading ? 'cargando' : `${events.length} eventos`}
    </output>
  );
}

const draw = (props: { enabled?: boolean; subjectId?: string } = {}) =>
  render(
    <SessionProvider value={{ audience: 'owner', memberId: 'm1', name: 'Jose', roleLabel: 'Becario', includesJournal: true, showsDescriptions: true }}>
      <Probe {...props} />
    </SessionProvider>,
  );

beforeEach(() => {
  fake.reset();
  renders.count = 0;
  fake.setQuery('events:list', { items: [{ id: 'e1' }, { id: 'e2' }], nextCursor: null });
});

describe('useEvents', () => {
  it('does not loop: asking for the history paints a handful of times, not endlessly (Convex re-subscribes when the requests object changes)', async () => {
    draw();
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('2 eventos'));
    const settled = renders.count;
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(renders.count).toBe(settled);
    expect(settled).toBeLessThan(10);
  });

  it('does not loop either when nothing is requested (the task panel is closed)', async () => {
    draw({ enabled: false });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.getByTestId('out').textContent).toBe('0 eventos');
    expect(renders.count).toBeLessThan(10);
  });

  it('asks again from the first page when the subject changes', async () => {
    const { rerender } = draw({ subjectId: 't1' });
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('2 eventos'));
    rerender(
      <SessionProvider value={{ audience: 'owner', memberId: 'm1', name: 'Jose', roleLabel: 'Becario', includesJournal: true, showsDescriptions: true }}>
        <Probe subjectId="t2" />
      </SessionProvider>,
    );
    await waitFor(() => expect(fake.asked.some((q) => q.name === 'events:list' && (q.args as { subjectId?: string }).subjectId === 't2')).toBe(true));
  });
});
