# Espacios y múltiples Bitácoras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada cuenta un perfil con varias Bitácoras independientes y permitir alternar entre las propias y las compartidas sin perder ni ampliar accidentalmente los accesos actuales.

**Architecture:** Convex separa la identidad global de las membresías y de los datos por espacio. El espacio actual se convierte en el espacio inicial conservando IDs y tokens; las API mantienen temporalmente una ruta de compatibilidad al espacio inicial mientras una migración idempotente asocia los documentos existentes. La interfaz usa un selector compacto dentro de la barra de navegación existente y rutas explícitas por espacio.

**Tech Stack:** React, TypeScript, Convex, Vitest, Testing Library, Vite y CSS por temas existente.

**Spec:** `docs/superpowers/specs/2026-10-23-multiple-bitacoras.md`

## Global Constraints

- Una cuenta conserva un perfil personal y puede pertenecer a varias Bitácoras.
- Cada Bitácora contiene sus propios proyectos, tareas, calendario, historial, registros, ajustes e invitaciones.
- Las invitaciones y enlaces de lectura quedan limitados a un espacio.
- El enlace actual y todos sus datos deben conservar IDs y tokens; no invalidar lectores ni borrar información.
- El enlace `#/ver/<token>` conserva exactamente el valor de `settings.shareToken` y sus opciones al asociar `settings` con el espacio inicial.
- La invitación `#/invitacion/<token>` conserva la fila y `tokenHash`, `createdBy`, caducidad, canje y revocación; si sigue pendiente y vigente, el canje crea membresía solo en el espacio inicial. No registrar tokens en claro ni reactivar invitaciones vencidas/usadas/revocadas.
- El perfil individual y su enlace continúan separados de los espacios y de la Bitácora.
- Mantener la barra, pestañas, temas, controles, tipografía y comportamiento responsive del producto; no crear landing ni navegación lateral nueva.
- Validar los tres estilos existentes (`grafito`, `papel`, `tinta`) en modo claro y oscuro. No introducir colores fijos que rompan contraste ni asumir que todos usan el mismo radio o tratamiento visual.
- La apariencia sigue siendo una preferencia local del navegador (predeterminado grafito claro), no un ajuste por Bitácora; cambiar de espacio no debe modificarla.
- Las API validan la membresía/rol del espacio en el servidor; nunca confiar en un `workspaceId` enviado por el cliente.
- Implementar y probar localmente. No ejecutar migraciones ni despliegues de producción en este plan sin autorización explícita posterior.

## Review Focus

- Documento histórico sin `workspaceId`: la migración y la lectura de compatibilidad deben conservarlo y asociarlo una sola vez al espacio inicial.
- Token público o de invitación existente: debe seguir resolviendo el espacio inicial exacto y no revelar otros espacios.
- Usuario miembro de dos espacios: cambiar un ID o reutilizar una suscripción no debe filtrar tareas, fotos, horas, eventos ni perfiles de otro espacio.
- Miembro revocado en un espacio pero activo en otro: el cambio debe retirar solo la primera membresía y dejar intacta la segunda.
- Tarea completada o movida con miembros concurrentes: debe crear un solo borrador dentro del espacio de la tarea y ningún vínculo cruzado.

---

### Task 1: Modelo de espacios y permisos

**Files:**
- Modify: `app/convex/schema.ts`
- Create: `app/convex/workspaces.ts`
- Create: `app/convex/lib/workspaces.ts`
- Modify: `app/convex/lib/actors.ts`
- Test: `app/tests/convex/workspaces.test.ts`
- Test: `app/tests/convex/schema.test.ts`

**Interfaces:**
- `workspaces.listMine({})` devuelve espacios activos de la cuenta con `{ id, name, role, ownerName, updatedAt }[]`.
- `workspaces.create({ name })` crea un espacio propiedad de quien llama y su membresía `owner`; devuelve el ID.
- `workspaces.membership(ctx, memberId, workspaceId)` resuelve la membresía vigente y su rol o falla con `FORBIDDEN`.
- Los IDs de membresía no sustituyen la cuenta global ni el perfil.

- [x] Escribir pruebas para crear dos espacios de la misma cuenta, listar espacios compartidos y rechazar miembros sin acceso.
- [x] Ejecutar `npm test -- tests/convex/workspaces.test.ts` y comprobar el fallo esperado antes de implementar.
- [x] Añadir tablas `workspaces` y `workspaceMembers`, roles `owner`/`editor`, índices por propietario, espacio e integrante; agregar referencias opcionales `workspaceId` a las tablas de datos existentes para permitir backfill.
- [x] Implementar list/create y la resolución de rol con autorización, asegurando que los nombres se validan y que un espacio no se puede crear sin sesión.
- [x] Añadir una prueba de que el perfil global de la cuenta no se duplica al crear espacios.
- [x] Ejecutar `npm test -- tests/convex/workspaces.test.ts tests/convex/schema.test.ts` y `npm run typecheck`.

### Task 2: Migración conservadora del espacio actual

**Files:**
- Create: `app/convex/workspaceMigration.ts`
- Create: `app/scripts/migrate-workspaces.mjs`
- Modify: `app/convex/schema.ts`
- Test: `app/tests/convex/workspaceMigration.test.ts`
- Test: `app/tests/convex/actors.test.ts`

**Interfaces:**
- La consulta interna `workspaceMigration.status` reporta conteos de documentos sin espacio, documentos asociados y referencias inconsistentes.
- La mutación interna `workspaceMigration.runBatch({ cursor, limit })` procesa como máximo 100 documentos y devuelve el cursor siguiente; es idempotente.
- `workspaceMigrationAdmin` expone un puente de acciones públicas protegido por `WORKSPACE_MIGRATION_SECRET`, porque la CLI no invoca funciones internas directamente.
- El script consulta en seco por defecto y exige `--apply` para mutar. No borra datos ni tokens.

- [x] Crear fixtures de producción antigua sin `workspaceId`, con proyecto/tarea/registro/evento/settings/invitación enlazados, token de lectura activo y una invitación pendiente; incluir además invitaciones vencidas/usadas/revocadas.
- [x] Ejecutar `npm test -- tests/convex/workspaceMigration.test.ts` y comprobar que falla por no existir el migrador.
- [x] Implementar la creación única del espacio inicial, mapear al propietario y miembros vigentes, y asociar documentos en lotes preservando IDs, referencias y tokens.
- [x] Probar reejecución, lote parcial, perfil legado, miembro revocado y detección de referencia cruzada; verificar que token de lectura, `tokenHash`, caducidad y estado de invitación no cambian. La segunda pasada no debe crear otro espacio ni duplicar membresías.
- [x] Probar después del backfill ficticio que el token de lectura aún abre solo el espacio inicial y que una invitación pendiente antigua se canjea en ese espacio.
- [x] Probar que el puente de la CLI rechaza secretos incorrectos.
- [x] Ejecutar `npm test -- tests/convex/workspaceMigration.test.ts tests/convex/actors.test.ts`.
- [ ] Ejecutar el script en `--dry-run` contra un despliegue local/dev aislado y comprobar que no muta datos. No se ejecutó porque la CLI usa el despliegue Convex configurado, que no se verificó como entorno aislado.

### Task 3: Aislar toda consulta y mutación por espacio

**Files:**
- Modify: `app/convex/tasks.ts`, `app/convex/projects.ts`, `app/convex/journal.ts`, `app/convex/calendar.ts`, `app/convex/events.ts`, `app/convex/members.ts`, `app/convex/invites.ts`, `app/convex/settings.ts`, `app/convex/viewer.ts`, `app/convex/legacyImport.ts`
- Modify: `app/convex/lib/actors.ts`, `app/convex/lib/audience.ts`, `app/convex/lib/calendar.ts`, `app/convex/lib/eventPages.ts`, `app/convex/lib/journalQueries.ts`, `app/convex/lib/projects.ts`, `app/convex/lib/taskQueries.ts`, `app/convex/lib/journalDraft.ts`
- Test: `app/tests/convex/workspaceIsolation.test.ts`
- Test: `app/tests/convex/tasks.test.ts`, `app/tests/convex/journal.test.ts`, `app/tests/convex/invites.test.ts`, `app/tests/convex/permissions.test.ts`

**Interfaces:**
- Cada consulta autenticada recibe `workspaceId` opcional durante compatibilidad; su ausencia resuelve únicamente al espacio inicial del integrante autenticado.
- Cada mutación deriva y valida el espacio y rol desde la identidad y membresía del servidor. Rechaza relaciones con proyectos, tareas o invitaciones de otro espacio.
- `viewer.*` resuelve el espacio desde el token guardado, nunca desde un ID suministrado por el visitante.

- [x] Escribir y ejecutar pruebas negativas: una integrante no lee ni cambia datos de otro espacio, la vista pública queda limitada a su token, una editora no abre la Bitácora ni cambia los ajustes, y retirar acceso a un espacio conserva el otro.
- [x] Ejecutar `npm test -- tests/convex/workspaceIsolation.test.ts`.
- [x] Añadir filtros por espacio a las consultas de tareas, proyectos, calendario, Bitácora, eventos, miembros e invitaciones.
- [x] Aplicar autorización por rol a cambios, invitaciones, miembros, ajustes, borradores, importación/restauración y enlaces públicos.
- [x] Mantener compatibilidad de llamadas sin `workspaceId` al espacio inicial y conservar token y configuración del enlace de lectura.
- [x] Ejecutar la suite Convex y la suite completa Vitest.

### Task 4: Rutas y contexto activo del espacio

**Files:**
- Modify: `app/src/router.ts`, `app/src/router.test.ts`
- Modify: `app/src/audience.ts`
- Modify: `app/src/data/useBoardData.ts`, `app/src/data/useCalendarHours.ts`, `app/src/data/useEvents.ts`
- Modify: `app/src/shell/Root.tsx`, `app/src/shell/MemberApp.tsx`, `app/src/viewer/ViewerApp.tsx`
- Modify: `app/src/views/BoardPage.tsx`, `app/src/views/CalendarPage.tsx`, `app/src/views/JournalPage.tsx`, `app/src/views/HistoryPage.tsx`

**Interfaces:**
- Rutas autenticadas nuevas: `#/espacio/<workspaceId>` y `#/espacio/<workspaceId>/<tab>`.
- `#/`, `#/tablero`, `#/calendario`, `#/bitacora` y `#/historial` siguen abriendo el espacio inicial para enlaces y marcadores existentes.
- `MemberApp` resuelve el espacio de la ruta mediante `workspaces.listMine`, y `SessionProvider` distribuye el ID y el rol activos; las suscripciones y escrituras incluyen el espacio seleccionado.
- `#/ver/<token>` continúa fijado al espacio determinado por ese token.

- [x] Probar parsing, rutas antiguas, pestaña conservada, selección por URL y navegación entre espacios.
- [x] Resolver la selección desde la ruta y usar el espacio inicial como predeterminado; un ID sin membresía no entrega contenido.
- [x] Propagar contexto a consultas y escrituras de páginas/paneles sin poner el ID en el perfil.
- [x] Probar que cambiar de espacio cambia las consultas y mutaciones del tablero.
- [x] Ejecutar pruebas de router, `MemberApp`, tipos y build.

### Task 5: Selector visual y creación de Bitácoras

**Files:**
- Create: `app/src/shell/WorkspaceSwitcher.tsx`
- Modify: `app/src/shell/Navbar.tsx`, `app/src/shell/MemberApp.test.tsx`
- Modify: `app/src/shell/MemberApp.tsx`
- Modify: `app/src/styles/base.css`, `app/src/styles/layout.css`, `app/src/styles/themes/grafito.css`, `app/src/styles/themes/papel.css`, `app/src/styles/themes/tinta.css`

**Interfaces:**
- Selector compacto: nombre activo, lista agrupada por propias/compartidas, rol visible y comando **Nueva Bitácora**.
- Creación reutiliza `Panel` y `useToast`; guarda el nombre y navega al tablero del espacio nuevo.
- El selector no aparece en enlaces de perfil públicos y el encabezado de lectores conserva la marca **Bitácora**.

- [x] Probar UI de creación, validación del nombre, cambio de espacio y estado sin espacios; el `<select>` conserva interacción nativa por teclado.
- [x] Implementar selector integrado a marca/barra y panel existente; usar variables de temas y sin nueva barra lateral.
- [x] Adaptar el selector a la distribución móvil existente.
- [ ] Revisar visualmente contraste, hover/foco y geometría en las seis combinaciones de apariencia y tamaños móviles; no hubo sesión de inspección visual en esta ejecución.
- [x] Mantener el predeterminado grafito claro y no acoplar apariencia/perfil al espacio activo.
- [x] Ejecutar pruebas UI de `MemberApp` y `npm run build`.

### Task 6: Invitaciones, visibilidad, revocación y cierre de seguridad

**Files:**
- Modify: `app/src/features/access/AccessPanel.tsx`, `app/src/features/access/AccessPanel.test.tsx`, `app/src/features/access/access.css`
- Modify: `app/src/features/profile/ProfileShareControls.tsx`, `app/src/features/profile/ProfileShareControls.test.tsx`
- Modify: `app/src/viewer/ViewerApp.tsx`, `app/src/viewer/SharedProfileApp.tsx`
- Modify: `app/e2e/invite-flow.spec.ts`, `app/e2e/viewer-flow.spec.ts`, `app/e2e/mobile.spec.ts`
- Create: `app/tests/convex/workspacePermissions.test.ts`
- Modify: `app/CUTOVER.md`

**Interfaces:**
- Cada invitación incluye el ID del espacio y rol `editor`; la aceptación incorpora solo a ese espacio.
- La vista de acceso muestra integrantes e invitaciones del espacio activo; retirar acceso invalida suscripciones e invitaciones de ese espacio, no las demás membresías de la cuenta.
- La acción de compartir administra el enlace del espacio activo y sus propias opciones; enlaces personales permanecen separados.

- [x] Probar invitación adicional a una cuenta activa, canje único, expiración/revocación y navegación al espacio correcto.
- [x] Probar en fixtures que `#/ver/<token>` conserva la lectura y `#/invitacion/<token>` conserva el canje pendiente original.
- [x] Probar que revocar una membresía A no revoca acceso a espacio B de la misma cuenta.
- [x] Probar que rutas antiguas mantienen compatibilidad y los enlaces públicos no cruzan datos.
- [ ] Completar flujos Playwright en escritorio y móvil, revisar mensajes vacíos/errores y acceso de solo lectura.
- [x] Añadir en `app/CUTOVER.md` el procedimiento conservador para el backfill y la protección de enlaces.
- [x] Ejecutar `npm test`, `npm run typecheck` y `npm run build`; los flujos E2E siguen pendientes de un despliegue de desarrollo aislado.

## Cutover

La implementación no implica ejecutar el migrador en producción. Antes de publicar: tomar respaldo, confirmar el `CONVEX_DEPLOY_KEY` de producción y que Netlify construye desde el branch correcto; desplegar primero el esquema/API compatibles; correr dry-run y revisar conteos; aplicar lotes con verificación; publicar la interfaz; comprobar el enlace de lectura y consultar el estado de invitaciones distribuidas sin canjearlas; probar canje en staging; solo entonces planear endurecer referencias opcionales. No regenerar el token principal ni prolongar/revocar invitaciones durante el corte.

## Suggested execution

Implementación nativa en esta sesión, por tareas, con pruebas Convex primero y revisión del aislamiento antes de conectar la interfaz. La migración de producción se mantiene fuera de la ejecución local y requiere autorización independiente.
