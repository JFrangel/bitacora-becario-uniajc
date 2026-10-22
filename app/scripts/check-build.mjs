// Comprueba lo construido en `dist/` y lo versionado en `app/` contra las reglas de seguridad y de peso del proyecto.
//   node scripts/check-build.mjs [carpeta-dist]      ⇒ imprime los problemas y sale con código 1 si hay alguno.
// También se importa desde `tests/build/check-build.test.ts`.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Presupuestos (KB comprimidos con gzip). El 3D (three.js) va en su propio paquete y se descarga al mostrar un carné. */
export const BUDGET = { mainKb: 250, badge3dKb: 220 };

/** Direcciones `https://` que pueden aparecer en el código de las bibliotecas sin ser peticiones de red (espacios de nombres, mensajes de error, citas). */
const INERT_HOSTS = ['www.w3.org', 'reactjs.org', 'react.dev', 'jcgt.org', 'docs.convex.dev'];
const NETWORK_HOSTS = [/\.convex\.cloud$/];
/** Texto que solo existe si la aplicación quedó dentro del paquete (la pantalla de entrada del enlace de solo lectura). */
const APP_MARKER = 'Este enlace ya no está activo';

/** Lo que nunca debe estar en un archivo versionado (criterio 17). */
const SECRETS = [
  ['GOCSPX-', /GOCSPX-/],
  ['client_secret', /["']client_secret["']\s*:/i],
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const SECRET_SCAN_SKIP = new Set(['scripts/check-build.mjs', 'tests/build/check-build.test.ts']);

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const gz = (text) => gzipSync(text, { level: 9 }).length;
const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

/** Archivos que se versionarían: los versionados y los nuevos que no están en `.gitignore`. */
function versionedFiles(app) {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '.'], { cwd: app, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\0').filter(Boolean);
  } catch {
    if (!existsSync(app)) return [];
    return walk(app)
      .map((file) => relative(app, file).split('\\').join('/'))
      .filter((file) => !/^(node_modules|dist|\.git|convex\/_generated)\//.test(file));
  }
}

export function checkBuild({ dist = join(APP, 'dist'), app = APP } = {}) {
  const problems = [];
  const facts = {};
  if (!existsSync(join(dist, 'index.html'))) return { problems: [`No hay ${dist}/index.html: ejecuta «npm run build» primero.`], facts };

  const html = readFileSync(join(dist, 'index.html'), 'utf8');

  // 1. Sin código ni estilos en línea (la política de seguridad solo permite 'self').
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc=/.test(match[1]) || match[2].trim()) problems.push('index.html tiene un <script> en línea.');
  }
  if (/<style\b/i.test(html)) problems.push('index.html tiene una etiqueta <style> en línea.');
  if (/\sstyle=/i.test(html)) problems.push('index.html tiene un atributo style en línea.');
  if (/\son[a-z]+=/i.test(html)) problems.push('index.html tiene un controlador de eventos en línea.');

  // 2. Ninguna petición a otro dominio.
  const assets = walk(dist).filter((file) => /\.(js|css|html)$/.test(file));
  for (const file of assets) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/https?:\/\/([A-Za-z0-9][A-Za-z0-9.-]*)/g)) {
      const host = match[1].toLowerCase().replace(/\.+$/, '');
      if (INERT_HOSTS.includes(host) || NETWORK_HOSTS.some((pattern) => pattern.test(host))) continue;
      problems.push(`${relative(dist, file)} menciona ${match[0]} (solo se permite *.convex.cloud).`);
    }
    if (/fonts\.(googleapis|gstatic)\.com/.test(text)) problems.push(`${relative(dist, file)} usa tipografías de Google (deben ser @fontsource).`);
  }

  // 3. Paquetes: el principal y el del 3D.
  const entries = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const scripts = walk(join(dist, 'assets')).filter((file) => file.endsWith('.js'));
  const mainGz = entries.reduce((sum, entry) => sum + gz(readFileSync(join(dist, entry))), 0);
  facts.mainKb = kb(mainGz);
  if (entries.length === 0) problems.push('index.html no carga ningún paquete.');
  // Sin `VITE_CONVEX_URL` al construir, Vite descarta toda la aplicación y deja solo el aviso «Falta conectar la base de datos».
  const bundled = entries.map((entry) => readFileSync(join(dist, entry), 'utf8')).join('\n');
  if (entries.length > 0 && !bundled.includes(APP_MARKER)) problems.push('El paquete principal no contiene la aplicación: construye con VITE_CONVEX_URL definida.');
  if (facts.mainKb > BUDGET.mainKb) problems.push(`El paquete principal pesa ${facts.mainKb} KB comprimido (máximo ${BUDGET.mainKb} KB).`);

  const withThree = scripts.filter((file) => readFileSync(file, 'utf8').includes('WebGLRenderer'));
  facts.badge3dChunks = withThree.map((file) => relative(dist, file).split('\\').join('/'));
  if (withThree.length !== 1) problems.push(`El 3D debe estar en un solo paquete aparte (hay ${withThree.length} con WebGLRenderer).`);
  for (const file of withThree) {
    const rel = relative(dist, file).split('\\').join('/');
    if (entries.includes(rel)) problems.push('three.js está en el paquete principal: debe cargarse solo al mostrar un carné.');
    facts.badge3dKb = kb(gz(readFileSync(file)));
    if (facts.badge3dKb > BUDGET.badge3dKb) problems.push(`El paquete del 3D pesa ${facts.badge3dKb} KB comprimido (máximo ${BUDGET.badge3dKb} KB).`);
  }

  // 4. Nada secreto en lo versionado.
  const files = versionedFiles(app).filter((file) => !SECRET_SCAN_SKIP.has(file));
  facts.scanned = files.length;
  for (const file of files) {
    if (/(^|\/)client_secret[^/]*\.json$/i.test(file)) problems.push(`${file} es un archivo de credenciales de Google: no va en el repositorio.`);
    const path = join(app, file);
    if (!existsSync(path) || statSync(path).size > 2 * 1024 * 1024) continue;
    if (/\.(png|jpe?g|webp|woff2?|ico|zip)$/i.test(file)) continue;
    const text = readFileSync(path, 'utf8');
    for (const [name, pattern] of SECRETS) if (pattern.test(text)) problems.push(`${file} contiene «${name}»: los secretos no van en el repositorio.`);
  }

  return { problems, facts };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { problems, facts } = checkBuild({ dist: process.argv[2] ? resolve(process.cwd(), process.argv[2]) : undefined });
  console.log(`Paquete principal: ${facts.mainKb ?? '?'} KB · paquete 3D: ${facts.badge3dKb ?? '?'} KB · archivos revisados: ${facts.scanned ?? 0}`);
  for (const problem of problems) console.log(`FALLA  ${problem}`);
  if (problems.length === 0) console.log('OK     La construcción cumple las reglas.');
  process.exit(problems.length === 0 ? 0 : 1);
}
