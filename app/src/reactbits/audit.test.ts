import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '..', '..');
const DIR = __dirname;
const PLAN_COMPONENTS = ['Lanyard', 'SpotlightCard', 'ShinyText', 'CountUp', 'TiltedCard', 'Magnet', 'ClickSpark', 'ElectricBorder', 'PillNav'];
const audit = readFileSync(join(DIR, 'AUDIT.md'), 'utf8');

describe('React Bits audit', () => {
  it('passes the content-security-policy audit script', () => {
    const run = spawnSync(process.execPath, [join(APP, 'scripts', 'audit-reactbits.mjs')], { cwd: APP, encoding: 'utf8' });
    expect(run.stdout).toContain('OK     Lanyard');
    expect(run.stdout).not.toContain('FALLA');
    expect(run.status).toBe(0);
  });

  it('finds none of the forbidden constructs in any vendored file', () => {
    const forbidden = /\beval\s*\(|\bnew\s+Function\b|<style\b|createElement\(\s*['"`]style|insertRule|adoptedStyleSheets|\bfetch\s*\(|XMLHttpRequest/;
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    const offenders = walk(DIR).filter((file) => /\.(tsx?|css)$/.test(file) && !/\.test\./.test(file) && forbidden.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('keeps the license notice', () => {
    expect(existsSync(join(DIR, 'LICENSE.md'))).toBe(true);
    expect(readFileSync(join(DIR, 'LICENSE.md'), 'utf8')).toContain('Commons Clause');
  });

  it('lists every plan component with its verdict, and says what was done with each', () => {
    for (const name of PLAN_COMPONENTS) {
      const row = audit.split('\n').find((line) => line.startsWith(`| ${name} |`));
      expect(row, `AUDIT.md no lista ${name}`).toBeDefined();
      expect(row).toMatch(/Pasa/);
      expect(row).toMatch(/\*\*(Copiado|No se copia)/);
    }
  });

  it('lists a verdict for every folder that is actually vendored', () => {
    const folders = readdirSync(DIR).filter((name) => statSync(join(DIR, name)).isDirectory());
    for (const folder of folders) expect(audit).toContain(`| ${folder} |`);
  });
});
