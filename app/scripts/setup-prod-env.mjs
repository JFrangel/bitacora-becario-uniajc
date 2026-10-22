// Carga las variables de entorno del despliegue de PRODUCCIÓN de Convex (la dueña lo corre una sola vez).
// Uso:  node scripts/setup-prod-env.mjs https://tu-sitio.netlify.app
// Ningún valor se imprime: las claves viajan directo de aquí (o del despliegue de desarrollo) a Convex.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';

const APP = fileURLToPath(new URL('..', import.meta.url));
const convexBin = `${APP}node_modules/convex/bin/main.js`;
const run = (args) => execFileSync(process.execPath, [convexBin, ...args], { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const setProd = (name, value) => run(['env', 'set', '--prod', name, '--', value]);
const getDev = (name) => run(['env', 'get', name]).replace(/\r?\n$/, '');

const siteUrl = process.argv[2];
if (!siteUrl || !/^https:\/\/[^/\s]+$/.test(siteUrl)) {
  console.error('Falta la dirección del sitio, sin barra final. Ejemplo:\n  node scripts/setup-prod-env.mjs https://bitacora-becario-uniajc.netlify.app');
  process.exit(1);
}

// Claves de sesión NUEVAS para producción: no se reutilizan las de desarrollo.
const keys = await generateKeyPair('RS256', { extractable: true });
setProd('JWT_PRIVATE_KEY', (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, ' '));
setProd('JWKS', JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(keys.publicKey)) }] }));

// El mismo cliente de Google que ya usas en desarrollo (en la consola de Google se le agrega la URL de producción).
for (const name of ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'OWNER_EMAIL']) setProd(name, getDev(name));
setProd('SITE_URL', siteUrl);

console.log('Producción lista: JWT_PRIVATE_KEY, JWKS, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, OWNER_EMAIL y SITE_URL cargadas.');
console.log('E2E_ENABLED no se define en producción (mantiene apagadas las funciones de prueba).');
