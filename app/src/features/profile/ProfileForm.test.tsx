import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../../appearance/AppearanceProvider';
import { appError, fake } from '../../test/fakeConvex';
import { MEMBER_BADGE, OWNER_BADGE } from '../../test/badgeFixtures';
import { ToastProvider } from '../../shell/Toast';
import { ProfileForm } from './ProfileForm';
import * as photo from './photo';

vi.mock('convex/react', async () => (await import('../../test/fakeConvex')).convexReactMock);
vi.mock('./photo', async (original) => ({
  ...(await original<typeof import('./photo')>()),
  loadImage: vi.fn(async () => ({ width: 2000, height: 1000 }) as HTMLImageElement),
  cropToJpeg: vi.fn(() => 'data:image/jpeg;base64,QUJD'),
  optimizeBadgeLogo: vi.fn(() => 'data:image/png;base64,QUJD'),
}));

const draw = (data = OWNER_BADGE, _isOwner = true) => {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  render(
    <AppearanceProvider>
      <ToastProvider>
        <ProfileForm data={data} onDone={onDone} onCancel={onCancel} />
      </ToastProvider>
    </AppearanceProvider>,
  );
  return { onDone, onCancel };
};
const field = (label: RegExp | string) => screen.getByLabelText(label) as HTMLInputElement;
const save = () => userEvent.setup().click(screen.getByRole('button', { name: 'Guardar perfil' }));

beforeEach(() => {
  fake.reset();
  vi.mocked(photo.cropToJpeg).mockClear();
  vi.mocked(photo.optimizeBadgeLogo).mockClear();
  URL.createObjectURL = () => 'blob:foto';
  URL.revokeObjectURL = () => {};
});

describe('ProfileForm · the owner', () => {
  it('starts with the data of the badge and every field', () => {
    draw();
    expect(field('Nombre').value).toBe('Jose Frangel Padilla Camacho');
    expect(field('Rol').value).toBe('Becario');
    expect(field(/^Semestre/).value).toBe('10.º semestre');
    expect(field(/^Programa/).value).toBe('Ingeniería de Sistemas');
    expect(field(/^Institución/).value).toBe('Institución Universitaria Antonio José Camacho');
    expect(field(/^Grupo de investigación/).value).toBe('AthenIA');
    expect(field('Descripción del grupo').value).toBe('grupo de investigación en IA');
    expect(screen.getByRole('img', { name: /Encuadre de la foto/ })).toBeTruthy();
    expect((screen.getByLabelText('Mejorar imagen') as HTMLInputElement).checked).toBe(true);
  });

  it('asks for a name and a role of at least two characters, with the focus on the wrong field, and sends nothing', async () => {
    const user = userEvent.setup();
    draw();
    await user.clear(field('Nombre'));
    await user.type(field('Nombre'), 'J');
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    expect(screen.getByRole('alert').textContent).toBe('Escribe tu nombre (2 a 60 caracteres).');
    expect(document.activeElement).toBe(field('Nombre'));
    await user.type(field('Nombre'), 'ose');
    await user.clear(field('Rol'));
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    expect(screen.getByRole('alert').textContent).toBe('Escribe tu rol (2 a 60 caracteres).');
    expect(document.activeElement).toBe(field('Rol'));
    expect(fake.calls).toEqual([]);
  });

  it('saves only the badge data when the name and the role did not change (no needless «member.updated» in the history)', async () => {
    const user = userEvent.setup();
    const { onDone } = draw();
    await user.clear(field(/^Programa/));
    await user.type(field(/^Programa/), '  Ingeniería de Software ');
    await user.clear(field(/^Grupo de investigación/));
    await save();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(fake.called('members:updateSelf')).toEqual([]);
    expect(fake.called('profile:update')).toEqual([
      { name: 'profile:update', args: {
        program: 'Ingeniería de Software', term: '10.º semestre', institution: 'Institución Universitaria Antonio José Camacho', group: '',
        frontDescription: 'grupo de investigación en IA',
        backTitle: 'AthenIA', backDescription: 'Grupo de investigación en inteligencia artificial', backFooter: 'UNIAJC · Cali',
      } },
    ]);
    expect(document.querySelector('.toast')!.textContent).toBe('Perfil actualizado.');
  });

  it('also saves the name and the role when they changed', async () => {
    const user = userEvent.setup();
    draw();
    await user.clear(field('Rol'));
    await user.type(field('Rol'), ' Asistente de investigación ');
    await save();
    await waitFor(() => expect(fake.called('members:updateSelf')).toHaveLength(1));
    expect(fake.called('members:updateSelf')[0].args).toEqual({ name: 'Jose Frangel Padilla Camacho', roleLabel: 'Asistente de investigación' });
  });

  it('saves a group logo, the editable front description and the three reverse-side texts', async () => {
    const user = userEvent.setup();
    const { onDone } = draw();
    fireEvent.change(document.getElementById('groupLogoFile')!, { target: { files: [new File(['logo'], 'grupo.png', { type: 'image/png' })] } });
    await waitFor(() => expect(photo.optimizeBadgeLogo).toHaveBeenCalled());
    await user.clear(field('Descripción del grupo'));
    await user.type(field('Descripción del grupo'), 'Inteligencia artificial aplicada');
    await user.clear(field('Título'));
    await user.type(field('Título'), 'AthenIA UNIAJC');
    await user.clear(field('Descripción'));
    await user.type(field('Descripción'), 'Investigación e inteligencia artificial');
    await user.clear(field('Pie de página'));
    await user.type(field('Pie de página'), 'Cali, Colombia');
    await save();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(fake.called('profile:update')[0].args).toMatchObject({
      groupLogoDataUrl: 'data:image/png;base64,QUJD',
      frontDescription: 'Inteligencia artificial aplicada',
      backTitle: 'AthenIA UNIAJC',
      backDescription: 'Investigación e inteligencia artificial',
      backFooter: 'Cali, Colombia',
    });
  });

  it('shows the server message and stays in the form when saving fails', async () => {
    fake.onMutation('profile:update', async () => {
      throw appError('VALIDATION', 'Máximo 80 caracteres.');
    });
    const { onDone } = draw();
    await save();
    expect((await screen.findByRole('alert')).textContent).toBe('Máximo 80 caracteres.');
    expect(onDone).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Guardar perfil' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('uses a generic message when the failure has none', async () => {
    fake.onMutation('profile:update', async () => {
      throw new Error('network');
    });
    draw();
    await save();
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo guardar el perfil. Intenta de nuevo.');
  });

  it('does not touch the photo unless it changed', async () => {
    draw({ ...OWNER_BADGE, photoDataUrl: 'data:image/jpeg;base64,QUJD' });
    await save();
    await waitFor(() => expect(fake.called('profile:update')).toHaveLength(1));
    expect(fake.called('profile:update')[0].args).not.toHaveProperty('photoDataUrl');
    expect(photo.cropToJpeg).not.toHaveBeenCalled();
  });

  it('removes the photo with «Quitar foto»', async () => {
    const user = userEvent.setup();
    draw({ ...OWNER_BADGE, photoDataUrl: 'data:image/jpeg;base64,QUJD' });
    await user.click(screen.getByRole('button', { name: 'Quitar foto' }));
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(fake.called('profile:update')).toHaveLength(1));
    expect(fake.called('profile:update')[0].args.photoDataUrl).toBeNull();
  });

  it('crops and enhances a new photo, and remembers when «Mejorar imagen» is turned off', async () => {
    const user = userEvent.setup();
    draw();
    fireEvent.change(document.getElementById('photoFile')!, { target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] } });
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(fake.called('profile:update')).toHaveLength(1));
    expect(photo.cropToJpeg).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), { enhance: true });
    expect(fake.called('profile:update')[0].args.photoDataUrl).toBe('data:image/jpeg;base64,QUJD');

    await user.click(screen.getByLabelText('Mejorar imagen'));
    expect(localStorage.getItem('bitacora.enhancePhoto')).toBe('0');
    fireEvent.change(document.getElementById('photoFile')!, { target: { files: [new File(['x'], 'otra.jpg', { type: 'image/jpeg' })] } });
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(photo.cropToJpeg).toHaveBeenCalledTimes(2));
    expect(photo.cropToJpeg).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), { enhance: false });
  });

  it('«Mejorar imagen» is on by default, turns off clicking the box or its text, and the form remembers it when reopened', async () => {
    const user = userEvent.setup();
    draw();
    const box = screen.getByLabelText('Mejorar imagen') as HTMLInputElement;
    expect(box.checked).toBe(true);
    await user.click(box);
    expect(box.checked).toBe(false);
    await user.click(screen.getByText('Mejorar imagen'));
    expect(box.checked).toBe(true);
    await user.click(screen.getByText('Mejorar imagen'));
    expect(box.checked).toBe(false);
    cleanup();
    draw();
    expect((screen.getByLabelText('Mejorar imagen') as HTMLInputElement).checked).toBe(false);
  });

  it('«Cancelar» leaves without saving', async () => {
    const { onCancel } = draw();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
    expect(fake.calls).toEqual([]);
  });
});

describe('ProfileForm · a guest', () => {
  it('can edit their own photo and badge data', () => {
    draw(MEMBER_BADGE, false);
    expect(field('Nombre').value).toBe('Ana Gómez');
    expect(field('Rol').value).toBe('Directora');
    expect(screen.getByRole('img', { name: /Encuadre de la foto/ })).toBeTruthy();
    expect(field(/^Programa/).value).toBe('');
    expect(field(/^Semestre/).value).toBe('');
    expect(field(/^Institución/).value).toBe('');
    expect(field(/^Grupo de investigación/).value).toBe('');
  });

  it('saves name, role and carnet fields to their own records', async () => {
    const user = userEvent.setup();
    const { onDone } = draw(MEMBER_BADGE, false);
    await user.clear(field('Rol'));
    await user.type(field('Rol'), 'Directora del grupo');
    await user.type(field(/^Programa/), 'Ingeniería de Sistemas');
    await user.type(field(/^Grupo de investigación/), 'AthenIA');
    await save();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(fake.called('members:updateSelf')).toEqual([{ name: 'members:updateSelf', args: { name: 'Ana Gómez', roleLabel: 'Directora del grupo' } }]);
    expect(fake.called('profile:update')).toEqual([
      { name: 'profile:update', args: {
        program: 'Ingeniería de Sistemas', term: '', institution: '', group: 'AthenIA',
        frontDescription: 'grupo de investigación en IA',
        backTitle: 'AthenIA', backDescription: 'Grupo de investigación en inteligencia artificial', backFooter: 'UNIAJC · Cali',
      } },
    ]);
  });
});
