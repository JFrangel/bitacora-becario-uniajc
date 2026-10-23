import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '..', '..');
const toml = readFileSync(join(APP, 'netlify.toml'), 'utf8');
const value = (key: string) => new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm').exec(toml)?.[1];

/** La política de «Restricciones globales» del plan, directiva por directiva. */
const EXPECTED_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data: https://*.convex.cloud",
  "font-src 'self'",
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
];

describe('netlify.toml', () => {
  it('has exactly the content-security policy of the project', () => {
    expect(value('Content-Security-Policy')!.split('; ')).toEqual(EXPECTED_CSP);
  });

  it('never allows inline or eval-ed code, or any other origin', () => {
    const csp = value('Content-Security-Policy')!;
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|unsafe-hashes/);
    const origins = [...csp.matchAll(/(?:https?|wss?):\/\/[^\s;]+/g)].map((m) => m[0]);
    expect([...new Set(origins)].sort()).toEqual(['https://*.convex.cloud', 'wss://*.convex.cloud']);
    expect(csp).not.toMatch(/google|script\.google|googleusercontent|\*(?!\.convex)/);
  });

  it('keeps the site out of search engines and sends the standard protections', () => {
    expect(value('X-Robots-Tag')).toBe('noindex');
    expect(value('X-Content-Type-Options')).toBe('nosniff');
    expect(value('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(value('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('builds with «convex deploy» so the app gets its Convex address, and publishes dist', () => {
    expect(value('command')).toBe("npx convex deploy --cmd 'npm run build'");
    expect(value('publish')).toBe('dist');
  });

  it('serves clean application routes through the SPA entry point', () => {
    expect(toml).toMatch(/\[\[redirects\]\]\s*from = "\/\*"\s*to = "\/index\.html"\s*status = 200/);
  });

  it('caches the hashed files for a year, and only those', () => {
    expect(toml).toMatch(/for = "\/assets\/\*"[\s\S]*Cache-Control = "public, max-age=31536000, immutable"/);
    expect(toml.match(/Cache-Control/g)).toHaveLength(1);
  });
});

describe('fonts', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });

  it('are self-hosted: Inter, Instrument Serif, JetBrains Mono and Space Grotesk from @fontsource', () => {
    const fonts = readFileSync(join(APP, 'src', 'styles', 'fonts.css'), 'utf8');
    for (const family of ['inter', 'instrument-serif', 'jetbrains-mono', 'space-grotesk']) expect(fonts).toContain(`@fontsource/${family}/`);
  });

  it('are never requested from Google, in the page or in any source file', () => {
    expect(readFileSync(join(APP, 'index.html'), 'utf8')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    const offenders = walk(join(APP, 'src')).filter((file) => /\.(tsx?|css)$/.test(file) && !/\.test\./.test(file) && /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
