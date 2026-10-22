# Tablero, Calendario, Historial y Bitácora — Plan de construcción

> **Para quien ejecute el plan:** usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans`, tarea por tarea. Los pasos usan casillas (`- [ ]`). **Los pasos de «Commit» solo se ejecutan cuando la dueña lo autorice** (regla de esta sesión: no hacer commit ni push por iniciativa propia).

**Objetivo:** construir la aplicación nueva (React + Convex) con tablero, calendario, historial, Bitácora, acceso por invitación, enlace de solo lectura, seis temas (3 estilos × oscuro/claro) y carné 3D de perfil, y migrar los datos de la hoja de Google.

**Arquitectura:** una aplicación en `app/` (Vite + React + TypeScript, CSS propio con variables) que habla con un backend de Convex en `app/convex/`. Toda regla de negocio y todo permiso vive en funciones de Convex (probadas con `convex-test`); el cliente solo muestra lo que cada audiencia (dueña, persona invitada, enlace de solo lectura) recibe ya filtrado. La aplicación actual (raíz) no se toca hasta el corte.

**Tecnologías:** React 18, Vite, TypeScript, Convex, `@convex-dev/auth` (Google), `@dnd-kit/core`, `three` (solo carné, carga diferida), componentes de React Bits (variante TS + CSS), `@fontsource/*`, Vitest (+ `convex-test`, Testing Library), Playwright.

**Especificación:** `docs/superpowers/specs/2026-10-21-tablero-bitacora-design.md` (leerla completa; este plan decide *quién hace qué, con qué nombres y con qué pruebas*, no repite el diseño). Maqueta de referencia: `docs/superpowers/specs/assets/2026-10-21-mockup/` (el CSS define los seis temas y los movimientos; el JS tiene el motor de scroll, el carné y el encuadre de foto, que se portan a TypeScript).

## Restricciones globales

Valen para todas las tareas (valores copiados de la especificación):
- **Interfaz en español**, con el tono de la maqueta. Código, nombres de funciones y tablas en inglés.
- **Fechas** `AAAA-MM-DD` en `America/Bogota`; marcas de tiempo en milisegundos UTC. Todo texto de personas se muestra como texto plano; enlaces solo `http`/`https`; sin `dangerouslySetInnerHTML`.
- **Límites:** título de tarea 200, descripción 2000, subtareas 20 × 200, nombre de proyecto 100 en el servidor (el formulario de tareas limita a 60; el de la Bitácora, a 100), campos de la Bitácora 1500, 4 imágenes de hasta 5 MB (lado mayor 1400 px, JPEG ≤ 1,2 MB; miniatura de 480 px), 12 enlaces, 10 invitaciones pendientes por persona, invitación 7 días, nombre y rol 2 a 60, foto de perfil 1024 × 1024 JPEG ≤ 400 KB (con mejora de imagen), historial de 50 en 50, Completada = últimos 30 días, móvil = 5 tarjetas por columna.
- **Horas:** de 0,25 a 24 en pasos de 0,25, acepta coma; mensaje exacto «Completa los campos. Las horas deben estar entre 0,25 y 24, en incrementos de 0,25.» Solo suman los registros `complete`.
- **Política de seguridad de contenido** (en `app/netlify.toml`): `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data: https://*.convex.cloud; font-src 'self'; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`. **Sin `unsafe-inline` ni `unsafe-eval`.** Más `X-Robots-Tag: noindex`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Secretos:** ninguno en el repositorio ni en el cliente. `.gitignore` debe cubrir `.env*` (salvo `.env.example`), `client_secret*.json` y `.convex/`. **Nunca leer ni copiar** el archivo `client_secret_*.json` que hay en Descargas: las credenciales de Google las carga la dueña en Convex.
- **`app/` es independiente:** el `node_modules` de la raíz es un enlace simbólico a un directorio externo; `app/` instala el suyo. No modificar la aplicación actual.
- **Licencia de React Bits** (MIT + Commons Clause): copiar solo dentro de esta aplicación y conservar `LICENSE.md` y los avisos. **Datos personales:** del currículum de la dueña solo nombre, programa, semestre, institución y grupo; nunca teléfono, correo, documento ni referencias.
- **Movimiento reducido:** `prefers-reduced-motion` desactiva inclinación, foco de luz, brillo, conteo animado, chispas, animación de tarjetas al desplazar y el 3D del carné.
- **Comandos de prueba:** `cd app && npx vitest run <ruta>` (servidor: `tests/convex/**`, entorno `edge-runtime`; cliente: `src/**`, entorno `jsdom`).

## Puntos a vigilar (no cubiertos por la especificación)

Cada línea tiene su prueba en la tarea que posee el código (se indica entre paréntesis):
1. **Mover una tarea que otra persona acaba de borrar o mover** debe fallar con un código claro, revertir la tarjeta y avisar «Esa tarea ya no existe.» sin dejar la pantalla a medias (A10, B6).
2. **Títulos solo con espacios, tildes y palabras larguísimas:** «   » no crea tarea; buscar «analisis» encuentra «Análisis Jurídico»; una palabra sin espacios de 300 letras no desborda la tarjeta (A3, A9, B5).
3. **Medianoche en Bogotá:** completar a las 23:30 (04:30 UTC del día siguiente) fecha el borrador con el día de Bogotá, no el de UTC; «vence esta semana» usa el mismo día (A3, A10).
4. **`OWNER_EMAIL` ausente o con otra capitalización:** sin la variable nadie es dueña (falla cerrada); `Jose@Gmail.com` equivale a `jose@gmail.com` (A4).
5. **Acceso retirado con la aplicación abierta:** la persona ve «Tu acceso ya no está activo.» y se cierra su sesión, en vez de un cargando infinito (B2).

---

# Parte A — Servidor (Convex)

### Tarea A1: Andamiaje de `app/`

**Archivos:** crear `app/package.json`, `app/tsconfig.json`, `app/vite.config.ts`, `app/vitest.config.ts`, `app/index.html`, `app/.env.example`, `app/src/main.tsx`, `app/tests/smoke.test.ts`; modificar `/.gitignore` (raíz).
**Interfaces:** produce los scripts `dev`, `build`, `test`, `typecheck`, `e2e`; la convención `tests/convex/*.test.ts` (servidor) y `src/**/*.test.ts(x)` (cliente).

- [ ] Paso 1: crear la rama de trabajo con `superpowers:using-git-worktrees` (nombre `feature/tablero-bitacora`); todo lo siguiente ocurre ahí.
- [ ] Paso 2: escribir `tests/smoke.test.ts` con `expect(1 + 1).toBe(2)` y `src/App.test.tsx` que renderiza `<App />` y espera el texto «Bitácora». Ejecutar y ver que falla (no existe `App`).
- [ ] Paso 3: crear el proyecto con las dependencias de la sección «Tecnologías» (versiones vigentes al ejecutar), `vitest.config.ts` con dos proyectos (`edge-runtime` con `server.deps.inline: ['convex-test']` para `tests/convex/**`; `jsdom` para `src/**`) y `<meta name="robots" content="noindex">` en `index.html`.
- [ ] Paso 4: añadir a `.gitignore`: `app/node_modules/`, `app/dist/`, `app/.convex/`, `.env*` con excepción `!.env.example`, `client_secret*.json`.
- [ ] Paso 5: `npm run test` y `npm run build` pasan. **Commit** `chore: scaffold app/`.

### Tarea A2: Esquema y límites

**Archivos:** `app/convex/schema.ts`, `app/convex/lib/limits.ts`, `app/convex/lib/types.ts`, `app/tests/convex/schema.test.ts`.
**Interfaces:** `type TaskStatus = 'todo' | 'doing' | 'review' | 'done'`, `type ActivityStatus = 'Completada' | 'En progreso' | 'Pendiente de revisión'` (en `types.ts`); `LIMITS` (objeto con los valores de «Restricciones globales»: `title: 200`, `description: 2000`, `subtasks: 20`, `subtaskText: 200`, `projectName: 100`, `journalField: 1500`, `photos: 4`, `links: 12`, `pendingInvites: 10`, `inviteDays: 7`, `nameMin: 2`, `nameMax: 60`, `photoBytes: 409600`, `eventsPage: 50`); tablas e índices de la sección 6 de la especificación (`members`, `invites`, `settings`, `profile`, `projects`, `tasks`, `journalEntries`, `events`) más las tablas de `authTables`; `tasks` con índice de búsqueda sobre `searchText`.

- [ ] Paso 1: prueba `schema accepts one document per table` (inserta un documento válido por tabla con `convexTest(schema)` y lo lee) y `LIMITS has the spec values` (compara cada valor con el de la lista de arriba). Debe fallar.
- [ ] Paso 2: escribir `limits.ts` y `schema.ts`. Índices mínimos: `members.by_userId`, `by_email`; `invites.by_hash`, `by_creator`; `projects.by_nameLower`; `tasks.by_status_order`, `by_assignee`, `by_due`, `search_text`; `journalEntries.by_date`, `by_task`, `by_legacyId`; `events.by_at`, `by_visibility_at`.
- [ ] Paso 3: la prueba pasa. **Commit** `feat(server): schema and limits`.

### Tarea A3: Librerías puras (horas, fechas, orden, tokens, texto)

**Archivos:** `app/convex/lib/{hours,dates,order,tokens,text}.ts`, `app/tests/convex/lib.test.ts`.
**Interfaces:** `parseHours(input: string): number | null` (válido ⇒ número; inválido ⇒ `null`); `bogotaDate(ms: number): string`; `isOverdue(due: string | undefined, status: TaskStatus, today: string): boolean`; `daysFromToday(today: string, days: number): string`; `monthRange(year: number, month: number): { from: string; to: string }`; `orderBetween(before: number | null, after: number | null): number`; `newToken(): string` (32 bytes aleatorios en base64url, 43 caracteres); `sha256Hex(text: string): Promise<string>`; `normalizeSearch(text: string): string` (minúsculas, sin tildes, espacios colapsados); `cleanText(text: string, max: number): string` (recorta y valida longitud).

- [ ] Paso 1: pruebas con estos valores exactos: `parseHours('0,25') === 0.25`, `parseHours('0.5') === 0.5`, `parseHours('24') === 24`, `parseHours('2') === 2`; `null` para `'0'`, `'0,2'`, `'24,25'`, `'abc'`, `''`, `'1,3'`. `bogotaDate(Date.UTC(2026, 9, 22, 4, 30)) === '2026-10-21'` y `bogotaDate(Date.UTC(2026, 9, 22, 5, 0)) === '2026-10-22'` (**punto 3**). `isOverdue('2026-10-20', 'doing', '2026-10-21') === true`; con `'done'` ⇒ `false`; sin fecha ⇒ `false`. `orderBetween(null, null) === 1`, `orderBetween(1, 2) === 1.5`, `orderBetween(null, 4) < 4`, `orderBetween(3, null) > 3`. `newToken()` tiene 43 caracteres base64url y dos llamadas difieren. `sha256Hex('abc')` es `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`. `normalizeSearch('  Análisis   JURÍDICO ') === 'analisis juridico'` (**punto 2**).
- [ ] Paso 2: ejecutar y ver fallar; implementar (`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` para la fecha; `crypto.subtle` para el hash). Pasan. **Commit** `feat(server): pure helpers`.

### Tarea A4: Identidad de la dueña y `getActor`

**Archivos:** `app/convex/auth.ts`, `app/convex/auth.config.ts`, `app/convex/http.ts`, `app/convex/lib/actors.ts`, `app/convex/session.ts` (solo `ensureOwner`), `app/tests/convex/actors.test.ts`.
**Interfaces:** `type Actor = { memberId: Id<'members'>; isOwner: boolean; name: string; roleLabel: string }`; `getActor(ctx): Promise<Actor | null>` (por la cuenta de Google); `requireMember(ctx)` y `requireOwner(ctx)` (lanzan `ConvexError({ code: 'UNAUTHENTICATED' | 'FORBIDDEN' })`); `requireViewer(ctx, shareToken: string): Promise<Doc<'settings'>>`; mutación pública `session.ensureOwner()` (idempotente: crea la fila de `members` con `isOwner`, `settings` y `profile` la primera vez que entra la cuenta cuyo correo coincide con `OWNER_EMAIL`).
**Notas:** el correo se toma de la tabla `users` de Convex Auth (el token de Convex no lo trae): `getAuthUserId` → `db.get(userId).email`. Solo se configura el proveedor Google, así que ese correo viene de Google. Verificar contra la documentación vigente de Convex Auth cómo se prueba con `t.withIdentity`.

- [ ] Paso 1: pruebas con `convex-test`: sin credenciales `getActor` ⇒ `null` y `requireMember` lanza `UNAUTHENTICATED`; con la cuenta de `OWNER_EMAIL` y `ensureOwner` se crean exactamente una fila de `members`, una de `settings` y una de `profile` (llamarla dos veces no duplica); otra cuenta de Google ⇒ `ensureOwner` lanza `FORBIDDEN` y `getActor` ⇒ `null` (sin registro en `members`); una cuenta vinculada a un registro vigente de `members` (por `userId`) ⇒ `Actor` con `isOwner: false`; **`OWNER_EMAIL` sin definir ⇒ nadie es dueña (falla cerrada)**; **`OWNER_EMAIL='jose@gmail.com'` y cuenta `Jose@Gmail.com` ⇒ sí es dueña** (**punto 4**); una persona retirada (`revokedAt`) no obtiene actor.
- [ ] Paso 2: ejecutar y ver fallar; implementar con toda la lectura de identidad dentro de `getActor` (para poder cambiar de proveedor sin tocar el resto). Pasan. **Commit** `feat(server): owner identity and actors`.

### Tarea A5: Cuentas de las personas invitadas (sin sesiones propias)

**Archivos:** `app/convex/members.ts` (solo `touch` aquí), modificar `app/convex/lib/actors.ts`; `app/tests/convex/accounts.test.ts`.
**Interfaces:** `members.touch()` (mutación; actualiza `lastSeenAt` como máximo una vez cada 24 h); `getActor` resuelve a las personas invitadas por `userId` (índice `members.by_userId`). No existe tabla `sessions` ni funciones `session.touch`/`session.logout`: la sesión es la de Convex Auth.

- [ ] Paso 1: pruebas: un usuario de `convex-test` (con `withIdentity` y su fila en `users`) vinculado a un `members` vigente obtiene `Actor` con `isOwner: false`; sin fila de `members` ⇒ `null`; con `revokedAt` ⇒ `null` **de inmediato** (sin esperar a que caduque nada); `touch` dos veces seguidas cambia `lastSeenAt` una sola vez; el esquema **no** tiene tabla `sessions`; ninguna respuesta de `members.*` ni de `profile.*` para personas invitadas contiene correos (`@`).
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(server): member accounts`.

### Tarea A6: Historial inmutable

**Archivos:** `app/convex/lib/events.ts`, `app/convex/events.ts`, `app/tests/convex/events.test.ts`.
**Interfaces:** `type EventType = 'task.created' | 'task.edited' | 'task.moved' | 'task.completed' | 'task.deleted' | 'project.created' | 'invite.created' | 'member.joined' | 'member.updated' | 'member.revoked' | 'share.changed' | 'journal.draft_created' | 'journal.documented' | 'journal.edited' | 'journal.deleted'`; `logEvent(ctx, actor: Actor, e: { type: EventType; subjectKind: string; subjectId?: string; subjectTitle?: string; detail?: Record<string, unknown> }): Promise<void>` (copia nombre y rol del momento; `visibility` = `'owner'` para `journal.*`, `'team'` para el resto); `type EventDto = { id: string; at: number; actorId: string; actorName: string; actorRole: string; type: EventType; subjectKind: string; subjectId?: string; subjectTitle?: string; detail?: Record<string, unknown> }`; `events.list({ shareToken?, cursor?, actorId? })` ⇒ `{ items: EventDto[]; nextCursor: string | null }` de 50 en 50.

- [ ] Paso 1: pruebas: `Object.keys(api.events)` es exactamente `['list']` (inmutabilidad: no hay edición ni borrado públicos); la persona invitada no recibe eventos `owner`; la dueña sí; el enlace de solo lectura recibe `owner` solo si `shareIncludesJournal`; paginación de 50; filtro por persona; los eventos conservan el nombre y rol de ese momento aunque la persona cambie después.
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(server): events`.

### Tarea A7: Invitaciones

**Archivos:** `app/convex/invites.ts`, `app/tests/convex/invites.test.ts`.
**Interfaces:** `invites.create() ⇒ { link: string }` (token en claro devuelto una sola vez, `<SITE_URL>/#/invitacion/<token>`); `invites.revoke({ inviteId })`; `invites.mine() ⇒ { id, expiresAt }[]`; `invites.redeem({ inviteToken, name, roleLabel }) ⇒ { memberId: Id<'members'> }` (**requiere sesión de Google**; vincula la cuenta de quien llama con un nuevo `members`).

- [ ] Paso 1: pruebas: solo se guarda el hash; el décimo y primero pendientes se crean y el undécimo lanza `LIMIT`; **dos `redeem` simultáneos del mismo token (`Promise.all`) ⇒ exactamente uno tiene éxito y el otro lanza `INVITE_USED`**; una invitación de 7 días y 1 ms vencida lanza `INVITE_EXPIRED`; revocada lanza `INVITE_REVOKED`; nombre y rol de 2 a 60 (1 o 61 caracteres ⇒ `VALIDATION`); **`redeem` sin sesión de Google lanza `UNAUTHENTICATED`**; con sesión crea la persona con `invitedBy`, su `userId` y su `email`, y el evento `member.joined`; la cuenta de la dueña o una que ya es miembro ⇒ `ALREADY_MEMBER`; dos `redeem` simultáneos desde **cuentas distintas** ⇒ exactamente uno tiene éxito; quien revoca debe ser el creador o la dueña; la persona invitada puede crear invitaciones; `invite.created` queda en el historial; **con `console.log` espiado, el token de invitación no aparece en ninguna salida** (especificación 8).
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(server): invites`.

### Tarea A8: Personas

**Archivos:** `app/convex/members.ts`, `app/tests/convex/members.test.ts`.
**Interfaces:** `members.list()` (solo dueña) ⇒ `{ id, name, roleLabel, email, invitedByName?, createdAt, lastSeenAt, revoked }[]` (el correo solo lo recibe la dueña); `members.revoke({ memberId })` (solo dueña); `members.updateSelf({ name, roleLabel })`.

- [ ] Paso 1: pruebas: una persona invitada no puede llamar `list` ni `revoke` (`FORBIDDEN`); `revoke` pone `revokedAt` (la persona deja de pasar `getActor` **al instante**) y revoca sus invitaciones **pendientes**, pero no a quienes entraron gracias a ella; la dueña no puede retirarse a sí misma; la persona retirada ya no pasa `requireMember`; `updateSelf` valida 2 a 60 y escribe `member.updated`; las tareas de una persona retirada conservan su responsable (regla 12).
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(server): members`.

### Tarea A9: Proyectos y tareas (crear, editar, consultar, borrar)

**Archivos:** `app/convex/projects.ts`, `app/convex/tasks.ts`, `app/convex/lib/validate.ts`, `app/convex/lib/audience.ts`, `app/tests/convex/tasks.test.ts`.
**Interfaces:** `type Audience = 'owner' | 'member' | 'viewer'`; `taskDto(task: Doc<'tasks'>, audience: Audience, opts: { showDescriptions: boolean }): TaskDto` (`TaskDto = { id, title, description?, projectId, projectName, projectColorSlot, assigneeId?, assigneeName?, assigneeRevoked?, dueDate?, priority, status, order, subtasks, completedAt? }`; `tasks.list` y `tasks.get` devuelven siempre `TaskDto`, nunca el documento crudo; la Tarea A12 le añade los campos derivados de la Bitácora); `projects.create({ name }) ⇒ Id<'projects'>` (crea o devuelve el existente por `nameLower`; `colorSlot` 1 a 6 en rotación); `projects.list`; `tasks.create({ title, projectName, description?, subtasks?, assigneeId?, dueDate?, priority?, status? }) ⇒ Id<'tasks'>`; `tasks.update({ id, patch })` (solo escribe los campos presentes en `patch`); `tasks.get`; `tasks.list({ projectId?, assigneeId?, priority?, q? })`; `tasks.remove({ id })` (solo dueña); `validateTaskInput(input): TaskInput` (lanza `ConvexError({ code: 'VALIDATION', message })`).
**Mensajes exactos:** «Escribe el nombre de la tarea.», «Elige o escribe un proyecto.», «Máximo 20 subtareas.».

- [ ] Paso 1: pruebas: con solo título y proyecto se crea con `priority: 2`, `status: 'todo'`, sin responsable y **arriba de su columna** (`order` menor que el de las existentes); **un título `'   '` lanza «Escribe el nombre de la tarea.»** y no crea nada (**punto 2**); título de 201 caracteres ⇒ `VALIDATION`; 21 subtareas ⇒ «Máximo 20 subtareas.»; las subtareas vacías se descartan; un proyecto nuevo se crea con la siguiente `colorSlot`; **`tasks.list({ q: 'analisis' })` encuentra «Análisis Jurídico revisión»** (se guarda `searchText = normalizeSearch(título + ' ' + descripción)` y se normaliza la consulta); dos `update` concurrentes de campos distintos (título y fecha) conservan ambos cambios; solo la dueña borra (la persona invitada ⇒ `FORBIDDEN`); la persona sin sesión ⇒ `UNAUTHENTICATED`; cada operación escribe su evento (`task.created`, `task.edited` con los campos cambiados y, para estado, responsable, fecha y prioridad, valor anterior y nuevo, `task.deleted`, `project.created`); el responsable debe ser una persona con acceso vigente.
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(server): projects and tasks`.

### Tarea A10: Mover tareas, completar y borrador único

**Archivos:** `app/convex/lib/journalDraft.ts`, modificar `app/convex/tasks.ts`, `app/tests/convex/draft.test.ts`.
**Interfaces:** `tasks.move({ id, status, beforeId? })` (calcula `order` en el servidor con `orderBetween`; fija `completedAt` al pasar a `done`); `ensureDraft(ctx, task: Doc<'tasks'>, actor: Actor): Promise<Id<'journalEntries'> | null>` (interna, se llama dentro de la misma mutación que cambia la tarea).

- [ ] Paso 1: pruebas de las reglas 1 a 6 de la especificación: completar una tarea **de la dueña** crea **un** borrador con `docStatus: 'draft'`, `hours` indefinido, `activity` = título, `objective` = descripción (si existe), proyecto, fecha de Bogotá, y los eventos `task.completed` (equipo) y `journal.draft_created` (dueña); completar una tarea de otra persona o sin responsable no crea nada; reabrir y volver a completar deja **un** registro y no pisa lo escrito; **dos `move` a `done` en `Promise.all` ⇒ un borrador**; reasignar a la dueña una tarea ya completada crea el borrador; **a las 23:30 de Bogotá (`Date.UTC(2026, 9, 22, 4, 30)`) el borrador lleva `date: '2026-10-21'`** (**punto 3**); borrar la tarea conserva el registro con `taskId` vacío y `taskTitleSnapshot`; borrar el registro no recrea el borrador; **`move` de una tarea borrada lanza `ConvexError({ code: 'TASK_NOT_FOUND' })`** (**punto 1**); `beforeId` inexistente se ignora y pone la tarjeta al final.
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(server): move, completion and single draft`.

### Tarea A11: Bitácora (registros) y archivos

**Archivos:** `app/convex/journal.ts`, `app/convex/files.ts`, `app/tests/convex/journal.test.ts`.
**Interfaces:** `journal.createManual`, `journal.update`, `journal.documentDraft({ id, fields })`, `journal.remove`, `journal.reorder({ date, orderedIds })`, `journal.list({ q?, projectId?, activityStatus?, onlyDrafts? })`, `journal.summary() ⇒ { activities: number; hours: number; completed: number; drafts: number }`, `files.generateUploadUrl()`. Todas solo para la dueña. Campos de la tabla «Campos del formulario» de la especificación (4.5), con sus límites.

- [ ] Paso 1: pruebas: la validación de horas usa `parseHours` y el mensaje exacto de «Restricciones globales»; resultado vacío al completar un borrador ⇒ el mismo mensaje; `createManual` nace `complete`; `documentDraft` pasa a `complete` y recién entonces `journal.summary().hours` suma; un borrador nunca suma horas; `activities` cuenta solo `complete`; 5 imágenes ⇒ error «Puedes adjuntar hasta 4 imágenes por registro.»; 13 enlaces ⇒ error; un enlace `javascript:` o `ftp:` se rechaza; el nombre de enlace vacío usa el dominio; `list` ordena por fecha descendente y, dentro del día, por `dayOrder` y luego `updatedAt`; `reorder` solo dentro del mismo día; **persona invitada ⇒ `FORBIDDEN` en todas**; eventos `journal.documented`, `journal.edited`, `journal.deleted` con visibilidad `owner`; `remove` borra también los archivos del registro.
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(server): journal and files`.

### Tarea A12: Audiencias, calendario, enlace de solo lectura y matriz de permisos

**Archivos:** `app/convex/lib/audience.ts`, `app/convex/calendar.ts`, `app/convex/settings.ts`, `app/convex/viewer.ts`, `app/tests/convex/permissions.test.ts`.
**Interfaces:** amplía `taskDto` (Tarea A9) con `opts.journal?: { hours?: number; isDraft: boolean }` y los campos opcionales `hours` y `draft` (se **omiten por completo**, sin la clave, para `member` y para `viewer` sin Bitácora; `description` se omite para `viewer` salvo `shareShowsDescriptions`); `calendar.month({ year, month })`; `settings.get` (dueña), `settings.setShare({ enabled?, includesJournal?, showsDescriptions? })`, `settings.regenerateShare() ⇒ { link: string }` (devuelve el enlace una vez; guarda el token; invalida el anterior); `viewer.board`, `viewer.calendar`, `viewer.journal`, `viewer.events`, `viewer.profile` (con `shareToken`).

- [ ] Paso 1: prueba `permission matrix` **parametrizada** con las filas de la tabla 3.1 de la especificación: para cada capacidad (ver tablero, ver descripción, crear/editar/mover/asignar, eliminar, ver historial, ver Bitácora, escribir en la Bitácora, crear invitaciones, ver quién invitó a quién, gestionar el enlace) y cada audiencia (dueña, persona invitada, enlace) comprueba permitido o `FORBIDDEN`/vacío. Además: el DTO de la persona invitada **no contiene** las claves `hours`, `draft`, `docStatus` ni eventos `owner`; el enlace por defecto no muestra descripciones y sí la Bitácora; desactivar o regenerar invalida el enlace anterior; `calendar.month` suma horas por día solo para dueña y enlace con Bitácora; las tareas sin fecha no aparecen; `viewer.*` con un token incorrecto devuelve error sin datos.
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(server): audiences, calendar, viewer link, permission matrix`.

### Tarea A13: Perfil

**Archivos:** `app/convex/profile.ts`, `app/tests/convex/profile.test.ts`.
**Interfaces:** `profile.get() ⇒ BadgeData` donde `BadgeData = { name: string; roleLabel: string; isOwner: boolean; since: number; program?: string; term?: string; institution?: string; group?: string; badgeDesign?: string; photoDataUrl?: string }` (para la dueña incluye los datos del perfil; para otras personas, solo `name`, `roleLabel`, `since`); `profile.update({ program?, term?, institution?, group?, badgeDesign?, photoDataUrl? })` (solo dueña; `photoDataUrl: null` la quita; `badgeDesign` debe ser uno de los ids de diseño vigentes); `viewer.profile({ shareToken })` devuelve los datos de la dueña.

- [ ] Paso 1: pruebas: longitudes 80/30/100/60 (un carácter más ⇒ `VALIDATION`); `photoDataUrl` debe empezar por `data:image/jpeg;base64,` y no pasar de 409 600 bytes decodificados; la persona invitada que llama `profile.update` ⇒ `FORBIDDEN`; **ningún DTO de perfil contiene el correo de la dueña** (`JSON.stringify(dto)` no incluye `@`); `viewer.profile` con token inválido ⇒ error.
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(server): profile`.

---

# Parte B — Cliente (React)

### Tarea B1: Variables de color, seis temas y preferencia de apariencia

**Archivos:** `app/src/styles/{tokens,base}.css`, `app/src/styles/themes/{grafito,papel,tinta}.css`, `app/src/appearance/appearance.ts`, `app/src/appearance/appearance.test.ts`, `app/src/styles/contrast.test.ts`.
**Interfaces:** `type Style = 'grafito' | 'papel' | 'tinta'`; `type Mode = 'dark' | 'light'`; `loadAppearance(): { style: Style; mode: Mode }` (lee `localStorage['bitacora.appearance']`; ausente o corrupto ⇒ `{ style: 'grafito', mode: 'dark' }`); `saveAppearance(a)`; `applyAppearance(root: HTMLElement, a)` (escribe `data-theme` y `data-mode` y actualiza `<meta name="theme-color">`).
**Notas:** portar de la maqueta las variables (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--p1…p6`, `--font-*` y las propias de cada estilo: Papel `--shadow-soft`, `--margin-line`, `--field-bg`; Tinta `--paper`, `--veil`, `--bar`, `--on-lime`, `--paper-warn`, `--tag-warn`, `--tag-violet`) con los valores de la sección 10 de la especificación; **ningún color escrito a mano fuera de las variables**.

- [ ] Paso 1: pruebas: el valor inicial es Grafito oscuro; se guarda y se vuelve a leer; JSON corrupto ⇒ valor inicial; `applyAppearance` fija `data-theme`, `data-mode` y `theme-color`; `contrast.test.ts` lee los CSS, extrae las variables de cada uno de los **seis** temas y exige relación de contraste **≥ 4,5** para `--ink` sobre `--bg` y `--surface`, `--muted` sobre `--surface`, y `--on-lime` (`#0e0e0e`) sobre `--lime` en Tinta viva; falla si falta cualquiera de los seis bloques. **Prueba de presupuesto de movimiento** (`src/styles/motion.test.ts`, criterio 26): lee todos los CSS y falla si hay un `backdrop-filter`, un `filter` sobre el contenedor del carné o sobre un `canvas`, una animación `infinite` cuyo nombre no esté en la lista permitida (`pulse`, `wiggle`), una transición de `width`, `height`, `top` o `left` en elementos repetidos, o `content-visibility` sobre `.entry`.
- [ ] Paso 2: implementar CSS y módulo; ajustar `--muted` o el acento que no alcance 4,5. **Commit** `feat(web): themes and appearance`.

### Tarea B2: Estructura de la aplicación (rutas, sesión, entradas, barra, avisos, paneles)

**Archivos:** `app/src/{App.tsx,router.ts,auth.ts,convexClient.ts}`, `app/src/shell/{Navbar,Gate,Toast,Panel,AppearanceMenu}.tsx`, pruebas junto a cada archivo.
**Interfaces:** `parseRoute(hash: string): { name: 'board'|'calendar'|'journal'|'history'|'invite'|'viewer'; token?: string }`; `useAudience(): 'owner' | 'member' | 'viewer'`; `useAuthState(): 'loading' | 'anonymous' | 'no-access' | 'active'` (sesión de Convex Auth + `getActor`) con `signIn()` y `signOut()`; `<Panel open onClose title>` (anillo de foco, `Esc` cierra, difumina el fondo, hoja completa en móvil); `useToast()`.
**Textos exactos:** los de las seis pantallas de entrada de la especificación 4.1 (inicio de sesión, invitación, invitación inválida, enlace inactivo, acceso retirado y sin conexión), en particular «Entrar con Google», «Para entrar necesitas una invitación.», «Esta invitación ya no es válida», «Este enlace ya no está activo», «Reintentar» y **«Tu acceso ya no está activo.»**. `Gate` es una sola pantalla con un `state: 'login' | 'invite' | 'inviteName' | 'noAccess' | 'invalidInvite' | 'invalidLink' | 'revoked' | 'offline'` (diseño de la maqueta: bloque «Pantallas de entrada» de `direccion-visual.js`).

- [ ] Paso 1: pruebas: `parseRoute('#/invitacion/abc')` ⇒ `{ name: 'invite', token: 'abc' }`, `#/ver/xyz` ⇒ `viewer`, hash vacío ⇒ `board`; `Navbar` oculta «Bitácora» para `member` y para `viewer` sin Bitácora, muestra «Invitar» solo a `owner` y `member`, y no muestra «Invitar» al `viewer`; `Gate` sin sesión muestra el botón «Entrar con Google» y la nota y ningún dato (la prueba recorre el árbol y falla si aparece un nombre, correo o institución); el formulario de invitación valida 2 a 60 caracteres con los mensajes exactos y no envía con un nombre o rol de 1 carácter; cada pantalla de error ofrece su acción («Ir al inicio» o «Reintentar»); con el foco en el primer control al abrir; `Panel` atrapa el foco y `Esc` lo cierra; **(punto 5) cuando una persona con sesión de Google deja de tener `Actor` (acceso retirado) con la aplicación abierta, aparece «Tu acceso ya no está activo.» y se llama a `signOut`**; una cuenta sin registro ⇒ «Tu cuenta no tiene acceso»; en la invitación el botón «Continuar con Google» precede al formulario (nombre precargado, rol vacío) y «Aceptar y entrar» llama a `invites.redeem`; sin conexión ⇒ mensaje con «Reintentar»; la barra móvil (≤ 640 px) usa dos filas. Ver fallar.
- [ ] Paso 2: implementar (indicador de pestaña deslizante de 500 ms como en la maqueta; avisos desde abajo). Pasan. **Commit** `feat(web): shell, routing, gates`.

### Tarea B3: Lista con scroll animado (`ScrollList`)

**Archivos:** `app/src/components/ScrollList/{ScrollList.tsx,useScrollList.ts,ScrollList.css,ScrollList.test.tsx}`.
**Interfaces:** `<ScrollList items renderItem={(item, i) => ReactNode} getKey snap?: boolean maxHeight?: string />`; el hook calcula el degradado de bordes (56 px, suavizado `smootherstep`) y lo escribe **en línea** como `mask-image` con píxeles —no con variables CSS—, solo cuando cambia (claves de 4 px), y marca cada hijo con `data-state="in" | "above" | "below"`. En cada cuadro **primero lee** (`scrollTop`, `clientHeight`, y `offsetTop`/`offsetHeight` de los hijos, guardados en caché y invalidados al redibujar) y **después escribe**, sin leer de nuevo.
**Notas:** porta el motor de la maqueta (`layoutSL`, `scheduleSL`, `refreshSL`) y la mecánica de **AnimatedList** de React Bits (barra nativa oculta con `scrollbar-width: none`, estados `opacity:0; translate 0 ±14px; scale .82`, resorte `linear()` con `cubic-bezier(.2,.9,.2,1)` de respaldo, propiedades CSS `translate` y `scale` para no chocar con transformaciones), flechas ↑ ↓ entre elementos y `scroll-snap-type: y proximity` solo si `snap`. **No** hay indicador de posición. No importar los iconos de `@hugeicons/*` del ejemplo original.

- [ ] Paso 1: pruebas: con 30 elementos y alto fijo, en reposo la máscara tiene degradado inferior y ninguno superior, y al llegar al final al revés; desplazar 1 px dentro de la misma clave de 4 px **no** reescribe `mask-image` (espía sobre `style`); con espías sobre las lecturas de diseño y las escrituras de estilo, en cada cuadro ninguna lectura ocurre después de una escritura; los hijos se leen una sola vez por cuadro; los elementos fuera de vista reciben `data-state="above"/"below"`; con `prefers-reduced-motion` todos quedan `in`; ↓ mueve el foco al siguiente; el CSS contiene `scrollbar-width: none` y no contiene ninguna regla de indicador. Ver fallar.
- [ ] Paso 2: implementar. Pasan. **Commit** `feat(web): animated scroll list`.

### Tarea B4: Componentes de React Bits y auditoría de la política de seguridad

**Archivos:** `app/src/reactbits/*` (copias de la variante TS + CSS de `CountUp`, `SpotlightCard`, `ShinyText`, `TiltedCard`, `Magnet`, `ClickSpark`, `ElectricBorder`, `PillNav`), `app/src/reactbits/LICENSE.md`, `app/scripts/audit-reactbits.mjs`, `app/src/reactbits/AUDIT.md`, `app/src/reactbits/audit.test.ts`.
**Interfaces:** `node scripts/audit-reactbits.mjs` imprime por componente si usa `eval`, `new Function`, `<style`, `createElement('style')`, `insertRule`, `adoptedStyleSheets`, `fetch(` o `XMLHttpRequest`, y sale con código 1 si alguno pasa a producción con una de ellas.

- [ ] Paso 1: prueba `audit.test.ts`: ejecuta el script y exige que ningún archivo de `src/reactbits/` contenga esos patrones; exige que exista `LICENSE.md` y que `AUDIT.md` liste cada componente con su veredicto. Ver fallar (no hay componentes).
- [ ] Paso 2: copiar cada componente de `https://github.com/DavidHDev/react-bits` (`src/ts-default/Components/<Nombre>/`) y la licencia; para cada uno que falle la auditoría, **sustituirlo por el CSS de la maqueta** y anotarlo en `AUDIT.md`. Quitar dependencias que no se usan. Anotar la versión de `motion` si `CountUp` la exige.
- [ ] Paso 3: la prueba pasa. **Commit** `feat(web): vendored react-bits components with CSP audit`.

### Tarea B5: Tablero (tarjetas, columnas, indicadores, filtros)

**Archivos:** `app/src/features/board/{Board,Column,TaskCard,Stats,Filters}.tsx`, `board.css`, `app/src/features/board/filters.ts`, pruebas.
**Interfaces:** `filterTasks(tasks: TaskDto[], f: { projectId?: string; assigneeId?: string; priority?: number; q?: string; onlyMine?: boolean }, me: string): TaskDto[]`; `splitCompleted(tasks, today, days = 30): { recent: TaskDto[]; older: TaskDto[] }`; `visibleCount(isMobile: boolean, expanded: boolean, total: number): number` (móvil: 5, o todas si `expanded`).

- [ ] Paso 1: pruebas: los indicadores *Activas* (no completadas) y *Vencen esta semana* (no completadas con fecha dentro de 7 días o ya vencidas) y, solo con Bitácora, *Horas registradas* y *Por documentar*; `filterTasks` combina proyecto, «Asignada a», prioridad, búsqueda y «Solo mías» (un filtro vacío significa todos); en Grafito el CSS de la tarjeta usa mezclas de color del 6 % (borde) y 7 % (luz) y ningún tinte de fondo; cuatro columnas con su total real; chips y búsqueda se aplican **antes** de contar y recortar; Completada muestra los últimos 30 días y «Mostrar anteriores»; en móvil 5 tarjetas con «Mostrar 8 más» / «Mostrar menos»; la tarjeta completada lleva ✓ (`aria-label="Completada"`), la barra de progreso «1/3» y el chip de horas solo si el DTO trae `hours`; **ninguna etiqueta de borrador ni horas para el DTO de persona invitada**; **(punto 2) una palabra de 300 letras sin espacios no desborda: `board.css` declara `overflow-wrap: anywhere` en el título de la tarjeta y la prueba lo comprueba**; columna vacía: «Suelta una tarjeta aquí» centrado; vista Compacta guarda su preferencia en `localStorage`; «Vencida 20 oct» solo si no está completada.
- [ ] Paso 2: implementar con `ScrollList` y los efectos por estilo (Grafito: `SpotlightCard`, color mínimo por columna con las mezclas 6 % y 7 %; Papel: inclinación; Tinta viva: sombra dura, `Magnet`, `ClickSpark`). Pasan. **Commit** `feat(web): board`.

### Tarea B6: Mover tarjetas (arrastre, menú, teclado)

**Archivos:** `app/src/features/board/{dnd.ts,MoveMenu.tsx,useMoveTask.ts}`, pruebas.
**Interfaces:** `computeDrop(columns: Record<TaskStatus, string[]>, activeId: string, overId: string | null): { status: TaskStatus; beforeId?: string } | null`; `useMoveTask(): (id: string, status: TaskStatus, beforeId?: string) => Promise<void>` (actualización optimista; si falla, revierte y avisa).
**Notas:** `@dnd-kit/core` con sensores de puntero, táctil (retardo corto) y teclado; autodesplazamiento de la columna al acercarse a su borde; anuncios en una región `aria-live` («Moviste «X» a «En curso».»).

- [ ] Paso 1: pruebas: `computeDrop` soltando sobre una tarjeta devuelve su columna y `beforeId`; sobre una columna vacía, el estado sin `beforeId`; fuera ⇒ `null`; el menú «Mover a…» llama a `move(id, 'review', undefined)`; el anuncio usa el texto exacto; **(punto 1) si `tasks.move` rechaza con `TASK_NOT_FOUND`, la tarjeta vuelve a su columna y se muestra «Esa tarea ya no existe.»**.
- [ ] Paso 2: implementar. Pasan. **Commit** `feat(web): move tasks`.

### Tarea B7: Panel de tarea y subtareas

**Archivos:** `app/src/features/tasks/{TaskPanel,SubtaskEditor,taskForm}.tsx|ts`, pruebas.
**Interfaces:** `diffTask(original: TaskDto, form: TaskForm): Partial<TaskInput>` (solo los campos cambiados); `validateTaskForm(form): { ok: true } | { ok: false; field: 'title' | 'project'; message: string }`; `<SubtaskEditor value onChange />` (3 filas de inicio con marcador «Tarea 1/2/3…», máximo 20, las filas vacías se ignoran, «×» renumera los marcadores).
**Textos:** los de la tabla del formulario de tarea (especificación 4.2), incluido «Evita datos personales de terceros.».

- [ ] Paso 1: pruebas: sin nombre ⇒ «Escribe el nombre de la tarea.»; sin proyecto ⇒ «Elige o escribe un proyecto.»; `diffTask` devuelve solo `{ dueDate }` cuando solo cambió la fecha; el estado inicial es el de la columna desde donde se abrió; al llegar a 20 filas «＋ Añadir otra» avisa «Máximo 20 subtareas.»; «Eliminar tarea» solo existe para la dueña y pide confirmación; el panel del enlace de solo lectura no tiene controles de edición y muestra la descripción solo si el DTO la trae; el historial de esa tarea se lista.
- [ ] Paso 2: implementar. Pasan. **Commit** `feat(web): task panel and subtasks`.

### Tarea B8: Calendario

**Archivos:** `app/src/features/calendar/{Calendar,DayCell,Upcoming,month.ts}.tsx|ts`, pruebas.
**Interfaces:** `buildMonthGrid(year: number, month: number): (string | null)[]` (empieza en lunes; rellena con `null`); `upcoming(tasks, today, n = 6): TaskDto[]` (no completadas, incluye vencidas, ordenadas por fecha).

- [ ] Paso 1: pruebas: `buildMonthGrid(2026, 9)` (octubre de 2026) tiene **35** celdas, tres `null` al inicio (el 1 es jueves) y `'2026-10-31'` en el índice 33; cada día muestra hasta 2 tareas y «+n más»; la insignia de horas solo aparece si el DTO trae `hours`; las tareas sin fecha no aparecen; `upcoming` devuelve como máximo 6, con las vencidas primero; en móvil se muestra un punto por tarea y la lista del día seleccionado; tocar un día vacío (con permiso de edición) abre «Nueva tarea» con esa fecha.
- [ ] Paso 2: implementar (hoy: aro rojo en Papel, borde luminoso en Grafito, relleno limón en Tinta viva). Pasan. **Commit** `feat(web): calendar`.

### Tarea B9: Vista Bitácora (resumen, filtros y línea de tiempo)

**Archivos:** `app/src/features/journal/{Journal,EntryCard,Timeline,JournalTools}.tsx`, `journal.css`, pruebas.
**Interfaces:** `<Journal />` renderiza dos columnas en escritorio ≥ 1101 px (contenido + ranura `<aside id="journal-badge">` de 340 px, pegajosa, que ocupa la Tarea B13) y una en menos ancho.

- [ ] Paso 1: pruebas: el resumen muestra *Actividades*, *Horas registradas*, *Completadas* y *Por documentar* con los valores de `journal.summary`; filtros por búsqueda, área, estado y «Solo borradores»; contador «N registros»; estados vacíos «Todavía no hay actividades» y «No hay resultados»; la tarjeta muestra la vista previa del Resultado y «Ver detalle» despliega Objetivo, Desarrollo, Resultado, Observaciones (solo los que tienen texto), evidencias y «Última actualización»; el borrador muestra «— horas», «Completa los detalles de esta tarea» y «Completar detalles»; la línea de tiempo usa `ScrollList` sin `snap`; en móvil no hay scroll interno; para la persona invitada la ruta de la Bitácora no existe.
- [ ] Paso 2: implementar. Pasan. **Commit** `feat(web): journal view`.

### Tarea B10: Panel de registro, imágenes y copia de seguridad

**Archivos:** `app/src/features/journal/{EntryPanel.tsx,entryForm.ts,images.ts,backup.ts}`, pruebas.
**Interfaces:** `validateEntryForm(form): { ok: true; hours: number } | { ok: false; field: string; message: string }`; `fitWithin(w: number, h: number, max: number): { w: number; h: number }`; `compressImage(file: File): Promise<{ full: Blob; thumb: Blob }>` (lado mayor 1400 y miniatura 480, JPEG, `full` ≤ 1,2 MB); `exportBackup(entries): string` (formato `bitacora-iterativa`, versión 2); `parseBackup(json: string): { entries: LegacyOrV2Entry[] }` (acepta versión 1 y 2).
**Textos y campos:** exactamente los de la tabla «Campos del formulario» (especificación 4.5), con sus avisos («Actividad agregada a tu bitácora.», «Cambios guardados.», «Registro eliminado.», «Orden del día guardado.») y mensajes de imágenes y enlaces.

- [ ] Paso 1: pruebas: hora `'1,5'` ⇒ 1,5; `'25'` y `'0,1'` ⇒ el mensaje exacto; resultado vacío ⇒ error; valores iniciales (fecha de hoy, horas `2`, estado «Completada»); `fitWithin(4000, 3000, 1400)` ⇒ `{ w: 1400, h: 1050 }`; el enlace sin nombre usa el dominio y uno escrito pero no añadido se añade al guardar; un archivo que no es imagen ⇒ «Se omitió un archivo que no es una imagen.»; **una imagen que el navegador no puede decodificar (por ejemplo HEIC) ⇒ «No se pudo leer esa imagen. Prueba con un JPG o un PNG.» sin romper el formulario**; `parseBackup` acepta `{"format":"bitacora-iterativa","version":1}` y rechaza otro formato con «El archivo no es una copia válida de la bitácora.»; «Completar detalles» precarga actividad, proyecto, fecha y objetivo y deja las horas vacías; eliminar pide confirmación («¿Eliminar esta actividad?»).
- [ ] Paso 2: implementar (panel lateral con botones fijos abajo). Pasan. **Commit** `feat(web): entry panel, images and backup`.

### Tarea B11: Historial

**Archivos:** `app/src/features/history/{History,eventLine.ts}.tsx|ts`, pruebas.
**Interfaces:** `dayLabel(at: number, now: number): string` (`'Hoy · 09:42'`, `'Ayer · 17:30'`, `'19 oct · 16:20'`, en hora de Bogotá); `eventLine(e: EventDto, meId: string | null): { who: string; text: string }` (segunda persona para los eventos propios: «Tú moviste…», «Tú completaste…»; siempre el nombre en el enlace de solo lectura).

- [ ] Paso 1: pruebas de las tres etiquetas con horas fijas (incluida una a las 23:30 de Bogotá); `eventLine` para cada tipo de evento de la especificación 4.6; «Cargar más» pide 50 más; filtro por persona; no existe ninguna acción de editar o borrar.
- [ ] Paso 2: implementar. Pasan. **Commit** `feat(web): history`.

### Tarea B12: Panel «Acceso»

**Archivos:** `app/src/features/access/{AccessPanel,ShareLink}.tsx`, pruebas.

- [ ] Paso 1: pruebas: «Invitar a alguien» genera el enlace y lo muestra **una sola vez** con «Copiar»; lista las invitaciones pendientes con caducidad y «Revocar»; la persona invitada solo ve «Invitar a alguien», sus invitaciones y «Cerrar sesión»; la dueña ve la lista de personas (nombre, rol, **correo**, quién la invitó, ingreso, última actividad) con «Retirar acceso» (con confirmación) y la sección «Enlace de solo lectura» (activar, copiar, regenerar con aviso de que el anterior deja de funcionar, y las casillas «Incluir la Bitácora» —activa— y «Mostrar descripciones de las tareas» —inactiva—).
- [ ] Paso 2: implementar. Pasan. **Commit** `feat(web): access panel`.

### Tarea B13: Perfil y carné 3D

**Archivos:** `app/src/features/profile/{ProfilePanel,ProfileForm,PhotoCropper,IdBadge,BadgeColumn,DesignGallery}.tsx`, `app/src/features/profile/{badgeFaces,badgeDesigns,photo,badgeSupport}.ts`, `app/src/reactbits/Lanyard/{Lanyard.tsx,Lanyard.css}`, `app/src/assets/athenia-mark.png` (copiar de `docs/superpowers/specs/assets/2026-10-21-mockup/athenia-mark.png`), `app/scripts/make-logo-mask.mjs`, pruebas.
**Interfaces:**
- `type BadgeDesignId = 'olimpo' | 'circuito' | 'poster' | 'suizo' | 'clasico'`; `DESIGNS: Record<BadgeDesignId, { label: string; note: string; finish: 'glossy' | 'matte' | 'holographic'; cardColor?: string; draw(env: DrawEnv, front: Ctx2D, back: Ctx2D, strap: Ctx2D): Promise<{ live?: LiveFn } | void> }>` con `type LiveFn = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => void` en `badgeDesigns.ts` (portar de la maqueta, bloque «Diseños del carné»; **los cinco quedan seleccionables**, Olimpo por defecto);
- `drawBadgeFaces(input: { design: BadgeDesignId; data: BadgeData; palette: { bg: string; ink: string; muted: string; accent: string; line: string; fontMono: string; dark: boolean }; photo?: CanvasImageSource | null; logoMask?: CanvasImageSource | null }, makeCanvas?: () => HTMLCanvasElement): Promise<{ front: string; back: string; strap: string; cardColor: string; finish: string; live?: LiveFn }>` (URL `data:image/png`; la cara frontal, la trasera y la cinta de la sección 4.8);
- `<DesignGallery current onPick />` (galería «Ver diseños»: frente y reverso de cada diseño y «Usar este diseño»; guarda `profile.badgeDesign`);
- `nameLines(name: string): [string, string]` (mitad y mitad por palabras: 4 palabras ⇒ 2 + 2; 3 ⇒ 2 + 1; 1 ⇒ `[palabra, '']`); `initialsOf(name: string): string` («Jose Frangel Padilla Camacho» ⇒ `JP`);
- `shouldUse3D(env: { webgl: boolean; reducedMotion: boolean; scriptLoaded: boolean }): boolean` (verdadero solo si las tres condiciones favorables);
- `cropToJpeg(img: CanvasImageSource, t: { scale: number; ox: number; oy: number }, opts?: { size?: number; enhance?: boolean }): string` (1024 × 1024 por defecto, calidad 0,92 → 0,86 → 0,8 → 0,72 → 0,62 hasta ≤ 400 KB); `enhanceImageData(img: ImageData, fine: Uint8ClampedArray, wide: Uint8ClampedArray, edge: number): void` (función pura: `v + clamp((v − fino) · 0,35 + (v − ancho) · 0,08, −18, 18)`, saturado a 0–255, sin tocar los `edge` píxeles del borde) y `enhanceCanvas(c: HTMLCanvasElement): void` (obtiene los dos desenfoques con `ctx.filter = 'blur(…)'` proporcionales al ancho);
- `<IdBadge data={BadgeData} />` carga `Lanyard` con `React.lazy`/`import()` (el 3D no entra en el paquete principal), la desmonta al salir y cae a la imagen plana si `!shouldUse3D`;
- `<BadgeColumn />` (columna de la Bitácora, ≥ 1101 px, `position: sticky`) y `<ProfilePanel />` (abierto desde el avatar; cuelga desde el borde superior del panel, con título y × encima; botones «Editar perfil» y «Cerrar sesión»; el formulario sustituye a la vista).
- `make-logo-mask.mjs`: regenera la máscara del logotipo desde el PNG original con `alfa = clamp((0,88 − luminancia) / 0,5, 0, 1) × alfa original`, recorta a la caja y guarda `athenia-mark.png` (551 × 413).

- [ ] Paso 1: pruebas: `nameLines('Jose Frangel Padilla Camacho')` ⇒ `['Jose Frangel', 'Padilla Camacho']`; `nameLines('Ana María Gómez')` ⇒ `['Ana María', 'Gómez']`; `initialsOf` ⇒ `'JP'`; `shouldUse3D` con las ocho combinaciones; `drawBadgeFaces` con un lienzo falso registra el texto de nombre, rol, programa e institución, dibuja el logotipo solo si `data.group` contiene «AthenIA» (sin distinguir mayúsculas) y **nunca** recibe ni dibuja teléfono ni correo (el tipo `BadgeData` no tiene esos campos); `cropToJpeg` no pasa de 400 KB y devuelve 1024 px; `enhanceImageData` con un borde suave (rampa 0 → 255) aumenta el contraste local en la transición, no cambia una imagen plana, deja intactos los `edge` píxeles del borde y nunca sale de 0–255; la casilla tiene como único texto «Mejorar imagen», está activa por defecto, **se desmarca al pulsarla (en la casilla o en el texto)**, recuerda su valor al reabrir el formulario y, desactivada, `cropToJpeg` no llama a `enhanceCanvas`; `enhanceImageData` acota el cambio a ±18 niveles por canal; el formulario valida «Escribe tu nombre (2 a 60 caracteres).», «Escribe tu rol (2 a 60 caracteres).», «Se omitió un archivo que no es una imagen.», «<nombre> supera el límite de 5 MB.» y «No se pudo leer esa imagen. Prueba con un JPG o un PNG.»; solo la dueña ve foto, semestre, programa, institución y grupo; el `PhotoCropper` mueve con flechas (8 px), limita el encuadre al cuadrado, y «Acercar» va de 1 a 3; guardar muestra «Perfil actualizado.»; **al abrir `ProfilePanel` se desmonta el carné de la columna y al cerrarlo vuelve (nunca dos 3D a la vez)**; con `matchMedia('(min-width: 1101px)')` falso no existe `BadgeColumn`.
- [ ] Paso 2: prueba de empaquetado `build.test.ts`: tras `npm run build`, el paquete principal de `dist/assets` **no** contiene `WebGLRenderer` y existe otro archivo que sí; el total comprimido del trozo del 3D es ≤ 220 KB.
- [ ] Paso 3: portar a TypeScript el dibujo del carné, los diseños, la galería, el encuadre y el montaje de la maqueta (`direccion-visual.js`, bloques «Perfil y carné» y «Diseños del carné»); copiar `Lanyard.tsx` y `Lanyard.css` de React Bits (variante TS) y verificar que no use `eval`, estilos inyectados ni `fetch` (la auditoría de la Tarea B4 los incluye). **Parchear la copia del componente** y anotarlo en `AUDIT.md` (cinco cambios): (a) `FACE_WIDTH = 2048`; (b) resolución adaptativa en `resize`: `renderer.setPixelRatio(Math.min(3, Math.max(1, Math.min(Math.max(2, devicePixelRatio || 1), Math.sqrt(2.4e6 / (ancho * alto))))))` (el original usa `Math.min(dpr, 2)` y se veía borroso a 1×); (c) propiedad `fx?: { size: [number, number]; dot?: [number, number, number]; dotColor?: string }`: uniformes `fxTime`, `fxOn`, `fxSize`, `fxDot`, `fxDotColor` en el material del frente (se añaden tras `injectFoil`, sustituyendo `uniform float foilStrength;` por la misma línea más los uniformes y anteponiendo el bloque GLSL a `#include <opaque_fragment>`) que suman a `outgoingLight` un halo `fxDotColor * (núcleo + halo)` con `halo` dependiente de `sin(fxTime * 3.2)`; los uniformes se actualizan en cada `tick` desde `settingsRef.current.fx` (colores con `THREE.Color`, en caché) y `resting` es falso mientras haya `fx`; (d) propiedad `bounds` (por defecto activa): tras cada paso de la simulación se limita la posición horizontal de los nodos de la cuerda y del carné al ancho visible del lienzo (menos el semiancho del carné), para que **nunca se corte** al arrastrarlo a los lados, también en solo lectura; (e) en `tick`, si no hay puntero encima, arrastre ni presión durante 2,5 s (`activeUntil`), se omiten los cuadros que lleguen a menos de 32 ms del anterior (≈ 30 cuadros por segundo). **No** se repinta ni se sube la textura 2D por cuadro. Las caras se regeneran al cambiar de estilo, de tema o de diseño. Propiedades del componente: `finish` del diseño, `metal: 'silver'`, `size: 0.66`, `strapLength: 0.5`, `breeze: 0.3`; en el panel `anchor: 'center'` y `strapWidth: 0.7`; en la Bitácora `anchor: 'right'` y `strapWidth: 0.5`.
- [ ] Paso 3b (carné de la Bitácora): `BadgeColumn` publica en el nodo de la aplicación `--nav-h` (alto de la barra), `--stage-left`, `--stage-w` y `--hit-left`. El **lienzo ocupa desde el borde izquierdo de la aplicación** (`left: var(--stage-left)`, `width: var(--stage-w)` = `(xCinta − bordeIzquierdo) / 0,73`, para que el anclaje derecho caiga en `xCinta`) para que el carné no se corte al arrastrarlo; `pointer-events: none` en el lienzo; una zona `badge-hit` de 380 px bajo la barra (`top: calc(var(--nav-h) + 10px)`) reenvía `pointerdown/move/up/cancel` al lienzo con `canvas.dispatchEvent(new PointerEvent(e.type, e))`; la barra abre un hueco de 34 px entre «Invitar» y «Apariencia» (clase `journal-wide` en la aplicación) y `xCinta` es el centro de ese hueco; cuando «Apariencia» está abierta la barra sube a `z-index: 7` (por encima del carné); `filter: drop-shadow` suave sobre el lienzo; `.stage` con `z-index: auto` en la Bitácora. Fuera de la Bitácora o con menos de 1101 px no se monta.
- [ ] Paso 3c: pruebas adicionales: la prueba de empaquetado exige que `Lanyard.tsx` contenga `bounds` y que el lienzo de la columna de la Bitácora se extienda de borde a borde de la aplicación; la caché de caras se invalida cuando cambia `updatedAt` del perfil (misma combinación de diseño/tema ⇒ misma imagen; distinto `updatedAt` ⇒ imagen nueva); el diseño Circuito devuelve `{ fx: { size: [1024, 1440], dot, dotColor } }` con el punto dentro del lienzo y **no** devuelve ninguna función de dibujo por cuadro (no hay escaneo); los demás diseños no devuelven `fx`; con `prefers-reduced-motion` no se pasa `fx` al componente; el tipo `Settings` del componente parchado acepta `fx`; el contenedor de la columna no tiene ancestros con `overflow: hidden|auto` (prueba de estilos) y su `position` es `sticky`; para los diseños Olimpo y Clásico el contraste del texto sobre el acento es ≥ 4,5 en los seis temas; `DESIGNS` contiene exactamente los ids de la dueña y cada `draw` termina sin lanzar con una foto y sin foto y con y sin logotipo (lienzo falso); ningún diseño dibuja el texto «Bitácora» ni el año en el frente cuando el grupo es AthenIA; `DesignGallery` marca el diseño actual y `onPick` recibe el id; el contenedor del carné de la Bitácora no recibe clics (`pointer-events: none`) salvo la zona `badge-hit`; el tamaño del lienzo del carné es mayor que el de la columna (no se corta).
- [ ] Paso 4: las pruebas pasan. **Commit** `feat(web): profile and 3D badge`.

### Tarea B14: Vista de solo lectura

**Archivos:** `app/src/viewer/{ViewerApp,ViewerGate}.tsx`, pruebas.

- [ ] Paso 1: pruebas: `#/ver/<token>` con un token inválido muestra «Este enlace ya no está activo»; **con el enlace por defecto la vista tiene las cuatro pestañas (Tablero, Calendario, Bitácora e Historial)**, con las horas y los borradores de la Bitácora y el **carné de la dueña** (columna de la Bitácora ≥ 1101 px y panel «Perfil»); **ninguno** de estos controles existe en el árbol: «Invitar», «＋ Nueva tarea», «＋» de columna, flechas de mover, «Mover a…», «Registrar actividad», ✎, «Completar detalles», «Descargar copia», «Restaurar copia», «Editar perfil» y «Cerrar sesión»; las tarjetas no son arrastrables (`draggable` falso y teclado sin «Espacio» para tomarlas); los campos del detalle de una tarea están deshabilitados y no hay botones de guardar ni eliminar; la barra muestra «Solo lectura» en lugar del nombre y el rol; la pestaña Bitácora existe solo si el servidor la incluye; las descripciones solo aparecen si el DTO las trae; «Apariencia» funciona (es local del navegador); ninguna mutación del servidor se llama desde esta vista (espía sobre el cliente de Convex); **«Ver diseños» sí existe** y elegir un diseño guarda `bitacora.viewerBadgeDesign` en `localStorage` (dentro de `try/catch`), se conserva al recargar y **no** llama a ninguna mutación (`profile.update` ni otra); el diseño elegido nunca se envía al servidor; cuando `viewer.profile` devuelve otro `updatedAt` (la dueña cambió nombre, rol o foto) se invalida la caché de caras y el carné se redibuja con los datos nuevos y el mismo diseño elegido; el carné se puede arrastrar y lanzar.
- [ ] Paso 2: implementar reutilizando los componentes con `readOnly`. Pasan. **Commit** `feat(web): read-only viewer`.

---

# Parte C — Entrega

### Tarea C1: Seguridad, tipografías y presupuesto de paquetes

**Archivos:** `app/netlify.toml`, `app/scripts/check-build.mjs`, `app/src/styles/fonts.css`, `app/tests/build/check-build.test.ts`.

- [ ] Paso 1: prueba que ejecuta `npm run build` y `check-build.mjs`: no hay `<script>` ni `<style>` en línea en `dist/index.html`; ninguna petición a otro dominio salvo `*.convex.cloud` (busca `https://` en `dist/**/*.js|css|html` y exige que las únicas coincidencias sean esas); `netlify.toml` contiene exactamente la política de «Restricciones globales», `X-Robots-Tag: noindex`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`; las tipografías son `@fontsource` (Inter, Instrument Serif, JetBrains Mono, Space Grotesk) y no hay `fonts.googleapis.com`; **ningún archivo versionado de `app/` contiene `GOCSPX-`, `client_secret` ni claves privadas** (criterio 17); el paquete principal ≤ 250 KB comprimido (sin el 3D).
- [ ] Paso 2: implementar y comprobar. **Commit** `feat(web): security headers and build checks`.

### Tarea C2: Humo de extremo a extremo (Playwright)

**Archivos:** `app/e2e/{invite-flow,viewer-flow,mobile}.spec.ts`, `app/convex/testing.ts`, `app/playwright.config.ts`.
**Interfaces:** funciones **internas** (solo invocables con la clave de despliegue desde la CLI, nunca desde el navegador) en `testing.ts`: `internal.testing.seed()` crea la dueña, un proyecto y tareas, y devuelve un token de invitación y uno de solo lectura; solo se ejecutan si `process.env.E2E_ENABLED === '1'` en el despliegue de desarrollo.

- [ ] Paso 1: escenarios: (a) canjear la invitación (nombre y rol) ⇒ entra, crea una tarea con solo nombre y proyecto, la mueve por menú y por teclado, **no ve** la pestaña Bitácora, y el mismo enlace no sirve dos veces; (b) abrir el enlace de solo lectura ⇒ sin controles de edición; (c) a 375 px no hay desborde horizontal y cada columna muestra 5 tarjetas con «Mostrar más»; (d) cambiar entre los seis temas actualiza `data-theme` y `data-mode` y persiste al recargar; (e) abrir «Mi perfil» muestra el carné y «Editar perfil» cambia el nombre; (f) **humo de rendimiento** (criterio 26): con 30 tarjetas en una columna, desplazarla de arriba abajo y de vuelta durante 3 s midiendo los intervalos de `requestAnimationFrame` (y las `long-animation-frame` si el navegador las ofrece), y repetirlo en la Bitácora con el carné 3D en reposo; falla si más del 5 % de los cuadros superan 50 ms. Se marca `@perf` y puede ejecutarse aparte.
- [ ] Paso 2: ejecutar `npx playwright test` contra un despliegue de desarrollo. Pasan. **Commit** `test(e2e): invite, viewer and mobile smoke`.

### Tarea C3: Migración desde la hoja de Google

**Archivos:** `app/convex/legacyImport.ts`, `app/scripts/migrate-legacy.ts`, `app/tests/convex/legacyImport.test.ts`, `app/tests/fixtures/legacy-entries.json`.
**Interfaces:** `mapLegacyEntry(e: LegacyEntry): JournalInsert` (`nextStep` → `development`, `blocker` → `observations`, `order` → `dayOrder`, `status` → `activityStatus`, `id` → `legacyId`, `docStatus: 'complete'`); mutación interna `legacyImport.upsertBatch({ entries })` (idempotente por `legacyId`, protegida con la clave de despliegue); el script lee el punto de lectura JSONP actual (`requestRemoteEntries` en `/app.js`), importa, copia las imágenes de Drive al almacenamiento de Convex con su miniatura (con `sharp`, solo en el script; si una no se puede copiar conserva su `url` y se informa) y **imprime un informe**: número de registros, horas totales, fechas y proyectos, comparado con el origen.
**Forma del registro antiguo:** `{ id, date, hours, project, activity, objective, nextStep, result, blocker, status, order, links: {label,url}[], photos: {url,name}[], createdAt, updatedAt }`.

- [ ] Paso 1: pruebas con el archivo de ejemplo (3 registros, uno con proyecto de más de 60 caracteres y otro sin objetivo): el mapeo cambia exactamente los nombres de campo indicados; importar dos veces deja el mismo número de filas (idempotente); los proyectos se normalizan en `projects`; las horas totales importadas coinciden con las del archivo; un registro sin `id` se rechaza y se informa.
- [ ] Paso 2: implementar; **no ejecutar la migración real hasta el corte (C4)**. Referencia del sitio publicado el 21 de octubre de 2026: **6 registros, 17,5 horas, 6 completadas** (volver a leerlas ese día). **Commit** `feat(server): legacy import`.

### Tarea C4: Lista de corte y guía de la dueña

**Archivos:** `app/CUTOVER.md`.

- [ ] Paso 1: escribir la guía paso a paso, con capturas de lo que verá la dueña: crear el proyecto de Convex (desarrollo y producción) y autorizar; crear el cliente OAuth en Google Cloud con la URI de redirección `https://<despliegue>.convex.site/api/auth/callback/google`; cargar `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OWNER_EMAIL`, `SITE_URL` en Convex y `CONVEX_DEPLOY_KEY` en Netlify; patrón de compilación `npx convex deploy --cmd 'npm run build'` (verificar contra la documentación vigente); apuntar Netlify a `app/` y reemplazar la política de seguridad; ejecutar la migración y revisar el informe; recorrer los criterios de aceptación 1 a 25 de la especificación; deshabilitar el despliegue de Apps Script y, al final, retirar el acceso público de la carpeta de Drive. **Recordar:** el archivo `client_secret_*.json` de Descargas se queda fuera del repositorio.
- [ ] Paso 2: **Commit** `docs: cutover guide`.

---

## Autorrevisión del plan

- **Cobertura de la especificación:** secciones 3 (A4–A8, A12, B2, B12, B14), 4.1 (B1, B2), 4.2 (B5–B7), 4.3 (B7), 4.4 (B8), 4.5 (A11, B9, B10), 4.6 (A6, B11), 4.7 (B12), 4.8 (A13, B13), 5 (A9, A10), 6 (A2), 7 (A4–A13), 8 (A12, A13, C1), 9 (A1, B4, C1), 10 (B1), 11 (C3), 12 (C4), 13 (C2 y las pruebas de cada tarea).
- **Coherencia de nombres:** `Actor`, `getActor`, `requireMember/Owner/Viewer`, `logEvent`, `ensureDraft`, `parseHours`, `bogotaDate`, `TaskDto`, `BadgeData` se definen en la tarea que los produce y se usan con la misma firma en las posteriores.
- **Punto a confirmar al ejecutar:** cómo se simula la identidad de Google en `convex-test` (A4) y la política de `connect-src` real de Convex (C1); ambos se verifican contra la documentación vigente antes de dar la tarea por cerrada.
