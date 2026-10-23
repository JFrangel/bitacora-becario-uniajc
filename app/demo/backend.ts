// El servidor de la vista previa: las funciones REALES de `convex/` corriendo en memoria con `convex-test`, más datos de ejemplo
// sembrados con esas mismas funciones (así el historial, los borradores y las horas salen como saldrían de verdad).
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { api, internal } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import schema from '../convex/schema';

const modules = import.meta.glob(['../convex/**/*.ts', '../convex/**/*.js', '!../convex/**/*.d.ts']);

const DAY = 86_400_000;
/** AAAA-MM-DD de hoy más `days` días, en hora de Bogotá (UTC−5), igual que la aplicación. */
const iso = (days: number) => new Date(Date.now() - 5 * 3_600_000 + days * DAY).toISOString().slice(0, 10);

type Client = ReturnType<ReturnType<typeof convexTest>['withIdentity']>;

async function seed(t: ReturnType<typeof convexTest>) {
  process.env.OWNER_EMAIL = 'jose@demo.local';
  process.env.SITE_URL = 'http://localhost:5175';
  const now = Date.now();

  const person = async (email: string, name: string) => {
    const userId = await t.run((ctx) => ctx.db.insert('users', { email, name }));
    return { userId, client: t.withIdentity({ subject: `${userId}|demo` }) as Client };
  };

  // La dueña entra por el camino de verdad: `session.ensureOwner` crea su registro, los ajustes y el perfil.
  const jose = await person('jose@demo.local', 'Jose Frangel Padilla Camacho');
  const owner = jose.client;
  const ownerId = (await owner.mutation(api.session.ensureOwner, {})) as Id<'members'>;
  await owner.mutation(api.members.updateSelf, { name: 'Jose Frangel Padilla Camacho', roleLabel: 'Becario' });

  const ana = await person('ana.gomez@demo.local', 'Ana Gómez');
  const luis = await person('luis.rios@demo.local', 'Luis Ríos');
  const carlos = await person('carlos.ruiz@demo.local', 'Carlos Ruiz');
  const anaId = await t.run((ctx) => ctx.db.insert('members', { name: 'Ana Gómez', roleLabel: 'Directora', isOwner: false, userId: ana.userId, email: 'ana.gomez@demo.local', invitedBy: ownerId, createdAt: now - 12 * DAY, lastSeenAt: now - 3_600_000 }));
  const luisId = await t.run((ctx) => ctx.db.insert('members', { name: 'Luis Ríos', roleLabel: 'Supervisor', isOwner: false, userId: luis.userId, email: 'luis.rios@demo.local', invitedBy: anaId, createdAt: now - 6 * DAY, lastSeenAt: now - 5 * DAY }));

  await owner.mutation(api.profile.update, {
    program: 'Ingeniería de Sistemas',
    term: '10.º semestre',
    institution: 'Institución Universidad Antonio José Camacho',
    group: 'AthenIA',
    badgeDesign: 'olimpo',
  });

  const todo = [
    ['Revisar cláusulas del convenio', 'iMujer', ownerId, 3, 2, ['Leer el borrador', 'Marcar riesgos', 'Proponer ajustes']],
    ['Preparar la reunión con la directora', 'iMujer', anaId, 2, 3, []],
    ['Descargar los pliegos del proceso', 'SECOP II', ownerId, -1, 3, []],
    ['Verificar el cronograma del proceso', 'SECOP II', undefined, 5, 2, []],
    ['Diseñar el esquema de la landing', 'Landing Jurídica', ownerId, 6, 1, []],
    ['Cotizar el dominio y el alojamiento', 'Landing Jurídica', anaId, 7, 1, []],
    ['Entrevistar a dos proveedores', 'CALIFRESCA', luisId, 4, 2, []],
    ['Levantar los requisitos del portal', 'Portal web', ownerId, 8, 2, ['Reunión de arranque', 'Lista de requisitos']],
    ['Redactar el glosario jurídico', 'Análisis Jurídico', ownerId, 9, 1, []],
    ['Clasificar las sentencias por tema', 'Análisis Jurídico', undefined, 10, 2, []],
    ['Actualizar la matriz de riesgos', 'iMujer', luisId, 11, 2, []],
    ['Preparar el informe mensual', 'iMujer', ownerId, 12, 3, []],
  ] as const;
  const doing = [
    ['Redactar el informe semanal', 'iMujer', ownerId, 1, 3, ['Recopilar datos', 'Redactar', 'Revisar'], 1],
    ['Cargar las observaciones al pliego', 'SECOP II', luisId, 4, 3, [], 0],
    ['Resumen de jurisprudencia', 'Análisis Jurídico', ownerId, 2, 2, [], 0],
    ['Maquetar la página de inicio', 'Landing Jurídica', ownerId, 5, 2, [], 0],
  ] as const;
  const review = [
    ['Enviar el borrador a dirección', 'iMujer', ownerId, 0, 3],
    ['Validar el anexo técnico', 'SECOP II', anaId, 1, 2],
  ] as const;
  const done = [
    ['Actualizar el tablero de indicadores', 'iMujer', ownerId],
    ['Mapa de normas aplicables', 'Análisis Jurídico', ownerId],
    ['Preparar el acta de la reunión', 'iMujer', ownerId],
    ['Configurar el repositorio del portal', 'Portal web', luisId],
  ] as const;

  const task = (client: Client, title: string, projectName: string, assigneeId: Id<'members'> | undefined, due: number, priority: number, subtasks: readonly string[], status: 'todo' | 'doing' | 'review' | 'done', doneSubtasks = 0) =>
    client.mutation(api.tasks.create, {
      title,
      projectName,
      status,
      priority,
      dueDate: iso(due),
      ...(assigneeId ? { assigneeId } : {}),
      subtasks: subtasks.map((text, index) => ({ text, done: index < doneSubtasks })),
    });

  for (const [title, project, who, due, priority, subs] of todo) await task(who === anaId ? ana.client : owner, title, project, who, due, priority, subs, 'todo');
  for (const [title, project, who, due, priority, subs, doneSubs] of doing) await task(owner, title, project, who, due, priority, subs, 'doing', doneSubs);
  for (const [title, project, who, due, priority] of review) await task(owner, title, project, who, due, priority, [], 'review');
  // Las tareas propias que nacen completadas dejan un borrador en la Bitácora, como en la vida real.
  for (const [title, project, who] of done) await task(owner, title, project, who, -2, 2, [], 'done');

  // Un poco de movimiento de otras personas para que el historial no sea solo de la dueña.
  const tasks = (await owner.query(api.tasks.list, {})) as Array<{ id: Id<'tasks'>; title: string }>;
  const byTitle = (title: string) => tasks.find((item) => item.title === title)!.id;
  await ana.client.mutation(api.tasks.move, { id: byTitle('Validar el anexo técnico'), status: 'review' });
  await luis.client.mutation(api.tasks.move, { id: byTitle('Cargar las observaciones al pliego'), status: 'doing' });

  // La Bitácora: registros documentados de los últimos días (la dueña escribe horas y resultado).
  const entries = [
    [-1, '2', 'iMujer', 'Reunión de seguimiento con la directora', 'Alinear prioridades de la semana', 'Se acordó el orden de entrega de los documentos.', 'Completada'],
    [-2, '3.5', 'SECOP II', 'Análisis del pliego de condiciones', 'Identificar requisitos habilitantes', 'Matriz de requisitos con 14 filas y 3 alertas.', 'Completada'],
    [-3, '1.5', 'Análisis Jurídico', 'Lectura de jurisprudencia sobre contratación', 'Reunir precedentes útiles', 'Cinco sentencias resumidas en una página.', 'Completada'],
    [-4, '4', 'Portal web', 'Levantamiento de requisitos con el equipo', 'Definir alcance del portal', 'Lista priorizada de 22 requisitos.', 'En progreso'],
    [-5, '2.5', 'Landing Jurídica', 'Boceto de la estructura de la página', 'Proponer secciones', 'Dos alternativas listas para revisión.', 'Pendiente de revisión'],
    [-6, '1', 'CALIFRESCA', 'Revisión de la cotización del proveedor', 'Comparar precios', 'Comparativo enviado a la supervisora.', 'Completada'],
  ] as const;
  for (const [days, hours, projectName, activity, objective, result, activityStatus] of entries) {
    await owner.mutation(api.journal.createManual, { fields: { date: iso(days), hours, projectName, activity, objective, result, activityStatus, links: [], photos: [] } });
  }

  await owner.mutation(api.settings.setShare, { enabled: true, includesJournal: true, showsDescriptions: false });
  const settings = (await owner.query(api.settings.get, {})) as { link?: string };
  const shareToken = settings.link!.split('/#/ver/')[1];
  const invite = (await owner.mutation(api.invites.create, {})) as { link: string };
  const inviteToken = invite.link.split('/#/invitacion/')[1];

  return { owner, ana: ana.client, carlos: carlos.client, shareToken, inviteToken };
}

export async function createBackend() {
  const t = convexTest(schema, modules);
  const world = await seed(t);
  // Igual que producción tras `migrate-workspaces --apply`: todo queda dentro de «Bitácora principal».
  let cursor: string | undefined;
  do {
    const batch = (await t.mutation(internal.workspaceMigration.runBatch, { cursor, limit: 100 })) as { cursor?: string | null };
    cursor = batch.cursor ?? undefined;
  } while (cursor !== undefined);
  let version = 1;

  const clientFor = (who: string): Client => {
    if (who === 'owner') return world.owner;
    if (who === 'ana') return world.ana;
    if (who === 'carlos') return world.carlos;
    return t as unknown as Client;
  };

  return {
    version: () => version,
    info: () => ({ shareToken: world.shareToken, inviteToken: world.inviteToken }),
    async call(kind: 'query' | 'mutation', name: string, args: unknown, who: string) {
      const client = clientFor(who);
      const ref = makeFunctionReference<'query' | 'mutation'>(name);
      const run = (kind === 'query' ? client.query : client.mutation).bind(client) as unknown as (ref: unknown, args: unknown) => Promise<unknown>;
      try {
        const value = await run(ref, args ?? {});
        if (kind === 'mutation') version += 1;
        return { ok: true, value };
      } catch (error) {
        const failure = error as Error & { data?: unknown };
        return { ok: false, message: failure.message, data: failure.data };
      }
    },
  };
}
