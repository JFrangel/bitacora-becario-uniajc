# Cómo se diseñó la Bitácora: de la idea a la maqueta, la base de datos y el código

Este documento explica **el método** que se usó aquí, con los archivos reales del proyecto, para que puedas repetirlo en
otras secciones (o en otros proyectos) y **no empezar a escribir código sin tener clara la idea**.

> Regla corta: **primero se ve, después se decide, después se escribe, y recién al final se programa.**
> Orden: pedido → preguntas → maqueta → decisiones → documento de diseño → plan → código con pruebas → vista local → despliegue.

---

## 1. La línea de tiempo real de este proyecto

| # | Qué pasó | Qué salió | Dónde está |
|---|---|---|---|
| 1 | Tú pediste «un tablero tipo Jira, pero **no genérico**, ni landing de SaaS, **sin barra lateral**, barra arriba» y pegaste una propuesta funcional. | El pedido y sus **anti-objetivos** (lo que NO quieres). | `FUNCIONALIDADES_TABLERO_BITACORA.md` |
| 2 | Se hicieron **preguntas una por una** (para qué se comparte, quién ve qué, quién edita, si hay login…). | Quién usa el sistema: tú (dueña), director y supervisora (editan), universidad (solo mira). | Sección 3 del diseño |
| 3 | Se comparó la **base de datos** (Supabase, Turso, Neon, Convex) con **tus criterios**: que no se pause, que tenga MCP, que se pueda vincular tu login de Google. | Se eligió **Convex**. | Sección 5 de este README |
| 4 | Se construyeron **maquetas navegables** con componentes de React Bits (v1 → v5). | 3 estilos × oscuro/claro, tablero, calendario, Bitácora, historial, carné 3D. | `docs/superpowers/specs/assets/2026-10-21-mockup/` |
| 5 | Tú viste las maquetas, mandaste capturas y pediste cambios («menos color», «quita la barra», «el marco de Olimpo no me gusta»). | Cada cambio se **registró como decisión**, no solo se aplicó. | Sección 14 del diseño |
| 6 | Aprobaste el diseño. Recién ahí se escribió el **plan** (tareas pequeñas con pruebas). | Plan paso a paso. | `docs/superpowers/plans/2026-10-21-tablero-bitacora.md` |
| 7 | Se programó siguiendo el plan, con pruebas primero, y se probó en **local** con las funciones reales del servidor. | `app/` + `npm run demo`. | `app/` |
| 8 | Se desplegó (Convex producción + Netlify) y se migraron tus datos. | Sitio publicado. | `app/CUTOVER.md` |

Lo importante: **entre tu primer mensaje y la primera línea de código real pasaron los pasos 2 a 6.** Ahí se resolvieron
casi todas las dudas; por eso el código salió con pocas sorpresas.

---

## 2. De dónde salió la inspiración (dicho con honestidad)

No hubo un «Dribbble de referencia». La inspiración vino de cuatro fuentes, y conviene que sepas cuál es cuál:

1. **Tus palabras y tus anti-objetivos.** «Simple pero moderno», «minimalista, con transiciones y animaciones»,
   «sin barra lateral», «no landing SaaS». Eso fijó el carácter más que cualquier referencia. *Escribir lo que NO quieres
   ahorra más tiempo que escribir lo que sí.*
2. **Tu propia Bitácora actual.** El estilo **Grafito** (menta + ámbar, oscuro) es la continuación de cómo ya se veía tu
   sitio. Los campos del formulario se copiaron literalmente del sitio publicado (se verificó contra `app.js`).
3. **Los dos enlaces que me diste en tu primer mensaje** (`modulify.ai/templates` = **inspiración**; `reactbits.dev` =
   **componentes**):
   - `https://modulify.ai/templates` («mira aquí, puedes usar para que tengas más o menos una idea»). Lo abrí al empezar. Es un
     catálogo de componentes React gratis por categorías (animaciones de texto, efectos de cursor como Electric Border,
     Click Spark y Magnet, componentes como Pill Nav y Holo Card, micro-interacciones y fondos animados). **No trae
     pantallas completas ni plantillas de tablero**, y esa página no dice instalación, dependencias ni licencia; por eso
     después fui al código fuente.
   - `https://reactbits.dev/get-started/index` (React Bits): tarjetas, listas animadas, contadores, carné 3D. Lo pediste
     «para animaciones, transiciones, tarjetas, diseño a nivel general». Es un **catálogo de comportamientos**, no de
     pantallas completas, y de ahí salieron Lanyard, AnimatedList, SpotlightCard, ShinyText, CountUp, TiltedCard, Magnet,
     ClickSpark, ElectricBorder y PillNav.
   - También pediste instalar, de forma general en Claude, **REA** y las habilidades de **HyperFrames**; no se usaron para
     estas maquetas (son para ingeniería inversa y para video).
4. **Tres arquetipos visuales que yo propuse** (no vienen de una referencia concreta): uno **editorial** (Papel), uno
   **oscuro y sereno** (Grafito) y uno **de contraste fuerte con bloques y sombras duras** (Tinta viva; es el lenguaje
   que se suele llamar *neo-brutalista*). Se eligieron porque son **muy distintos entre sí**: comparar tres cosas
   parecidas no te ayuda a decidir.

**Cómo conseguir inspiración para tus próximas secciones (método, no lista de sitios):**
- Escribe 3 adjetivos y 3 anti-adjetivos («cálido, editorial, tranquilo» / «corporativo, saturado, genérico»).
- Busca 3 referencias **que difieran entre sí** (una clara, una oscura, una atrevida) y anota **qué te gusta de cada una en
  una frase** (la tipografía, el espacio, el borde). Una referencia sin esa frase no sirve.
- Pídele a la IA que construya **las tres como maqueta** y compáralas viéndolas, no leyendo descripciones.
- Reúne los comportamientos que quieras (animación de lista, contador, tarjeta que se inclina) del catálogo de React Bits
  **antes** de decidir pantallas.

---

## 3. Cómo se hicieron las maquetas (la parte técnica)

> **Detalle completo, con las herramientas reales y las horas, en
> [COMO-SE-CONSTRUYERON-LAS-MAQUETAS.md](COMO-SE-CONSTRUYERON-LAS-MAQUETAS.md).** Corrección importante: la maqueta no es
> solo HTML plano; **el carné 3D es el componente real de React Bits (React + three.js) compilado con esbuild** y cargado
> como `badge.js`.

### 3.1 Qué es una «maqueta» aquí
No es un dibujo: es una **página HTML + CSS + JavaScript sueltos**, sin servidor ni base de datos, con **datos inventados**,
donde ya se puede arrastrar, cambiar de estilo, abrir paneles, buscar. Se abre con doble clic:

```
docs/superpowers/specs/assets/2026-10-21-mockup/
├── index.html            ← estructura (22 KB): pantallas, paneles, formularios
├── direccion-visual.css  ← TODO el aspecto (85 KB): tres estilos × claro/oscuro
├── direccion-visual.js   ← comportamiento (109 KB): arrastre, scroll animado, carné, apariencia
└── athenia-mark.png      ← logotipo convertido a máscara de una tinta
```

### 3.2 Cómo se iteró (versiones)
Se trabajó en una carpeta temporal `.superpowers/brainstorm/<sesión>/content/` (no va al repositorio) con un servidor local
de «compañero visual». Cada ronda de tus comentarios generó una versión nueva **sin pisar la anterior**:

| Versión | Qué cambió |
|---|---|
| `direccion-visual.html` | «Elige el estilo». Los tres estilos funcionando: arrastra tarjetas, cambia de vista, busca. |
| `-v2` | **Grafito por defecto**, con tema claro y oscuro; los otros dos siguen disponibles. Se quitó «jurídica» de la marca. |
| `-v3` | La Bitácora **conserva su formulario y sus campos** reales. |
| `-v4` | **Nueva tarea**, muchas tarjetas por columna (scroll interno, vista compacta), Bitácora con campos reales. |
| `-v5` (la aprobada) | Scroll animado, subtareas, color mínimo por columna, Bitácora rediseñada con panel lateral, carné 3D y perfil. |

Antes de las maquetas de estilo hubo dos prototipos de flujo (`standalone-task-board.html`, `task-board-flow.html`) y una
**demo en React real** (`react-demo/`) para probar de verdad los componentes de React Bits.

> Truco: **guarda cada versión con otro nombre.** Cuando algo «empeora», puedes volver a la anterior en segundos.

### 3.3 El truco que permite tener 3 estilos × 2 temas con un solo código
Todo el aspecto depende de **variables CSS** y de dos atributos en el contenedor:

```html
<div class="app" data-theme="b" data-mode="dark">   <!-- a = Papel · b = Grafito · c = Tinta viva -->
```

Cada estilo redefine las **mismas variables** (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--p1…--p6`).
El resto del CSS usa `var(--…)` y nunca un color escrito a mano. Por eso cambiar de estilo o de tema es cambiar un
atributo, sin tocar componentes. En el CSS de la maqueta cada estilo es un bloque comentado:
`/* A · PAPEL */`, `/* B · GRAFITO */`, `/* C · TINTA VIVA */`.

| | **Grafito** (por defecto) | **Papel** | **Tinta viva** |
|---|---|---|---|
| Carácter | Oscuro, sereno, luminoso | Editorial, cálido, tipográfico | Contraste fuerte, bloques, sombras duras |
| Tipografía | Inter + JetBrains Mono | Instrument Serif + Inter + JetBrains Mono | Space Grotesk + JetBrains Mono |
| Acento | menta `#66c6a9` / `#137a5d` | rojo sello `#e0634a` / `#b3402a` | naranja `#ff5a2a` + limón `#d4ff3a` |
| Navegación | píldora que se desliza | pestañas con subrayado | barra negra con bloque limón |
| Detalle propio | luz que sigue al cursor, color mínimo por columna | grano de papel, inclinación | borde grueso, sombra dura que se «presiona» |

Regla que costó aprender: **un tema oscuro no es «invertir» el claro.** Hay que definirlo aparte (en Tinta viva oscuro el
fondo es `#060606` porque pediste «más oscuro», y el texto sobre limón es siempre oscuro).

### 3.4 Qué se usó de React Bits (la verdad completa)
React Bits es un catálogo; **no se instala entero**. Cada componente se **copia** al proyecto (con la CLI `jsrepo` desde
`https://reactbits.dev/r` o a mano) y se audita. Su licencia es MIT con *Commons Clause*: gratis para usarlo **dentro** de
tu app, **no** para revenderlo como componente.

| Pensado en el diseño | ¿Se copió el componente real? | Por qué |
|---|---|---|
| **Lanyard** (carné 3D) | **Sí**, parchado (10 cambios documentados) | Es la pieza que no se puede imitar con CSS. Solo depende de `three`. |
| **AnimatedList** (scroll de columnas) | Comportamiento **reimplementado** (sin barra, degradado, tarjetas que se encogen y rebotan) | El original trae iconos de muestra y no se adapta a arrastrar tarjetas. |
| SpotlightCard, ShinyText, CountUp, TiltedCard, Magnet, ClickSpark, PillNav | **No**; se usó el CSS/JS de la maqueta aprobada | Rendimiento (muchas tarjetas), cero dependencias extra (CountUp pide `motion`) y fidelidad con lo que tú aprobaste. |
| ElectricBorder | No | Anima un filtro SVG: prohibido por el presupuesto de movimiento en elementos repetidos. |

Todos pasaron la auditoría de seguridad (`src/reactbits/AUDIT.md`: sin `eval`, sin `<style>` inyectado, sin `fetch`), porque
la política de seguridad del sitio es estricta. **Si prefieres los componentes reales de React Bits** en vez de las
versiones de la maqueta, es un cambio por componente y se puede hacer: es una decisión tuya pendiente.

### 3.5 Cómo se hizo el carné (un ejemplo de «diseño → código»)
1. Se dibuja cada cara del carné en un `<canvas>` 2D (texto, foto, logotipo) → una imagen.
2. Esa imagen se pega como textura al modelo 3D del componente Lanyard.
3. Cada diseño es una función `draw(env, front, back, strap)`; hay cinco (Olimpo, Circuito, Póster, Suizo, Clásico) y se
   guarda cuál elegiste.
4. Las animaciones (el punto «ACTIVO» que late) van en la **GPU (shader)**, no repintando el canvas: así no hay lag.
5. Se dibuja al doble de resolución y el 3D baja a 30 cuadros por segundo en reposo.
6. El logotipo se convirtió **una sola vez** en máscara de una tinta para verse bien en los seis temas.

---

## 4. Cómo pasar de la maqueta al documento de diseño (y por qué no saltarte este paso)

El documento `docs/superpowers/specs/2026-10-21-tablero-bitacora-design.md` tiene una estructura que puedes copiar:

1. **Intención y por qué** (en 5 líneas, sin tecnología).
2. **Objetivos / no-objetivos / anti-objetivos.** El *anti-objetivo* es «aunque funcione, sería un fracaso».
3. **Personas y permisos** en una **tabla** (quién ve y quién edita qué).
4. **Funcionalidad pantalla por pantalla**, con campos, límites, textos y mensajes de error exactos.
5. **Reglas de negocio** numeradas (por ejemplo: «un borrador único e idempotente por tarea»).
6. **Datos** (tablas) y **contratos del servidor** (qué consultas y mutaciones existen).
7. **Seguridad**: riesgo → mitigación, en tabla.
8. **Stack** y qué se usa de cada librería.
9. **Diseño visual**: variables, tipografías, movimiento, accesibilidad, responsive.
10. **Criterios de aceptación** numerados y comprobables.
11. **Decisiones que tomó la IA** (para que las revises) y **lo que queda abierto**.

Una versión corta, para secciones nuevas, está en `docs/superpowers/specs/2026-10-23-multiple-bitacoras.md`
(Problema → Objetivo → Modelo → Roles y permisos → Flujo y presentación). **Úsala como plantilla mínima.**

### 4.1 Mini-plantilla para pegar antes de pedir cualquier sección nueva

```
SECCIÓN: <nombre>
PARA QUÉ (1 frase): 
QUIÉN LA USA: dueña / invitado / solo lectura
LO QUE NO QUIERO (anti-objetivos): 
REFERENCIA VISUAL (1 frase de qué me gusta de cada una): 
QUÉ DATOS GUARDA (lista de cosas, aunque sea en palabras): 
QUÉ PUEDE HACER CADA PERSONA (tabla corta): 
CÓMO SE VE EN MÓVIL: 
CÓMO SABRÉ QUE ESTÁ BIEN (3 a 5 criterios): 
```
Si no puedes llenar una línea, **esa es la duda que hay que resolver antes de programar.**

---

## 5. La base de datos: cómo se decidió y cómo pensarla desde el boceto

### 5.1 Por qué Convex
Tus condiciones fueron: *«que no se pause»*, *«que tenga MCP»*, *«un enlace y ya»*, *«vincular mi sesión con Google»*.

| Opción | Por qué se descartó o se eligió |
|---|---|
| Supabase | El plan gratis **se pausa** tras 7 días de poca actividad. |
| Turso | **Archiva** bases gratis tras 10 días. |
| Neon | Es solo la base: habría que armar aparte servidor, imágenes y actualización en vivo. |
| **Convex** ✔ | Base + funciones del servidor + archivos + **actualización en vivo** en un solo lugar; MCP; Google con *Convex Auth*; el plan gratis alcanza para <20 personas. |

Qué ganaste con eso: si alguien mueve una tarjeta, **todos la ven moverse al instante** sin que escribas código de sincronización.

### 5.2 Cómo se llega a las tablas (método para cualquier sección)
No se empieza por las tablas. Se empieza por la pantalla:

```
PANTALLA  →  ¿qué cosas veo?  →  ¿qué cosas guardo?  →  ¿quién puede ver/cambiar cada una?  →  TABLAS + FUNCIONES
```

Ejemplo real:

| Pantalla de la maqueta | Cosas que se ven | Tabla |
|---|---|---|
| Tarjeta del tablero | título, proyecto, responsable, fecha, prioridad, subtareas, columna | `tasks` (+ `projects`, `members`) |
| Historial | quién, qué, cuándo | `events` (solo se agrega, nunca se edita) |
| Bitácora | fecha, horas, actividad, resultado, imágenes | `journalEntries` (+ archivos en almacenamiento) |
| Panel «Acceso» | invitaciones, personas, enlace de solo lectura | `invites`, `members`, `settings` |
| Mi perfil / carné | programa, semestre, foto, diseño elegido | `profile` |

Preguntas que se hicieron con cada tabla (úsalas siempre):
1. **¿Qué la identifica y qué la ordena?** (de ahí salen los índices).
2. **¿Quién la lee?** Las respuestas se arman **por audiencia** (dueña / invitada / enlace): lo que una audiencia no puede
   ver, el servidor **ni siquiera lo envía**. Ocultar un botón en pantalla no es seguridad.
3. **¿Se puede borrar?** Algunas cosas no (historial). Otras dejan rastro (al borrar una tarea, su registro de Bitácora se
   conserva con la nota «Tarea eliminada»).
4. **¿Qué debe ser atómico?** Completar una tarea y crear su borrador pasan **en la misma transacción**: no puede quedar
   una sin la otra.
5. **¿Cuánto crece?** Aquí cientos de filas; lo caro son las imágenes → miniaturas en las listas.

### 5.3 Tablas del proyecto (resumen)
`members`, `invites`, `settings`, `profile`, `projects`, `tasks`, `journalEntries`, `events` (más las de inicio de sesión).
El esquema real está en `app/convex/schema.ts` y el detallado en la sección 6 del diseño. La próxima ampliación
(varias Bitácoras por cuenta) está especificada en `docs/superpowers/specs/2026-10-23-multiple-bitacoras.md`.

### 5.4 Reglas de negocio que deben escribirse ANTES de programar
Son las que más sorpresas dan si se dejan para después. Aquí, por ejemplo: las **horas nunca se calculan**, solo suman
cuando tú las escribes y guardas; **completar una tarea ajena no crea borrador**; **reabrir y volver a completar no duplica**.
Cada regla quedó como una prueba automática.

---

## 6. De la idea al código sin perderse

1. **Plan en tareas pequeñas** (`docs/superpowers/plans/…`): cada tarea dice qué archivos, qué firma y **qué prueba demuestra
   que está hecha**.
2. **Pruebas primero** para lo que puede romperse en silencio (permisos, borrador único, invitación de un solo uso).
3. **Vista local con el servidor real** (`npm run demo` corre las funciones de `convex/` en memoria con datos de ejemplo y
   un selector de sesión: dueña, invitada, sin invitación, sin sesión). Se ve **antes** de desplegar.
4. **Despliegue en dos entornos** (desarrollo y producción) y **migración idempotente** con comparación origen contra destino.
5. **Un registro de avance** (`.superpowers/sdd/…/progress.md`) para retomar sin repetir trabajo.

---

## 7. Trampas reales que ya nos pasaron (para no repetirlas)

| Qué pasó | Lección |
|---|---|
| El arrastre nativo de HTML5 de la maqueta **no funciona en táctil** | En la app se usa `@dnd-kit`. Anota en la maqueta lo que «finge» (el spec tiene una lista: «Lo que la maqueta simplifica»). |
| Página en blanco con la base real (bucle de renderizado) | La demo en memoria no lo mostraba: **prueba también contra el servidor real** y deja una prueba de regresión. |
| El carné se cortaba al arrastrarlo / se veía borroso / aparecía una tarjeta gigante al cargar | Un lienzo 3D grande necesita presupuesto de píxeles propio y **nada de «imagen de respaldo» a tamaño completo**. |
| «Menos color» pedido tres veces | Cuando repites un pedido, **conviértelo en regla escrita** (sección 14, decisión 26) para no volver a fallar. |
| Una construcción sin la dirección de Convex dejaba la app vacía | Añadir una **prueba de la construcción** (`scripts/check-build.mjs`). |
| Producción empezó vacía y parecía que «se perdió todo» | Los entornos son bases **separadas**: planifica la migración y avísalo. |

---

## 8. Cómo usar esto la próxima vez (checklist de 10 minutos)

- [ ] Llené la mini-plantilla de la sección 4.1 (si una línea quedó vacía, la pregunto antes de pedir código).
- [ ] Tengo **3 referencias distintas** con una frase de qué me gusta de cada una.
- [ ] Pedí **maquetas navegables** (HTML suelto) y las comparé viéndolas.
- [ ] Cada cambio que pedí quedó anotado como **decisión** con su motivo.
- [ ] Dibujé la tabla **quién ve / quién edita**.
- [ ] Lista de **datos que se guardan** derivada de las pantallas, no inventada aparte.
- [ ] Reglas de negocio numeradas y criterios de aceptación comprobables.
- [ ] Recién entonces: plan → pruebas → código → vista local → despliegue.

### Prompt completo y estructurado
El prompt maestro (con fases, puertas de aprobación, formato de respuestas y reglas de base de datos) está en
[PROMPT-para-nuevos-desarrollos.md](PROMPT-para-nuevos-desarrollos.md). Úsalo para proyectos nuevos; el corto de abajo
es para secciones pequeñas.

### Prompt corto para arrancar una sección nueva
> «Antes de escribir código: hazme preguntas de una en una hasta entender para qué es, quién la usa y qué NO quiero.
> Luego construye **3 maquetas HTML navegables muy distintas entre sí** (sin base de datos), con datos inventados, y
> guárdalas como v1, v2, v3 sin sobrescribir. Cuando elija, escribe el documento de diseño con la estructura de
> `docs/README-diseno-y-maquetas.md` (secciones 4 y 5), y solo después el plan con pruebas.»

---

## 9. De dónde salió la información (fuentes reales)

| Dato | Fuente | Cómo se obtuvo |
|---|---|---|
| Qué quieres, quién usa qué, qué NO quieres | **Tus mensajes** y `FUNCIONALIDADES_TABLERO_BITACORA.md` | Preguntas una por una; tus capturas de pantalla con cambios |
| Campos, límites y textos de la Bitácora | **Tu sitio publicado** (`bitacora-becario-uniajc.netlify.app`: `app.js`, `styles.css`, `index.html`) | Se leyeron y se compararon con el repositorio |
| Tus 6 registros, horas e imágenes | **El endpoint de tu Apps Script** (hoja de Google) | El script de migración los lee en solo lectura |
| Idea general de qué componentes existen | **El enlace `modulify.ai/templates` que tú me diste** | Lo abrí con una consulta web el 21 oct 2026; solo da el catálogo, no el código |
| Componentes de React Bits y su código | `reactbits.dev` y el repositorio `DavidHDev/react-bits` en GitHub (variante TypeScript) | Se leyó el código fuente y su licencia; se auditó con búsquedas de `eval`, `<style>`, `fetch` |
| Comparación de bases de datos | Páginas de precios y límites de Supabase, Turso y Neon, y `docs.convex.dev` | Búsqueda web; los límites gratuitos se anotaron con fecha (21 oct 2026) y hay que **volver a comprobarlos** |
| Cómo se hace el login con Google | `docs.convex.dev` y `labs.convex.dev/auth` (Convex Auth, que está en beta) | Documentación oficial |
| Datos de la hoja de vida del carné | **Tu hoja de vida**: solo nombre, programa, semestre, institución y grupo | Nunca teléfono, correo ni referencias |

Lo que **no** tiene fuente externa: los tres estilos (Papel, Grafito, Tinta viva), sus paletas y las paletas oscuras de Papel y
Tinta viva. Eso lo propuse yo y está marcado en la sección 14 del diseño como «decisión mía» para que la revises.

## 10. Por qué las maquetas están en otro lenguaje (HTML/CSS/JS) y la app en React + TypeScript

Es a propósito. Una maqueta sirve para **decidir**, y la app sirve para **funcionar**; necesitan herramientas distintas.

| | Maqueta | Aplicación |
|---|---|---|
| Lenguaje | HTML + CSS + JavaScript sueltos, **salvo el carné 3D** (React + three.js compilado con esbuild a `badge.js`) | React + TypeScript + Convex |
| Cómo se hizo | Escribí los tres archivos a mano (`index.html`, `direccion-visual.css`, `direccion-visual.js`) y los serví con el servidor local del «compañero visual» | Código por módulos con pruebas, compilado con Vite |
| Datos | Inventados, en memoria | Reales, en Convex |
| Para qué | Que **tú la veas y la toques** en segundos | Que la usen varias personas con permisos |

**Por qué no hacerla ya en React:**
1. **Se abre con doble clic**, sin instalar, sin compilar y sin servidor. Cada cambio tuyo se veía en un minuto.
2. **Es desechable.** Si hubiera sido la app, cada cambio de opinión (y hubo muchos) obligaba a tocar datos, permisos y
   pruebas. En una maqueta solo cambias el aspecto.
3. **No te casa con una tecnología antes de decidir.** Mientras se hacían las maquetas todavía no estaba elegida la base de datos.
4. **Se compara mejor.** Tres estilos × claro/oscuro en un solo CSS con variables es más rápido de pintar a mano.

**Qué se pierde:** hay que volver a escribir el comportamiento. Por eso el diseño tiene la lista «Lo que la maqueta simplifica»
(el arrastre de HTML5 no funciona en táctil, nada se guarda, etc.).

**Qué se aprovecha tal cual:** el **CSS casi completo pasó a la app** (`app/src/styles/themes/grafito.css`, `papel.css`,
`tinta.css`, `dark.css`), porque está hecho con variables. Lo que se reescribió en TypeScript fue el JavaScript de la maqueta
(arrastre, scroll animado, carné), esta vez con pruebas. Además hubo una **demo en React real** (`react-demo/`) solo para
probar que los componentes de React Bits funcionaban de verdad.

**Cuándo sí conviene hacer la maqueta ya en React:** si el proyecto es chico, si ya tienes decidido el diseño, o si la
maqueta va a ser la base del producto. Aquí no era el caso.

## 11. Mapa de archivos para consultar

| Qué buscas | Dónde |
|---|---|
| El pedido original | `FUNCIONALIDADES_TABLERO_BITACORA.md` |
| Diseño completo aprobado | `docs/superpowers/specs/2026-10-21-tablero-bitacora-design.md` |
| Maqueta aprobada (abrir con doble clic) | `docs/superpowers/specs/assets/2026-10-21-mockup/index.html` |
| Versiones anteriores de la maqueta | `.superpowers/brainstorm/*/content/` (local, no está en GitHub) |
| Plan de construcción | `docs/superpowers/plans/2026-10-21-tablero-bitacora.md` |
| Especificación de varias Bitácoras | `docs/superpowers/specs/2026-10-23-multiple-bitacoras.md` |
| Auditoría de React Bits y parches del carné | `app/src/reactbits/AUDIT.md` |
| Esquema de la base de datos | `app/convex/schema.ts` |
| Pasos de despliegue y migración | `app/CUTOVER.md` |
| Vista local con el servidor real | `app/demo/` (`npm run demo`) |

*Nota: `badge.js` (el carné 3D empaquetado para la maqueta) vive solo en `.superpowers/brainstorm/` y no está en el
repositorio por la licencia Commons Clause de React Bits; en la aplicación real el carné usa el componente copiado en
`app/src/reactbits/Lanyard/`.*
