import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../../appearance/AppearanceProvider';
import { SessionProvider } from '../../audience';
import { fake } from '../../test/fakeConvex';
import { MEMBER_BADGE, OWNER_BADGE, SESSIONS } from '../../test/badgeFixtures';
import { ToastProvider } from '../../shell/Toast';
import { clearFaceCache } from './badgeFaces';
import { LOCAL_DESIGN_KEYS } from './useBadge';
import { ProfilePanel } from './ProfilePanel';
import { ProfileUiProvider, useProfileUi } from './ProfileUi';

const env = vi.hoisted(() => ({ webgl: false }));
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
  return { default: () => createElement('canvas', { 'data-testid': 'lanyard' }) };
});

/** Lo que el resto de la pantalla ve del perfil, y un botón que lo abre (como el avatar de la barra). */
function Probe() {
  const ui = useProfileUi();
  return (
    <>
      <button onClick={ui.openPanel}>abrir perfil</button>
      <output aria-label="bloqueado">{String(ui.blocked)}</output>
    </>
  );
}

function draw(audience: 'owner' | 'member' | 'viewer', handlers: { onAccess?: () => void; onSignOut?: () => void } = {}) {
  render(
    <AppearanceProvider>
      <ToastProvider>
        <SessionProvider value={SESSIONS[audience]}>
          <ProfileUiProvider>
            <Probe />
            <ProfilePanel {...handlers} />
          </ProfileUiProvider>
        </SessionProvider>
      </ToastProvider>
    </AppearanceProvider>,
  );
}
const open = async () => {
  await userEvent.setup().click(screen.getByRole('button', { name: 'abrir perfil' }));
  return screen.findByRole('dialog', { name: /perfil/i });
};

beforeEach(() => {
  fake.reset();
  env.webgl = false;
  clearFaceCache();
  fake.setQuery('profile:get', OWNER_BADGE);
  fake.setQuery('viewer:profile', OWNER_BADGE);
});

describe('ProfilePanel · the owner', () => {
  it('opens as «Mi perfil» with the badge, the data and every action', async () => {
    draw('owner', { onAccess: () => {}, onSignOut: () => {} });
    const panel = await open();
    expect(within(panel).getByRole('heading', { name: 'Mi perfil' })).toBeTruthy();
    expect(await within(panel).findByAltText('Carné de Jose Frangel Padilla Camacho')).toBeTruthy();
    const facts = [...panel.querySelectorAll('.profile-facts > div')].map((row) => [row.querySelector('dt')!.textContent, row.querySelector('dd')!.textContent]);
    expect(facts).toEqual([
      ['Nombre', 'Jose Frangel Padilla Camacho'],
      ['Rol', 'Becario'],
      ['Programa', 'Ingeniería de Sistemas · 10.º semestre'],
      ['Institución', 'Institución Universitaria Antonio José Camacho'],
      ['Grupo', 'AthenIA'],
    ]);
    for (const name of ['Editar perfil', 'Ver diseños', 'Acceso', 'Cerrar sesión']) expect(within(panel).getByRole('button', { name })).toBeTruthy();
  });

  it('shows how to play with the badge only when it is 3D', async () => {
    draw('owner');
    const panel = await open();
    expect(within(panel).queryByText('Arrástralo, lánzalo o púlsalo para girarlo.')).toBeNull();
  });

  it('with WebGL hangs the 3D badge and shows the hint', async () => {
    env.webgl = true;
    draw('owner');
    const panel = await open();
    expect(await within(panel).findByTestId('lanyard')).toBeTruthy();
    expect(within(panel).getByText('Arrástralo, lánzalo o púlsalo para girarlo.')).toBeTruthy();
  });

  it('«Editar perfil» swaps the view for the form and «Cancelar» comes back', async () => {
    const user = userEvent.setup();
    draw('owner');
    const panel = await open();
    await user.click(within(panel).getByRole('button', { name: 'Editar perfil' }));
    expect(within(panel).getByRole('heading', { name: 'Editar perfil' })).toBeTruthy();
    expect(panel.querySelector('#profileView')).toBeNull();
    expect(panel.querySelector('#profileForm')).toBeTruthy();
    await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));
    expect(within(panel).getByRole('heading', { name: 'Mi perfil' })).toBeTruthy();
    expect(panel.querySelector('#profileForm')).toBeNull();
  });

  it('saving the form returns to the view with the toast', async () => {
    const user = userEvent.setup();
    draw('owner');
    const panel = await open();
    await user.click(within(panel).getByRole('button', { name: 'Editar perfil' }));
    await user.click(within(panel).getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(within(panel).getByRole('heading', { name: 'Mi perfil' })).toBeTruthy());
    expect(document.querySelector('.toast')!.textContent).toBe('Perfil actualizado.');
  });

  it('keeps the badge visible and explains when the new sharing query is not deployed yet', async () => {
    fake.setQuery('profile:shareSettings', () => {
      throw new Error('Could not find public function profile:shareSettings');
    });
    draw('member');
    const panel = await open();
    expect(await within(panel).findByAltText('Carné de Jose Frangel Padilla Camacho')).toBeTruthy();
    expect(within(panel).getByText(/falta sincronizar las funciones de compartir con Convex/)).toBeTruthy();
  });

  it('«Acceso» and «Cerrar sesión» call what the shell gave it', async () => {
    const user = userEvent.setup();
    const onAccess = vi.fn();
    const onSignOut = vi.fn();
    draw('owner', { onAccess, onSignOut });
    const panel = await open();
    await user.click(within(panel).getByRole('button', { name: 'Acceso' }));
    await user.click(within(panel).getByRole('button', { name: 'Cerrar sesión' }));
    expect(onAccess).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('the gallery picks a design for everyone, saves it in the profile and closes', async () => {
    const user = userEvent.setup();
    draw('owner');
    const panel = await open();
    await user.click(within(panel).getByRole('button', { name: 'Ver diseños' }));
    const gallery = await screen.findByRole('dialog', { name: 'Diseños del carné' });
    await user.click(within(gallery.querySelector('[data-design="poster"]') as HTMLElement).getByRole('button', { name: 'Usar este diseño' }));
    expect(fake.called('profile:update')).toEqual([{ name: 'profile:update', args: { badgeDesign: 'poster' } }]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Diseños del carné' })).toBeNull());
    expect(document.querySelector('.toast')!.textContent).toBe('Diseño del carné actualizado.');
  });

  it('while the gallery is open the badge of the panel is not drawn (never two at once) and comes back after', async () => {
    const user = userEvent.setup();
    draw('owner');
    const panel = await open();
    await within(panel).findByAltText('Carné de Jose Frangel Padilla Camacho');
    await user.click(within(panel).getByRole('button', { name: 'Ver diseños' }));
    expect(panel.querySelector('.badge-stage')).toBeNull();
    await user.keyboard('{Escape}');
    expect(await within(panel).findByAltText('Carné de Jose Frangel Padilla Camacho')).toBeTruthy();
  });
});

describe('ProfilePanel · a guest', () => {
  beforeEach(() => fake.setQuery('profile:get', MEMBER_BADGE));

  it('shows their own name and role, since when they are here, and no «Acceso»', async () => {
    draw('member', { onSignOut: () => {} });
    const panel = await open();
    expect(within(panel).getByRole('heading', { name: 'Mi perfil' })).toBeTruthy();
    expect(within(panel).getByText('En la bitácora desde').nextSibling!.textContent).toBe('19 de octubre de 2026');
    expect(within(panel).queryByRole('button', { name: 'Acceso' })).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });

  it('a design picked by a guest stays in this browser and is not sent to the server', async () => {
    const user = userEvent.setup();
    draw('member');
    const panel = await open();
    await user.click(within(panel).getByRole('button', { name: 'Ver diseños' }));
    const gallery = await screen.findByRole('dialog', { name: 'Diseños del carné' });
    await user.click(within(gallery.querySelector('[data-design="suizo"]') as HTMLElement).getByRole('button', { name: 'Usar este diseño' }));
    expect(localStorage.getItem(LOCAL_DESIGN_KEYS.member)).toBe('suizo');
    expect(fake.calls).toEqual([]);
    expect(document.querySelector('.toast')!.textContent).toBe('Diseño cambiado en este navegador.');
  });
});

describe('ProfilePanel · the read-only link', () => {
  it('is only «Perfil»: the badge and «Ver diseños», nothing to edit and no session to close', async () => {
    draw('viewer', { onSignOut: () => {}, onAccess: () => {} });
    const panel = await open();
    expect(within(panel).getByRole('heading', { name: 'Perfil' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Ver diseños' })).toBeTruthy();
    for (const name of ['Editar perfil', 'Acceso', 'Cerrar sesión']) expect(within(panel).queryByRole('button', { name })).toBeNull();
    expect(fake.asked.some((q) => q.name === 'viewer:profile' && JSON.stringify(q.args) === JSON.stringify({ shareToken: 'tok' }))).toBe(true);
  });

  it('a design picked there is only for that viewer: saved in this browser, no mutation, the owner\'s profile untouched', async () => {
    const user = userEvent.setup();
    draw('viewer');
    const panel = await open();
    await user.click(within(panel).getByRole('button', { name: 'Ver diseños' }));
    const gallery = await screen.findByRole('dialog', { name: 'Diseños del carné' });
    expect(within(gallery).getByText(/solo en este navegador/)).toBeTruthy();
    await user.click(within(gallery.querySelector('[data-design="clasico"]') as HTMLElement).getByRole('button', { name: 'Usar este diseño' }));
    expect(localStorage.getItem(LOCAL_DESIGN_KEYS.viewer)).toBe('clasico');
    expect(fake.calls).toEqual([]);
  });
});

describe('ProfilePanel · only one 3D badge at a time', () => {
  it('reports itself as blocking the column badge while open, until it has finished closing', async () => {
    const user = userEvent.setup();
    draw('owner');
    expect(screen.getByLabelText('bloqueado').textContent).toBe('false');
    const panel = await open();
    expect(screen.getByLabelText('bloqueado').textContent).toBe('true');
    await user.click(within(panel).getByRole('button', { name: 'Cerrar' }));
    // Mientras el panel se desliza hacia afuera su carné sigue montado: la columna espera.
    expect(screen.getByLabelText('bloqueado').textContent).toBe('true');
    await waitFor(() => expect(screen.getByLabelText('bloqueado').textContent).toBe('false'), { timeout: 2000 });
  });

  it('opening the gallery keeps it blocked too', async () => {
    const user = userEvent.setup();
    draw('owner');
    const panel = await open();
    await user.click(within(panel).getByRole('button', { name: 'Ver diseños' }));
    await act(async () => {});
    expect(screen.getByLabelText('bloqueado').textContent).toBe('true');
  });
});
