# Diseño: Tablero, Calendario e Historial para la Bitácora

**Estado:** diseño aprobado por la dueña el 21 de octubre de 2026, con dos ampliaciones posteriores incluidas en este documento (temas oscuros de Papel y Tinta viva; carné 3D en «Mi perfil» y en la Bitácora, con perfil editable, foto y logotipo de AthenIA). No se ha escrito código de la aplicación.
**Reemplaza** a `FUNCIONALIDADES_TABLERO_BITACORA.md` en todo lo que lo contradiga (ver la sección 16).
**Maqueta de referencia (funcional, sin persistencia):** `docs/superpowers/specs/assets/2026-10-21-mockup/index.html`. Se abre con doble clic. Las tipografías se cargan desde Google Fonts solo en la maqueta. El carné 3D solo funciona con el paquete de prueba `badge.js` (no incluido); sin él se ve el carné plano. `athenia-mark.png` (máscara del logotipo, sección 4.8) sí está incluida.

---

## 1. Intención y por qué

La persona dueña de la Bitácora es un becario de la Institución Universitaria Antonio José Camacho. Hoy lleva su registro de actividades, horas y evidencias en una página estática conectada a una hoja de Google. Quiere **compartir su trabajo** con su director, su supervisora y la universidad, y quiere que ellos puedan **asignarle y seguir tareas**.

Se añaden cuatro cosas a la aplicación actual:

1. Un **tablero** de tareas (columnas tipo kanban).
2. Un **calendario** mensual.
3. Un **historial de cambios** que dice qué cambió, quién lo hizo y cuándo.
4. **Acceso por invitación**, para que otras personas entren con su cuenta de Google (sin contraseñas propias), y un **enlace de solo lectura** para la universidad.

La **Bitácora sigue siendo el registro personal de la dueña**: conserva todas sus funciones y es la única parte que las personas invitadas no ven. Cuando la dueña completa una tarea suya, el sistema crea un **borrador** en su Bitácora para que documente el trabajo. Nunca inventa horas.

El resultado debe sentirse simple, minimalista, moderno y dinámico. No debe parecer un SaaS genérico, una landing ni un clon de Jira.

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Tablero con 4 columnas: Por hacer, En curso, En revisión, Completada. Se mueve arrastrando y también con un control accesible equivalente.
- Calendario mensual con las fechas límite y, para quien puede verlas, las horas documentadas de cada día.
- Historial inmutable de cambios, con quién, qué y cuándo.
- Bitácora con todas sus funciones actuales, integrada con el tablero mediante el borrador único.
- Acceso sin contraseñas propias: **inicio de sesión con Google para quien edita** (la dueña entra directo; las demás personas aceptan un enlace de invitación de un solo uso con su cuenta de Google) y un **enlace de solo lectura** para la universidad, sin cuenta.
- Tres estilos visuales intercambiables desde la propia aplicación: **Grafito** (predeterminado), **Papel** y **Tinta viva**. Los tres tienen tema oscuro y tema claro (seis combinaciones).
- Un panel «Mi perfil» con el carné 3D de cada persona (componente `Lanyard` de React Bits), que cuelga de una cinta y se puede arrastrar, lanzar y girar (sección 4.8).
- Funciona bien en escritorio y en móvil. Las animaciones usan componentes de React Bits y respetan `prefers-reduced-motion`.

**No-objetivos de la primera versión**
Comentarios o chat en las tareas, notificaciones (correo, push), dependencias entre tareas, subtareas con responsable o fecha propios (las subtareas simples de la sección 4.2 sí se incluyen), sprints, varios responsables por tarea, adjuntos en las tareas, permisos distintos entre personas invitadas, más de una bitácora, modo sin conexión, aplicación nativa, importar desde Jira, estadísticas avanzadas.

**Anti-objetivos** (aunque técnicamente funcione, sería un fracaso)
- Una barra lateral, una portada de marketing o una apariencia de SaaS genérico.
- Mostrar horas que la persona no escribió, o sumarlas a los indicadores antes de que las guarde.
- Que una persona invitada vea o modifique la Bitácora.
- Que un enlace filtrado dé acceso permanente. Todo acceso debe poder retirarse.
- Que una tarea quede completada sin su borrador por un fallo a medias.
- Depender de servicios de pago para funcionar con el volumen esperado.

## 3. Personas y acceso

### 3.1 Quién puede qué

| Capacidad | Dueña | Persona invitada | Enlace de solo lectura |
|---|---|---|---|
| Ver tablero y calendario | Sí | Sí | Sí |
| Ver la descripción de las tareas | Sí | Sí | Configurable (por defecto **no**) |
| Crear, editar, mover y asignar tareas; crear proyectos | Sí | Sí | No |
| Eliminar tareas | Sí | **No** | No |
| Ver el historial de tablero y personas | Sí | Sí | Sí |
| Ver Bitácora, horas, borradores y eventos de la Bitácora | Sí | **No** | Configurable (por defecto **sí**) |
| Escribir en la Bitácora | Sí | No | No |
| Crear invitaciones | Sí | Sí (máximo 10 pendientes por persona) | No |
| Ver quién invitó a quién y retirar acceso | Sí | No | No |
| Gestionar el enlace de solo lectura | Sí | No | No |

Solo hay **una dueña**. El «rol» que escribe cada persona (por ejemplo «Directora») es **solo una etiqueta informativa** y no concede permisos. Todas las personas invitadas tienen los mismos permisos.

Los datos derivados de la Bitácora (horas registradas, «Por documentar», chip de horas en las tarjetas, horas por día en el calendario, etiqueta de borrador) se muestran únicamente a la dueña y al enlace de solo lectura cuando incluye la Bitácora. Las personas invitadas **no** los ven.

### 3.2 Entrada de la dueña
La dueña entra con **Google**. El sistema compara el correo verificado de la cuenta con la variable de entorno `OWNER_EMAIL`. Cualquier otra cuenta de Google se rechaza. Su nombre sale del perfil de Google y su etiqueta de rol es editable (por defecto «Becario/a»). En el **primer** inicio de sesión con ese correo se crean el registro de la dueña (`members`) y la fila única de `settings`. La dueña no puede retirarse a sí misma.

La librería de inicio de sesión de Convex (Convex Auth) está en beta. El acceso a la identidad debe quedar encapsulado en una sola función (`getActor`, ver la sección 7) para poder cambiarla por un proveedor externo con Google (por ejemplo Clerk) sin tocar el resto del código.

### 3.3 Invitaciones
- Cualquier persona autorizada (dueña o invitada) pulsa «Invitar». El servidor genera un token aleatorio de 32 bytes (base64url), guarda **solo su hash SHA-256** y devuelve el enlace una única vez: `<SITE_URL>/#/invitacion/<token>`. El token va en el fragmento (`#`) para que no llegue a registros del servidor ni al encabezado `Referer`.
- La invitación caduca a los **7 días** si no se usa. Puede revocarla quien la creó o la dueña.
- **Quien abre el enlace debe iniciar sesión con Google** («Continuar con Google»). Después ve su correo, confirma cómo quiere aparecer —*nombre* (2 a 60, precargado con el de su cuenta) y *rol* (2 a 60)— y pulsa «Aceptar y entrar». Al confirmar, el servidor, en una única transacción, comprueba que la persona está autenticada, marca la invitación como usada, crea su registro de `members` vinculado a su cuenta (`userId` y `email`) y la deja dentro. **Una invitación solo puede usarse una vez**, incluso con dos intentos simultáneos desde cuentas distintas; una cuenta que ya es miembro (o la de la dueña) no puede canjearla.
- Una cuenta de Google que inicia sesión sin ser la dueña ni una persona con acceso vigente ve **«Tu cuenta no tiene acceso»** y puede volver al inicio; no se crea nada ni se ve ningún dato.
- Cada persona invitada puede crear a su vez invitaciones. La dueña ve un listado con quién invitó a quién **y el correo de cada cuenta** (para comprobar que entró la persona esperada; solo la dueña ve los correos).
- Retirar a una persona (solo la dueña) pone `revokedAt` en su registro: **deja de tener acceso de inmediato** aunque su sesión de Google siga abierta, y se revocan sus invitaciones **pendientes**. Las personas que ya entraron gracias a ella siguen dentro, y la dueña puede retirarlas también.

### 3.4 Sesiones
- Las gestiona **Convex Auth** (sesión de Google renovable). **No hay tokens de sesión propios ni tabla `sessions`.** Cada llamada identifica a la persona por su cuenta (`getActor`) y comprueba que su registro de `members` esté vigente.
- Se actualiza `lastSeenAt` como máximo una vez al día mediante una mutación `members.touch` al abrir la aplicación.
- Hay un botón «Cerrar sesión» (en «Mi perfil»). Si alguien pierde su dispositivo, la dueña retira a esa persona y, si hace falta, la vuelve a invitar. Con la aplicación abierta, una persona retirada ve «Tu acceso ya no está activo.».

### 3.5 Enlace de solo lectura (universidad)
- Un enlace único: `<SITE_URL>/#/ver/<token>`. La dueña lo activa, lo desactiva y lo **regenera** (el anterior deja de funcionar). Solo existe uno activo.
- Opciones (ambas en la tabla `settings`): «Incluir la Bitácora» (por defecto sí) y «Mostrar descripciones de las tareas» (por defecto no).
- La vista es de solo lectura: sin botones de edición, sin «Invitar» y sin «Apariencia» persistente en el servidor (la apariencia es local del navegador).
- **Ve todas las secciones**: Tablero, Calendario, **Bitácora** (por defecto sí, con sus horas y borradores) e Historial, y **el carné de la dueña** (en la columna de la Bitácora y en el panel «Perfil»), pero **no puede editar nada**: no hay «Invitar», «Nueva tarea», «＋» de columna, flechas de mover, arrastre, «Registrar actividad», ✎ de editar, «Completar detalles», «Descargar/Restaurar copia», «Editar perfil» ni «Cerrar sesión» (no tiene sesión), y los campos del detalle de una tarea quedan deshabilitados. La barra muestra «Solo lectura» en lugar del nombre y el rol, y el avatar abre el perfil de quien registra («Perfil»). Las únicas opciones del enlace son «Incluir la Bitácora» y «Mostrar descripciones de las tareas».
- **Carné en solo lectura (decisión del 22 de octubre de 2026):** quien mira **sí puede arrastrar y lanzar el carné** (es física, no edita nada; se toma desde la cinta, la anilla o la tarjeta) y **sí puede elegir el diseño** con «Ver diseños» (los cinco), **solo para sí**: la elección se guarda en el `localStorage` de su navegador (`bitacora.viewerBadgeDesign`), se mantiene al recargar y **no cambia** `profile.badgeDesign` de la dueña ni la vista de nadie más. Lo que **no** es suyo es el contenido: nombre, rol, foto y datos del carné son siempre los **actuales de la dueña** (consulta reactiva `viewer.profile`); cuando ella actualiza su perfil, el carné del enlace se redibuja, porque la caché de caras se invalida con `profile.updatedAt`.
- Muestra los nombres y roles de las personas, porque aparecen como responsables.

## 4. Funcionalidad

La maqueta define el aspecto y las interacciones. Esta sección define lo que la maqueta **no** resuelve.

### 4.1 Navegación y apariencia
- Barra superior, **sin barra lateral**. Izquierda: marca «Bitácora» (marca gráfica y palabra). Centro: pestañas **Tablero · Calendario · Bitácora · Historial**. Derecha: «Invitar», «Apariencia», nombre y rol, avatar.
- La pestaña **Bitácora** muestra una insignia con el número de borradores. Solo la ven la dueña y el enlace de solo lectura con la Bitácora incluida.
- El avatar abre el panel **«Mi perfil»** (sección 4.8), que contiene además «Cerrar sesión» y, para la dueña, «Acceso» (sección 4.7).
- **Móvil (≤ 640 px):** una primera fila con la marca, «Apariencia» y el avatar, y una segunda fila con las cuatro pestañas a ancho completo.
- Enrutado por **fragmento** (`#/tablero`, `#/calendario`, `#/bitacora`, `#/historial`, `#/invitacion/<token>`, `#/ver/<token>`). Así Netlify no necesita reglas de redirección.
- **Pantallas de entrada (sin sesión).** Ninguna muestra datos de la dueña. Todas respetan el estilo y el tema elegidos (o los del sistema si no hay preferencia guardada: Grafito oscuro). La maqueta las incluye con un selector «Pantallas de entrada (solo en la maqueta)» y el botón «Ver inicio de sesión»; «Cerrar sesión» de «Mi perfil» abre la primera:
  1. **Inicio de sesión:** sobretítulo «Seguimiento académico», título «Bitácora.» grande, «Tablero, calendario y bitácora de actividades en un solo lugar.», botón **«Entrar con Google»** (con la «G» de Google), la nota **«Para entrar necesitas una invitación.»** y «¿Te enviaron un enlace? Ábrelo directamente: no necesitas contraseña ni cuenta de Google.».
  2. **Invitación, paso 1** (`#/invitacion/<token>`): «Te invitaron.» + «Inicia sesión con Google para aceptar. Este enlace es de un solo uso.»; botón **«Continuar con Google»**; nota «Usamos tu cuenta solo para identificarte; nunca vemos tu contraseña.». **Paso 2:** «Hola, <nombre>.» + «Entraste como <correo>. Confirma cómo quieres aparecer en el tablero.»; campos *Tu nombre* (precargado con el de la cuenta) y *Tu rol* («Ej. Directora»), ambos de 2 a 60 con los mensajes «Escribe tu nombre (2 a 60 caracteres).» y «Escribe tu rol (2 a 60 caracteres).»; botón «Aceptar y entrar»; nota «Verás el tablero, el calendario y el historial, y podrás crear y editar tareas. La Bitácora y las horas son privadas.»; enlace «Usar otra cuenta».
  2b. **Cuenta sin invitación:** «Tu cuenta no tiene acceso» («Iniciaste sesión como <correo>, pero esa cuenta no tiene una invitación. Pide un enlace de invitación a quien administra la bitácora.») con «Entrar con otra cuenta».
  3. **Invitación inválida:** «Esta invitación ya no es válida» («Pudo usarse antes o caducar: duran 7 días. Pide a quien te invitó un enlace nuevo.») con «Ir al inicio».
  4. **Enlace de solo lectura inactivo:** «Este enlace ya no está activo» («La persona que lo compartió lo desactivó o lo reemplazó por uno nuevo.») con «Ir al inicio».
  5. **Acceso retirado** (con la aplicación abierta): «Tu acceso ya no está activo.» («Se retiró tu acceso a la Bitácora. Si crees que es un error, escribe a quien te invitó.») con «Ir al inicio».
  6. **Sin conexión:** «No se pudo abrir tu bitácora» («Revisa tu conexión a internet e inténtalo de nuevo.») con «Reintentar».
  Fondo con un resplandor suave del acento (sin `backdrop-filter`); en Papel los botones llevan esquinas casi rectas y en Tinta viva borde grueso y sombra dura.
- **Sin conexión con el servidor:** mensaje claro con botón «Reintentar» (como el actual «No se pudo abrir tu bitácora»). Las acciones usan actualización optimista; si fallan, se revierten y avisan.
- **Apariencia:** un menú con tres estilos y un interruptor Oscuro/Claro que vale para **los tres** (el menú muestra la nota «Los tres estilos tienen tema oscuro y tema claro»). La preferencia se guarda en `localStorage` (`bitacora.appearance`). Valor inicial: Grafito oscuro. Debe actualizar `<meta name="theme-color">`.

### 4.2 Tablero
- **Cabecera:** fecha de hoy, título «Tablero.» y cuatro indicadores: *Activas*, *Vencen esta semana* (no completadas con fecha límite en los próximos 7 días o ya vencidas), *Horas registradas* y *Por documentar* (estos dos solo con acceso a la Bitácora). Los números suben animados (CountUp).
- **Filtros:** chips por proyecto, búsqueda de texto (título y descripción, con índice de búsqueda de Convex), selector «Asignada a», selector de prioridad y atajo «Solo mías». Un filtro vacío significa «todos».
- **Crear una tarea:** botón «＋ Nueva tarea» (junto a la búsqueda) y un «＋» en la cabecera de cada columna, que abre el **panel contextual** (sección 4.3) con el estado de esa columna ya elegido. Solo hacen falta **dos datos**: el nombre y el proyecto; todo lo demás es opcional o trae un valor por defecto. El panel pide, en este orden:

  | Campo | Control | Obligatorio | Límite | Texto de ayuda | Valor inicial |
  |---|---|---|---|---|---|
  | Nombre de la tarea | texto | Sí | 200 | «Ej. Revisar cláusulas del convenio» | |
  | Descripción (opcional) | área de texto (3 filas) | No | 2000 | «¿Qué hay que hacer y qué se espera como resultado?» (y debajo: «Evita datos personales de terceros.») | |
  | Subtareas (opcional) | lista de filas, cada una con casilla de «hecha», texto y «×» para quitarla; «＋ Añadir otra» agrega filas | No | hasta 20 subtareas de 200 caracteres; las filas vacías se ignoran | «Tarea 1», «Tarea 2», «Tarea 3»… | 3 filas vacías |
  | Proyecto o área | texto con sugerencias (los mismos proyectos de la Bitácora) | Sí | 60 | «Escribe o elige un proyecto» | |
  | Responsable | lista: Sin asignar, y las personas con acceso (incluida la dueña) | No | una sola persona | | Sin asignar |
  | Fecha límite (opcional) | fecha | No | | | vacía |
  | Prioridad | tres opciones con su icono de barras: **Baja** (1 barra), **Media** (2), **Alta** (3) | Sí | | | Media |
  | Estado | lista: Por hacer, En curso, En revisión, Completada | Sí | | | el de la columna desde donde se abrió, o «Por hacer» |

  - La prioridad **se elige por su nombre** (Baja, Media o Alta), no escribiendo números. Internamente es 1, 2 o 3 y en la tarjeta se ve como las tres barras (con las que sobran atenuadas).
  - Mensajes de validación: «Escribe el nombre de la tarea.» y «Elige o escribe un proyecto.»
  - Al crear: la tarjeta aparece **arriba de su columna** con un pequeño rebote, se muestra «Tarea creada en «Por hacer»» y el historial anota «Tú añadiste «…» · Asignada a … · vence el …» (o «Sin responsable»). Si se crea directamente en Completada y el responsable es la dueña, se aplica la regla 1 de la sección 5.
  - Un proyecto que no existe se crea al escribirlo (con el siguiente color de la rotación).
  - **Subtareas:** son un recordatorio simple de los pasos de la tarea (texto y casilla de «hecha»). No tienen responsable ni fecha propios. **Completar todas las subtareas no completa la tarea** (la tarea se mueve a mano) y completar la tarea no marca las subtareas. En la tarjeta aparece una barra de progreso con «hechas/total».
- **Tarjeta:** punto y nombre del proyecto; a la derecha, el **✓ de completada** (solo en la columna Completada: un círculo con un chulito que entra con una pequeña animación al completar la tarea) y las barras de prioridad; título (máximo 3 líneas); si hay subtareas, una **barra de progreso** con «hechas/total»; avatar y nombre del responsable; fecha límite (en rojo «Vencida 20 oct» si ya pasó; el texto es corto a propósito para que quepa junto al nombre del responsable y la tarea no está completada); chip de horas en tareas completadas y documentadas, y etiqueta de borrador («Falta documentar en tu bitácora») si corresponde. Todo lo derivado de la Bitácora respeta la tabla 3.1.
- **Color por columna (Grafito):** cada tarjeta toma el color de su columna: gris para Por hacer, azul para En curso, violeta para En revisión y menta para Completada. **Sin tinte de fondo**: la tarjeta es neutra. El color de la columna aparece solo en un **borde casi imperceptible** (6 %), en una **luz suave** del mismo color (7 %) que sigue al cursor únicamente al pasar por encima, y en la **barra de progreso** y el **✓**, que son lo que realmente diferencia, junto con el puntito de color de la cabecera de la columna. La dueña pidió tres veces que fuera menos color: no debe dominar la tarjeta. Papel y Tinta viva no tienen color por columna (Tinta viva ya lo lleva en las cabeceras).
- **Mover:** arrastrar y soltar entre columnas **y** un menú «Mover a…» en cada tarjeta, **y** teclado (enfocar la tarjeta, Espacio para tomarla, flechas para cambiar de columna o de posición, Espacio para soltar, Esc para cancelar), con anuncios en una región `aria-live`. El arrastre debe funcionar con pantalla táctil. La maqueta usa arrastre nativo de HTML5, que **no** funciona en táctil: el constructor debe elegir una solución que sí (por ejemplo `@dnd-kit`).
- **Orden dentro de la columna:** campo `order` numérico con inserción fraccionaria, calculado en el servidor.
- **Columna Completada:** por defecto solo muestra las completadas en los últimos 30 días, con un botón «Mostrar anteriores» (decisión mía, para que el tablero no crezca sin límite).
- **Columna vacía:** texto «Suelta una tarjeta aquí».
- **Muchas tarjetas en una columna** (por ejemplo 13 o 30):
  - **Escritorio:** cada columna tiene una altura máxima (la altura de la ventana menos la cabecera, con un mínimo de 320 px) y **se desplaza por dentro, sin barra de desplazamiento visible**. En su lugar: (a) un **degradado suave** en el borde superior e inferior que crece y se encoge con el desplazamiento y avisa de que hay más; (b) las tarjetas que quedan fuera de la vista **se encogen y se desvanecen** (hacia arriba o hacia abajo) y **vuelven con un pequeño rebote** al entrar; (c) un ajuste suave a cada tarjeta (`scroll-snap` proximal), solo en las columnas del tablero; (d) las flechas ↑ ↓ mueven el foco entre tarjetas. **No hay ninguna barra de posición**, ni siquiera mientras se desplaza: la dueña pidió quitarla y el degradado basta para indicar que hay más contenido. La página no se alarga. El contador de la columna muestra el total real. Este comportamiento es el de **AnimatedList** de React Bits (barra oculta, degradados activados, animación «pop»); la maqueta lo imita en CSS y JavaScript y lo usa también en la línea de tiempo de la Bitácora. Con el arrastre activo, la columna debe desplazarse sola al acercar la tarjeta a su borde, y se puede soltar en cualquier columna aunque esté desplazada.
  - **Vista «Compacta»:** un interruptor junto a los filtros reduce cada tarjeta a una sola línea (barra de color del proyecto a la izquierda, título en una línea, avatar y fecha). Caben más del doble de tarjetas. La preferencia se guarda en el navegador (`localStorage`).
  - **Móvil (≤ 640 px):** las columnas van apiladas y no tienen desplazamiento interno; cada una muestra **5 tarjetas** y un botón «Mostrar N más» que expande y se vuelve «Mostrar menos».
  - La columna **Completada** además solo muestra los últimos 30 días, con «Mostrar anteriores» (ver arriba).
  - La búsqueda y los filtros se aplican antes de contar y de recortar.
  - **Alternativas de React Bits evaluadas y descartadas:** **ScrollStack** (las tarjetas se apilan unas sobre otras al desplazar; sin dependencias) esconde tarjetas detrás de otras, y un tablero se escanea de un vistazo; **GradualBlur** (desenfoque progresivo en los bordes; sin dependencias) no aporta más que el degradado ya incluido. **AnimatedList** trae su archivo de ejemplo con iconos de `@hugeicons/*`; el constructor debe quitarlos si no los usa y pasar su propia tarjeta (`renderItem`).

### 4.3 Detalle de la tarea
Al abrir una tarjeta se muestra un **panel contextual** (a la derecha, 440 px en escritorio; hoja a pantalla completa en móvil). No es una barra lateral de navegación.
- Es **el mismo formulario** que «Nueva tarea» (el título del panel cambia a «Detalle de la tarea»), con los campos de la sección 4.2 ya rellenos. Se abre al pulsar una tarjeta (o Enter con la tarjeta enfocada). La maqueta guarda con «Guardar cambios»; el constructor puede elegir entre ese botón y el guardado por campo con aviso «Guardado». En ambos casos la mutación modifica solo los campos que cambiaron (regla 8). Cambiar el estado desde aquí equivale a mover la tarjeta (reglas 1 a 4).
- Una tarea **sin responsable** muestra «Sin asignar» con un avatar punteado; una **sin fecha límite** muestra «Sin fecha» y no aparece en el calendario.
- **Subtareas:** bajo la descripción hay una sección «Subtareas (opcional)» con **3 filas vacías** de inicio («Tarea 1», «Tarea 2», «Tarea 3»). Cada fila tiene una casilla de «hecha», el texto y una «×» para quitarla; «＋ Añadir otra» agrega filas (máximo 20). Las filas vacías se ignoran al guardar. Marcar una casilla actualiza la barra de progreso de la tarjeta.
- Los botones «Guardar cambios» (o «Crear tarea»), «Cancelar» y «Eliminar tarea» quedan **fijos en el borde inferior** del panel mientras el contenido se desplaza. La barra de desplazamiento del panel solo aparece al pasar el cursor. El fondo detrás del panel se difumina ligeramente.
- Muestra los eventos del historial de esa tarea.
- «Eliminar tarea» (solo la dueña), con un cuadro de confirmación como el que ya usa la Bitácora.
- El enlace de solo lectura ve el panel sin controles de edición, y con la descripción solo si esa opción está activa.

### 4.4 Calendario
- Cuadrícula mensual que **empieza en lunes**, con navegación de mes anterior y siguiente, y un panel «Próximos vencimientos» (las 6 próximas no completadas, incluidas las vencidas).
- Cada día muestra hasta 2 tareas por su fecha límite y «+n más» (abre la lista del día), más la insignia de **horas documentadas** de ese día cuando el usuario puede verlas (suma de las entradas completas de la Bitácora con esa fecha).
- Hoy se marca según el estilo (aro rojo dibujado a mano en Papel, borde luminoso en Grafito, relleno limón en Tinta viva).
- Tocar una tarea abre el detalle. Tocar un día vacío (personas con permiso de edición) abre «Nueva tarea» con esa fecha. Las tareas **sin fecha límite** no aparecen en el calendario (solo en el tablero).
- **Móvil:** la maqueta oculta el texto de las tareas por falta de espacio. El constructor debe mostrar un punto de color por tarea en la cuadrícula y la lista de tareas del día seleccionado debajo.

### 4.5 Bitácora
Solo la dueña escribe. El enlace de solo lectura la ve si la opción está activa. Se conservan **todas** las funciones y **todos los campos** actuales. La fuente de verdad de los campos es el sitio publicado (`https://bitacora-becario-uniajc.netlify.app/`, verificado el 21 de octubre de 2026: `app.js` y `styles.css` son idénticos a los del repositorio y `index.html` solo difiere en un comentario y un script que inyecta Netlify). **Los campos del formulario —etiquetas, orden, límites, obligatorios, textos de ayuda y valores iniciales— se conservan tal cual** (ver la tabla «Campos del formulario»). **La presentación sí se rediseña**, por indicación de la dueña: el aspecto de la app actual es un punto de partida, no una restricción. Lo marcado como «se retira» o «se reemplaza» también cambia.
- **Cabecera de la vista:** sobretítulo «SEGUIMIENTO ACADÉMICO», título «Bitácora.» y la línea «Institución Universitaria Antonio José Camacho» (decisión mía: el nombre de la institución se conserva aquí y en el pie del enlace de solo lectura). El `<title>` del documento sigue siendo «Mi bitácora de actividades».
- **Carné a la derecha (escritorio ≥ 1101 px):** la vista se organiza en dos columnas (contenido y una columna de 340 px con el carné 3D colgando desde la barra superior). Detalle en la sección 4.8.
- **Resumen** (los tres actuales más uno nuevo): *Actividades* (registros completos), *Horas registradas* (suma de los completos), *Completadas* (registros completos con estado «Completada») y **nuevo** *Por documentar* (borradores).
- **Barra de herramientas:** búsqueda («Buscar actividades o resultados»), filtros «Todas las áreas» y «Todos los estados», el chip «Solo borradores» y el botón principal «＋ Registrar actividad». Debajo, el contador «N registros».
- **Registrar, editar y completar un borrador** ocurren en el **mismo panel lateral** que usan las tareas (440 px; pantalla completa en móvil), con **los campos de la tabla «Campos del formulario»**, que no cambian. Orden: fecha, horas, proyecto, título de la actividad, objetivo, desarrollo, resultado, observaciones, estado y evidencias. El título del panel es «Nuevo registro», «Editar registro» o «Completar detalles» (con la etiqueta «Completa los detalles de esta tarea» arriba cuando es un borrador). Los botones (el principal, «Cancelar» y, al editar, «Eliminar actividad» con confirmación) quedan fijos abajo. Ya no existe el formulario plegable dentro de la página.
- Evidencias: hasta **4 imágenes** por registro, de hasta 5 MB, comprimidas en el navegador (lado mayor 1400 px, JPEG, máximo 1,2 MB) con una **miniatura** de 480 px que se usa en las listas; hasta **12 enlaces** (solo `http` o `https`); visor ampliado.
- **Línea de tiempo de tarjetas** (vertical, con un punto de color por estado: menta Completada, ámbar En progreso o borrador, violeta Pendiente de revisión). Cada tarjeta muestra: fecha con día de la semana en minúscula («viernes, 16 de octubre de 2026»), proyecto, etiqueta de estado y «N hora(s)» (o «— horas» en un borrador); el título de la **Actividad**; y, plegada, una **vista previa del Resultado** (2 líneas). El botón **«Ver detalle»** despliega con animación todos los campos con etiqueta y en este orden: **Objetivo**, **Desarrollo**, **Resultado**, **Observaciones** (solo los que tengan texto), las evidencias (miniaturas de imágenes que se amplían al pulsarlas y enlaces «↗ nombre») y «Última actualización: 18 oct 2026, 09:32 a. m.». El botón pasa a «Ocultar detalle». Un ícono ✎ (al pasar el cursor; siempre visible en táctil) abre el panel de edición.
- Orden: fecha descendente y, dentro del mismo día, orden manual y luego última actualización. Estados vacíos actuales: «Todavía no hay actividades» y «No hay resultados» («Prueba otra búsqueda o cambia los filtros.»).
- **Con muchas actividades la línea de tiempo usa el mismo scroll animado del tablero** (sección 4.2): altura máxima, sin barra visible, degradado en los bordes, tarjetas que se desvanecen y regresan con rebote, y flechas de teclado, **sin barra de posición** y **sin ajuste automático a cada tarjeta** (las tarjetas altas que se despliegan con «Ver detalle» harían saltar el desplazamiento). **En móvil no hay scroll interno**: se usa el desplazamiento de la página y solo se conserva la animación de aparición.
- Acciones **solo para la dueña** (hoy requieren el PIN): editar ✎ (abre el panel en «Editar registro», con «Guardar cambios» y «Cancelar»), «Eliminar actividad» dentro del panel con el cuadro «¿Eliminar esta actividad?» («Esta acción es permanente y también eliminará sus evidencias.»), y subir o bajar ↑↓ dentro del mismo día (desactivado con filtros activos: «Quita los filtros para reordenar»; la maqueta no incluye estas flechas).
- **Se retira:** el PIN, el botón «Administrar», el enlace «Ver hoja» y el aviso de privacidad actual. **Se reemplaza:** el selector de tema Oscuro/Claro por «Apariencia» (sección 4.1). **Se mantiene** en el pie de la vista, solo para la dueña: «Descargar copia» y «Restaurar copia».
- «Descargar copia» y «Restaurar copia» (JSON). Se acepta el formato actual (`bitacora-iterativa`, versión 1) y el nuevo (versión 2, con `taskId` y `docStatus`).
- **Borrador** (nace al completar una tarea propia, ver la sección 5):
  - Tarjeta ámbar con la etiqueta «Completa los detalles de esta tarea», horas «— horas», el aviso de que las horas no suman todavía y el botón «Completar detalles».
  - Trae precargados: título de la tarea como actividad, proyecto y fecha de finalización. Si la tarea tiene descripción, se copia como **objetivo** editable.
  - «Completar detalles» abre el **mismo panel** de «Registrar actividad» con los campos precargados (actividad, proyecto, fecha, y el objetivo si la tarea tenía descripción) y las **Horas trabajadas** vacías. Los obligatorios son **Horas trabajadas** y **Resultado obtenido**. El estado inicial es «Completada».
  - **Validación de horas** idéntica a la actual (mismo mensaje): «Completa los campos. Las horas deben estar entre 0,25 y 24, en incrementos de 0,25.» Se acepta la coma decimal.
  - Al guardar, el registro pasa a `complete` y recién entonces suma a los indicadores. Aviso: «Cambios guardados.»

#### Campos del formulario «Registrar actividad» (tal como están hoy)

| Campo | Control | Obligatorio | Límite | Texto de ayuda | Valor inicial |
|---|---|---|---|---|---|
| Fecha | fecha | Sí | | | hoy |
| Horas trabajadas | texto decimal (acepta coma) | Sí | 5 caracteres; de 0,25 a 24 en pasos de 0,25 | «Ej. 0,5» | `2` |
| Proyecto o área | texto con sugerencias | Sí | 100 | «Escribe o elige un proyecto» | |
| Título de la actividad | área de texto (2 filas) | Sí | 1500 | «Ej. Revisión inicial de la plataforma y sus funcionalidades» | |
| Objetivo | área de texto (2 filas) | No | 1500 | «¿Qué se buscaba lograr con esta actividad?» | |
| Desarrollo | área de texto (3 filas) | No | 1500 | «Describe el proceso, las tareas y los pasos realizados.» | |
| Resultado obtenido | área de texto (3 filas) | Sí | 1500 | «Ej. Identifiqué los documentos pendientes y dejé las dudas para revisión.» | |
| Observaciones | área de texto (2 filas) | No | 1500 | «Anota hallazgos, pendientes o comentarios relevantes.» | |
| Estado | opciones: Completada, En progreso, Pendiente de revisión | Sí | | | Completada |
| Evidencias: imágenes | botón «＋ Añadir imágenes» (varias) | No | máximo 4 por registro, 5 MB cada una; se comprimen al cargarlas | «Máximo 4 imágenes por registro. Se optimizan al cargarlas.» | |
| Evidencias: enlace | «Nombre del enlace» (80) + «Dirección web» + botón «Añadir enlace» | No | solo `http` o `https`; hasta 12 | «Nombre del enlace», «https://...» | |

- Si el nombre del enlace queda vacío se usa el dominio de la dirección. Un enlace escrito pero no añadido se añade al guardar. Mensajes: «Completa la dirección web del enlace.», «Usa un enlace que comience con http:// o https://.»
- Sugerencias de **Proyecto o área** (lista inicial, que pasa a la tabla `projects`): iMujer, Análisis Jurídico, Landing Jurídica, SECOP II, CALIFRESCA, Portal web y Otro, más los que ya existan en los registros (hoy «Reunión becario AthenIA / Inducción»).
- Botón de envío «＋ Agregar a la bitácora». Avisos al guardar: «Actividad agregada a tu bitácora.», «Cambios guardados.», «Registro eliminado.», «Orden del día guardado.»
- Mensajes de imágenes: «Se omitió un archivo que no es una imagen.», «<nombre> supera el límite de 5 MB.», «Puedes adjuntar hasta 4 imágenes por registro.»
- Un registro creado desde este formulario nace **completo** (no es borrador). Un borrador solo nace al completar una tarea propia.
- El estado del registro (Completada, En progreso, Pendiente de revisión) es **independiente** de la columna de la tarea; son dos conceptos distintos y ambos se conservan.

### 4.6 Historial
- Lista cronológica, del más reciente al más antiguo, con etiquetas «Hoy · 09:42», «Ayer · 17:30», «19 oct · 16:20». Cada evento muestra el icono del tipo, la persona, el verbo, el sujeto y un detalle. Para la persona que mira, sus propios eventos se redactan en segunda persona («Tú moviste…», «Tú completaste…»). En el enlace de solo lectura siempre aparece el nombre.
- Carga de 50 en 50 («Cargar más»). Filtro por persona.
- **Inmutable:** no existe ninguna operación para editar o borrar eventos.
- Eventos registrados: `task.created`, `task.edited`, `task.moved`, `task.completed`, `task.deleted`, `project.created`, `invite.created`, `member.joined`, `member.updated`, `member.revoked`, `share.changed`, `journal.draft_created`, `journal.documented`, `journal.edited`, `journal.deleted`. Los de edición de tarea guardan qué campos cambiaron y, para estado, responsable, fecha y prioridad, el valor anterior y el nuevo.
- **Visibilidad:** cada evento tiene `visibility: "team"` o `"owner"`. Los eventos `journal.*` son `owner` (los ve la dueña y el enlace de solo lectura si incluye la Bitácora). Al completar una tarea propia se guardan **dos** eventos: `task.completed` (equipo) y `journal.draft_created` (dueña).

### 4.7 Panel «Acceso»
Un panel contextual abierto desde «Invitar» o desde el menú del avatar.
- **Invitar a alguien:** genera el enlace y lo muestra una vez con un botón «Copiar». Debajo, las invitaciones pendientes de la persona con su caducidad y la opción de revocarlas.
- **Solo la dueña:** lista de personas (nombre, rol, **correo de su cuenta de Google**, quién la invitó, fecha de ingreso y última actividad) con «Retirar acceso», y la sección «Enlace de solo lectura» (activar o desactivar, copiar, regenerar, y las dos casillas de la sección 3.5).
- Una persona invitada solo ve «Invitar a alguien», sus propias invitaciones pendientes y «Cerrar sesión».

### 4.8 Perfil y carné
El carné es el componente `Lanyard` de React Bits: una cinta con el carné que cuelga, se arrastra, se lanza y se gira al pulsarlo. Es **el carné de AthenIA** (grupo de investigación de la dueña) y aparece en **dos lugares**. En ambos, la cinta nace en el **borde superior** de su zona y nunca se ve cortada a media altura:
- **Panel «Mi perfil»**, que abre el avatar de la barra superior (misma mecánica que los demás paneles). El carné ocupa la parte superior del panel, desde el borde de la pantalla; el título y la × quedan encima de la cinta. Debajo: «Arrástralo, lánzalo o púlsalo para girarlo.», los datos como texto (nombre, rol, programa, institución, grupo) y los botones **«Editar perfil»** y **«Cerrar sesión»**. Para la dueña, «Acceso» (sección 4.7) también se abre desde aquí.
- **Vista Bitácora (escritorio ≥ 1101 px):** una columna fija de 340 px a la derecha, pegajosa (`position: sticky`). **No lleva ningún texto debajo** (ni ayuda ni «Editar perfil»: eso vive en «Mi perfil»). La cinta nace en el borde superior de la aplicación y pasa **por encima de la barra superior** (la barra mide su alto y publica `--nav-h`): el lienzo 3D no recibe clics y solo la zona situada por debajo de la barra (`position: absolute; top: calc(var(--nav-h) + 10px)`) reenvía el puntero al lienzo (`canvas.dispatchEvent(new PointerEvent(e.type, e))`; con la captura de puntero del propio componente el arrastre sigue funcionando). Así los botones de la barra siguen siendo pulsables. La cinta es más delgada (`strapWidth: 0.5`) y la barra **abre un hueco de 34 px entre «Invitar» y «Apariencia»** (solo en esta vista) por el que pasa, sin tapar ningún botón; el lienzo ocupa **desde el borde izquierdo de la aplicación** (anclaje derecho = 73 % de su ancho, calculado para que caiga en el centro del hueco) para que el carné **no se corte al arrastrarlo ni al balancearse**, y lleva una sombra suave (`drop-shadow`) que lo asienta en la página. Cuando el menú «Apariencia» está abierto, la barra sube de capa (`z-index: 7`) y el menú queda **por encima** del carné. El resto de la vista (cabecera, herramientas, línea de tiempo) ocupa la columna izquierda y el resumen pasa debajo del título si no cabe. **La columna acompaña al desplazamiento** (`position: sticky; top: 0`): ningún ancestro entre ella y la ventana puede tener `overflow: hidden` ni `auto` (se recorta con `overflow: clip`), o el carné se queda atrás y se corta al bajar. **En menos de 1101 px la columna no existe** (el carné sigue en «Mi perfil»). Solo hay un carné 3D montado a la vez: al abrir «Mi perfil» el de la Bitácora se desmonta y vuelve al cerrarlo.
- **De quién es:** cada persona con sesión ve el **suyo**. El enlace de solo lectura ve el de la dueña (quien registra), también en su vista de la Bitácora si está incluida.
- **Diseños para elegir.** La maqueta trae **cinco diseños** del carné (botón «Ver diseños» en «Mi perfil»: galería con frente y reverso de cada uno; «Usar este diseño» lo aplica y lo recuerda). Todos son de AthenIA, no dicen «Bitácora» ni el año en el frente (salvo el de otras personas sin grupo) y llevan «Becario de AthenIA»:
  1. **Olimpo** (predeterminado; la dueña pidió «más lenguaje de programación»): **editor de código**. Letra de programación (JetBrains Mono 800), barra de ventana con tres puntos y la pestaña «athenia.ts», el logotipo y «Athen**IA**▌» con cursor de terminal, `// grupo de investigación en IA`, retrato en un **cuadrado redondeado** con un contorno fino (la dueña descartó el arco, el marco achaflanado y las líneas de circuito alrededor), la etiqueta como elemento JSX `<Becario de="AthenIA" />` (etiqueta en azul, atributo en el color del texto, cadena en verde) y un **panel de código** con `const programa = "…";`, `const semestre = "…";` y la institución como comentario, con números de línea y la sintaxis resaltada. Reverso azul profundo con un esqueleto de código de fondo, el logotipo, «Athen**IA**▌» y `export default AthenIA;`.
  2. **Circuito**: placa electrónica de fondo, retrato cuadrado con marco de visor, datos en columna tipo terminal (`> PROGRAMA`, `> ESTADO`), nombre en Space Grotesk con el apellido en azul y código de barras decorativo. **Es dinámico con el 3D:** el punto de «● ACTIVO» late con un halo, calculado en la GPU (ver «Animaciones del carné»). La franja de escaneo del retrato se probó y la dueña pidió quitarla: **no** hay escaneo.
  3. **Póster**: bloque azul de marca, «IA» gigante de fondo, nombre en la condensada **Anton**, retrato circular con aro y rótulo vertical «UNIAJC · CALI»; reverso claro con «ATHENIA» enorme.
  4. **Suizo** (a la dueña le gustó; solo pidió **alejar la foto**): retícula limpia y filetes finos; el **retrato mide 440 px** (no el ancho completo) con *Programa*, *Semestre* y *Rol* a su derecha, nombre grande, etiqueta con cuadrito y filas *Institución* y *Grupo* con filetes; acabado mate. La foto por defecto muestra cabeza y hombros (no un primer plano).
  5. **Clásico**: la **primera versión** del carné, que se «personaliza» porque sigue el **color de acento y la letra del estilo activo** (Grafito, Papel o Tinta viva): rótulo «ATHENIA», retrato cuadrado de 400 px con el rol («Becario de AthenIA», en el acento), el programa y el semestre a su derecha, el nombre grande pegado debajo, y la institución y el grupo al pie (sin huecos: la dueña notó un espacio entre la foto y el nombre); el **reverso lleva el logotipo y el nombre de AthenIA** sobre el color de acento (texto oscuro o blanco según su luminancia relativa: umbral 0,179). Sustituyó a «Holo», que la dueña descartó.
  Cada diseño es una función `draw(env, front, back, strap)` registrada en `DESIGNS` que puede devolver `{ fx }`; los **cinco** están disponibles para elegir (la dueña pidió poder elegir entre todos) y la elección se guarda en `profile.badgeDesign`.
- **Animaciones del carné (diseño Circuito) sin repintar texturas.** El único movimiento propio de la cara es el halo que late alrededor del punto de «ACTIVO». Se calcula en un **shader de la GPU**: la copia del componente `Lanyard` se parchea con una propiedad `fx` (`{ size, dot: [x, y, radio], dotColor }` en píxeles del lienzo de 1024 × 1440) que añade uniformes (`fxTime`, `fxOn`, `fxSize`, `fxDot`, `fxDotColor`) al material del frente y suma el halo a `outgoingLight` antes de `opaque_fragment`. **No** se vuelve a pintar ni a subir la textura en cada cuadro (una primera versión lo hacía a 20 cuadros por segundo y causaba picos). Con `prefers-reduced-motion`, en la galería y en la imagen plana de respaldo no hay animación (se ve el punto fijo).
- **Tipografía propia del carné** (independiente de la del estilo de la aplicación, salvo en Clásico, que usa la del estilo activo): JetBrains Mono (Olimpo y etiquetas), Space Grotesk (Circuito), Anton (Póster) e Inter (Suizo). El lienzo espera a `document.fonts.load` de cada una antes de dibujar. Se autoalojan con `@fontsource` (la aplicación ya trae Inter, JetBrains Mono y Space Grotesk; solo se añade Anton) y los pesos 700 y 800 de JetBrains Mono se cargan con el trozo del carné.
- **Nitidez y rendimiento del 3D.** Las caras se dibujan al **doble de resolución** (2048 × 2880 px; el componente usa `FACE_WIDTH = 2048`) y se entregan como JPEG (calidad 0,95; la galería usa 1×). La resolución del lienzo WebGL es **adaptativa**: `setPixelRatio(min(3, max(1, min(max(2, devicePixelRatio), √(2,4·10⁶ / (ancho · alto)))))`, es decir, 2× en lienzos pequeños (panel) y menos en el lienzo ancho de la Bitácora, con un tope de ≈ 2,4 megapíxeles por cuadro. Cuando el carné está quieto (sin puntero encima ni arrastre, pasados 2,5 s) el bucle baja a **30 cuadros por segundo**; con el puntero sube a la frecuencia de la pantalla. Las etiquetas más pequeñas miden al menos 22 px sobre el lienzo de 1024 px. No se usa ningún filtro CSS (`drop-shadow`) sobre el lienzo.
- **Colores.** Fondo del frente, texto y tipografías salen del estilo y el tema activos (se leen de las variables CSS al dibujar y se vuelven a leer al cambiar de estilo o de tema). El **azul de marca** es fijo por tema: `#6aa5ff` en oscuro y `#0f4aa8` en claro (texto sobre él: `#071533` y `#ffffff`). El carné se dibuja en un `canvas` y se entrega al componente como imágenes `data:`.
- **Logotipo de AthenIA.** La dueña entregó el PNG del grupo (fondo transparente, pero con la cara y el casco en blanco opaco y el azul oscuro, por lo que sobre fondos oscuros no se ve). Se convierte **una sola vez** en una **máscara de una tinta**: el azul oscuro queda opaco, el blanco transparente y el azul claro parcial (`alfa = clamp((0,88 − luminancia) / 0,5, 0, 1) × alfa original`), recortada a su caja (551 × 413 px, ≈ 31 KB, archivo `athenia-mark.png` junto a la maqueta). El carné la tiñe con el azul de marca en el frente y de blanco en el reverso. Solo aparece si el campo *Grupo* de la dueña contiene «AthenIA» (sin distinguir mayúsculas).
- **Editar perfil.** «Editar perfil» cambia el panel a un formulario: **foto** con encuadre (cuadrado de 220 px con arrastre y teclado —flechas— para moverla, control «Acercar» de 1× a 3×, «＋ Subir foto» y «Quitar foto»), *Nombre* (2 a 60), *Rol* (2 a 60), *Semestre* (máx. 30, opcional), *Programa* (máx. 80, opcional), *Institución* (máx. 100, opcional) y *Grupo de investigación* (máx. 60, opcional). Mensajes: «Escribe tu nombre (2 a 60 caracteres).», «Escribe tu rol (2 a 60 caracteres).», «Se omitió un archivo que no es una imagen.», «<nombre> supera el límite de 5 MB.», «No se pudo leer esa imagen. Prueba con un JPG o un PNG.», aviso «Perfil actualizado.». **Cualquier persona** edita su propio *Nombre* y *Rol*; **solo la dueña** edita la foto, el semestre, el programa, la institución y el grupo. Los eventos del historial anteriores conservan el nombre y el rol de ese momento.
- **Foto.** Solo la dueña. Se acepta cualquier imagen del navegador (hasta 5 MB); se recorta con el encuadre elegido a **1024 × 1024 px, JPEG** (calidad 0,92 y, si pasa de **400 KB**, 0,86, 0,8, 0,72 y 0,62) y se guarda como cadena `data:` en la tabla `profile` (evita permisos entre dominios al dibujarla en el `canvas`). Al abrir una foto de retrato se parte con el encuadre desplazado hacia arriba (20 %) para que entre la cara. Sin foto se usa el monograma. El enlace de solo lectura la muestra si existe.
- **Mejora de imagen** (casilla con **solo** el texto «Mejorar imagen», sin descripción; activa por defecto; se marca y desmarca como cualquier casilla y **recuerda su último valor**: si se desmarca, la foto se guarda sin realce). Al guardar la foto se aplica una **máscara de enfoque** (suma `(v − desenfoque fino de 1,6 px) × 0,35 + (v − desenfoque ancho de 14 px) × 0,08`, ambos radios proporcionales al ancho, **acotada a ±18 niveles** para que no se vean halos ni se note artificial —la primera versión usaba 0,9 y 0,22 y se veía demasiado procesada—, e ignorando una franja de 24 px en el borde) sobre el lienzo de 1024 px, con suavizado de alta calidad al escalar. **No inventa detalle:** evita perder el que hay al reducir y al acercar; no es un aumento con inteligencia artificial (eso, por ejemplo con un modelo de superresolución en el navegador, queda fuera de la primera versión).
- **Datos de la dueña.** Salen de su hoja de vida: nombre, programa, semestre, institución y grupo. **Nunca** se usan teléfono, correo, documento ni referencias.
- **Carga diferida:** el 3D (`three`, ≈ 160 KB comprimido) **no** entra en el paquete principal. Se descarga al abrir «Mi perfil» o la Bitácora en escritorio ancho por primera vez y se destruye al cerrar el panel o salir de la Bitácora (libera el contexto WebGL).
- **El carné nunca se corta al arrastrarlo** a la izquierda o a la derecha (también en solo lectura): el lienzo cubre desde el borde izquierdo de la aplicación hasta el derecho y el componente parchado limita el alcance horizontal del carné al lienzo (propiedad `bounds`: los nodos de la cuerda y el carné no pueden salir de la ventana de dibujo), de modo que ninguna parte queda recortada por una línea vertical.
- **Respaldo:** sin WebGL, con `prefers-reduced-motion` o si el paquete 3D falla, se muestra la imagen plana de la cara frontal. El texto real siempre está disponible y cada contenedor lleva `role="img"` y una etiqueta con el nombre, el rol y el programa.

## 5. Reglas de negocio

1. **Borrador único e idempotente.** Existe a lo sumo **un** registro de Bitácora vinculado a cada tarea (`journalEntries.taskId`). Se crea un borrador cuando ocurre una **transición**: la tarea pasa a Completada, o se reasigna a la dueña mientras ya está Completada, y en ambos casos el responsable es la dueña y no existe un registro vinculado. Se ejecuta **dentro de la misma mutación** que el cambio de la tarea. Como las mutaciones de Convex son transaccionales y serializables, no hay borradores duplicados ni tareas completadas sin su borrador.
2. **Quién genera borrador.** Solo las tareas cuyo responsable es la dueña. No importa quién mueva la tarjeta. Completar una tarea de otra persona o sin responsable no crea nada.
3. **Horas.** Un borrador tiene `hours = null`. Nunca se calculan, estiman ni se rellenan. Solo los registros `complete` suman a los indicadores, al calendario y a las tarjetas.
4. **Reabrir.** Mover una tarea fuera de Completada conserva el registro y su vínculo. Al volver a completarla no se crea otro ni se pisan los detalles ya escritos. Si la dueña quiere otro registro, lo crea manualmente (decisión mía).
5. **Eliminar una tarea** (solo la dueña): los registros de Bitácora vinculados **se conservan**. Se les borra `taskId`, se guarda `taskTitleSnapshot` y se muestra una nota discreta «Tarea eliminada». Se registra el evento `task.deleted`.
6. **Eliminar un registro de Bitácora** (solo la dueña) no recrea el borrador. Solo se vuelve a crear en una nueva transición (regla 1).
7. **Fechas.** Las fechas son cadenas `AAAA-MM-DD` en la zona `America/Bogota`. Las marcas de tiempo son milisegundos UTC. «Vencida» significa fecha límite anterior a hoy y estado distinto de Completada.
8. **Concurrencia.** Las mutaciones modifican solo los campos que cambian. Si dos personas editan campos distintos de una tarea, ambos cambios sobreviven. Mover una tarjeta calcula el `order` en el servidor.
9. **Límites.** Título 200, descripción 2000, nombre de proyecto 60, campos de la Bitácora 1500, 4 imágenes, 12 enlaces, 10 invitaciones pendientes por persona.
10. **Texto.** Todo texto de personas se muestra como texto plano (React lo escapa). Los enlaces aceptan solo `http` y `https`.
11. **Posición de una tarea nueva.** Entra **arriba** de su columna (decisión mía: lo recién asignado es lo que más conviene ver).
12. **Persona retirada.** Sus tareas conservan el responsable. La interfaz muestra su nombre con la nota «sin acceso» y cualquier persona con permiso de edición puede reasignarlas. Los eventos del historial conservan el nombre y el rol que tenía en ese momento.
13. **Quién puede ser responsable.** Cualquier persona con acceso vigente, incluida la dueña.
14. **Subtareas.** Máximo 20 por tarea, 200 caracteres cada una, solo texto y estado «hecha». Completar todas no completa la tarea y completar la tarea no las marca (decisión mía). Cambiarlas cuenta como una edición de la tarea (`task.edited`, campo «subtareas»); no generan eventos propios.

## 6. Datos (tablas de Convex)

Todas las tablas llevan los campos de sistema de Convex (`_id`, `_creationTime`). Esquema orientativo; los nombres exactos los fija el constructor.

| Tabla | Campos | Índices |
|---|---|---|
| `members` | `name`, `roleLabel`, `isOwner`, `userId` (cuenta de Convex Auth), `email` (solo se entrega a la dueña), `invitedBy?`, `createdAt`, `lastSeenAt`, `revokedAt?` | por `userId`, por correo |
| `invites` | `tokenHash`, `createdBy`, `createdAt`, `expiresAt`, `usedBy?`, `usedAt?`, `revokedAt?` | por hash, por creador |
| `settings` (una fila) | `shareToken?`, `shareEnabled`, `shareIncludesJournal`, `shareShowsDescriptions`, `timezone` | |
| `profile` (una fila, la de la dueña) | `program?` (80), `term?` (30), `institution?` (100), `group?` (60), `badgeDesign?` (`olimpo` por defecto), `photoDataUrl?` (cadena `data:image/jpeg`, máx. 400 KB), `updatedAt` | |
| `projects` | `name`, `nameLower`, `colorSlot` (1 a 6, asignado en rotación) | por `nameLower` |
| `tasks` | `title`, `description?`, `projectId`, `assigneeId?`, `dueDate?`, `priority` (1 a 3), `status` (`todo` `doing` `review` `done`), `order`, `createdBy`, `createdAt`, `updatedAt`, `completedAt?`, `subtasks[]` (cada una con `id`, `text` y `done`; máximo 20), `searchText` (título y descripción concatenados, porque un índice de búsqueda de Convex cubre un solo campo) | por estado y orden, por responsable, por fecha límite, índice de búsqueda sobre `searchText` |
| `journalEntries` | `taskId?`, `taskTitleSnapshot?`, `date`, `projectId`, `activity`, `objective?`, `development?`, `result?`, `observations?`, `hours?`, `docStatus` (`draft` `complete`), `activityStatus`, `links[]`, `photos[]` (`storageId`, `thumbStorageId`, `name`, o `url` heredada), `dayOrder`, `legacyId?`, `createdAt`, `updatedAt` | por fecha, por tarea, por `legacyId` |
| `events` | `at`, `actorId`, `actorName`, `actorRole` (copias del momento), `type`, `subjectKind`, `subjectId?`, `subjectTitle?`, `detail?` (objeto), `visibility` | por fecha, por visibilidad y fecha |

El colorido de cada proyecto lo comparten tablero, calendario y Bitácora.

## 7. Interfaz del servidor (contratos)

Cada función empieza identificando a quien llama y rechaza sin datos si falla. **No existe ninguna función que devuelva datos sin una sesión válida, la identidad de la dueña o un token de solo lectura válido.**

- `getActor(ctx)` → `{ memberId, isOwner }`. Identifica a la persona por su cuenta de Google (Convex Auth): la dueña por `OWNER_EMAIL` y las demás por su registro vigente en `members` (`userId`). `requireMember`, `requireOwner` y `requireViewer(shareToken)` se construyen encima.
- **Consultas:** `tasks.list(filtros)`, `tasks.get`, `calendar.month(año, mes)`, `journal.list` y `journal.summary` (dueña), `events.list(cursor)`, `members.list` (dueña), `invites.mine`, `settings.get` (dueña), `profile.get` (cualquier persona con sesión: devuelve su carné, con los datos de la dueña solo si quien llama es la dueña), `viewer.board`, `viewer.calendar`, `viewer.journal`, `viewer.events`, `viewer.profile` (con `shareToken`: solo el carné de la dueña).
- **Mutaciones:** `tasks.create`, `tasks.update`, `tasks.move(id, estado, antesDe?)`, `tasks.remove` (dueña), `projects.create`, `invites.create`, `invites.revoke`, `invites.redeem(token, nombre, rol)` (**requiere sesión de Google**; sin ella lanza `UNAUTHENTICATED`; no devuelve ningún token), `members.revoke` (dueña), `members.touch`, `journal.createManual`, `journal.update`, `journal.remove`, `journal.reorder`, `journal.documentDraft` (dueña), `settings.share*` (dueña), `profile.update` (dueña; valida longitudes y que la foto sea `data:image/jpeg` de máx. 150 KB), `members.updateSelf(nombre, rol)` (cualquier persona con sesión; 2 a 60 caracteres cada uno; escribe el evento `member.updated`).
- **Subida de archivos:** `files.generateUploadUrl` (dueña).
- Las respuestas se construyen **por audiencia**: un objeto de datos distinto para dueña, persona invitada y enlace de solo lectura, que omite lo que esa audiencia no puede ver (horas, borradores, descripciones, eventos `owner`).
- Toda mutación de tablero o de acceso escribe su evento **en la misma transacción**.

## 8. Seguridad y privacidad

| Riesgo | Mitigación |
|---|---|
| Enlace de invitación filtrado | Un solo uso, caducidad de 7 días, token de 256 bits guardado como hash, va en el fragmento de la URL, revocable por la dueña, y **exige iniciar sesión con Google**: la dueña ve el correo de quien entró y puede retirarlo al instante. |
| Robo de sesión | La sesión es la de Google gestionada por Convex Auth; el acceso se revoca en `members` y surte efecto de inmediato; CSP estricta; React escapa el texto; sin `dangerouslySetInnerHTML`; enlaces solo `http` o `https`; no escribir tokens ni argumentos de funciones en los registros del servidor. |
| Acceso a datos ajenos | Cada función valida actor y permisos en el servidor. Los datos se arman por audiencia. Pruebas automáticas de la matriz de permisos. |
| Enlace de solo lectura público | Una sola URL activa, desactivable y regenerable; descripciones ocultas por defecto; la Bitácora se puede excluir. |
| Imágenes de evidencias | Las URL del almacenamiento de Convex no son adivinables y solo se entregan a quien puede ver la Bitácora. Las fotos actuales de Drive son públicas por enlace; se migran y luego la dueña retira ese acceso público (sección 11). |
| Datos jurídicos o personales | Nota en el formulario de tareas; el enlace de solo lectura oculta las descripciones por defecto. |
| Datos personales en el carné | Solo nombre, rol, programa, semestre, institución y foto opcional. Nunca teléfono, correo, documento ni referencias de la hoja de vida. `profile.get` y `viewer.profile` devuelven únicamente esos campos; el correo de la dueña nunca sale del servidor. |
| Credenciales en el navegador | Ninguna clave secreta en JavaScript del cliente. Los secretos (cliente de Google, claves de despliegue) viven en variables de entorno de Convex y Netlify. |
| Pérdida de datos | «Descargar copia» (JSON) para la dueña; la hoja de Google actual se conserva como respaldo tras la migración. |
| Indexación por buscadores | `<meta name="robots" content="noindex">` y cabecera `X-Robots-Tag: noindex` en `netlify.toml`. |

La política de seguridad de contenido de `netlify.toml` se actualiza (sección 9) y **se mantiene estricta**: sin `unsafe-inline` ni `unsafe-eval`.

## 9. Arquitectura y stack

- **Frontend:** React + Vite + TypeScript, con CSS propio basado en variables (como la maqueta). Sin Tailwind. Variante de React Bits: TypeScript con CSS (`-TS-CSS`; si alguna no existe, `-JS-CSS`).
- **Backend:** Convex (base de datos, funciones, almacenamiento de archivos y consultas reactivas). Inicio de sesión de la dueña con Convex Auth y Google.
- **Alojamiento:** Netlify. Un despliegue de Convex de desarrollo y otro de producción. Patrón de compilación documentado por Convex: `npx convex deploy --cmd 'npm run build'` con la variable `CONVEX_DEPLOY_KEY` (el constructor debe verificarlo contra la documentación vigente).
- **Escala esperada y presupuesto.** Menos de 20 personas, cientos de tareas y cientos de registros. Límites del plan gratuito de Convex según su página de límites (21 de octubre de 2026; el constructor debe volver a comprobarlos): 0,5 GB de base de datos, 1 GB de archivos, 1 millón de llamadas a funciones al mes y 1 GB de transferencia al mes. Lo que más consume es la transferencia de imágenes: por eso las listas usan miniaturas y solo se descarga la imagen completa al ampliarla. Evitar consultas que se vuelvan a ejecutar innecesariamente (índices en lugar de recorridos completos).
- **Disposición del repositorio (decisión mía):** la aplicación nueva vive en `app/` con su propio `package.json` y su carpeta `convex/`. La aplicación actual (raíz) **no se toca** hasta el corte. El `node_modules` de la raíz es un enlace simbólico a un directorio externo, así que `app/` no debe depender de él. Se trabaja en una rama.
- **Dependencias:** `react`, `react-dom`, `convex`, `@convex-dev/auth`, `motion` (solo si se usa CountUp de React Bits), un paquete de arrastre con soporte táctil y de teclado, `three` y las tipografías del carné `@fontsource/anton` y los pesos 700 y 800 de `@fontsource/jetbrains-mono` (solo para el carné; se cargan bajo demanda, sección 4.8) y tipografías autoalojadas con `@fontsource` (Inter, Instrument Serif, JetBrains Mono, Space Grotesk). No se usa GSAP: las animaciones de entrada son CSS, como en la maqueta.
- **Política de seguridad de contenido** (ajuste de `netlify.toml`): `script-src 'self'`; `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud`; `img-src 'self' blob: data: https://*.convex.cloud`; `font-src 'self'`; `style-src 'self'`. Se eliminan las entradas de Google Apps Script y Drive tras el corte. React y las librerías de animación aplican estilos mediante el modelo de objetos de CSS (permitido bajo `style-src 'self'`), pero **algunos componentes de React Bits podrían inyectar etiquetas `<style>`**: el constructor debe probar cada componente bajo esta política y descartar o adaptar los que no la cumplan.
- **Licencia de React Bits:** MIT con Commons Clause. Es gratis para este uso, pero el constructor debe leer `LICENSE.md` del repositorio de React Bits antes de copiar componentes y conservar los avisos.

**Componentes de React Bits por estilo** (nombres verificados en su catálogo; en la maqueta están imitados en CSS):

| Estilo | Componentes | Dependencias |
|---|---|---|
| Grafito | `PillNav` (navegación), `SpotlightCard` (tarjetas), `ShinyText` (título), `CountUp` (indicadores) | `CountUp` requiere `motion`; los demás, ninguna |
| Papel | `TiltedCard` (inclinación), `ShinyText`, `CountUp` | igual |
| Tinta viva | `Magnet`, `ClickSpark`, `ElectricBorder` (tarjeta «En curso») | ninguna |
| Los tres estilos | `AnimatedList` (columnas del tablero y línea de tiempo de la Bitácora: scroll sin barra, degradados, tarjetas que aparecen y desaparecen al desplazar) | su archivo de ejemplo importa `@hugeicons/*` solo para sus iconos de muestra: quitarlos si no se usan |
| Los tres estilos | `Lanyard` (carné 3D del panel «Mi perfil»). Variante TypeScript con CSS: `src/ts-default/Components/Lanyard/Lanyard.tsx` y `Lanyard.css` del repositorio de React Bits | solo `three`. Verificado el 21 de octubre de 2026: no usa `eval`, no inyecta `<style>`, no hace `fetch`; carga imágenes con `new Image()` y dibuja en `canvas`, así que cumple la política de la sección 9 |

Donde un componente encaje directamente y no añada dependencias, se usa. Donde no, se usa el CSS de la maqueta. Menos dependencias es mejor.

**Pruebas.** Vitest con `convex-test` para las reglas del servidor: matriz de permisos, invitación de un solo uso (incluidos dos canjes simultáneos), caducidad y revocación, idempotencia del borrador, validación de horas, filtrado por audiencia, inmutabilidad del historial. Humo de extremo a extremo (por ejemplo Playwright): mover por arrastre y por menú, cambiar de estilo y de tema, vista móvil.

## 10. Diseño visual

La maqueta es la referencia de intención. Contiene los tres estilos completos (`direccion-visual.css` define las variables). Resumen:

| | **Grafito (predeterminado)** | **Papel** | **Tinta viva** |
|---|---|---|---|
| Carácter | Oscuro, sereno, luminoso | Editorial, cálido, tipográfico | Contraste fuerte, bloques, sombras duras |
| Fondo / superficie | Oscuro `#0a0c0d` / `#111416`. Claro `#f4f6f5` / `#ffffff` | Claro `#f3eee4` / `#fbf8f1` con grano sutil. Oscuro `#17140f` / `#201c15` (grano en modo `screen`) | Claro `#efeee7` / `#ffffff`. Oscuro `#060606` / `#101010` (casi negro: la dueña pidió el fondo más oscuro) |
| Texto | Oscuro `#eef3f1`. Claro `#17201e` | Claro `#1c1a16`. Oscuro `#efe7d6` | Claro `#0e0e0e`. Oscuro `#f4f4ee` |
| Acento | Oscuro `#66c6a9`. Claro `#137a5d` | Claro `#b3402a` (sello). Oscuro `#e0634a` | Claro `#ff4f1f`. Oscuro `#ff5a2a`. Limón `#d4ff3a` en ambos |
| Borrador | Ámbar (`#e4bd71` oscuro, `#9a6a10` claro) | Sello rojo girado | Bloque naranja que se mueve |
| ✓ de completada | Círculo del color de la columna, con un brillo suave | Aro en verde tinta (claro `#2f5d50`, oscuro `#6fb59f`) | Círculo limón con borde y trazo `#0e0e0e` en ambos temas |
| Color por columna | Gris `#7e8b88` · Azul `#7aa7ff` · Violeta `#d69be3` · Menta `#66c6a9` (en claro: `#7a8884`, `#3563d6`, `#9a42b8`, `#137a5d`) | No aplica | No aplica (las cabeceras ya llevan color) |
| Tipografía | Inter y JetBrains Mono | Instrument Serif, Inter y JetBrains Mono | Space Grotesk y JetBrains Mono |
| Navegación | Píldora centrada que se desliza | Pestañas con subrayado que se desliza | Barra negra con bloque limón que se desliza |

- **Movimiento:** indicador de pestaña con deslizamiento de 500 ms (`cubic-bezier(.2,.9,.2,1)`); entrada escalonada de 45 ms entre elementos; tarjetas fuera de la vista de una lista con scroll: escala 0,82, 14 px de desplazamiento y opacidad 0, que regresan en 550 ms con una curva de resorte (`linear()` de AnimatedList, con `cubic-bezier(.2,.9,.2,1)` de respaldo); degradado de borde de 56 px con suavizado `smootherstep` que crece con el desplazamiento; ✓ de completada que entra girando y creciendo en 600 ms; «Ver detalle» que despliega en 450 ms; indicadores con CountUp de 800 ms; foco de luz que sigue al cursor (Grafito), inclinación (Papel), sombra dura que se «presiona» (Tinta viva); al soltar una tarjeta, un pequeño rebote y chispas; aviso temporal (toast) desde abajo.
- **Temas oscuros de Papel y Tinta viva.** Se definen con las mismas variables que los claros (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--p1`…`--p6` y las propias de cada estilo: `--shadow-soft`, `--margin-line`, `--field-bg` en Papel; `--paper`, `--veil`, `--bar`, `--on-lime`, `--paper-warn`, `--tag-warn`, `--tag-violet` en Tinta viva). **Regla de Tinta viva:** el texto sobre limón (pestaña activa, cabecera y ✓ de Completada, avatar propio, chip de horas, botón principal, «Nueva tarea») es siempre `--on-lime` (`#0e0e0e`), también en oscuro. Ningún valor de color queda escrito a mano fuera de las variables.
- **Rendimiento de animaciones y transiciones** (sin perder el dinamismo). Presupuesto y reglas: (1) animar **solo `transform` y `opacity`** (y `translate`/`scale`); nada de animar `box-shadow`, `filter`, `width`, `height`, `top` o `left` en elementos grandes o repetidos; (2) **ningún `backdrop-filter`** (se quitaron el de la píldora de navegación, el del fondo de los paneles y el de la galería) **ni `filter` sobre lienzos**; (3) en las listas con scroll animado **se lee primero y se escribe después**: la posición y el alto de cada tarjeta se leen una vez por cuadro (`offsetTop`, `offsetHeight`, `scrollTop`) y todas las escrituras van juntas; el degradado de bordes se escribe **en línea** (`mask-image` con píxeles) solo cuando cambia (pasos de 4 px) en lugar de variables CSS heredadas por todas las tarjetas; la lista de tarjetas se guarda en caché y se invalida al redibujar; (4) el brillo del título (`ShinyText`) corre 3 vueltas y se detiene; (5) en el 3D: resolución adaptativa, 30 cuadros por segundo en reposo, efectos en el shader y no en el lienzo 2D, y el bucle se detiene cuando el carné no está visible (el componente ya observa la visibilidad); (6) con `prefers-reduced-motion` todo esto se apaga; (7) `content-visibility: auto` queda reservado para listas de cientos de elementos y nunca sobre elementos con decoración fuera de su caja (el punto de la línea de tiempo y las sombras duras de Tinta viva se recortarían). Se verifica con una prueba de estilos y con una prueba de humo de cuadros (criterio 26).
- **Accesibilidad:** contraste AA en los seis temas (tres estilos × oscuro y claro; los acentos están elegidos para eso y el constructor lo comprueba con una verificación de contraste, incluido el texto oscuro sobre limón); anillo de foco visible; el significado del borrador siempre lleva texto, no solo color; las barras de desplazamiento ocultas se compensan con degradado y teclado (flechas); `prefers-reduced-motion` desactiva inclinación, foco de luz, brillo del título, conteo animado, chispas y la animación de las tarjetas al desplazar (todas quedan visibles); avisos en región `aria-live`.
- **Responsive:** puntos de corte de 860 px (el calendario pasa a una columna) y 640 px (navegación en dos filas, columnas apiladas, panel de detalle a pantalla completa).
- **Lo que la maqueta simplifica y el constructor debe resolver:** el carné 3D de la maqueta usa un paquete de prueba (`badge.js`, compilado aparte con el componente de React Bits y **no incluido en el repositorio**; sin él la maqueta muestra la imagen plana); la foto por defecto (`carnet.png`) **no** se incluye (sin ella sale el monograma), y «Editar perfil» recuerda los cambios solo en `localStorage` del navegador; no hay más persistencia; el formulario de «Nueva tarea» y el panel de detalle existen pero no guardan nada y usan una confirmación de dos pasos para eliminar (en la app, el cuadro de confirmación de la Bitácora); el botón «Simular 10 tareas más» es solo de la maqueta; el panel de «Registrar actividad» (que también edita y completa borradores) **sí** está, con los campos reales, pero no sube ni comprime imágenes (solo muestra el nombre del archivo) y no guarda nada; las subtareas tampoco se guardan; la maqueta no incluye las flechas ↑ ↓ para reordenar dentro del día; el arrastre HTML5 no funciona en táctil; el calendario móvil oculta el texto de las tareas; la fecha «hoy» está fija al 21 de octubre de 2026; los datos son inventados (los registros reales viven en la hoja de Google).

## 11. Migración desde la hoja de Google

1. Un script de una sola vez (Node) lee todos los registros del servicio actual (el endpoint público de lectura, en formato JSONP) y los importa con una mutación interna protegida con la clave de despliegue. Es **idempotente** por `legacyId`.
2. Correspondencias: `nextStep` pasa a `development`, `blocker` a `observations`, `order` a `dayOrder`, `status` a `activityStatus`; todos los registros importados quedan en `docStatus = complete`. Los proyectos se normalizan en la tabla `projects`.
3. Las imágenes de Drive se copian al almacenamiento de Convex (con su miniatura). Si alguna no se puede copiar, se conserva su `url` heredada y se informa.
4. **Verificación antes del corte:** mismo número de registros, mismas horas totales, mismas fechas y proyectos. Se informa cualquier diferencia. Referencia del sitio publicado el 21 de octubre de 2026: **6 registros, 17,5 horas, 6 completadas** (las cifras pueden haber cambiado el día del corte; se vuelven a leer).
5. Corte: se publica la aplicación nueva, se deja de usar la hoja (se conserva como respaldo) y se deshabilita el despliegue del servicio de Apps Script. El PIN deja de existir.
6. Después, la dueña retira el acceso público de la carpeta de Drive con las evidencias.

## 12. Pasos que solo puede hacer la dueña

- Iniciar sesión en Convex (ya hecho) y autorizar la creación del proyecto cuando se llegue a construir.
- Crear las credenciales de Google (cliente OAuth) en la consola de Google Cloud. La URI de redirección autorizada es la del sitio de Convex, terminada en `/api/auth/callback/google`. El constructor la guía paso a paso.
- Cargar las variables de entorno en Convex (`OWNER_EMAIL`, credenciales de Google, `SITE_URL`) y en Netlify (`CONVEX_DEPLOY_KEY`).
- Retirar el acceso público a las fotos de Drive tras la migración.

## 13. Criterios de aceptación

1. La dueña inicia sesión con Google. Otra cuenta de Google es rechazada.
2. La dueña genera una invitación; otra persona la abre en otro navegador, **inicia sesión con su cuenta de Google**, confirma su nombre y rol, y entra. El mismo enlace no sirve una segunda vez, ni siquiera con dos intentos simultáneos. Pasados 7 días tampoco.
3. La persona invitada ve el tablero, el calendario y el historial, puede crear, editar, mover y asignar tareas, y puede invitar a otra persona. **No** ve la pestaña Bitácora, ni horas, ni borradores, y no puede eliminar tareas.
4. La dueña ve quién invitó a quién (con el correo de cada cuenta) y retira a una persona: su acceso deja de funcionar de inmediato, aunque su sesión de Google siga abierta, y su aplicación abierta muestra «Tu acceso ya no está activo.».
4b. Una cuenta de Google sin invitación (que no es la dueña) ve «Tu cuenta no tiene acceso» y ningún dato.
5. Una tarea se mueve de columna por arrastre (ratón y táctil), por el menú «Mover a…» y por teclado. El cambio aparece al instante en otro navegador.
6. Al completar una tarea cuyo responsable es la dueña aparece **un único** borrador en su Bitácora. Reabrir y volver a completar, o completar desde dos navegadores a la vez, no crea un segundo ni descarta lo ya escrito.
7. Completar una tarea de otra persona o sin responsable no crea borrador.
8. El borrador muestra «— horas» y no suma a ningún indicador. Al guardar horas válidas (de 0,25 a 24, en pasos de 0,25) y un resultado, suma a los indicadores, al calendario y a la tarjeta. Horas o resultado inválidos muestran un error y no guardan.
9. Eliminar una tarea (dueña) conserva el registro de Bitácora vinculado con la nota «Tarea eliminada».
10. El historial muestra quién, qué y cuándo para cada cambio. No hay forma de editarlo o borrarlo. Las personas invitadas no ven los eventos de la Bitácora.
11. El enlace de solo lectura muestra **todas las secciones** (tablero, calendario, historial y, si está activado —por defecto sí—, la Bitácora con el carné de la dueña), sin ningún control de edición (lista en la sección 3.5) y con los campos del detalle deshabilitados. Desactivarlo o regenerarlo invalida el enlace anterior. Las descripciones solo aparecen si se activó esa opción.
12. Las funciones del servidor rechazan toda llamada sin credenciales válidas. La matriz de permisos de la sección 3.1 se verifica con pruebas automáticas.
13. El selector «Apariencia» cambia entre Grafito, Papel y Tinta viva y, **en los tres**, entre oscuro y claro (seis combinaciones, ninguna con elementos ilegibles: en Tinta viva oscuro el texto sobre limón es oscuro). La elección persiste en el navegador. Con movimiento reducido no hay animaciones decorativas.
14. La Bitácora conserva todas sus funciones actuales (sección 4.5): el formulario con **los mismos campos, etiquetas, límites, obligatorios y valores iniciales** de la tabla «Campos del formulario», la tarjeta de registro con sus cinco campos y sus evidencias, el resumen con *Actividades*, *Horas registradas* y *Completadas* (más *Por documentar*), búsqueda, filtros, orden dentro del día, edición, eliminación con confirmación, copia y restauración. Se comprueba campo por campo contra el sitio publicado.
15. Los datos migrados coinciden con la hoja: mismo número de registros y mismas horas totales.
16. La aplicación funciona en escritorio y en móvil, sin desborde horizontal a 375 px de ancho. La política de seguridad de contenido se mantiene estricta y la aplicación funciona bajo ella.
17. En el repositorio no hay credenciales, tokens ni claves.
18. Con 30 tareas en una columna, esa columna se desplaza por dentro y la página no se alarga; «Compacta» muestra al menos el doble de tarjetas; en móvil cada columna muestra 5 y «Mostrar más».
19. Cualquier persona con permiso crea una tarea escribiendo solo el nombre y el proyecto. La tarea aparece arriba de su columna, al instante en los demás navegadores abiertos, y queda en el historial. Sin nombre o sin proyecto no se crea y se muestra el mensaje de validación.
20. Las columnas del tablero y la línea de tiempo de la Bitácora **no muestran barra de desplazamiento nativa**. Con contenido largo muestran degradado en los bordes; las tarjetas fuera de la vista se desvanecen y regresan al desplazar; con movimiento reducido todas se ven sin animación; en móvil el desplazamiento es el de la página.
21. Una tarea admite **subtareas opcionales** (3 filas vacías de inicio, hasta 20): la tarjeta muestra «hechas/total» con una barra de progreso, y completar todas no completa la tarea.
22. En la columna Completada cada tarjeta lleva su **✓**. En Grafito el color de la columna (gris, azul, violeta, menta) aparece de forma **mínima** en la tarjeta: borde casi neutro, barra de progreso y ✓; sin tinte de fondo.
23. En la Bitácora, registrar, editar y completar un borrador se hace en un **panel lateral** con los mismos campos. Las tarjetas muestran el Resultado como vista previa y «Ver detalle» despliega todos los campos.
24. El avatar abre «Mi perfil» con el carné 3D (cinta y carné que se arrastran, se lanzan y giran al pulsar), **colgando desde el borde superior del panel** (la cinta no se ve cortada bajo el título) y con los colores del estilo y tema activos. En escritorio ≥ 1101 px la Bitácora muestra además el carné en una columna a la derecha; con menos ancho esa columna no existe. Nunca hay dos carnés 3D montados a la vez. La persona invitada ve el suyo con el nombre y el rol que escribió; el enlace de solo lectura ve el de la dueña. Sin WebGL, con movimiento reducido o si el 3D falla, se ve la imagen plana más el texto. El 3D **no** se descarga hasta que se necesita y el carné **no** contiene teléfono, correo ni documento.
27. **Carné en solo lectura:** se puede arrastrar y lanzar sin que ninguna parte quede cortada, en ambos lados; «Ver diseños» cambia el diseño solo en ese navegador, el cambio sobrevive a recargar, no modifica el perfil de la dueña (ninguna mutación) y, si la dueña cambia su foto o su nombre, el carné del enlace muestra los datos nuevos con el diseño que esa persona eligió.
26. **Rendimiento:** al desplazar sin parar durante 3 s una columna con 30 tarjetas, y con el carné 3D en reposo en la Bitácora, no más del 5 % de los cuadros tardan más de 50 ms (prueba de humo en Playwright; en una máquina de referencia el p95 queda por debajo de 20 ms); ningún CSS contiene `backdrop-filter`, ni animaciones infinitas fuera de una lista permitida (`pulse`, `wiggle`), ni `filter` sobre el contenedor del carné.
25. «Editar perfil» permite cambiar nombre y rol (cualquier persona) y, la dueña, además semestre, programa, institución, grupo y **foto**: subirla, encuadrarla (arrastre, teclado y acercar), quitarla y guardarla; la foto guardada es un JPEG cuadrado de 1024 px que no pasa de 400 KB. Una imagen que no se puede leer (por ejemplo HEIC en un navegador que no la abre), una que no es imagen o una de más de 5 MB muestran su mensaje y no cambian nada. El carné y los textos se actualizan al guardar. El logotipo de AthenIA se ve con buen contraste en los seis temas y solo cuando el grupo es AthenIA.

## 14. Decisiones que tomé yo (para revisar)

Estas no las dijo la dueña. Cámbialas si no te convencen.

1. Solo la dueña elimina tareas; las personas invitadas crean, editan y mueven.
2. Un solo responsable por tarea.
3. Invitaciones de 7 días, máximo 10 pendientes por persona, y retirar a alguien revoca sus invitaciones pendientes pero no a quienes ya entraron.
4. Las sesiones las gestiona Convex Auth (Google): no hay tokens de sesión propios. Las personas invitadas **necesitan una cuenta de Google** (la dueña lo pidió —«que la invitación pida login»— y **lo confirmó** el 21 de octubre de 2026), y la dueña ve su correo para verificarlas.
5. El enlace de solo lectura incluye la Bitácora por defecto y oculta las descripciones de tareas por defecto.
6. Al volver a completar una tarea reabierta no se crea otro registro; la dueña crea uno manual si lo quiere.
7. Eliminar una tarea conserva su registro de Bitácora; eliminar un registro no recrea el borrador.
8. La columna Completada muestra los últimos 30 días y un botón para ver los anteriores.
9. Para ser un registro completo hacen falta horas válidas y resultado (lo que ya exige la Bitácora hoy); objetivo, desarrollo, observaciones y evidencias son opcionales.
10. Los tres estilos tienen tema oscuro y claro (la dueña pidió completar Papel y Tinta viva). Las paletas oscuras de Papel y Tinta viva las definí yo a partir de las claras (sección 10); en Tinta viva oscuro el fondo es casi negro (`#060606`) porque la dueña pidió «el fondo más oscuro».
11. Grafito oscuro es el estado inicial, sin seguir la preferencia del sistema.
12. Tipografías autoalojadas, sin Google Fonts en producción.
13. La aplicación nueva vive en `app/` y la actual no se toca hasta el corte.
14. Los eventos de la Bitácora son visibles solo para la dueña y el enlace de solo lectura con la Bitácora incluida.
15. Las tareas sin fecha límite no aparecen en el calendario; las tareas de una persona retirada siguen mostrando su nombre con la nota «sin acceso».
16. La Bitácora conserva el sobretítulo «Seguimiento académico» y la línea de la institución, y *Actividades* cuenta solo registros completos (los borradores se cuentan aparte en *Por documentar*).
17. `<meta name="robots" content="noindex">` y `X-Robots-Tag: noindex`.
18. Una tarea nueva entra arriba de su columna y, por defecto, «Sin asignar», sin fecha, prioridad Media y estado de la columna desde la que se creó.
19. La prioridad se elige por nombre (Baja, Media, Alta) con su icono de barras, no con números.
20. Las columnas largas se desplazan por dentro (escritorio) y la vista «Compacta» es una preferencia por dispositivo; en móvil se muestran 5 tarjetas con «Mostrar más».
21. Subtareas simples: texto y «hecha», máximo 20; completar todas no completa la tarea.
22. La Bitácora se rediseñó (la dueña lo pidió: solo debían conservarse los campos): panel lateral para registrar, editar y completar borradores; tarjetas con vista previa del Resultado y «Ver detalle»; línea de tiempo con scroll animado.
23. El scroll de tarjetas se basa en **AnimatedList** (sin barra visible ni indicador de posición, degradado, estados de tarjeta, teclado). **ScrollStack** y **GradualBlur** se evaluaron y descartaron.
24. El color por columna existe solo en Grafito. El ✓ de completada existe en los tres estilos.
25. Los botones del panel lateral quedan fijos abajo y el fondo se difumina al abrirlo.
26. El color por columna en Grafito es **mínimo** (sin tinte de fondo, borde 6 %, luz al pasar el cursor 7 %): la dueña probó tres versiones y pidió quitarle color las tres veces. La diferencia la dan la barra de progreso, el ✓ y el puntito de la cabecera. Si se quiere más diferencia, se sube con los porcentajes de mezcla de `.app[data-theme="b"] .card`.
27. No hay ninguna barra de posición al desplazar (la dueña la quitó); la Bitácora tampoco usa ajuste automático a cada tarjeta.
28. El carné `Lanyard` (que la dueña pidió incluir) vive en el panel «Mi perfil», abierto desde el avatar, y **también** a la derecha de la Bitácora en escritorio ancho (lo pidió la dueña). No va en una pantalla de entrada: así se ve cada vez que se quiere, no una sola vez al iniciar sesión. Cada persona ve el suyo en «Mi perfil» (decisión mía: generaliza el pedido sin añadir pantallas); la Bitácora solo la ven la dueña y el enlace de solo lectura, así que ahí siempre es el de la dueña.
29. Del currículum de la dueña solo se toman nombre, programa, semestre, institución y grupo. Teléfono, correo, referencias y demás no se usan en ninguna parte de la aplicación ni del repositorio.
30. La foto del carné es opcional y se guarda reducida como cadena `data:` en la tabla `profile`, no en el almacenamiento de archivos (evita el problema de permisos entre dominios al dibujarla en el `canvas`). Sin foto hay monograma con las iniciales. El recorte lo hace la persona con un encuadre sencillo (arrastrar y acercar), sin librerías.
31. El 3D se carga bajo demanda y se destruye al cerrar el panel o salir de la Bitácora; con movimiento reducido o sin WebGL se ve una imagen plana. En la Bitácora solo hay carné desde 1101 px de ancho.
32. El logotipo de AthenIA se usa como **máscara de una tinta** (sección 4.8) para que se vea bien sobre los seis temas, en lugar del PNG original en colores. Solo se muestra cuando el grupo del perfil es AthenIA.
33. Cualquier persona puede editar su propio nombre y rol (la dueña pidió «editar el perfil»); lo demás del perfil, y la foto, solo la dueña porque son datos de su hoja de vida.
34. Se muestran **cinco diseños** del carné para que la dueña elija (Olimpo en estilo código, Circuito animado, Póster, Suizo con la foto más pequeña y Clásico —la primera versión— con AthenIA atrás); Holo se descartó. Los cinco quedan disponibles para elegir desde «Ver diseños»; el predeterminado es Olimpo. Lo que se pide que no cambie en ninguno: AthenIA como identidad, nada de «Bitácora» ni año en el frente, «Becario de AthenIA» y contenido centrado.

## 15. Lo que queda al constructor

Esquema exacto de Convex y nombres de funciones; biblioteca de enrutado y de arrastre; gestor de estado en el cliente; cómo organizar los componentes de React Bits (copiarlos al proyecto o instalarlos con la CLI de shadcn); redacción exacta de los textos de la interfaz (en español, con el tono de la maqueta); diseño detallado del formulario de tarea, del panel de detalle y del panel de acceso, siguiendo el estilo de la maqueta; estrategia de pruebas más allá de lo mínimo de la sección 9; división del trabajo en etapas.

## 16. Qué cambia respecto a `FUNCIONALIDADES_TABLERO_BITACORA.md`

| Antes | Ahora |
|---|---|
| Sin pantalla de historial | Historial incluido |
| Sin barra superior genérica | Barra superior mínima con cuatro pestañas (sin barra lateral) |
| Roles administradora, colaboradora y consulta, con cuentas asignadas | Una dueña con Google, personas invitadas por enlace de un solo uso (todas iguales) y un enlace de solo lectura |
| Almacenamiento en Sheets y Drive, con PIN | Convex; el PIN desaparece |
| Colores de la Bitácora actual, con ámbar solo para borradores | Tres estilos, cada uno con tema oscuro y claro; Grafito conserva la menta y el ámbar; Papel y Tinta viva tienen su propia paleta |
| Sin perfil de persona | Panel «Mi perfil» con carné 3D (`Lanyard` de React Bits) |
| Horas solo dentro de la Bitácora | Además, resumen de horas, horas por día en el calendario y chip en las tarjetas completadas, siempre solo con horas guardadas |
| Formulario y campos de la Bitácora sin cambios (el borrador de tarea los reutiliza) | Se conservan literalmente; el borrador usa el mismo formulario |
| Botón «Administrar» (PIN), «Ver hoja» y selector de tema | Se retiran (PIN, «Administrar», «Ver hoja») o se reemplazan por «Apariencia» (tema) |
| Subtareas fuera de alcance | Subtareas simples y opcionales en cada tarea |
| Bitácora con formulario plegable en la página y tarjetas con todos los campos a la vista | Bitácora con panel lateral, tarjetas plegables («Ver detalle») y línea de tiempo con scroll animado; **los campos no cambian** |
| Preguntas abiertas de la sección 10 | Resueltas en la sección 14 |
