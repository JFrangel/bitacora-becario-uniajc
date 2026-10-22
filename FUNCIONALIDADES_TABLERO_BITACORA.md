# Propuesta funcional: tablero y Bitácora

**Estado:** especificación para revisión e implementación posterior. No incluye código ni modifica la aplicación actual.

## 1. Propósito y alcance

Crear un tablero sencillo para asignar y seguir tareas del equipo jurídico. El tablero funciona como módulo independiente: no incorpora una pantalla Jira ni una vista de historial/auditoría. La única conexión deliberada con la Bitácora ocurre cuando una tarea se marca como completada: se crea un registro borrador para documentar el trabajo y las horas.

La Bitácora sigue siendo el registro de actividades realizadas. Completar una tarea no debe inventar horas ni dar por terminado el registro de la Bitácora.

## 2. Perfiles y permisos

- **Administradora:** puede crear proyectos y tareas, asignar responsables, editar y eliminar tareas, y consultar el tablero completo. Por ejemplo, una profesora coordinadora.
- **Colaboradora o becario:** consulta sus tareas asignadas, cambia su estado según el flujo permitido y completa el borrador de Bitácora asociado.
- **Consulta:** puede ver el tablero y el detalle de las tareas, pero no cambiar información.

El acceso debe ser por cuentas identificadas y roles asignados por una administradora; no mediante registro público con un PIN compartido. La lista de quién puede crear, asignar o cerrar tareas debe poder ajustarse a las reglas del equipo.

## 3. Funciones del tablero

- Crear una tarea con título, descripción, proyecto/área, responsable, fecha límite y prioridad.
- Editar los datos de una tarea y consultar quién es responsable y cuál es su estado actual.
- Organizar las tareas en columnas **Por hacer**, **En curso**, **En revisión** y **Completada**.
- Cambiar de columna arrastrando una tarjeta o con un control accesible equivalente; el arrastre no debe ser la única forma de cambiar el estado.
- Buscar por título o descripción y filtrar por proyecto, responsable, prioridad y estado.
- Mostrar tarjetas compactas con título, proyecto, persona asignada, vencimiento y estado. Al abrir una tarjeta se consulta su descripción y demás datos.
- Adaptar el tablero a pantallas pequeñas sin ocultar acciones ni hacer ilegible el contenido.

No se requiere, para la primera versión, chat, notificaciones complejas, dependencias entre tareas, sprints ni una pantalla de auditoría de cambios.

## 4. Flujo de integración con la Bitácora

1. La administradora crea una tarea y la asigna.
2. La persona asignada avanza el estado de la tarea mientras trabaja.
3. Al cambiarla a **Completada**, el sistema crea un borrador de Bitácora enlazado con el identificador de esa tarea.
4. El borrador aparece en la línea de tiempo de la Bitácora con una señal visual ámbar y el texto **“Completa los detalles de esta tarea”**. El color significa que falta documentar; no significa que la tarea siga abierta.
5. El borrador incluye el título de la tarea como actividad, el proyecto/área, la fecha de finalización y la descripción como contexto u objetivo si corresponde. Las horas quedan sin registrar (cero o vacías), nunca se calculan a partir de la tarea.
6. La persona completa en la Bitácora el tiempo real trabajado, desarrollo, resultado, observaciones y evidencias que tenga. Puede adjuntar imágenes y enlaces siguiendo las capacidades existentes de la Bitácora.
7. Al guardar la información requerida, el registro deja de ser borrador y usa el estilo normal de la línea de tiempo. Las horas solo se suman a los indicadores cuando se hayan ingresado y guardado.

**Orden sugerido en el formulario de Bitácora:** actividad, objetivo, desarrollo, resultado y observaciones; después, evidencias y enlaces. El resultado va antes de las observaciones.

## 5. Reglas para evitar errores de sincronización

- Cada tarea debe tener un identificador estable y cada borrador guardar `source_task_id` para que el enlace no dependa del título.
- Marcar varias veces una misma tarea como completada no debe crear borradores duplicados.
- El estado de la tarea y el estado de documentación de la Bitácora son independientes: una tarea puede estar completada y su borrador pendiente.
- Si se reabre una tarea después de completar, se conserva el registro y su vínculo. La política para una segunda finalización debe definirse antes de implementarla: actualizar el mismo registro o crear uno nuevo solo mediante una acción explícita.
- Si falla la creación del borrador, el tablero debe mostrar que la tarea se completó pero que falta sincronizar la Bitácora, con una opción de reintento. No debe mostrar un éxito falso.
- El borrador no debe incluir horas ficticias ni aparecer como actividad completamente documentada en exportaciones o resúmenes de horas.

## 6. Datos mínimos

**Tarea:** identificador, título, descripción, proyecto/área, responsable, fecha límite, prioridad, estado, fecha de creación y última actualización.

**Registro de Bitácora:** identificador, `source_task_id` opcional, fecha de actividad, proyecto/área, actividad, objetivo, desarrollo, resultado, observaciones, horas, estado de documentación (`borrador` o `completo`), enlaces y evidencias.

Mantener metadatos básicos de creación/actualización es útil para operar el tablero. No implica construir una pantalla de historial de auditoría en esta primera versión.

## 7. Diseño visual

- Mantener la paleta y tipografía ya usadas por la Bitácora: fondo oscuro `#090b0c`, superficies `#101314`, texto claro y acento verde menta `#66c6a9`.
- Usar ámbar solo para borradores pendientes; conservar el verde menta para acciones o registros guardados/completos.
- Reutilizar el ancho y la densidad visual del sitio existente. Presentar una opción discreta para cambiar entre **Tablero** y **Bitácora**, sin una barra superior genérica, navegación lateral nueva ni una portada de marketing.
- Incluir una leyenda breve junto al estado ámbar para que su significado no dependa solo del color.

## 8. Persistencia, seguridad y límites actuales

La interfaz actual de Bitácora y su servicio de Apps Script/Sheets no deben considerarse automáticamente preparados para usuarios, roles y borradores multiusuario. Antes de integrar se requiere definir autenticación, autorización por rol, persistencia de tareas y una operación de servidor que cree el borrador de forma idempotente.

No exponer claves ni credenciales en JavaScript del navegador. Como el tablero puede contener asignaciones y trabajo jurídico, restringir los datos y las evidencias a usuarios autorizados; no asumir que un enlace público o un PIN corto es protección suficiente. Si se mantienen Sheets y Drive como almacenamiento, revisar permisos de ambos y no hacer públicas las fotos por defecto.

## 9. Criterios de aceptación

- Una administradora puede crear y asignar una tarea; la persona asignada la encuentra en su tablero.
- Cambiar estado funciona con arrastre y con una alternativa accesible.
- Completar una tarea crea un único borrador enlazado en la Bitácora, marcado claramente como pendiente.
- El borrador no suma horas hasta que la persona ingresa y guarda el tiempo real.
- La persona puede completar los detalles y agregar evidencias desde la Bitácora; el registro queda relacionado con la tarea.
- Reintentos o cambios repetidos de estado no duplican el registro ni descartan detalles ya escritos.
- Los perfiles de consulta no pueden modificar tareas o registros.
- La interfaz conserva los colores existentes y funciona en escritorio y móvil.

## 10. Decisiones que el equipo debe confirmar

- ¿Quiénes pueden asignar tareas y quiénes pueden marcar una tarea como completada?
- ¿Un usuario puede tener más de una persona responsable por tarea?
- ¿Al reabrir y volver a completar una tarea se actualiza la misma Bitácora o se genera un registro nuevo con confirmación?
- ¿Qué campos de la Bitácora son obligatorios para convertir el borrador en completo?
- ¿La tarea eliminada debe conservar su registro de Bitácora vinculado?
