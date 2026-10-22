import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppearanceProvider } from './appearance/AppearanceProvider';
import { MissingConfig } from './App';
import { AppRoot } from './shell/AppRoot';

// Se prueba el aviso por sí solo: así no depende de si hay un `.env.local` con `VITE_CONVEX_URL` en este equipo.
describe('App · sin base de datos conectada', () => {
  it('asks to connect the database and keeps the brand and the default look', () => {
    render(
      <AppearanceProvider>
        <AppRoot>
          <MissingConfig />
        </AppRoot>
      </AppearanceProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Falta conectar la base de datos' })).toBeTruthy();
    expect(screen.getByText('VITE_CONVEX_URL')).toBeTruthy();
    expect(document.querySelector('.app')!.getAttribute('data-theme')).toBe('grafito');
    expect(document.querySelector('.app')!.getAttribute('data-mode')).toBe('dark');
  });
});
