import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUDGET, checkBuild as check } from '../../scripts/check-build.mjs';
import type { checkBuild } from '../../scripts/check-build.mjs';

type Result = ReturnType<typeof checkBuild>;
const APP = join(__dirname, '..', '..');
/** El texto que delata que la aplicación está dentro del paquete principal. */
const MAIN = 'console.log("Este enlace ya no está activo")';
const scratch = mkdtempSync(join(tmpdir(), 'check-build-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Una carpeta `dist/` mínima: lo que se pasa en `files` reemplaza a lo normal. */
function fakeDist(name: string, files: Record<string, string> = {}) {
  const dist = join(scratch, name, 'dist');
  const all: Record<string, string> = {
    'index.html': '<!doctype html><html><head><script type="module" src="/assets/index.js"></script></head><body><div id="root"></div></body></html>',
    'assets/index.js': MAIN,
    'assets/Lanyard.js': 'class WebGLRenderer {}',
    ...files,
  };
  for (const [file, text] of Object.entries(all)) {
    mkdirSync(dirname(join(dist, file)), { recursive: true });
    writeFileSync(join(dist, file), text);
  }
  return { dist, app: join(scratch, name, 'app') };
}

describe('the real build', () => {
  let result: Result;
  beforeAll(() => {
    const out = join(scratch, 'real');
    const build = spawnSync(process.execPath, [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'silent'], {
      cwd: APP,
      encoding: 'utf8',
      // Vitest corre con NODE_ENV=test: la construcción de producción necesita lo contrario.
      env: { ...process.env, NODE_ENV: 'production', VITE_CONVEX_URL: 'https://check-build-123.convex.cloud' },
    });
    expect(build.status, build.stderr + build.stdout).toBe(0);
    result = check({ dist: out });
  }, 180_000);

  it('passes every check', () => {
    expect(result.problems).toEqual([]);
  });

  it('keeps the main bundle under 250 KB compressed, without the 3D', () => {
    expect(BUDGET.mainKb).toBe(250);
    expect(result.facts.mainKb).toBeGreaterThan(0);
    expect(result.facts.mainKb!).toBeLessThanOrEqual(250);
  });

  it('puts three.js in a single separate chunk of at most 220 KB compressed, loaded only when a badge is shown', () => {
    expect(result.facts.badge3dChunks).toHaveLength(1);
    expect(result.facts.badge3dChunks![0]).toMatch(/^assets\/Lanyard-.*\.js$/);
    expect(result.facts.badge3dKb!).toBeLessThanOrEqual(220);
  });

  it('keeps the patch that stops the badge from being cut at the sides in the vendored Lanyard', () => {
    const source = readFileSync(join(APP, 'src', 'reactbits', 'Lanyard', 'Lanyard.tsx'), 'utf8');
    expect(source).toMatch(/bounds\?: boolean/);
    expect(source).toMatch(/keepInside/);
  });
});

describe('the checks catch what they must', () => {
  it('asks for a build first', () => {
    expect(check({ dist: join(scratch, 'nada') }).problems[0]).toMatch(/npm run build/);
  });

  it('passes a clean build', () => {
    expect(check(fakeDist('limpio')).problems).toEqual([]);
  });

  it('rejects inline scripts, styles, style attributes and event handlers in index.html', () => {
    const bad = (html: string) => check(fakeDist(`html-${randomBytes(3).toString('hex')}`, { 'index.html': html })).problems.join('\n');
    expect(bad('<script>alert(1)</script><script src="/assets/index.js"></script>')).toMatch(/<script> en línea/);
    expect(bad('<style>body{}</style><script src="/assets/index.js"></script>')).toMatch(/<style>/);
    expect(bad('<div style="color:red"></div><script src="/assets/index.js"></script>')).toMatch(/atributo style/);
    expect(bad('<body onload="x()"><script src="/assets/index.js"></script></body>')).toMatch(/controlador de eventos/);
  });

  it('rejects requests to any domain other than *.convex.cloud, but not the inert strings of the libraries', () => {
    const run = (js: string) => check(fakeDist(`host-${randomBytes(3).toString('hex')}`, { 'assets/index.js': `${MAIN};${js}` })).problems.join('\n');
    expect(run('fetch("https://tracker.example.com/x")')).toMatch(/tracker\.example\.com/);
    expect(run('const ws = "wss://x.convex.cloud"; const u = "https://happy-animal-123.convex.cloud"')).toBe('');
    expect(run('const ns = "http://www.w3.org/2000/svg"; const e = "https://reactjs.org/docs/error-decoder.html"')).toBe('');
  });

  it('rejects Google fonts', () => {
    expect(check(fakeDist('fuentes', { 'assets/app.css': '@import url(https://fonts.googleapis.com/css2?family=Inter)' })).problems.join('\n')).toMatch(/fonts\.googleapis\.com|Google/);
  });

  it('rejects three.js in the main bundle, and 3D split in two', () => {
    const inMain = check(fakeDist('tres-en-principal', { 'assets/index.js': `${MAIN};class WebGLRenderer {}`, 'assets/Lanyard.js': 'x' })).problems.join('\n');
    expect(inMain).toMatch(/three\.js está en el paquete principal/);
    const twice = check(fakeDist('tres-dos-veces', { 'assets/Otro.js': 'class WebGLRenderer {}' })).problems.join('\n');
    expect(twice).toMatch(/solo paquete aparte \(hay 2/);
  });

  it('rejects a main bundle over the budget', () => {
    const heavy = randomBytes(270 * 1024).toString('base64');
    expect(check(fakeDist('pesado', { 'assets/index.js': `${MAIN};"${heavy}"` })).problems.join('\n')).toMatch(/paquete principal pesa/);
  });

  it('rejects a build made without VITE_CONVEX_URL, where Vite drops the whole app and keeps only the «falta conectar» notice', () => {
    const empty = check(fakeDist('sin-convex', { 'assets/index.js': 'console.log("Falta conectar la base de datos")' })).problems.join('\n');
    expect(empty).toMatch(/no contiene la aplicación: construye con VITE_CONVEX_URL/);
  });

  it('rejects secrets in versioned files: Google secrets, client_secret and private keys', () => {
    const { dist, app } = fakeDist('secretos');
    for (const [name, text] of [['a.txt', 'AUTH_GOOGLE_SECRET=GOCSPX-abc123'], ['b.json', '{"client_secret":"x"}'], ['c.pem', '-----BEGIN RSA PRIVATE KEY-----']] as const) {
      mkdirSync(app, { recursive: true });
      writeFileSync(join(app, name), text);
    }
    const found = check({ dist, app }).problems.join('\n');
    expect(found).toMatch(/a\.txt contiene «GOCSPX-»/);
    expect(found).toMatch(/b\.json contiene «client_secret»/);
    expect(found).toMatch(/c\.pem contiene «clave privada»/);
  });

  it('rejects the credentials file Google hands out, by its name, and lets documents talk about it', () => {
    const { dist, app } = fakeDist('archivo-google');
    mkdirSync(app, { recursive: true });
    writeFileSync(join(app, 'client_secret_123-abc.apps.googleusercontent.com.json'), '{}');
    writeFileSync(join(app, 'GUIA.md'), 'El archivo client_secret_*.json se queda fuera del repositorio.');
    const found = check({ dist, app }).problems.join('\n');
    expect(found).toMatch(/client_secret_123.*archivo de credenciales de Google/);
    expect(found).not.toMatch(/GUIA\.md/);
  });

  it('finds no secret in the real project files', () => {
    const real = check({ dist: fakeDist('real-app').dist });
    expect(real.problems.filter((p) => /contiene/.test(p))).toEqual([]);
  });
});
