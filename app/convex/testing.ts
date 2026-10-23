import type { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';
import { normalizeSearch } from './lib/text';
import { newToken, sha256Hex } from './lib/tokens';

/**
 * SOLO PARA LAS PRUEBAS DE EXTREMO A EXTREMO. Son funciones **internas**: el navegador no puede llamarlas, solo la CLI con
 * la clave de despliegue (`npx convex run testing:seed`). Además se niegan a correr si el despliegue no tiene
 * `E2E_ENABLED=1`, que solo se define en el despliegue de desarrollo, nunca en el de producción.
 */
const TABLES = ['events', 'journalEntries', 'tasks', 'projects', 'invites', 'members', 'users', 'settings', 'profile'] as const;

const DAY = 86_400_000;
const E2E_EMAIL = 'e2e-owner@example.com';

function requireE2E() {
  if (process.env.E2E_ENABLED !== '1') throw new Error('Las funciones de prueba están desactivadas en este despliegue (falta E2E_ENABLED=1).');
}

const searchText = (title: string) => normalizeSearch(title);

/** Vacía las tablas de la aplicación (las pruebas parten siempre de lo mismo). */
export const reset = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireE2E();
    for (const table of TABLES) for (const doc of await ctx.db.query(table).collect()) await ctx.db.delete(doc._id);
  },
});

/**
 * Deja la aplicación con la dueña, dos proyectos, 30 tareas «Por hacer» (para medir el desplazamiento), algunas en curso y
 * hechas, cinco registros de la Bitácora (uno borrador), una invitación vigente y el enlace de solo lectura activo.
 * Devuelve los dos enlaces para que las pruebas los abran.
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireE2E();
    for (const table of TABLES) for (const doc of await ctx.db.query(table).collect()) await ctx.db.delete(doc._id);

    const now = Date.now();
    const userId = await ctx.db.insert('users', { email: E2E_EMAIL, name: 'Jose Padilla' });
    const ownerId = await ctx.db.insert('members', { name: 'Jose Padilla', roleLabel: 'Becario', isOwner: true, userId, email: E2E_EMAIL, createdAt: now, lastSeenAt: now });
    const shareToken = newToken();
    await ctx.db.insert('settings', { shareEnabled: true, shareToken, shareIncludesJournal: true, shareShowsDescriptions: false, timezone: 'America/Bogota' });
    await ctx.db.insert('profile', {
      memberId: ownerId,
      program: 'Ingeniería de Sistemas',
      term: '10.º semestre',
      institution: 'Institución Universitaria Antonio José Camacho',
      group: 'AthenIA',
      badgeDesign: 'olimpo',
      updatedAt: now,
    });

    const projects: Id<'projects'>[] = [];
    for (const [index, name] of ['iMujer', 'SECOP II'].entries()) projects.push(await ctx.db.insert('projects', { name, nameLower: normalizeSearch(name), colorSlot: index + 1 }));

    let order = 0;
    const task = async (title: string, status: 'todo' | 'doing' | 'review' | 'done', patch: { dueDate?: string; hours?: number } = {}) => {
      order += 1;
      return ctx.db.insert('tasks', {
        title,
        projectId: projects[order % 2],
        priority: 2,
        status,
        order,
        createdBy: ownerId,
        createdAt: now - order * 1000,
        updatedAt: now - order * 1000,
        ...(status === 'done' ? { completedAt: now - DAY } : {}),
        ...(patch.dueDate ? { dueDate: patch.dueDate } : {}),
        subtasks: [],
        searchText: searchText(title),
      });
    };
    for (let i = 1; i <= 30; i += 1) await task(`Tarea de prueba ${String(i).padStart(2, '0')}`, 'todo');
    await task('Redactar el informe semanal', 'doing');
    await task('Revisar el convenio', 'doing');
    await task('Enviar el borrador a dirección', 'review');
    const done = await task('Actualizar el tablero', 'done');
    await task('Preparar la reunión', 'done');

    const date = (daysAgo: number) => new Date(now - daysAgo * DAY - 5 * 3_600_000).toISOString().slice(0, 10);
    const entry = (n: number, activity: string, draft = false) =>
      ctx.db.insert('journalEntries', {
        date: date(n),
        projectId: projects[n % 2],
        activity,
        ...(draft ? {} : { result: 'Quedó listo', hours: 2 }),
        docStatus: draft ? 'draft' : 'complete',
        activityStatus: 'Completada',
        links: [],
        photos: [],
        dayOrder: n,
        createdAt: now,
        updatedAt: now,
        ...(draft ? { taskId: done, taskTitleSnapshot: 'Actualizar el tablero' } : {}),
      });
    for (const [n, activity] of ['Reunión de arranque', 'Revisión del convenio', 'Informe semanal', 'Ajuste de indicadores'].entries()) await entry(n + 1, activity);
    await entry(0, 'Actualizar el tablero', true);

    const inviteToken = newToken();
    await ctx.db.insert('invites', { tokenHash: await sha256Hex(inviteToken), createdBy: ownerId, createdAt: now, expiresAt: now + 7 * DAY });

    return { shareToken, inviteToken, ownerEmail: E2E_EMAIL };
  },
});
