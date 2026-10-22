import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const APP = join(__dirname, '..');
const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'legacy-entries.json'), 'utf8')) as { entries: Array<Record<string, unknown>> };

let server: Server;
let entries: Array<Record<string, unknown>> = fixture.entries;
let url = '';

beforeAll(async () => {
  server = createServer((request, response) => {
    const callback = new URL(request.url ?? '', 'http://x').searchParams.get('callback') ?? 'cb';
    response.setHeader('Content-Type', 'application/javascript');
    response.end(`${callback}(${JSON.stringify({ entries })});`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/exec`;
});
afterAll(() => server.close());

/** Asíncrono a propósito: el servidor falso vive en este mismo proceso y no puede responder si este se queda esperando. */
const run = (...args: string[]) =>
  new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [join(APP, 'scripts', 'migrate-legacy.ts'), ...args], { cwd: APP });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });

describe('scripts/migrate-legacy.ts --dry-run', () => {
  it('reads the source and prints its report without touching Convex', async () => {
    entries = fixture.entries;
    const result = await run('--dry-run', '--source', url);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Se leyeron 3 registros; 3 se pueden migrar y 0 se rechazan.');
    expect(result.stdout).toContain('Registros:   3');
    expect(result.stdout).toMatch(/Horas:\s+7,5/);
    expect(result.stdout).toContain('Completadas: 2');
    expect(result.stdout).toContain('2026-10-14 a 2026-10-15');
    expect(result.stdout).toContain('Imágenes:    1');
    expect(result.stdout).toContain('--dry-run: no se tocó Convex.');
    expect(result.stdout).not.toContain('Importando');
  });

  it('reports a record without id as rejected, with the reason, and still migrates the rest', async () => {
    entries = [...fixture.entries, { date: '2026-10-16', project: 'iMujer', activity: 'Sin id', result: 'x', hours: 1, status: 'Completada' }];
    const result = await run('--dry-run', '--source', url);
    expect(result.stdout).toContain('Se leyeron 4 registros; 3 se pueden migrar y 1 se rechazan.');
    expect(result.stdout).toContain('RECHAZADO  El registro no tiene id.');
  });

  it('fails clearly when the source does not answer with the sheet', async () => {
    entries = fixture.entries;
    const result = await run('--dry-run', '--source', 'http://127.0.0.1:1/exec');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('FALLA');
  });
});
