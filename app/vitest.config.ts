import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          include: ['tests/convex/**/*.test.ts'],
          environment: 'edge-runtime',
          server: { deps: { inline: ['convex-test'] } },
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          include: ['src/**/*.test.{ts,tsx}', 'tests/*.test.ts', 'tests/build/*.test.ts'],
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
        },
      },
    ],
  },
});
