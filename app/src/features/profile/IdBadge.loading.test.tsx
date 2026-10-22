import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../../appearance/AppearanceProvider';
import { SessionProvider } from '../../audience';
import { OWNER_BADGE, SESSIONS } from '../../test/badgeFixtures';
import { clearFaceCache, drawBadgeFaces } from './badgeFaces';
import { IdBadge } from './IdBadge';

// El 3D todavía no terminó de descargarse: el componente de Lanyard nunca llega.
vi.mock('./badgeSupport', async (original) => ({ ...(await original<typeof import('./badgeSupport')>()), hasWebGL: () => true }));
vi.mock('./photo', async (original) => ({ ...(await original<typeof import('./photo')>()), loadImage: vi.fn(async () => null) }));
vi.mock('./badgeFaces', async (original) => ({
  ...(await original<typeof import('./badgeFaces')>()),
  loadBadgeFonts: async () => {},
  drawBadgeFaces: vi.fn(async () => (await import('../../test/badgeFixtures')).FACES),
}));
vi.mock('../../reactbits/Lanyard/Lanyard', () => new Promise(() => {}));

const draw = (variant: 'panel' | 'column') =>
  render(
    <AppearanceProvider>
      <SessionProvider value={SESSIONS.owner}>
        <IdBadge data={OWNER_BADGE} design="olimpo" variant={variant} />
      </SessionProvider>
    </AppearanceProvider>,
  );

beforeEach(() => {
  clearFaceCache();
  vi.mocked(drawBadgeFaces).mockClear();
});

describe('IdBadge while the 3D is still downloading', () => {
  it('in the profile panel shows the flat card, so the panel is not empty', async () => {
    draw('panel');
    expect(await screen.findByAltText('Carné de Jose Frangel Padilla Camacho')).toBeTruthy();
  });

  it('in the Bitácora column shows nothing: a flat card there would fill the whole screen (the canvas is as big as the window)', async () => {
    draw('column');
    await waitFor(() => expect(drawBadgeFaces).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.querySelector('.badge-flat')).toBeNull();
    expect(document.querySelector('.badge-stage')!.getAttribute('data-mode')).toBe('3d');
  });
});
