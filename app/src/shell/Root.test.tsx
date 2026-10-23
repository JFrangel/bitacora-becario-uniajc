import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../appearance/AppearanceProvider';
import { appError, fake } from '../test/fakeConvex';
import { AppRoot } from './AppRoot';
import { Root } from './Root';
import { ToastProvider } from './Toast';

vi.mock('convex/react', async () => (await import('../test/fakeConvex')).convexReactMock);
vi.mock('@convex-dev/auth/react', async () => (await import('../test/fakeConvex')).convexAuthMock);

const draw = (props: Parameters<typeof Root>[0] = {}) =>
  render(
    <AppearanceProvider>
      <ToastProvider>
        <AppRoot>
          <Root {...props} />
        </AppRoot>
      </ToastProvider>
    </AppearanceProvider>,
  );

const owner = { status: 'active', memberId: 'm1', name: 'Jose Frangel Padilla Camacho', roleLabel: 'Becario', isOwner: true };
const ana = { status: 'active', memberId: 'm2', name: 'Ana Gómez', roleLabel: 'Directora', isOwner: false };

beforeEach(() => {
  fake.reset();
  window.location.hash = '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Root · without a session', () => {
  it('shows only the sign-in screen', () => {
    draw();
    expect(screen.getByRole('button', { name: 'Entrar con Google' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('starts the Google sign-in and comes back to the same address', async () => {
    window.location.hash = '#/historial';
    draw();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar con Google' }));
    expect(fake.signIn).toHaveBeenCalledWith('google', { redirectTo: expect.stringContaining('#/historial') });
  });

  it('shows nothing while the session is loading', () => {
    fake.auth.isLoading = true;
    draw();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('Root · public personal profile', () => {
  it('renders only the profile data from its own public link without opening a session', () => {
    window.location.hash = '#/perfil/token-personal';
    fake.setQuery('viewer:sharedProfile', {
      name: 'Ana Gómez', roleLabel: 'Directora', group: 'AthenIA', institution: 'UNIAJC',
    });
    draw();
    expect(screen.getByRole('heading', { name: 'Ana Gómez' })).toBeTruthy();
    expect(screen.getByText('Directora')).toBeTruthy();
    expect(screen.getByText('AthenIA')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(fake.asked.find((query) => query.name === 'viewer:sharedProfile')?.args).toEqual({ token: 'token-personal' });
    expect(fake.asked.some((query) => query.name === 'session:me')).toBe(false);
  });

  it('shows a neutral unavailable state for an inactive link', () => {
    window.location.hash = '#/perfil/revoked';
    fake.setQuery('viewer:sharedProfile', null);
    draw();
    expect(screen.getByRole('heading', { name: 'Este perfil ya no está disponible' })).toBeTruthy();
  });
});

describe('Root · signed in with Google', () => {
  beforeEach(() => fake.setAuth({ isAuthenticated: true }));

  it('lets the owner in, the first time creating her record', async () => {
    fake.setQuery('session:me', { status: 'none', email: 'jose@gmail.com', name: 'Jose' });
    fake.onMutation('session:ensureOwner', async () => {
      fake.setQuery('session:me', owner);
    });
    draw();
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeTruthy());
    expect(fake.called('session:ensureOwner')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Bitácora' })).toBeTruthy();
    expect(screen.getByText('Tú · Becario')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver mi perfil' }).textContent).toBe('JP');
  });

  it('tells an unknown account it has no access, with its e-mail, and offers another account', async () => {
    fake.setQuery('session:me', { status: 'none', email: 'carlos.ruiz@gmail.com', name: 'Carlos' });
    fake.onMutation('session:ensureOwner', async () => {
      throw appError('FORBIDDEN');
    });
    draw();
    expect(await screen.findByRole('heading', { name: 'Tu cuenta no tiene acceso' })).toBeTruthy();
    expect(screen.getByText('carlos.ruiz@gmail.com')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar con otra cuenta' }));
    expect(fake.signOut).toHaveBeenCalled();
  });

  it('gives an invited person the app without the Bitácora tab, and notes the visit', async () => {
    fake.setQuery('session:me', ana);
    draw();
    const nav = await screen.findByRole('navigation', { name: 'Secciones' });
    expect(nav.textContent).toContain('Tablero');
    expect(nav.textContent).not.toContain('Bitácora');
    expect(document.querySelector('.app')!.getAttribute('data-mode')).toBe('light');
    expect(screen.getByRole('button', { name: 'Invitar' })).toBeTruthy();
    await waitFor(() => expect(fake.called('members:touch')).toHaveLength(1));
  });

  it('does not let an invited person open the Bitácora by typing the address', async () => {
    window.location.hash = '#/bitacora';
    fake.setQuery('session:me', ana);
    draw();
    await screen.findByRole('navigation', { name: 'Secciones' });
    expect(screen.getByRole('button', { name: 'Tablero' }).getAttribute('aria-current')).toBe('page');
  });

  it('asks the owner for the draft count of the Bitácora tab', async () => {
    fake.setQuery('session:me', owner);
    fake.setQuery('journal:summary', { activities: 1, hours: 2, completed: 1, drafts: 3 });
    draw();
    await screen.findByRole('navigation', { name: 'Secciones' });
    expect(document.querySelector('.badge')!.textContent).toBe('3');
  });

  it('(punto 5) shows «Tu acceso ya no está activo.» and signs out when access is withdrawn with the app open', async () => {
    fake.setQuery('session:me', ana);
    draw();
    await screen.findByRole('navigation', { name: 'Secciones' });
    act(() => fake.setQuery('session:me', { status: 'revoked' }));
    expect(await screen.findByRole('heading', { name: 'Tu acceso ya no está activo.' })).toBeTruthy();
    expect(fake.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('navigation')).toBeNull();
    act(() => fake.setAuth({ isAuthenticated: false }));
    expect(screen.getByRole('heading', { name: 'Tu acceso ya no está activo.' })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ir al inicio' }));
    expect(screen.getByRole('button', { name: 'Entrar con Google' })).toBeTruthy();
  });

  it('shows the same notice when someone with withdrawn access opens the app', async () => {
    fake.setQuery('session:me', { status: 'revoked' });
    draw();
    expect(await screen.findByRole('heading', { name: 'Tu acceso ya no está activo.' })).toBeTruthy();
    expect(fake.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('Root · invitation', () => {
  beforeEach(() => {
    window.location.hash = '#/invitacion/tok123';
  });

  it('asks for Google first when the invitation is valid', async () => {
    fake.setQuery('invites:peek', { valid: true });
    draw();
    expect(await screen.findByRole('heading', { name: /Te invitaron/ })).toBeTruthy();
    expect(document.querySelector('.app')!.getAttribute('data-mode')).toBe('light');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(fake.signIn).toHaveBeenCalledWith('google', { redirectTo: expect.stringContaining('#/invitacion/tok123') });
  });

  it('says right away that the invitation is no longer valid', async () => {
    fake.setQuery('invites:peek', { valid: false });
    draw();
    expect(await screen.findByRole('heading', { name: 'Esta invitación ya no es válida' })).toBeTruthy();
    expect(fake.asked.find((entry) => entry.name === 'invites:peek')!.args).toEqual({ inviteToken: 'tok123' });
  });

  describe('after signing in', () => {
    beforeEach(() => {
      fake.setAuth({ isAuthenticated: true });
      fake.setQuery('session:me', { status: 'none', email: 'laura.gomez@gmail.com', name: 'Laura Gómez' });
    });

    it('asks for name and role, with the name filled in, and never tries to make her the owner', async () => {
      draw();
      expect(await screen.findByLabelText('Tu nombre')).toBeTruthy();
      expect((screen.getByLabelText('Tu nombre') as HTMLInputElement).value).toBe('Laura Gómez');
      expect(screen.getByText('laura.gomez@gmail.com')).toBeTruthy();
      expect(fake.called('session:ensureOwner')).toHaveLength(0);
    });

    it('redeems the invitation and goes to the board', async () => {
      fake.onMutation('invites:redeem', async () => {
        fake.setQuery('session:me', { ...ana, name: 'Laura Gómez' });
        return { memberId: 'm3' };
      });
      draw();
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText('Tu rol'), 'Directora');
      await user.click(screen.getByRole('button', { name: 'Aceptar y entrar' }));
      await waitFor(() => expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeTruthy());
      expect(fake.called('invites:redeem')[0].args).toEqual({ inviteToken: 'tok123', name: 'Laura Gómez', roleLabel: 'Directora' });
      expect(window.location.hash).toBe('#/');
    });

    it.each(['INVITE_USED', 'INVITE_EXPIRED', 'INVITE_REVOKED', 'INVITE_INVALID'])('shows the invalid-invitation notice on %s', async (code) => {
      fake.onMutation('invites:redeem', async () => {
        throw appError(code);
      });
      draw();
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText('Tu rol'), 'Directora');
      await user.click(screen.getByRole('button', { name: 'Aceptar y entrar' }));
      expect(await screen.findByRole('heading', { name: 'Esta invitación ya no es válida' })).toBeTruthy();
    });

    it('shows a validation message from the server in the form', async () => {
      fake.onMutation('invites:redeem', async () => {
        throw appError('VALIDATION', 'Escribe tu rol (2 a 60 caracteres).');
      });
      draw();
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText('Tu rol'), 'Directora');
      await user.click(screen.getByRole('button', { name: 'Aceptar y entrar' }));
      expect((await screen.findByRole('alert')).textContent).toBe('Escribe tu rol (2 a 60 caracteres).');
    });

    it('lets someone with withdrawn access be invited again', async () => {
      fake.setQuery('session:me', { status: 'revoked' });
      draw();
      expect(await screen.findByLabelText('Tu rol')).toBeTruthy();
      expect(fake.signOut).not.toHaveBeenCalled();
    });

    it('sends someone who already has access to the board', async () => {
      fake.setQuery('session:me', ana);
      draw();
      await screen.findByRole('navigation', { name: 'Secciones' });
      expect(window.location.hash).toBe('#/');
    });
  });
});

describe('Root · connection trouble', () => {
  it('offers «Reintentar» when the browser is offline', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    fake.auth.isLoading = true; // sin red, la sesión nunca termina de resolverse
    const reload = vi.fn();
    draw({ reload });
    expect(await screen.findByRole('heading', { name: 'No se pudo abrir tu bitácora' })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reload).toHaveBeenCalled();
  });

  it('gives up waiting after a while and offers «Reintentar»', () => {
    vi.useFakeTimers();
    fake.auth.isLoading = true;
    draw();
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => vi.advanceTimersByTime(10_500));
    expect(screen.getByRole('heading', { name: 'No se pudo abrir tu bitácora' })).toBeTruthy();
  });
});
