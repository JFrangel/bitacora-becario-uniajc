import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // El paquete del 3D (three.js, ~590 KB sin comprimir) se descarga aparte y solo al mostrar un carné: su peso (≤ 220 KB
  // comprimido) lo vigila `scripts/check-build.mjs`, por eso no avisa el límite genérico de Vite.
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 650 },
});
