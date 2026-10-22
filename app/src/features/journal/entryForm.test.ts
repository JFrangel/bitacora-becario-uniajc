import { describe, expect, it } from 'vitest';
import type { JournalDto } from '../../../convex/lib/journalDto';
import { HOURS_MESSAGE } from '../../../convex/lib/hours';
import { entryFormFrom, newEntryForm, pendingLink, toFieldsArgs, validateEntryForm } from './entryForm';

const ok = { ...newEntryForm('2026-10-21'), projectName: 'iMujer', activity: 'Revisión', result: 'Listo' };

describe('newEntryForm', () => {
  it('starts with today, 2 hours and the status «Completada»', () => {
    expect(newEntryForm('2026-10-21')).toMatchObject({ date: '2026-10-21', hours: '2', activityStatus: 'Completada', projectName: '', links: [], photos: [], pending: [] });
  });
});

describe('validateEntryForm', () => {
  it.each([
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['0,25', 0.25],
    ['24', 24],
    [' 2 ', 2],
  ])('accepts %s hours', (hours, expected) => {
    expect(validateEntryForm({ ...ok, hours })).toEqual({ ok: true, hours: expected });
  });

  it.each(['25', '0,1', '0', '', 'abc', '1,3', '-2'])('rejects %s hours with the exact message', (hours) => {
    expect(validateEntryForm({ ...ok, hours })).toEqual({ ok: false, field: 'hours', message: HOURS_MESSAGE });
  });

  it.each([
    ['date', { date: '' }],
    ['project', { projectName: '  ' }],
    ['activity', { activity: '' }],
    ['result', { result: '   ' }],
  ] as const)('needs the %s, with the same message as the published site', (field, patch) => {
    expect(validateEntryForm({ ...ok, ...patch })).toEqual({ ok: false, field, message: HOURS_MESSAGE });
  });

  it('keeps objective, development and observations optional', () => {
    expect(validateEntryForm({ ...ok, objective: '', development: '', observations: '' })).toEqual({ ok: true, hours: 2 });
  });
});

describe('pendingLink', () => {
  it('returns nothing when both boxes are empty', () => {
    expect(pendingLink('', '')).toBeNull();
    expect(pendingLink('  ', '  ')).toBeNull();
  });

  it('uses the domain as the name when it is left empty', () => {
    expect(pendingLink('', 'https://www.secop.gov.co/ruta')).toEqual({ label: 'www.secop.gov.co', url: 'https://www.secop.gov.co/ruta' });
    expect(pendingLink('Contrato', 'http://docs.example.com/a')).toEqual({ label: 'Contrato', url: 'http://docs.example.com/a' });
  });

  it('asks for the address when only the name was written', () => {
    expect(() => pendingLink('Solo nombre', '')).toThrow('Completa la dirección web del enlace.');
  });

  it.each(['example.com', 'ftp://example.com', 'javascript:alert(1)', '//example.com'])('rejects %s', (url) => {
    expect(() => pendingLink('x', url)).toThrow('Usa un enlace que comience con http:// o https://.');
  });
});

describe('entryFormFrom', () => {
  const base = {
    id: 'j1', date: '2026-10-18', projectId: 'p1', projectName: 'iMujer', projectColorSlot: 1, activity: 'Revisión inicial', objective: 'Meta', result: 'Hecho', hours: 1.5,
    docStatus: 'complete', isDraft: false, activityStatus: 'En progreso', links: [{ label: 'Doc', url: 'https://example.com' }], photos: [{ storageId: 's1', thumbStorageId: 't1', name: 'a.jpg', url: 'https://x/a', thumbUrl: 'https://x/t' }],
    dayOrder: 1, createdAt: 1, updatedAt: 2,
  } as unknown as JournalDto;

  it('fills the form with a complete record, writing hours with a decimal comma', () => {
    expect(entryFormFrom(base)).toMatchObject({ date: '2026-10-18', hours: '1,5', projectName: 'iMujer', activity: 'Revisión inicial', objective: 'Meta', result: 'Hecho', activityStatus: 'En progreso' });
    expect(entryFormFrom(base).photos).toHaveLength(1);
  });

  it('leaves the hours empty for a draft, and fills activity, project, date and objective', () => {
    const draft = { ...base, isDraft: true, docStatus: 'draft', hours: undefined, result: undefined } as unknown as JournalDto;
    expect(entryFormFrom(draft)).toMatchObject({ hours: '', result: '', activity: 'Revisión inicial', objective: 'Meta', projectName: 'iMujer', date: '2026-10-18', activityStatus: 'En progreso' });
  });
});

describe('toFieldsArgs', () => {
  it('sends the typed hours as text and drops empty optional texts', () => {
    const args = toFieldsArgs({ ...ok, hours: '1,5', objective: ' ', links: [{ label: 'A', url: 'https://e.co' }] }, [{ storageId: 's1', name: 'a.jpg' }]);
    expect(args).toMatchObject({ date: '2026-10-21', hours: '1,5', projectName: 'iMujer', activity: 'Revisión', result: 'Listo', activityStatus: 'Completada', links: [{ label: 'A', url: 'https://e.co' }], photos: [{ storageId: 's1', name: 'a.jpg' }] });
    expect('objective' in args).toBe(false);
  });
});
