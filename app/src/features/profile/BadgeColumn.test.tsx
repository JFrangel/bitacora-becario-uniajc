import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../../appearance/AppearanceProvider';
import { SessionProvider } from '../../audience';
import { fake } from '../../test/fakeConvex';
import { OWNER_BADGE, SESSIONS } from '../../test/badgeFixtures';
import { clearFaceCache } from './badgeFaces';
import { BadgeColumn } from './BadgeColumn';
import { columnTuning } from './geometry';
import { ProfileUiProvider, useProfileUi } from './ProfileUi';

const env = vi.hoisted(() => ({ webgl: true, anchor: undefined as unknown, size: undefined as unknown, strapLength: undefined as unknown }));
vi.mock('convex/react', async () => (await import('../../test/fakeConvex')).convexReactMock);
vi.mock('./badgeSupport', async (original) => ({ ...(await original<typeof import('./badgeSupport')>()), hasWebGL: () => env.webgl }));
vi.mock('./photo', async (original) => ({ ...(await original<typeof import('./photo')>()), loadImage: vi.fn(async () => null) }));
vi.mock('./badgeFaces', async (original) => ({
  ...(await original<typeof import('./badgeFaces')>()),
  loadBadgeFonts: async () => {},
  drawBadgeFaces: vi.fn(async () => (await import('../../test/badgeFixtures')).FACES),
}));
vi.mock('../../reactbits/Lanyard/Lanyard', async () => {
  const { createElement } = await import('react');
  return {
    default: (props: Record<string, unknown>) => {
      env.anchor = props.anchor;
      env.size = props.size;
      env.strapLength = props.strapLength;
      return createElement('canvas', { 'data-testid': 'lanyard' });
    },
  };
});

const wide = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: matches && query.includes('min-width: 1101px'), addEventListener() {}, removeEventListener() {} }));

/** Dónde está cada cosa en pantalla (jsdom no calcula posiciones). */
const rects: Record<string, [number, number]> = { app: [100, 1500], 'journal-badge': [900, 1240], invite: [940, 1000], appearance: [1068, 1200] };
function stubLayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const key = this.id === 'invite' ? 'invite' : (Object.keys(rects).find((name) => this.classList.contains(name)) ?? '');
    const [left, right] = rects[key] ?? [0, 0];
    return { left, right, top: 0, bottom: 0, width: right - left, height: 0, x: left, y: 0, toJSON() {} };
  });
}

function Block() {
  const ui = useProfileUi();
  return (
    <>
      <button onClick={ui.openPanel}>abrir perfil</button>
      <button onClick={ui.closePanel}>cerrar perfil</button>
    </>
  );
}

const draw = (audience: 'owner' | 'viewer' = 'owner', invite = true) =>
  render(
    <AppearanceProvider>
      <SessionProvider value={SESSIONS[audience]}>
        <ProfileUiProvider>
          <Block />
          <div className="app">
            <header className="nav">
              {invite && <button id="invite">Invitar</button>}
              <div className="appearance" />
            </header>
            <aside className="journal-badge">
              <BadgeColumn />
            </aside>
          </div>
        </ProfileUiProvider>
      </SessionProvider>
    </AppearanceProvider>,
  );
const app = () => document.querySelector<HTMLElement>('.app')!;
const hits = () => [...document.querySelectorAll<HTMLElement>('.badge-hit')];

beforeEach(() => {
  fake.reset();
  env.webgl = true;
  clearFaceCache();
  fake.setQuery('profile:get', OWNER_BADGE);
  fake.setQuery('viewer:profile', OWNER_BADGE);
  stubLayout();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BadgeColumn', () => {
  it('does not exist on screens narrower than 1101 px', () => {
    wide(false);
    draw();
    expect(document.querySelector('.badge-col')).toBeNull();
    expect(app().classList.contains('journal-wide')).toBe(false);
    expect(fake.asked.some((q) => q.name === 'profile:get')).toBe(true);
  });

  it('hangs the 3D badge from the top bar of the Bitácora', async () => {
    wide(true);
    draw();
    expect(await screen.findByTestId('lanyard')).toBeTruthy();
    expect(document.getElementById('journalBadgeStage')).toBeTruthy();
  });

  it('opens the gap in the bar and publishes where the strap hangs and where the pointer zones go', async () => {
    wide(true);
    draw();
    await screen.findByTestId('lanyard');
    expect(app().classList.contains('journal-wide')).toBe(true);
    // El hueco está en el centro entre «Invitar» (1000) y «Apariencia» (1068): 1034.
    expect(app().style.getPropertyValue('--stage-left')).toBe('-1080.0px');
    // La aplicación mide 1400 (de 100 a 1500) y el lienzo sobresale 280 px a cada lado.
    expect(app().style.getPropertyValue('--stage-w')).toBe('1960.0px');
    expect(app().style.getPropertyValue('--hit-left')).toBe('-56.0px');
    expect(app().style.getPropertyValue('--strap-left')).toBe('120.0px');
    expect(app().style.getPropertyValue('--nav-h')).toBe('0px');
  });

  it('hangs the strap from the gap in the bar: the canvas is anchored at that fraction of its width', async () => {
    wide(true);
    draw();
    await screen.findByTestId('lanyard');
    await waitFor(() => expect(env.anchor).toBeCloseTo((1034 - (100 - 280)) / 1960, 3));
  });

  it('keeps the card the size it had with the old canvas, now that the canvas is as tall as the window', async () => {
    wide(true);
    draw();
    await screen.findByTestId('lanyard');
    const { size, strapLength } = columnTuning(window.innerHeight);
    expect(env.size).toBeCloseTo(size);
    expect(env.strapLength).toBeCloseTo(strapLength);
    expect(env.size as number).toBeLessThan(0.66); // un lienzo más alto pide un tamaño relativo menor
  });

  it('in the read-only link, which has no «Invitar», uses the free space left of «Apariencia»', async () => {
    wide(true);
    draw('viewer', false);
    await screen.findByTestId('lanyard');
    expect(app().style.getPropertyValue('--strap-left')).toBe(`${1051 - 900 - 14}.0px`);
  });

  it('keeps the canvas out of the way and forwards the pointer from the two zones (below the bar and on the strap itself)', async () => {
    wide(true);
    draw();
    const canvas = (await screen.findByTestId('lanyard')) as HTMLCanvasElement;
    await waitFor(() => expect(hits().every((zone) => !zone.hidden)).toBe(true));
    expect(hits()).toHaveLength(2);
    expect(hits()[1].classList.contains('strap')).toBe(true);
    expect(canvas.style.pointerEvents).toBe('none');

    const seen: string[] = [];
    canvas.addEventListener('pointerdown', () => seen.push('down'));
    canvas.addEventListener('pointermove', () => seen.push('move'));
    hits()[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    hits()[1].dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
    expect(seen).toEqual(['down', 'move']);
  });

  it('the zones stay hidden until the 3D canvas is there', async () => {
    wide(true);
    draw();
    expect(hits().every((zone) => zone.hidden)).toBe(true);
    await screen.findByTestId('lanyard');
  });

  it('is removed while the profile panel is open (never two 3D badges), but keeps the gap in the bar', async () => {
    wide(true);
    draw();
    await screen.findByTestId('lanyard');
    act(() => screen.getByRole('button', { name: 'abrir perfil' }).click());
    expect(screen.queryByTestId('lanyard')).toBeNull();
    expect(hits()).toHaveLength(0);
    expect(app().classList.contains('journal-wide')).toBe(true);
  });

  it('comes back when the profile panel finishes closing', async () => {
    wide(true);
    draw();
    await screen.findByTestId('lanyard');
    act(() => screen.getByRole('button', { name: 'abrir perfil' }).click());
    act(() => screen.getByRole('button', { name: 'cerrar perfil' }).click());
    expect(await screen.findByTestId('lanyard')).toBeTruthy();
  });

  it('leaves the bar as it was when the Bitácora is left', async () => {
    wide(true);
    const { unmount } = draw();
    await screen.findByTestId('lanyard');
    const bar = app();
    unmount();
    expect(bar.classList.contains('journal-wide')).toBe(false);
    expect(bar.style.getPropertyValue('--stage-w')).toBe('');
  });

  it('draws nothing while the badge data has not arrived', () => {
    wide(true);
    fake.queries = {};
    draw();
    expect(document.querySelector('.badge-stage')).toBeNull();
    expect(hits()).toHaveLength(0);
  });
});
