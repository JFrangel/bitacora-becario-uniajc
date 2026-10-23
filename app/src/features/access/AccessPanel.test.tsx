import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../../appearance/AppearanceProvider';
import { SessionProvider } from '../../audience';
import type { SessionInfo } from '../../audience';
import { fake } from '../../test/fakeConvex';
import { ToastProvider } from '../../shell/Toast';
import { AccessPanel } from './AccessPanel';

vi.mock('convex/react', async () => (await import('../../test/fakeConvex')).convexReactMock);
vi.mock('@convex-dev/auth/react', async () => (await import('../../test/fakeConvex')).convexAuthMock);

const NOW = Date.UTC(2026, 9, 21, 17);
const session = (audience: 'owner' | 'member'): SessionInfo => ({ audience, memberId: audience === 'owner' ? 'm1' : 'm2', name: 'Persona', roleLabel: 'Rol', includesJournal: audience === 'owner', showsDescriptions: true });

function draw(audience: 'owner' | 'member' = 'owner', onClose = vi.fn()) {
  render(
    <AppearanceProvider>
      <ToastProvider>
        <SessionProvider value={session(audience)}>
          <AccessPanel open onClose={onClose} now={NOW} />
        </SessionProvider>
      </ToastProvider>
    </AppearanceProvider>,
  );
  return onClose;
}

const people = [
  { id: 'm1', name: 'Jose Padilla', roleLabel: 'Becario', email: 'jose@gmail.com', createdAt: NOW - 20 * 86_400_000, lastSeenAt: NOW - 3_600_000, revoked: false },
  { id: 'm2', name: 'Ana Gómez', roleLabel: 'Directora', email: 'ana.gomez@gmail.com', invitedByName: 'Jose Padilla', createdAt: Date.UTC(2026, 9, 19, 21), lastSeenAt: NOW - 86_400_000, revoked: false },
  { id: 'm3', name: 'Luis Ríos', roleLabel: 'Supervisor', email: 'luis@gmail.com', invitedByName: 'Ana Gómez', createdAt: NOW - 10 * 86_400_000, lastSeenAt: NOW - 5 * 86_400_000, revoked: true },
];

beforeEach(() => {
  fake.reset();
  fake.setQuery('invites:mine', [{ id: 'i1', expiresAt: Date.UTC(2026, 9, 28, 17) }]);
  fake.setQuery('members:list', people);
  fake.setQuery('settings:get', { enabled: false, includesJournal: true, showsDescriptions: false });
  fake.onMutation('invites:create', async () => ({ link: 'https://bitacora.example/invitacion/ABC123' }));
});

describe('AccessPanel · invitations', () => {
  it('creates a one-use link and shows it once, with «Copiar»', async () => {
    const user = userEvent.setup();
    draw('member');
    await user.click(screen.getByRole('button', { name: 'Invitar a alguien' }));
    expect(fake.called('invites:create')).toHaveLength(1);
    const field = (await screen.findByLabelText('Enlace de invitación')) as HTMLInputElement;
    expect(field.value).toBe('https://bitacora.example/invitacion/ABC123');
    expect(screen.getByText(/Es de un solo uso y caduca en 7 días/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(await navigator.clipboard.readText()).toBe('https://bitacora.example/invitacion/ABC123');
    expect(document.querySelector('.toast')!.textContent).toBe('Enlace copiado.');
  });

  it('lists the pending invitations with their expiry and lets you revoke them', async () => {
    const user = userEvent.setup();
    draw('member');
    const list = screen.getByRole('list', { name: 'Invitaciones pendientes' });
    expect(within(list).getByText(/Caduca el 28 oct/)).toBeTruthy();
    await user.click(within(list).getByRole('button', { name: 'Revocar' }));
    await waitFor(() => expect(fake.called('invites:revoke')).toHaveLength(1));
    expect(fake.called('invites:revoke')[0].args).toEqual({ inviteId: 'i1' });
  });

  it('says so when there are no pending invitations', () => {
    fake.setQuery('invites:mine', []);
    draw('member');
    expect(screen.getByText('No tienes invitaciones pendientes.')).toBeTruthy();
  });

  it('shows the server message when the limit of 10 is reached', async () => {
    fake.onMutation('invites:create', async () => {
      throw Object.assign(new Error('x'), { data: { code: 'LIMIT', message: 'Ya tienes 10 invitaciones pendientes. Revoca alguna para crear otra.' } });
    });
    const user = userEvent.setup();
    draw('member');
    await user.click(screen.getByRole('button', { name: 'Invitar a alguien' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Ya tienes 10 invitaciones pendientes. Revoca alguna para crear otra.');
  });
});

describe('AccessPanel · an invited person', () => {
  it('only sees invitations and «Cerrar sesión»: no people, no e-mails, no read-only link', async () => {
    const user = userEvent.setup();
    draw('member');
    expect(screen.getByRole('button', { name: 'Invitar a alguien' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.queryByText('Personas con acceso')).toBeNull();
    expect(screen.queryByText('Enlace de solo lectura')).toBeNull();
    expect(document.body.textContent).not.toContain('@gmail.com');
    expect(fake.asked.some((q) => q.name === 'members:list' && q.args !== 'skip')).toBe(false);
    expect(fake.asked.some((q) => q.name === 'settings:get' && q.args !== 'skip')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(fake.signOut).toHaveBeenCalled();
  });
});

describe('AccessPanel · the owner', () => {
  it('lists the people with name, role, account e-mail, who invited them, when they joined and their last activity', () => {
    draw('owner');
    const list = screen.getByRole('list', { name: 'Personas con acceso' });
    const ana = within(list).getByText('Ana Gómez').closest('li') as HTMLElement;
    expect(ana.textContent).toContain('Directora');
    expect(ana.textContent).toContain('ana.gomez@gmail.com');
    expect(ana.textContent).toContain('Invitada por Jose Padilla');
    expect(ana.textContent).toContain('Ingresó el 19 oct');
    expect(ana.textContent).toContain('Ayer');
    const luis = within(list).getByText('Luis Ríos').closest('li') as HTMLElement;
    expect(luis.textContent).toContain('Sin acceso');
    expect(within(luis).queryByRole('button', { name: /Retirar/ })).toBeNull();
  });

  it('cannot withdraw herself, but can withdraw others after confirming', async () => {
    const user = userEvent.setup();
    draw('owner');
    const list = screen.getByRole('list', { name: 'Personas con acceso' });
    const mine = within(list).getByText('Jose Padilla').closest('li') as HTMLElement;
    expect(within(mine).queryByRole('button', { name: /Retirar/ })).toBeNull();
    const ana = within(list).getByText('Ana Gómez').closest('li') as HTMLElement;
    await user.click(within(ana).getByRole('button', { name: 'Retirar acceso' }));
    expect(fake.called('members:revoke')).toHaveLength(0);
    const dialog = screen.getByRole('alertdialog', { name: '¿Retirar el acceso de Ana Gómez?' });
    await user.click(within(dialog).getByRole('button', { name: 'Retirar acceso' }));
    await waitFor(() => expect(fake.called('members:revoke')).toHaveLength(1));
    expect(fake.called('members:revoke')[0].args).toEqual({ memberId: 'm2' });
  });

  it('turns the read-only link on, and the defaults are: Bitácora included, descriptions hidden', async () => {
    const user = userEvent.setup();
    draw('owner');
    const section = screen.getByRole('region', { name: 'Enlace de solo lectura' });
    expect(within(section).getByRole('checkbox', { name: 'Incluir la Bitácora' })).toHaveProperty('checked', true);
    expect(within(section).getByRole('checkbox', { name: 'Mostrar descripciones de las tareas' })).toHaveProperty('checked', false);
    expect(within(section).queryByLabelText('Enlace de solo lectura')).toBeNull();
    await user.click(within(section).getByRole('button', { name: 'Activar enlace' }));
    expect(fake.called('settings:setShare')[0].args).toEqual({ enabled: true });
  });

  it('shows the link while it is active, with «Copiar», «Desactivar» and the two options', async () => {
    const user = userEvent.setup();
    fake.setQuery('settings:get', { enabled: true, includesJournal: true, showsDescriptions: false, link: 'https://bitacora.example/ver/TOKEN' });
    draw('owner');
    const section = screen.getByRole('region', { name: 'Enlace de solo lectura' });
    expect((within(section).getByLabelText('Enlace de solo lectura') as HTMLInputElement).value).toBe('https://bitacora.example/ver/TOKEN');
    await user.click(within(section).getByRole('button', { name: 'Copiar' }));
    expect(await navigator.clipboard.readText()).toBe('https://bitacora.example/ver/TOKEN');
    await user.click(within(section).getByRole('checkbox', { name: 'Mostrar descripciones de las tareas' }));
    expect(fake.called('settings:setShare').at(-1)!.args).toEqual({ showsDescriptions: true });
    await user.click(within(section).getByRole('checkbox', { name: 'Incluir la Bitácora' }));
    expect(fake.called('settings:setShare').at(-1)!.args).toEqual({ includesJournal: false });
    await user.click(within(section).getByRole('button', { name: 'Desactivar enlace' }));
    expect(fake.called('settings:setShare').at(-1)!.args).toEqual({ enabled: false });
  });

  it('warns that the old link stops working before regenerating it', async () => {
    const user = userEvent.setup();
    fake.setQuery('settings:get', { enabled: true, includesJournal: true, showsDescriptions: false, link: 'https://bitacora.example/ver/TOKEN' });
    fake.onMutation('settings:regenerateShare', async () => ({ link: 'https://bitacora.example/ver/NUEVO' }));
    draw('owner');
    await user.click(within(screen.getByRole('region', { name: 'Enlace de solo lectura' })).getByRole('button', { name: 'Regenerar enlace' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Regenerar el enlace?' });
    expect(dialog.textContent).toContain('El enlace anterior dejará de funcionar de inmediato.');
    expect(fake.called('settings:regenerateShare')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Regenerar' }));
    await waitFor(() => expect(fake.called('settings:regenerateShare')).toHaveLength(1));
  });

  it('does not show the read-only link section to anyone else', () => {
    draw('member');
    expect(screen.queryByRole('region', { name: 'Enlace de solo lectura' })).toBeNull();
  });
});
