import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gate } from './Gate';
import type { GateState } from './Gate';

const draw = (state: GateState, extra: Partial<Parameters<typeof Gate>[0]> = {}) => {
  const handlers = { onGoogle: vi.fn(), onHome: vi.fn(), onRetry: vi.fn(), onOtherAccount: vi.fn(), onAccept: vi.fn() };
  render(<Gate state={state} {...handlers} {...extra} />);
  return { ...handlers, user: userEvent.setup() };
};

describe('Gate · sign in', () => {
  it('offers Google and the invitation note, and shows no data at all', () => {
    draw('login');
    expect(screen.getByRole('button', { name: 'Entrar con Google' })).toBeTruthy();
    expect(screen.getByText('Para entrar necesitas una invitación.')).toBeTruthy();
    expect(screen.getByText('Tablero, calendario y bitácora de actividades en un solo lugar.')).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/@|Instituci[oó]n|Universitaria|Camacho|Padilla|Jose|AthenIA|Becari/i);
  });

  it('puts the focus on the first control when it opens', () => {
    draw('login');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Entrar con Google' }));
  });

  it('is a labelled modal dialog', () => {
    draw('login');
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('gateTitle');
    expect(document.getElementById('gateTitle')!.textContent).toBe('Bitácora.');
  });

  it('starts the Google sign-in', async () => {
    const { user, onGoogle } = draw('login');
    await user.click(screen.getByRole('button', { name: 'Entrar con Google' }));
    expect(onGoogle).toHaveBeenCalledTimes(1);
  });
});

describe('Gate · invitation', () => {
  it('asks for Google first, before any form', async () => {
    const { user, onGoogle } = draw('invite');
    expect(screen.getByText('Te invitaron')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(onGoogle).toHaveBeenCalled();
  });

  it('then shows the e-mail, a name filled in from the account and an empty role', () => {
    draw('inviteName', { email: 'laura.gomez@gmail.com', suggestedName: 'Laura Gómez' });
    expect(screen.getByText('laura.gomez@gmail.com')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Hola, Laura/ })).toBeTruthy();
    expect((screen.getByLabelText('Tu nombre') as HTMLInputElement).value).toBe('Laura Gómez');
    expect((screen.getByLabelText('Tu rol') as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(screen.getByLabelText('Tu nombre'));
  });

  it('does not send a name or a role of one character, and says why', async () => {
    const { user, onAccept } = draw('inviteName', { email: 'a@b.co', suggestedName: 'L' });
    await user.click(screen.getByRole('button', { name: 'Aceptar y entrar' }));
    expect(screen.getByRole('alert').textContent).toBe('Escribe tu nombre (2 a 60 caracteres).');
    expect(document.activeElement).toBe(screen.getByLabelText('Tu nombre'));
    await user.clear(screen.getByLabelText('Tu nombre'));
    await user.type(screen.getByLabelText('Tu nombre'), 'Laura');
    await user.type(screen.getByLabelText('Tu rol'), 'D');
    await user.click(screen.getByRole('button', { name: 'Aceptar y entrar' }));
    expect(screen.getByRole('alert').textContent).toBe('Escribe tu rol (2 a 60 caracteres).');
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('sends the trimmed name and role', async () => {
    const { user, onAccept } = draw('inviteName', { email: 'a@b.co', suggestedName: 'Laura Gómez' });
    await user.type(screen.getByLabelText('Tu rol'), '  Directora ');
    await user.click(screen.getByRole('button', { name: 'Aceptar y entrar' }));
    expect(onAccept).toHaveBeenCalledWith({ name: 'Laura Gómez', roleLabel: 'Directora' });
  });

  it('shows what the server answered', () => {
    draw('inviteName', { email: 'a@b.co', error: 'Esta cuenta ya tiene acceso.' });
    expect(screen.getByRole('alert').textContent).toBe('Esta cuenta ya tiene acceso.');
  });

  it('lets the person use another account', async () => {
    const { user, onOtherAccount } = draw('inviteName', { email: 'a@b.co' });
    await user.click(screen.getByRole('button', { name: 'Usar otra cuenta' }));
    expect(onOtherAccount).toHaveBeenCalled();
  });
});

describe('Gate · notices, each with its way out', () => {
  it.each([
    ['invalidInvite', 'Esta invitación ya no es válida', 'Ir al inicio', 'onHome'],
    ['invalidLink', 'Este enlace ya no está activo', 'Ir al inicio', 'onHome'],
    ['revoked', 'Tu acceso ya no está activo.', 'Ir al inicio', 'onHome'],
    ['noAccess', 'Tu cuenta no tiene acceso', 'Entrar con otra cuenta', 'onOtherAccount'],
    ['offline', 'No se pudo abrir tu bitácora', 'Reintentar', 'onRetry'],
  ] as const)('%s says «%s» and offers «%s»', async (state, title, action, handler) => {
    const handlers = draw(state, { email: 'carlos.ruiz@gmail.com' });
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    await handlers.user.click(screen.getByRole('button', { name: action }));
    expect(handlers[handler]).toHaveBeenCalledTimes(1);
  });

  it('tells a stranger which account is signed in, and nothing else', () => {
    draw('noAccess', { email: 'carlos.ruiz@gmail.com' });
    expect(screen.getByText('carlos.ruiz@gmail.com')).toBeTruthy();
    expect(screen.getByText(/Pide un enlace de invitación a quien administra la bitácora/)).toBeTruthy();
  });

  it('explains the invitation lasts seven days', () => {
    draw('invalidInvite');
    expect(screen.getByText('Pudo usarse antes o caducar: duran 7 días. Pide a quien te invitó un enlace nuevo.')).toBeTruthy();
  });
});
