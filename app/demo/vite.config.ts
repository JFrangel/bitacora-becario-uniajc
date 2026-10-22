import react from '@vitejs/plugin-react';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { demoBackend } from './plugin.ts';

// Vista previa local (`npm run demo`): la aplicación de verdad, con las funciones REALES del servidor (`convex/`) corriendo
// en memoria sobre datos de ejemplo. No necesita Convex, Google ni Netlify. Solo el inicio de sesión va simulado.
const here = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: join(here, '..'),
  plugins: [react(), demoBackend()],
  resolve: { alias: { 'convex/react': join(here, 'client.ts'), '@convex-dev/auth/react': join(here, 'authClient.ts') } },
  define: { 'import.meta.env.VITE_CONVEX_URL': JSON.stringify('https://demo.convex.cloud') },
  optimizeDeps: { entries: ['demo/main.tsx'] },
  ssr: { noExternal: ['convex-test'] },
  server: { port: 5175, strictPort: true },
});
