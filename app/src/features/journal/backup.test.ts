import { describe, expect, it } from 'vitest';
import { exportBackup, parseBackup } from './backup';
import type { ExportEntry } from './backup';

const png = 'data:image/png;base64,iVBORw0KGgo=';
const entry = (patch: Partial<ExportEntry> = {}): ExportEntry => ({
  id: 'j1', date: '2026-10-18', hours: 2, project: 'iMujer', activity: 'Revisión', objective: 'Meta', development: 'Pasos', result: 'Hecho', observations: 'Nota',
  status: 'Completada', docStatus: 'complete', links: [{ label: 'Doc', url: 'https://example.com' }], photos: [{ name: 'a.png', dataUrl: png }], createdAt: 10, updatedAt: 20, ...patch,
});

describe('exportBackup', () => {
  it('writes format bitacora-iterativa version 2', () => {
    const parsed = JSON.parse(exportBackup([entry()], new Date('2026-10-21T10:00:00Z')));
    expect(parsed).toMatchObject({ format: 'bitacora-iterativa', version: 2, exportedAt: '2026-10-21T10:00:00.000Z' });
    expect(parsed.entries[0]).toMatchObject({ id: 'j1', docStatus: 'complete', project: 'iMujer', photos: [{ name: 'a.png', dataUrl: png }] });
  });
});

describe('parseBackup', () => {
  it('reads what exportBackup wrote', () => {
    const { entries, skippedDrafts } = parseBackup(exportBackup([entry()]));
    expect(skippedDrafts).toBe(0);
    expect(entries).toEqual([
      {
        legacyId: 'j1', date: '2026-10-18', hours: 2, projectName: 'iMujer', activity: 'Revisión', objective: 'Meta', development: 'Pasos', result: 'Hecho', observations: 'Nota',
        activityStatus: 'Completada', links: [{ label: 'Doc', url: 'https://example.com' }], photos: [{ name: 'a.png', dataUrl: png }], createdAt: 10, updatedAt: 20,
      },
    ]);
  });

  it('accepts a copy of the published site (version 1)', () => {
    const v1 = JSON.stringify({
      format: 'bitacora-iterativa', version: 1, exportedAt: '2026-10-01T00:00:00Z',
      entries: [{ id: 'abc', date: '2026-10-16', hours: 3.5, project: 'SECOP II', activity: 'Búsqueda', result: 'Lista', status: 'En progreso', photos: [{ id: 'p', name: 'x', url: 'https://img.example/x.jpg' }], links: [{ id: 'l', label: 'Enlace', url: 'https://example.com' }], createdAt: 1, updatedAt: 2 }],
    });
    const { entries } = parseBackup(v1);
    expect(entries[0]).toMatchObject({ legacyId: 'abc', hours: 3.5, projectName: 'SECOP II', activityStatus: 'En progreso', photos: [{ name: 'x', url: 'https://img.example/x.jpg' }], links: [{ label: 'Enlace', url: 'https://example.com' }] });
  });

  it('maps the old nextStep and blocker fields to development and observations', () => {
    const v1 = JSON.stringify({ format: 'bitacora-iterativa', version: 1, entries: [{ id: 'a', date: '2026-10-16', hours: 1, project: 'P', activity: 'A', result: 'R', nextStep: 'Siguiente', blocker: 'Traba', status: 'Completada' }] });
    expect(parseBackup(v1).entries[0]).toMatchObject({ development: 'Siguiente', observations: 'Traba' });
  });

  it('skips drafts (they have no hours or result) and says how many', () => {
    const copy = exportBackup([entry({ id: 'd1', docStatus: 'draft', hours: null, result: '' }), entry({ id: 'j2' })]);
    const { entries, skippedDrafts } = parseBackup(copy);
    expect(entries.map((e) => e.legacyId)).toEqual(['j2']);
    expect(skippedDrafts).toBe(1);
  });

  it.each([
    ['another format', JSON.stringify({ format: 'otra-cosa', version: 1, entries: [] })],
    ['an unknown version', JSON.stringify({ format: 'bitacora-iterativa', version: 3, entries: [] })],
    ['entries missing', JSON.stringify({ format: 'bitacora-iterativa', version: 2 })],
    ['text that is not JSON', 'esto no es json'],
    ['a JSON array', '[]'],
  ])('rejects %s with «El archivo no es una copia válida de la bitácora.»', (_name, json) => {
    expect(() => parseBackup(json)).toThrow('El archivo no es una copia válida de la bitácora.');
  });

  it.each([
    ['a bad date', { date: '18/10/2026' }],
    ['hours out of range', { hours: 30 }],
    ['no activity', { activity: '' }],
    ['no result', { result: '   ' }],
    ['a bad status', { status: 'Hecho' }],
    ['no id', { id: '' }],
  ])('rejects a record with %s', (_name, patch) => {
    const copy = JSON.stringify({ format: 'bitacora-iterativa', version: 2, entries: [{ ...entry(), ...patch }] });
    expect(() => parseBackup(copy)).toThrow('La copia contiene un registro con datos inválidos.');
  });

  it('rejects images that are not images, or too many, or over 5 MB', () => {
    const wrap = (photos: unknown) => JSON.stringify({ format: 'bitacora-iterativa', version: 2, entries: [{ ...entry(), photos }] });
    expect(() => parseBackup(wrap([{ name: 'x', dataUrl: 'data:text/html;base64,AAAA' }]))).toThrow('La copia contiene una imagen inválida.');
    expect(() => parseBackup(wrap([{ name: 'x', url: 'http://inseguro.example/x.jpg' }]))).toThrow('La copia contiene una imagen inválida.');
    expect(() => parseBackup(wrap(Array.from({ length: 5 }, () => ({ name: 'x', dataUrl: png }))))).toThrow('Cada registro puede tener máximo 4 imágenes.');
    const huge = `data:image/png;base64,${'A'.repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3) + 8)}`;
    expect(() => parseBackup(wrap([{ name: 'x', dataUrl: huge }]))).toThrow('La copia contiene una imagen de más de 5 MB.');
  });

  it('drops links that are not http or https', () => {
    const copy = JSON.stringify({ format: 'bitacora-iterativa', version: 2, entries: [{ ...entry(), links: [{ label: 'Mal', url: 'javascript:alert(1)' }, { label: 'Bien', url: 'https://ok.example' }] }] });
    expect(parseBackup(copy).entries[0].links).toEqual([{ label: 'Bien', url: 'https://ok.example' }]);
  });
});
