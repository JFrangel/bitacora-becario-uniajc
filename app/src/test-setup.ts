import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin `globals`, Testing Library no limpia solo entre pruebas.
afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  localStorage.clear();
});

// jsdom no dibuja: `getContext` devuelve `null` sin avisos (las pruebas que necesitan un lienzo usan uno falso).
HTMLCanvasElement.prototype.getContext = (() => null) as never;
