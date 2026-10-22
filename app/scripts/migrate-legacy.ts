// Migra la Bitácora publicada (hoja de Google) a Convex. NO se ejecuta hasta el corte (CUTOVER.md).
//
//   node scripts/migrate-legacy.ts --dry-run                       Solo lee y mapea: imprime el informe del origen y no toca Convex.
//   node scripts/migrate-legacy.ts --owner-email tu@gmail.com      Importa en el despliegue de DESARROLLO (el de `npx convex dev`).
//   node scripts/migrate-legacy.ts --prod --owner-email tu@gmail.com   Importa en PRODUCCIÓN (en el corte, con la clave de despliegue).
//   --owner-email: el correo de Google de la dueña. Debe ser el de la cuenta que ya entró a la aplicación; si no coincide no se
//   importa nada (la Bitácora migrada queda enlazada solo a esa cuenta, nunca a otra persona que entre después).
//   --source <url>                                    Otro punto de lectura (por omisión, el de /app.js).
//
// Es idempotente: se puede repetir. Las imágenes de Drive se copian al almacenamiento de Convex con su miniatura (con
// `sharp`, solo aquí); si una no se puede copiar conserva su dirección y se informa. Al final imprime un informe que compara
// el origen con lo importado: registros, horas, completadas, fechas y proyectos.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LegacyEntryError, mapLegacyEntry, parseJsonp, summarize } from '../convex/lib/legacy.ts';
import type { JournalInsert, LegacySummary } from '../convex/lib/legacy.ts';

const APP = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dryRun = flag('--dry-run');
const ownerEmail = option('--owner-email')?.trim();
const prod = flag('--prod');
const BATCH = 10;
const FULL_PX = 1600;
const THUMB_PX = 400;

const found = option('--source') ?? /REMOTE_API_URL\s*=\s*"([^"]+)"/.exec(readFileSync(join(APP, '..', 'app.js'), 'utf8'))?.[1];
if (!found) throw new Error('No se encontró el punto de lectura: pásalo con --source <url>.');
const sourceUrl: string = found;

const convexBin = join(APP, 'node_modules', 'convex', 'bin', 'main.js');
/** Llama a una función interna de Convex con la CLI (usa la clave de despliegue o el inicio de sesión de `npx convex`). */
function convexRun<T>(name: string, payload: object = {}): T {
  const output = execFileSync(process.execPath, [convexBin, 'run', ...(prod ? ['--prod'] : []), name, JSON.stringify(payload)], { cwd: APP, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const start = output.search(/[{["\d]/);
  return JSON.parse(output.slice(start >= 0 ? start : 0)) as T;
}

const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

async function readSource() {
  const response = await fetch(`${sourceUrl}?callback=cb_migrate`);
  if (!response.ok) throw new Error(`La hoja respondió ${response.status}.`);
  const { entries } = parseJsonp(await response.text());
  const mapped: JournalInsert[] = [];
  const rejected: string[] = [];
  for (const entry of entries) {
    try {
      mapped.push(mapLegacyEntry(entry));
    } catch (error) {
      if (!(error instanceof LegacyEntryError)) throw error;
      rejected.push(error.message);
    }
  }
  return { read: entries.length, mapped, rejected };
}

/** Copia una imagen de Drive al almacenamiento de Convex (completa y miniatura). Devuelve `null` y el motivo si no se pudo. */
async function copyImage(url: string): Promise<{ storageId: string; thumbStorageId: string } | { error: string }> {
  try {
    const id = new URL(url).searchParams.get('id') ?? /\/d\/([^/]+)/.exec(url)?.[1];
    const response = await fetch(id ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}` : url);
    if (!response.ok) return { error: `respondió ${response.status}` };
    const original = Buffer.from(await response.arrayBuffer());
    const { default: sharp } = await import('sharp');
    const full = await sharp(original).rotate().resize(FULL_PX, FULL_PX, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    const thumb = await sharp(original).rotate().resize(THUMB_PX, THUMB_PX, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
    const upload = async (bytes: Buffer) => {
      const target = convexRun<string>('legacyImport:uploadUrl');
      const sent = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array(bytes) });
      if (!sent.ok) throw new Error(`la subida respondió ${sent.status}`);
      return ((await sent.json()) as { storageId: string }).storageId;
    };
    return { storageId: await upload(full), thumbStorageId: await upload(thumb) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

function printSummary(title: string, s: LegacySummary) {
  console.log(`\n${title}`);
  console.log(`  Registros:   ${s.count}`);
  console.log(`  Horas:       ${fmt(s.hours)}`);
  console.log(`  Completadas: ${s.completed}`);
  console.log(`  Fechas:      ${s.firstDate ?? '—'} a ${s.lastDate ?? '—'}`);
  console.log(`  Proyectos:   ${s.projects.join(', ') || '—'}`);
}

const key = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function main() {
  console.log(`Leyendo ${sourceUrl.replace(/\/macros\/s\/[^/]+/, '/macros/s/…')} …`);
  const { read, mapped, rejected } = await readSource();
  console.log(`Se leyeron ${read} registros; ${mapped.length} se pueden migrar y ${rejected.length} se rechazan.`);
  for (const reason of rejected) console.log(`  RECHAZADO  ${reason}`);
  const source = summarize(mapped);
  printSummary('ORIGEN (hoja de Google)', source);
  const photos = mapped.flatMap((entry) => entry.photos).length;
  console.log(`  Imágenes:    ${photos}`);

  if (dryRun) {
    console.log('\n--dry-run: no se tocó Convex.');
    return;
  }

  if (!ownerEmail) throw new Error('Falta --owner-email <correo de Google de la dueña>: la Bitácora migrada se enlaza solo a esa cuenta.');
  console.log(`\nImportando a ${prod ? 'PRODUCCIÓN' : 'desarrollo'}, enlazada a la cuenta ${ownerEmail}…`);
  const kept: string[] = [];
  let copied = 0;
  for (const entry of mapped) {
    for (const photo of entry.photos) {
      if (!photo.url || photo.storageId) continue;
      const result = await copyImage(photo.url);
      if ('error' in result) kept.push(`${entry.legacyId} · ${photo.name}: ${result.error}`);
      else {
        photo.storageId = result.storageId;
        photo.thumbStorageId = result.thumbStorageId;
        delete photo.url;
        copied += 1;
      }
    }
  }

  const failed: string[] = [];
  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH);
    try {
      convexRun('legacyImport:upsertBatch', { ownerEmail, entries: batch });
    } catch {
      // Un registro inválido hace fallar todo el lote: se repite uno por uno para saber cuál es.
      for (const entry of batch) {
        try {
          convexRun('legacyImport:upsertBatch', { ownerEmail, entries: [entry] });
        } catch (error) {
          failed.push(`${entry.legacyId}: ${String((error as Error).message).split('\n').find((line) => /Registro|dueña|correo|VALIDATION/.test(line)) ?? 'no se pudo importar'}`);
        }
      }
    }
  }

  const imported = convexRun<LegacySummary & { photosInStorage: number; photosStillOnDrive: number }>('legacyImport:report');
  printSummary('IMPORTADO (Convex)', imported);
  console.log(`  Imágenes:    ${imported.photosInStorage} copiadas a Convex, ${imported.photosStillOnDrive} siguen en Drive`);

  const same = (label: string, a: unknown, b: unknown) => console.log(`  ${JSON.stringify(a) === JSON.stringify(b) ? '✔' : '✘'} ${label}`);
  console.log('\nCOMPARACIÓN');
  same('registros', source.count, imported.count);
  same('horas', Math.round(source.hours * 100), Math.round(imported.hours * 100));
  same('completadas', source.completed, imported.completed);
  same('fechas', [source.firstDate, source.lastDate], [imported.firstDate, imported.lastDate]);
  same('proyectos', [...new Set(source.projects.map(key))].sort(), [...new Set(imported.projects.map(key))].sort());
  console.log(`  Imágenes copiadas ahora: ${copied}`);
  for (const line of kept) console.log(`  IMAGEN SIN COPIAR  ${line}`);
  for (const line of failed) console.log(`  REGISTRO NO IMPORTADO  ${line}`);
  if (rejected.length || failed.length) process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(`\nFALLA  ${error.message}`);
  process.exit(1);
});
