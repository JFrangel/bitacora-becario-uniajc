import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { SEED_FILE } from './seed';

/** Deja el despliegue de desarrollo con los datos de siempre (`convex/testing.ts`) y guarda los enlaces para los escenarios. */
export default function globalSetup() {
  const output = execFileSync('npx', ['convex', 'run', 'testing:seed'], { encoding: 'utf8', shell: true });
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`«convex run testing:seed» no devolvió los enlaces:\n${output}`);
  writeFileSync(SEED_FILE, output.slice(start, end + 1));
}
