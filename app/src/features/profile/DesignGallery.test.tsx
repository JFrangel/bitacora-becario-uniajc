import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from '../../appearance/AppearanceProvider';
import { FACES, OWNER_BADGE } from '../../test/badgeFixtures';
import { DesignGallery } from './DesignGallery';

vi.mock('./useBadge', async (original) => ({ ...(await original<typeof import('./useBadge')>()), facesFor: vi.fn(async () => (await import('../../test/badgeFixtures')).FACES) }));

const draw = (props: Partial<React.ComponentProps<typeof DesignGallery>> = {}) => {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(
    <AppearanceProvider>
      <button>Ver diseños</button>
      <DesignGallery data={OWNER_BADGE} current="olimpo" local={false} onPick={onPick} onClose={onClose} {...props} />
    </AppearanceProvider>,
  );
  return { onPick, onClose };
};
const tile = (label: string) => screen.getByRole('heading', { name: label }).closest('article') as HTMLElement;

describe('DesignGallery', () => {
  it('shows the five designs, each with its front and back drawn with the current data', async () => {
    draw();
    expect([...document.querySelectorAll('.design-tile h3')].map((h) => h.textContent)).toEqual(['Olimpo', 'Circuito', 'Póster', 'Suizo', 'Clásico']);
    for (const label of ['Olimpo', 'Circuito', 'Póster', 'Suizo', 'Clásico']) {
      const front = await within(tile(label)).findByAltText(`Frente del diseño ${label}`);
      expect((front as HTMLImageElement).src).toBe(FACES.front);
      expect((within(tile(label)).getByAltText(`Reverso del diseño ${label}`) as HTMLImageElement).src).toBe(FACES.back);
    }
  });

  it('marks the design in use and offers the others', async () => {
    const { onPick } = draw({ current: 'suizo' });
    const current = within(tile('Suizo')).getByRole('button', { name: 'Diseño en uso' }) as HTMLButtonElement;
    expect(current.disabled).toBe(true);
    expect(tile('Suizo').getAttribute('aria-current')).toBe('true');
    await userEvent.setup().click(within(tile('Póster')).getByRole('button', { name: 'Usar este diseño' }));
    expect(onPick).toHaveBeenCalledWith('poster');
  });

  it('says whose badge changes: «tu carné» for the owner, only «este navegador» for everyone else', () => {
    draw();
    expect(screen.getByText(/se aplica a tu carné/)).toBeTruthy();
  });

  it('for a read-only viewer says the choice stays in this browser', () => {
    draw({ local: true });
    expect(screen.getByText(/se aplica a tu vista \(solo en este navegador\)/)).toBeTruthy();
  });

  it('closes with the × and with Esc, and gives the focus back to what opened it', async () => {
    const user = userEvent.setup();
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { onClose } = draw();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    opener.remove();
  });

  it('keeps the keyboard focus inside while open', async () => {
    const user = userEvent.setup();
    draw();
    const dialog = screen.getByRole('dialog', { name: 'Diseños del carné' });
    const buttons = within(dialog).getAllByRole('button').filter((b) => !(b as HTMLButtonElement).disabled);
    buttons[buttons.length - 1].focus();
    await user.tab();
    expect(document.activeElement).toBe(buttons[0]);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });
});
