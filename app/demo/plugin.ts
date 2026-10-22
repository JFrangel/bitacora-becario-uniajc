import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

type Backend = {
  version(): number;
  info(): { shareToken: string; inviteToken: string };
  call(kind: 'query' | 'mutation', name: string, args: unknown, who: string): Promise<unknown>;
};

const readBody = (request: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => resolve(body));
  });

/** El servidor de ejemplo: ejecuta las funciones reales de `convex/` en memoria (con `convex-test`) y las expone por HTTP. */
export function demoBackend(): Plugin {
  return {
    name: 'demo-backend',
    configureServer(server) {
      let backend: Promise<Backend> | undefined;
      const load = () =>
        (backend ??= server.ssrLoadModule('/demo/backend.ts').then(async (module) => (await module.createBackend()) as Backend));

      server.middlewares.use('/__demo', async (request, response) => {
        const send = (status: number, body: unknown) => {
          response.statusCode = status;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(body));
        };
        try {
          const api = await load();
          const path = (request.url ?? '').split('?')[0];
          if (path === '/version') return send(200, { version: api.version() });
          if (path === '/info') return send(200, api.info());
          if (path === '/query' || path === '/mutation') {
            const { name, args } = JSON.parse((await readBody(request)) || '{}') as { name: string; args: unknown };
            return send(200, await api.call(path.slice(1) as 'query' | 'mutation', name, args, String(request.headers['x-demo-who'] ?? 'owner')));
          }
          send(404, { ok: false, message: 'No existe.' });
        } catch (error) {
          server.config.logger.error(`[demo] ${(error as Error).stack ?? error}`);
          send(500, { ok: false, message: (error as Error).message });
        }
      });
    },
  };
}
