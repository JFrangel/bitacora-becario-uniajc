import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../../audience';
import type { SessionInfo } from '../../audience';
import { fake } from '../../test/fakeConvex';
import { LOCAL_DESIGN_KEYS, useBadgeData, useBadgeDesign } from './useBadge';

vi.mock('convex/react', async () => (await import('../../test/fakeConvex')).convexReactMock);

const OWNER = { name: 'Jose Padilla', roleLabel: 'Becario', isOwner: true, since: 1, updatedAt: 5, badgeDesign: 'suizo' };
const sessions: Record<'owner' | 'member' | 'viewer', SessionInfo> = {
  owner: { audience: 'owner', memberId: 'm1', name: 'Jose', roleLabel: 'Becario', includesJournal: true, showsDescriptions: true },
  member: { audience: 'member', memberId: 'm2', name: 'Ana', roleLabel: 'Directora', includesJournal: false, showsDescriptions: true },
  viewer: { audience: 'viewer', shareToken: 'tok', includesJournal: true, showsDescriptions: false },
};

/** Dos lugares de la pantalla (la columna y el panel) que leen y cambian el diseño a la vez. */
function Probe({ label }: { label: string }) {
  const data = useBadgeData();
  const { design, setDesign, isLocal } = useBadgeDesign(data);
  return (
    <div>
      <output aria-label={`${label} diseño`}>{design}</output>
      <output aria-label={`${label} local`}>{String(isLocal)}</output>
      <button onClick={() => void setDesign('poster')}>{label} poster</button>
    </div>
  );
}

const draw = (audience: 'owner' | 'member' | 'viewer') =>
  render(
    <SessionProvider value={sessions[audience]}>
      <Probe label="A" />
      <Probe label="B" />
    </SessionProvider>,
  );
const design = (label: string) => screen.getByLabelText(`${label} diseño`).textContent;

beforeEach(() => {
  fake.reset();
  fake.setQuery('profile:get', OWNER);
  fake.setQuery('viewer:profile', { ...OWNER, badgeDesign: 'circuito' });
});

describe('useBadgeData', () => {
  it('the owner and the guests ask for their own badge; the read-only link asks for the owner\'s with the link token', () => {
    draw('owner');
    expect(fake.asked.filter((q) => q.name === 'viewer:profile')).toHaveLength(0);
    fake.asked = [];
    draw('viewer');
    expect(fake.asked.filter((q) => q.name === 'profile:get')).toHaveLength(0);
    expect(fake.asked.find((q) => q.name === 'viewer:profile')!.args).toEqual({ shareToken: 'tok' });
  });
});

describe('useBadgeDesign · the owner', () => {
  it('reads the design saved in the profile and saves a new one on the server for everyone', async () => {
    const user = userEvent.setup();
    draw('owner');
    expect(design('A')).toBe('suizo');
    await user.click(screen.getByRole('button', { name: 'A poster' }));
    expect(fake.called('profile:update')).toEqual([{ name: 'profile:update', args: { badgeDesign: 'poster' } }]);
    expect(localStorage.length).toBe(0);
  });

  it('defaults to Olimpo while the profile has no design', () => {
    fake.setQuery('profile:get', { ...OWNER, badgeDesign: undefined });
    draw('owner');
    expect(design('A')).toBe('olimpo');
  });
});

describe('useBadgeDesign · guests and the read-only link', () => {
  it('a read-only viewer changes the design only for themself: stored in this browser, never sent to the server', async () => {
    const user = userEvent.setup();
    draw('viewer');
    expect(design('A')).toBe('circuito'); // la elección de la dueña, mientras no haya una propia
    await user.click(screen.getByRole('button', { name: 'A poster' }));
    expect(localStorage.getItem(LOCAL_DESIGN_KEYS.viewer)).toBe('poster');
    expect(fake.calls).toEqual([]);
    expect(screen.getByLabelText('A local').textContent).toBe('true');
  });

  it('every badge on screen follows the same choice at once', async () => {
    const user = userEvent.setup();
    draw('viewer');
    await user.click(screen.getByRole('button', { name: 'B poster' }));
    expect(design('A')).toBe('poster');
    expect(design('B')).toBe('poster');
  });

  it('keeps the choice after reloading, and the owner changing hers does not move it', () => {
    localStorage.setItem(LOCAL_DESIGN_KEYS.viewer, 'clasico');
    draw('viewer');
    expect(design('A')).toBe('clasico');
    act(() => fake.setQuery('viewer:profile', { ...OWNER, badgeDesign: 'olimpo', updatedAt: 9 }));
    expect(design('A')).toBe('clasico');
  });

  it('a guest with an account keeps theirs under another key, also local', async () => {
    const user = userEvent.setup();
    draw('member');
    await user.click(screen.getByRole('button', { name: 'A poster' }));
    expect(localStorage.getItem(LOCAL_DESIGN_KEYS.member)).toBe('poster');
    expect(localStorage.getItem(LOCAL_DESIGN_KEYS.viewer)).toBeNull();
    expect(fake.calls).toEqual([]);
  });

  it('ignores a stored value that is not a design, and still works when the browser refuses to store', async () => {
    localStorage.setItem(LOCAL_DESIGN_KEYS.viewer, 'rojo');
    const user = userEvent.setup();
    draw('viewer');
    expect(design('A')).toBe('circuito');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    await user.click(screen.getByRole('button', { name: 'A poster' }));
    expect(design('A')).toBe('poster');
    setItem.mockRestore();
  });
});
