import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const APP = import.meta.dirname ? import.meta.dirname.replace(/[\\/]scripts$/, '') : process.cwd();
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const apply = flag('--apply');
const prod = flag('--prod');
const secret = process.env.WORKSPACE_MIGRATION_SECRET;
if (!secret) throw new Error('Configura WORKSPACE_MIGRATION_SECRET para consultar o ejecutar el backfill en este despliegue.');
if (flag('--dry-run') && apply) throw new Error('Usa --dry-run o --apply, no ambos.');
if (process.env.CONVEX_DEPLOYMENT?.startsWith('prod:') && !prod) {
  throw new Error('El despliegue seleccionado parece producción. Para evitar tocarlo por accidente, selecciona un despliegue dev.');
}

const convexBin = join(APP, 'node_modules', 'convex', 'bin', 'main.js');
function convexRun(name, payload = {}) {
  const output = execFileSync(process.execPath, [convexBin, 'run', ...(prod ? ['--prod'] : []), name, JSON.stringify(payload)], {
    cwd: APP,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const start = output.search(/[{[\d]/);
  return JSON.parse(output.slice(start >= 0 ? start : 0));
}

const initial = convexRun('workspaceMigration:statusAction', { secret });
console.log(apply ? 'Aplicando backfill en el despliegue seleccionado.' : 'Comprobación en seco; no se modificó Convex.');
console.log(JSON.stringify(initial, null, 2));
if (!apply) process.exit(0);

let cursor;
let batches = 0;
do {
  const result = convexRun('workspaceMigration:runBatchAction', { secret, ...(cursor ? { cursor } : {}), limit: 100 });
  cursor = result.cursor ?? undefined;
  batches += 1;
  console.log(`Lote ${batches}: ${result.processed} documentos procesados.`);
} while (cursor !== undefined);

const final = convexRun('workspaceMigration:statusAction', { secret });
console.log('Estado después del backfill:');
console.log(JSON.stringify(final, null, 2));
if (final.inconsistentReferences !== 0 || Object.values(final.unassigned).some((count) => count !== 0)) {
  throw new Error('El backfill dejó documentos sin espacio o referencias inconsistentes.');
}
