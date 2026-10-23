import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../shell/Toast';
import { fake } from '../../test/fakeConvex';
import { ProfileShareControls } from './ProfileShareControls';

vi.mock('convex/react', async () => (await import('../../test/fakeConvex')).convexReactMock);

const draw = () => render(<ToastProvider><ProfileShareControls /></ToastProvider>);

beforeEach(() => {
  fake.reset();
  fake.setQuery('profile:shareSettings', { enabled: false, showPhoto: false, showAcademic: false });
});

describe('ProfileShareControls', () => {
  it('keeps optional fields off by default and creates an individual read-only URL', async () => {
    const user = userEvent.setup();
    fake.onMutation('profile:createShareLink', async (args) => {
      fake.setQuery('profile:shareSettings', { enabled: true, ...args });
      return { token: 'random-personal-token' };
    });
    draw();

    expect((screen.getByLabelText('Incluir mi foto') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Incluir programa y semestre') as HTMLInputElement).checked).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Crear enlace de perfil' }));

    const link = await screen.findByRole('textbox', { name: 'Enlace de mi perfil' }) as HTMLInputElement;
    expect(link.value).toContain('#/perfil/random-personal-token');
    expect(fake.called('profile:createShareLink')[0].args).toEqual({ showPhoto: false, showAcademic: false });
  });

  it('updates optional visibility one field at a time without rotating the link', async () => {
    const user = userEvent.setup();
    fake.setQuery('profile:shareSettings', { enabled: true, showPhoto: false, showAcademic: false });
    draw();
    await user.click(screen.getByLabelText('Incluir programa y semestre'));
    await waitFor(() => expect(fake.called('profile:updateShareVisibility')).toEqual([{ name: 'profile:updateShareVisibility', args: { showAcademic: true } }]));
  });

  it('uses a just-selected visibility option when creating the link', async () => {
    const user = userEvent.setup();
    fake.onMutation('profile:createShareLink', async (args) => {
      fake.setQuery('profile:shareSettings', { enabled: true, ...args });
      return { token: 'with-academic-data' };
    });
    draw();
    await user.click(screen.getByLabelText('Incluir programa y semestre'));
    await user.click(screen.getByRole('button', { name: 'Crear enlace de perfil' }));
    await waitFor(() => expect(fake.called('profile:createShareLink')[0].args).toEqual({ showPhoto: false, showAcademic: true }));
  });

  it('requires confirmation before regenerating or deactivating an existing link', async () => {
    const user = userEvent.setup();
    fake.setQuery('profile:shareSettings', { enabled: true, showPhoto: false, showAcademic: true });
    fake.onMutation('profile:createShareLink', async () => ({ token: 'replacement-token' }));
    draw();
    await user.click(screen.getByRole('button', { name: 'Generar enlace nuevo' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Regenerar enlace' }));
    await waitFor(() => expect(fake.called('profile:createShareLink')).toHaveLength(1));
    expect(await screen.findByRole('textbox', { name: 'Enlace de mi perfil' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Desactivar enlace' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fake.onMutation('profile:revokeShareLink', async () => fake.setQuery('profile:shareSettings', { enabled: false, showPhoto: false, showAcademic: false }));
    await user.click(screen.getByRole('alertdialog').querySelector('button.danger-fill')!);
    await waitFor(() => expect(fake.called('profile:revokeShareLink')).toHaveLength(1));
  });
});
