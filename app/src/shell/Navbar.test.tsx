import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppearanceProvider } from '../appearance/AppearanceProvider';
import type { Audience } from '../audience';
import { Navbar } from './Navbar';

const draw = (props: Partial<Parameters<typeof Navbar>[0]> = {}) => {
  const handlers = { onSelect: vi.fn(), onInvite: vi.fn(), onProfile: vi.fn() };
  render(
    <AppearanceProvider>
      <Navbar audience="owner" active="board" whoText="Tú · Becario" initials="JP" profileLabel="Ver mi perfil" {...handlers} {...props} />
    </AppearanceProvider>,
  );
  return handlers;
};
const tabNames = () => within(screen.getByRole('navigation', { name: 'Secciones' })).getAllByRole('button').map((b) => b.textContent?.replace(/\d+$/, ''));

describe('Navbar', () => {
  it('shows the four sections to the owner, with the draft count on Bitácora', () => {
    draw({ draftCount: 2 });
    expect(tabNames()).toEqual(['Tablero', 'Calendario', 'Bitácora', 'Historial']);
    expect(document.querySelector('.badge')!.textContent).toBe('2');
  });

  it('shows no badge when there are no drafts', () => {
    draw({ draftCount: 0 });
    expect(document.querySelector('.badge')).toBeNull();
  });

  it('hides Bitácora from invited people, even with drafts', () => {
    draw({ audience: 'member', draftCount: 3 });
    expect(tabNames()).toEqual(['Tablero', 'Calendario', 'Historial']);
    expect(document.querySelector('.badge')).toBeNull();
  });

  it.each([
    ['owner', true, true],
    ['member', false, true],
    ['viewer', false, false],
    ['viewer', true, false],
  ] as Array<[Audience, boolean, boolean]>)('%s (journal included: %s) sees the Invitar button = %s', (audience, includesJournal, invite) => {
    draw({ audience, includesJournal });
    expect(screen.queryByRole('button', { name: 'Invitar' }) !== null).toBe(invite);
  });

  it('gives the read-only link the Bitácora only when the owner included it', () => {
    draw({ audience: 'viewer', includesJournal: true });
    expect(tabNames()).toContain('Bitácora');
  });

  it('hides it from a link without the journal', () => {
    draw({ audience: 'viewer', includesJournal: false });
    expect(tabNames()).not.toContain('Bitácora');
  });

  it('marks the active section and reports clicks', async () => {
    const { onSelect, onProfile, onInvite } = draw({ active: 'calendar' });
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Calendario' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Tablero' }).getAttribute('aria-current')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Historial' }));
    expect(onSelect).toHaveBeenCalledWith('history');
    await user.click(screen.getByRole('button', { name: 'Ver mi perfil' }));
    expect(onProfile).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Invitar' }));
    expect(onInvite).toHaveBeenCalled();
  });

  it('shows who is looking and the initials in the profile button', () => {
    draw({ whoText: 'Solo lectura', initials: 'JP', audience: 'viewer' });
    expect(screen.getByText('Solo lectura')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver mi perfil' }).textContent).toBe('JP');
  });

  it('keeps Apariencia available for everyone', () => {
    draw({ audience: 'viewer' });
    expect(screen.getByRole('button', { name: 'Apariencia' })).toBeTruthy();
  });

  it('uses two rows on a phone (≤ 640 px): brand and person on top, sections below', () => {
    const css = readFileSync(join(__dirname, '../styles/layout.css'), 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 640px)'));
    expect(phone).toMatch(/grid-template-areas:\s*"brand who"\s*"tabs tabs"/);
  });
});
