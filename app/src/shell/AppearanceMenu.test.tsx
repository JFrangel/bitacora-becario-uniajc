import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppearanceProvider, useAppearance } from '../appearance/AppearanceProvider';
import { AppearanceMenu } from './AppearanceMenu';

function Probe() {
  const { appearance } = useAppearance();
  return <output data-testid="now">{`${appearance.style}-${appearance.mode}`}</output>;
}

const setup = () => {
  render(
    <AppearanceProvider>
      <AppearanceMenu />
      <Probe />
    </AppearanceProvider>,
  );
  return userEvent.setup();
};

describe('AppearanceMenu', () => {
  it('starts closed, with Grafito oscuro active and marked as the default', async () => {
    const user = setup();
    const button = screen.getByRole('button', { name: 'Apariencia' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.pop')!.hasAttribute('hidden')).toBe(true);
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Grafito/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('predeterminado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Los tres estilos tienen tema oscuro y tema claro.')).toBeTruthy();
  });

  it('changes the style and the mode independently, and remembers them', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Apariencia' }));
    await user.click(screen.getByRole('button', { name: 'Papel' }));
    expect(screen.getByTestId('now').textContent).toBe('papel-dark');
    await user.click(screen.getByRole('button', { name: 'Claro' }));
    expect(screen.getByTestId('now').textContent).toBe('papel-light');
    await user.click(screen.getByRole('button', { name: /Tinta viva/ }));
    expect(screen.getByTestId('now').textContent).toBe('tinta-light');
    expect(JSON.parse(localStorage.getItem('bitacora.appearance')!)).toEqual({ style: 'tinta', mode: 'light' });
  });

  it('closes with Escape and when clicking outside', async () => {
    const user = setup();
    const button = screen.getByRole('button', { name: 'Apariencia' });
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await user.click(button);
    await user.click(document.body);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
