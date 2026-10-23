# Plan: Perfiles personales y carné compartible

**Estado:** plan funcional; no incluye cambios de código ni modifica la aplicación.

## 1. Objetivo

Permitir que cada integrante con acceso tenga un perfil propio, complete y edite su carné con foto y datos académicos y del grupo al que pertenece, y comparta una vista pública de ese perfil mediante un enlace independiente del tablero.

El tablero seguirá siendo un espacio de trabajo común. Crear un perfil personal no crea una copia ni un tablero privado.

## 2. Situación actual

- El acceso de integrantes es con cuenta de Google y una invitación; no hay registro público abierto. Las invitaciones actuales son de un solo uso y vencen en 7 días.
- Una persona invitada puede editar su nombre y rol, y trabajar sobre las tareas del tablero compartido.
- La ficha ampliada (foto, programa, semestre, institución y grupo) se almacena hoy como un perfil global de la dueña. Las personas invitadas no tienen aún un carné ampliado propio.
- El enlace compartible actual es el del espacio/tablero, no el perfil individual.
- La Bitácora y las horas siguen siendo privadas de la dueña.

## 3. Experiencia propuesta

### Apariencia inicial

- En una invitación, para una persona integrante nueva y en el enlace de solo lectura, el tema inicial será **Grafito claro** cuando ese navegador no tenga una preferencia de apariencia guardada.
- Se conserva la elección manual de tema del navegador; el valor claro es el predeterminado, no una restricción que impida elegir oscuro.
- El mismo selector de apariencia debe funcionar en la vista de solo lectura sin permitir cambios en los datos compartidos.

### Crear perfil

1. La persona recibe una invitación y accede con su cuenta de Google.
2. Confirma su nombre y rol y completa su perfil personal. La cuenta autenticada queda asociada a un único perfil.
3. Puede terminarlo después; el sistema identifica qué datos faltan sin impedirle usar el tablero.

Se recomienda conservar el acceso por invitación en esta primera etapa. La creación de un perfil no debe permitir que una cuenta sin invitación ingrese al espacio de trabajo.

### Editar carné

Cada integrante podrá abrir **Mi perfil**, editar sus datos y previsualizar el carné antes de guardar. Los cambios se reflejarán en su perfil compartido, si está habilitado, pero no modificarán los datos personales de otros integrantes.

Campos propuestos:

- Nombre para mostrar y rol dentro del grupo.
- Foto de perfil, con recorte y previsualización.
- Institución, programa o carrera y semestre/periodo.
- Grupo de investigación al que pertenece.
- Presentación breve y áreas de interés, opcionales.
- Identidad visual del grupo: nombre y logotipo; por ejemplo, **AthenaIA**, “Grupo de investigación en inteligencia artificial”, UNIAJC · Cali, tomando la imagen adjunta como referencia visual.

Los datos del grupo deben seleccionarse de grupos registrados para evitar variantes del nombre. La persona puede solicitar un grupo nuevo; una persona administradora lo crea o corrige. No se deben publicar por defecto correo, teléfono, documento, credenciales ni información sensible.

### Compartir perfil

- Cada perfil tendrá una acción independiente: **Compartir mi perfil**.
- Al activarla, se genera un enlace aleatorio de solo lectura, revocable y distinto del enlace del tablero.
- La persona podrá previsualizar exactamente lo que verá quien tenga el enlace y escoger qué campos opcionales mostrar.
- El enlace no permitirá editar el perfil, ver tareas, acceder a la Bitácora ni descubrir otros perfiles.
- Desactivar o regenerar el enlace invalida el anterior inmediatamente.
- El perfil no aparecerá en buscadores ni en un directorio público en la primera versión.

### Identidad de la vista de solo lectura

- En el modo de solo lectura del espacio, la marca de la parte superior dirá únicamente **Bitácora**; no mostrará «Mi bitácora de actividades» como título principal.
- Debajo de **Bitácora** se mostrará el nombre de la persona propietaria del espacio, por ejemplo, «De [nombre]», para que quien recibió el enlace sepa de quién es la información.
- La vista pública de un perfil individual identificará a la persona de ese perfil, sin confundirla con la dueña del tablero.
- La pestaña del navegador tendrá el título **Bitácora** y un favicon propio, legible en tamaño pequeño y coherente con la identidad visual de la aplicación. Las imágenes adjuntas sirven como referencia para el encabezado y el icono actual.
- Esta identidad visual no cambia los permisos: el nombre visible no habilita edición ni revela datos que no estén publicados.

## 4. Separación de datos y permisos

| Rol | Perfil y carné | Tablero compartido | Enlace individual |
|---|---|---|---|
| Integrante | Ver y editar el propio; no modificar el de otros | Ver y colaborar según sus permisos actuales | Crear, previsualizar, regenerar o desactivar el propio |
| Administradora del espacio | Administrar integrantes y grupos; no editar silenciosamente datos personales ajenos | Administrar el espacio según su rol | No controlar el enlace personal de otra persona, salvo una política explícita de moderación |
| Visitante con enlace de perfil | Ver solo los campos publicados | Sin acceso | Solo lectura |
| Visitante con enlace del tablero | Ver únicamente lo habilitado por el enlace del espacio | Solo lectura | Sin acceso a perfiles individuales no publicados |

La persona administradora podrá retirar el acceso al espacio. Eso debe impedir el acceso autenticado al tablero y al perfil privado. La política para invalidar también el enlace público del perfil al retirar el acceso debe ser explícita; se recomienda invalidarlo automáticamente.

## 5. Modelo funcional de información

- **Cuenta:** identidad autenticada de Google.
- **Perfil personal:** pertenece a una cuenta/integrante; contiene sus campos académicos, foto, presentación y preferencias de visibilidad.
- **Grupo:** registro compartido con nombre oficial, descripción, institución y logotipo opcional. Un perfil referencia el grupo al que pertenece.
- **Enlace de perfil:** token independiente, guardado de forma segura, con estado activo/revocado y selección de campos públicos.
- **Espacio de trabajo:** conserva el tablero, calendario, tareas e historial compartidos que ya existen.

La foto debe guardarse mediante almacenamiento controlado, con límites de formato y tamaño. No se recomienda incrustar fotos grandes como texto en la base de datos ni hacer pública la carpeta de almacenamiento.

## 6. Etapas de implementación

1. **Definir permisos y privacidad:** confirmar registro por invitación, campos públicos predeterminados, administración de grupos y revocación de enlaces.
2. **Separar perfiles por integrante:** migrar el carné global actual al perfil de la dueña y crear el registro personal para cada integrante sin perder sus datos.
3. **Completar el carné individual:** formulario, validación, carga/recorte de foto, previsualización y vista adaptable a móvil.
4. **Administrar grupos:** catálogo de grupos; selección en el perfil y flujo para solicitar/crear un grupo.
5. **Compartir perfiles:** enlace individual de solo lectura, selección de campos visibles, previsualización, regeneración y desactivación.
6. **Identidad y marca:** nombre de la persona propietaria en la vista de solo lectura del espacio, encabezado «Bitácora», título de pestaña y favicon propios.
7. **Verificar seguridad y compatibilidad:** pruebas de permisos, migración, enlaces revocados, cargas de foto y separación entre perfil, tablero y Bitácora; comprobar que el modo de solo lectura identifica a la persona correcta en escritorio y móvil.

## 7. Criterios de aceptación

- Una cuenta sin invitación no puede crear un perfil con acceso al tablero.
- Al aceptar una invitación, cada persona tiene un perfil asociado exclusivamente a su cuenta.
- Una integrante puede editar su foto, nombre, rol, programa, semestre y grupo sin cambiar los datos de otra persona.
- El carné muestra correctamente la identidad visual del grupo y la afiliación individual.
- Compartir el perfil produce un enlace individual de solo lectura, separado del enlace del tablero.
- El visitante ve solo los campos habilitados; no ve correo, datos privados, tablero ni Bitácora.
- Regenerar o desactivar un enlace lo invalida; una sesión sin permiso no puede reactivarlo.
- La vista de solo lectura del espacio dice **Bitácora** y muestra debajo el nombre de su propietaria; no confunde esa identidad con el perfil de otra persona.
- La pestaña del navegador muestra el título **Bitácora** y el favicon de la aplicación.
- Una persona invitada y quien abre el enlace de solo lectura ven **Grafito claro** inicialmente si no existe una preferencia guardada; si eligen otro tema, esa elección se conserva en el navegador.
- La persona administradora puede gestionar acceso y catálogo de grupos sin hacerse pasar por otro integrante ni editar su carné personal.
- La aplicación mantiene el tablero compartido actual; los perfiles no crean espacios de tareas aislados.
- La experiencia funciona con teclado y en móvil, y la carga de foto tiene límites y errores comprensibles.

## 8. Decisiones pendientes antes de programar

- ¿El alta seguirá siendo solo por invitación? Recomendación: sí, al menos inicialmente.
- ¿Qué campos se publicarán por defecto en el enlace personal? Recomendación: nombre, rol, grupo e institución; foto y demás campos solo tras confirmación.
- ¿Quién puede crear y corregir grupos: solo la administradora o cualquier integrante mediante aprobación?
- ¿La administradora podrá invalidar un enlace personal por seguridad? Recomendación: sí, sin modificar el contenido del perfil.
- ¿Se desea una galería interna de perfiles autorizados, o solo compartir cada perfil por enlace directo? Recomendación inicial: enlace directo, sin directorio público.

## 9. Fuera del alcance inicial

- Crear un tablero privado o una copia del tablero para cada integrante.
- Habilitar registro abierto sin invitación.
- Publicar automáticamente perfiles en un directorio o buscadores.
- Dar a cada integrante permisos de administradora del espacio.
- Compartir la Bitácora personal, las horas o las tareas mediante el enlace del carné.
