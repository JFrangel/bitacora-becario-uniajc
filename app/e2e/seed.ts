import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Lo que devuelve `testing:seed`: los dos enlaces de la sesión de pruebas. Se escribe en `global-setup.ts` y no se versiona. */
export const SEED_FILE = join(import.meta.dirname, '.seed.json');

export type Seed = { shareToken: string; inviteToken: string; ownerEmail: string };

export const readSeed = (): Seed => JSON.parse(readFileSync(SEED_FILE, 'utf8')) as Seed;

/** Todo lo que sirve para editar: ninguno debe existir en la vista de solo lectura. */
export const EDIT_BUTTONS = ['Invitar', '＋ Nueva tarea', /^Nueva tarea en /, /^Nueva tarea el /, /^Mover a /, /^Mover «/, '＋ Registrar actividad', 'Editar registro', 'Completar detalles', 'Descargar copia', 'Restaurar copia', 'Editar perfil', 'Cerrar sesión'];
