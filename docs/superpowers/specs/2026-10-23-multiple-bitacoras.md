# Especificación: espacios y múltiples Bitácoras

## Problema

Hoy una invitación incorpora a una persona al único espacio de trabajo de la aplicación. Aunque cada integrante ya puede tener su perfil y su carné, no puede crear una Bitácora propia ni alternar entre varias Bitácoras desde su cuenta.

## Objetivo

Permitir que una cuenta autenticada cree y administre varias Bitácoras y que también participe en espacios a los que la inviten. Cada Bitácora incluye su propio tablero, calendario, historial, registros, proyectos, invitaciones y enlace de solo lectura.

## Modelo elegido

- Una cuenta autenticada conserva **un perfil personal** y puede pertenecer a varios espacios.
- Cada espacio representa una Bitácora completa; una persona puede crear varias desde su perfil.
- Cada espacio tiene su propio tablero, calendario, historial, Bitácora, proyectos, personas, invitaciones y ajustes de compartir.
- Una persona puede ser propietaria de varios espacios y editora en otros. Su perfil y carné siguen siendo globales a su cuenta, no se duplican por espacio.
- Aceptar una invitación agrega a la persona al espacio asociado a esa invitación. Después puede crear sus propios espacios desde el mismo perfil.
- Se conserva el acceso por invitación; esta función no abre el registro al público.

## Roles y permisos

| Rol | Tablero y calendario | Bitácora | Administrar espacio |
|---|---|---|---|
| Propietaria | Ver y editar tareas | Ver y editar registros del espacio | Invitar, administrar integrantes, ajustes y compartir |
| Editora | Ver y editar tareas; completar tareas puede crear borradores para la propietaria | No entra en la pestaña Bitácora, como ocurre actualmente con integrantes | Puede crear invitaciones, preservando el comportamiento vigente; no puede retirar a otras personas ni cambiar ajustes |
| Visitante con enlace del espacio | Solo lectura según las opciones del enlace | Solo lectura si el enlace la incluye | No |
| Visitante con enlace de perfil | Sin acceso | Sin acceso | Sin acceso |

Los permisos se validan en Convex para cada operación; ocultar controles en la interfaz no sustituye la autorización del servidor.

## Flujo y presentación

- Mantener la aplicación actual como experiencia principal. No crear una landing, un dashboard separado ni una barra lateral genérica.
- Agregar un selector compacto de Bitácora en la barra superior existente, junto a la marca y antes de las pestañas. La marca **Bitácora**, las pestañas Tablero/Calendario/Bitácora/Historial, los temas, el carné y los controles actuales conservan sus estilos.
- El selector abre una lista ligera, agrupada en **Mis Bitácoras** y **Compartidas conmigo**, con nombre, rol y una marca discreta para el espacio activo. Al final ofrece **Nueva Bitácora**.
- **Nueva Bitácora** abre un panel consistente con los paneles actuales: nombre obligatorio, creación y entrada inmediata al nuevo tablero. No se muestran tarjetas anidadas ni una pantalla de bienvenida.
- En móvil el selector ocupa una fila compacta integrada con la marca; las pestañas conservan su fila actual y no se desbordan.
- La apariencia clara actual continúa como predeterminada en navegadores sin preferencia guardada. Una preferencia manual no se cambia al cambiar de espacio.
- La aplicación tiene tres estilos visuales (`grafito`, `papel` y `tinta`), cada uno con modo claro y oscuro. El selector, su lista, estados vacíos, foco, hover y panel de creación deben leerse correctamente en las seis combinaciones, usando las variables y reglas de cada tema; no se diseña solo para grafito claro.
- Los espacios no guardan ni fuerzan una apariencia propia: se conserva la preferencia local actual del navegador y el predeterminado sigue siendo grafito claro.
- La selección del espacio queda representada en la ruta/hash para que recargar, usar atrás/adelante y compartir una URL no cambie de Bitácora inesperadamente.

## Enlaces e integración

- El enlace de invitación queda asociado a **un espacio**. Aceptarlo abre ese espacio y no da acceso a los demás espacios de quien invita.
- Cada espacio tiene su propio enlace de solo lectura y sus propias opciones. El token de lectura actual se conserva para el espacio migrado.
- El enlace público de solo lectura existente continúa resolviendo únicamente la Bitácora original migrada; crear más espacios no los hace visibles desde ese enlace.
- La URL pública actual `#/ver/<token>` conserva exactamente su token y opciones: hoy el token está en `settings.shareToken`, así que la migración mueve esa configuración al espacio inicial sin regenerarlo.
- La invitación existente `#/invitacion/<token>` conserva su fila, `tokenHash`, creador, caducidad y estado de uso/revocación, y se asocia al espacio inicial. Si sigue pendiente y no vencida, canjearla da acceso solo a ese espacio. No se reactiva ni extiende una invitación vencida, usada o revocada.
- La verificación de corte para una invitación de producción consulta únicamente su validez (sin canjearla, porque es de un solo uso); el canje se prueba con una invitación de staging/fixture.
- Las rutas actuales `#/ver/<token>`, `#/invitacion/<token>` y `#/perfil/<token>` siguen funcionando. Los enlaces antiguos de navegación interna abren el espacio existente original; no se reinterpretan como el último espacio seleccionado.
- El enlace individual `/perfil/<token>` continúa mostrando solo los campos del perfil personal autorizados por su propietaria; no revela Bitácoras ni otros espacios.
- Completar una tarea crea, como hasta ahora, un borrador único en la Bitácora de **ese mismo espacio**. No se puede vincular una tarea a un registro de otro espacio.

## Datos y migración

- Añadir entidades de espacio y membresía. Las cuentas/personas y su perfil personal permanecen globales.
- Incorporar una referencia `workspaceId` a proyectos, tareas, registros de Bitácora, eventos, invitaciones y ajustes del espacio.
- Crear exactamente un espacio inicial que contenga los datos existentes. El propietario actual queda como propietaria y los integrantes activos se conservan como editores; los revocados siguen revocados.
- Asociar los registros existentes al espacio inicial en lotes idempotentes. Conservar IDs de tareas, proyectos y registros, relaciones entre ellos, historial, evidencias, ajustes, token literal de lectura y filas/hash/estado de las invitaciones.
- Durante la migración, las referencias nuevas pueden ser opcionales en el esquema y las API antiguas sin `workspaceId` se resuelven al espacio inicial. Solo después de validar el backfill se exige el espacio en todas las rutas de escritura.
- Proveer comprobación en seco con conteos y verificación de relaciones antes de aplicar lotes. No borrar documentos ni regenerar enlaces durante el backfill.
- El despliegue y la ejecución de la migración de producción son pasos separados y requieren aprobación explícita; la implementación local no debe tocar producción.

## Fuera de alcance

- Varias Bitácoras dentro de una misma Bitácora/espacio: cada espacio es una Bitácora completa.
- Registro público sin invitación o autenticación diferente de la actual.
- Directorio público de espacios o perfiles.
- Compartir automáticamente todos los espacios de una cuenta con sus integrantes.
- Cambiar la privacidad histórica de la Bitácora, el contenido de tareas o los enlaces individuales de perfil.

## Criterios de aceptación

1. Una cuenta puede crear dos Bitácoras, alternar entre ellas y conservar en cada una tareas, proyectos, historial y registros distintos.
2. Una cuenta invitada a un espacio conserva ese acceso y puede crear su propio espacio; cambiar de contexto no mezcla ni copia sus datos.
3. Una invitación y un enlace de lectura solo abren el espacio al que pertenecen; un usuario sin membresía no puede consultar ni mutar otro espacio cambiando el ID enviado al servidor.
4. Los roles conservan las capacidades definidas arriba, con autorización servidor en consultas y mutaciones.
5. La migración conserva documentos, relaciones, evidencias, tokens activos y accesos del espacio actual; se puede ejecutar más de una vez sin duplicar ni perder datos.
6. Los enlaces ya distribuidos de lectura e invitación siguen resolviendo el espacio inicial sin cambiar sus tokens ni su estado; el enlace de invitación conserva sus reglas de un solo uso y vencimiento.
7. El selector y el panel de creación siguen la barra, temas, espaciado y controles del producto; funcionan con teclado y en móvil.
8. Completar una tarea produce como máximo un borrador en la Bitácora del mismo espacio.
9. Selector, menú y panel de creación mantienen contraste, estados de interacción y legibilidad en grafito/papel/tinta, claro y oscuro.
