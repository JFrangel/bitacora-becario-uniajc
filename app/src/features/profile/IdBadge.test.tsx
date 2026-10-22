import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../../appearance/AppearanceProvider';
import { SessionProvider } from '../../audience';
import { OWNER_BADGE, SESSIONS } from '../../test/badgeFixtures';
import { clearFaceCache, drawBadgeFaces } from './badgeFaces';
import { IdBadge } from './IdBadge';

const env = vi.hoisted(() => ({ webgl: false, lanyard: null as null | Record<string, unknown> }));
vi.mock('./badgeSupport', async (original) => ({ ...(await original<typeof import('./badgeSupport')>()), hasWebGL: () => env.webgl }));
vi.mock('./photo', async (original) => ({ ...(await original<typeof import('./photo')>()), loadImage: vi.fn(async () => null) }));
vi.mock('./badgeFaces', async (original) => ({
  ...(await original<typeof import('./badgeFaces')>()),
  loadBadgeFonts: async () => {},
  drawBadgeFaces: vi.fn(async () => ({ ...(await import('../../test/badgeFixtures')).FACES, fx: { size: [1024, 1440], dot: [10, 20, 9], dotColor: '#6aa5ff' } })),
}));
vi.mock('../../reactbits/Lanyard/Lanyard', async () => {
  const { createElement } = await import('react');
  return {
    default: (props: Record<string, unknown>) => {
      env.lanyard = props;
      return createElement('canvas', { 'data-testid': 'lanyard' });
    },
  };
});

const draw = (props: Partial<React.ComponentProps<typeof IdBadge>> = {}) =>
  render(
    <AppearanceProvider>
      <SessionProvider value={SESSIONS.owner}>
        <IdBadge data={OWNER_BADGE} design="olimpo" {...props} />
      </SessionProvider>
    </AppearanceProvider>,
  );

beforeEach(() => {
  env.webgl = false;
  env.lanyard = null;
  clearFaceCache();
  vi.mocked(drawBadgeFaces).mockClear();
});

describe('IdBadge', () => {
  it('describes the badge for screen readers: who it is and what they study', () => {
    draw();
    expect(screen.getByRole('img', { name: 'Carné de Jose Frangel Padilla Camacho, becario de Ingeniería de Sistemas' })).toBeTruthy();
  });

  it('draws nothing until the faces are ready', async () => {
    draw();
    expect(document.querySelector('.badge-stage img, .badge-stage canvas')).toBeNull();
    await screen.findByAltText('Carné de Jose Frangel Padilla Camacho');
  });

  it('without WebGL shows the flat image of the front', async () => {
    draw();
    const image = (await screen.findByAltText('Carné de Jose Frangel Padilla Camacho')) as HTMLImageElement;
    expect(image.className).toBe('badge-flat');
    expect(image.src).toBe('blob:front');
    expect(document.querySelector('.badge-stage')!.getAttribute('data-mode')).toBe('flat');
    expect(screen.queryByTestId('lanyard')).toBeNull();
  });

  it('with «reducir movimiento» also stays flat, even with WebGL', async () => {
    env.webgl = true;
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {} }));
    draw();
    await screen.findByAltText('Carné de Jose Frangel Padilla Camacho');
    expect(screen.queryByTestId('lanyard')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('with WebGL hangs the 3D badge from the strap, centred inside the profile panel', async () => {
    env.webgl = true;
    draw();
    await screen.findByTestId('lanyard');
    expect(env.lanyard).toMatchObject({
      frontImage: 'blob:front',
      backImage: 'blob:back',
      strapImage: 'blob:strap',
      cardColor: '#16181c',
      finish: 'glossy',
      metal: 'silver',
      size: 0.66,
      strapLength: 0.5,
      breeze: 0.3,
      anchor: 'center',
      strapWidth: 0.7,
      bounds: false, // en el panel angosto el límite chocaba con la cuerda y el carné se quedaba atascado arriba
      fx: { dotColor: '#6aa5ff' },
    });
    expect(document.querySelector('.badge-stage')!.getAttribute('data-mode')).toBe('3d');
  });

  it('in the Bitácora column the strap is anchored to the right and thinner', async () => {
    env.webgl = true;
    draw({ variant: 'column', stageId: 'journalBadgeStage' });
    await screen.findByTestId('lanyard');
    expect(env.lanyard).toMatchObject({ anchor: 'right', strapWidth: 0.5, bounds: true }); // la columna sí limita hasta dónde llega el carné
    expect(document.getElementById('journalBadgeStage')).toBeTruthy();
  });

  it('lets the column say where on the canvas the strap hangs (a fraction of its width)', async () => {
    env.webgl = true;
    draw({ variant: 'column', anchor: 0.667 });
    await screen.findByTestId('lanyard');
    expect(env.lanyard).toMatchObject({ anchor: 0.667, strapWidth: 0.5 });
  });

  it('draws the faces once per design, theme and profile version, and again when the owner updates the profile', async () => {
    const { rerender } = draw();
    await screen.findByAltText('Carné de Jose Frangel Padilla Camacho');
    rerender(
      <AppearanceProvider>
        <SessionProvider value={SESSIONS.owner}>
          <IdBadge data={{ ...OWNER_BADGE }} design="olimpo" />
        </SessionProvider>
      </AppearanceProvider>,
    );
    expect(drawBadgeFaces).toHaveBeenCalledTimes(1);
    rerender(
      <AppearanceProvider>
        <SessionProvider value={SESSIONS.owner}>
          <IdBadge data={{ ...OWNER_BADGE, updatedAt: 9, program: 'Ingeniería de Software' }} design="olimpo" />
        </SessionProvider>
      </AppearanceProvider>,
    );
    await waitFor(() => expect(drawBadgeFaces).toHaveBeenCalledTimes(2));
  });
});
