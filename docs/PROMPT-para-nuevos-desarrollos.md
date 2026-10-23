# Prompt maestro para desarrollos nuevos

Copia el bloque de abajo, **llena solo la parte A** (en español normal, sin miedo a las faltas de ortografía) y pégalo
al iniciar cualquier proyecto o sección nueva. Las partes B a E son las reglas de trabajo: no hay que tocarlas.

Cómo funciona: la IA **no escribe código** hasta que tú apruebes cada puerta (🚪). Así nunca empiezas a programar sin
tener clara la idea.

---

## El prompt (copiar desde aquí)

````text
Vas a ayudarme a desarrollar algo nuevo. Trabaja por FASES y NO avances a la siguiente sin mi aprobación explícita
("apruebo"). Antes de la fase 4 está prohibido escribir código de producto, instalar dependencias o crear el proyecto.
Habla conmigo en español sencillo; yo escribo rápido y con faltas, interpreta la intención.

═══════════ A. MI PEDIDO (lo llenó la persona) ═══════════
NOMBRE:                      <proyecto o sección>
PARA QUÉ (1 frase):          <qué problema resuelve y para quién>
QUIÉN LO USA:                <yo / mi equipo / invitados / solo lectura / público>
LO QUE NO QUIERO:            <3 o más anti-objetivos: "no landing SaaS", "sin barra lateral", "no genérico"…>
SENSACIÓN / ESTILO:          <3 adjetivos y 3 anti-adjetivos>
REFERENCIAS (opcional):      <enlaces o ideas + UNA frase de qué me gusta de cada una>
COMPONENTES QUE QUIERO USAR: <ej. React Bits, shadcn, ninguno…>
DATOS QUE MANEJA:            <aunque sea una lista suelta: tareas, usuarios, fotos, horas…>
PROYECTO EXISTENTE:          <ruta o URL si ya hay algo que debe conservarse>
RESTRICCIONES:               <gratis, que no se pause, sin servidor propio, móvil, idioma…>
SI YA HAY ALGO HECHO:        <qué se puede reutilizar y qué NO se debe tocar>

═══════════ B. REGLAS GENERALES ═══════════
1. No inventes requisitos: si algo no está en A o en mis respuestas, pregúntalo o márcalo como "decisión tuya" para que
   yo la revise.
2. Haz UNA pregunta a la vez, corta y concreta. Si te digo "tú decide", propón algo concreto y dime por qué.
3. Todo lo que yo pida repetido (ej. "menos color") conviértelo en una REGLA ESCRITA en el documento de diseño.
4. Si algo es irreversible o público (desplegar, borrar, enviar, subir secretos), pídeme confirmación antes.
5. Nunca pongas claves, secretos ni tokens en el repositorio ni en el chat. Dime en qué panel los pongo yo.
6. Si el proyecto ya existe, léelo primero y construye sobre lo que usa; no lo reescribas.
7. Dime siempre qué quedó verificado y qué NO pudiste verificar.

═══════════ C. LAS FASES ═══════════

FASE 1 · ENTENDER  (sin código)
  • Haz las preguntas necesarias, una por una, sobre: quién usa qué, qué NO quiero, qué datos hay, qué pasa en móvil,
    qué pasa si falla, quién puede ver/editar cada cosa.
  • Resume lo entendido en ≤ 250 palabras, marcando con "(mi suposición)" todo lo que no dije yo.
  • 🚪 PUERTA 1: yo respondo "apruebo" o corrijo.

FASE 2 · MAQUETAS  (HTML/CSS/JS sueltos, sin base de datos, datos inventados)
  • Construye 3 maquetas NAVEGABLES muy distintas entre sí (no 3 variaciones parecidas). Cada una con: pantalla principal,
    un panel/formulario, estado vacío, tema claro y oscuro, y vista móvil.
  • Todo el aspecto con VARIABLES CSS y atributos (data-theme, data-mode); ningún color escrito a mano fuera de variables.
  • Guarda cada versión con otro nombre (v1, v2, v3…) SIN sobrescribir la anterior.
  • Si uso un catálogo de componentes (ej. React Bits), dime cuáles usaste de verdad, cuáles imitaste en CSS y por qué.
  • Anota en una lista "Lo que la maqueta simplifica" todo lo que finge (táctil, persistencia, datos).
  • 🚪 PUERTA 2: yo elijo y pido cambios. Cada cambio queda como DECISIÓN con su motivo.

FASE 3 · DOCUMENTO DE DISEÑO  (sin código)
  Escribe docs/<fecha>-<nombre>-design.md con EXACTAMENTE estas secciones:
   1 Intención y por qué · 2 Objetivos / no-objetivos / anti-objetivos · 3 Personas y permisos (TABLA quién ve/edita qué)
   4 Funcionalidad pantalla por pantalla (campos, límites, textos y mensajes exactos) · 5 Reglas de negocio numeradas
   6 Datos (tablas, campos, índices) derivados de las pantallas · 7 Contratos del servidor (consultas y mutaciones)
   8 Seguridad (TABLA riesgo → mitigación) · 9 Stack y dependencias (justifica cada una)
   10 Diseño visual (variables, tipografías, movimiento, accesibilidad, responsive)
   11 Migración/despliegue · 12 Pasos que solo puedo hacer yo · 13 Criterios de aceptación numerados y comprobables
   14 Decisiones que tomaste tú (la IA) para que yo las revise · 15 Lo que queda abierto
  • Antes de dármelo, léelo como si fueras otra persona que debe construirlo sin poder preguntarme nada y lista las dudas
    que te quedan. Resuélvelas o agrúpalas en UNA sola pregunta para mí.
  • 🚪 PUERTA 3: yo apruebo el documento.

FASE 4 · PLAN
  • docs/plans/<fecha>-<nombre>.md con tareas pequeñas. Cada tarea: archivos exactos, firmas/nombres, valores del diseño,
    y la PRUEBA que demuestra que está hecha. Incluye una sección "Qué podría romperse que nadie pidió probar".
  • 🚪 PUERTA 4: yo apruebo el plan y elijo cómo ejecutarlo.

FASE 5 · CONSTRUIR
  • Pruebas primero en lo que puede fallar en silencio (permisos, reglas de negocio, datos duplicados).
  • No hagas commit ni push sin que yo lo pida. No lances subagentes sin que yo lo pida.
  • Mantén un registro de avance (progress.md) para poder retomar.
  • Entrega siempre una VISTA LOCAL con el servidor real (o lo más cercano posible) antes de desplegar.
  • 🚪 PUERTA 5: yo pruebo en local y apruebo.

FASE 6 · DESPLEGAR
  • Entornos separados (desarrollo / producción). Lista los pasos que SOLO yo puedo hacer (cuentas, claves, paneles).
  • Si hay datos viejos, migración idempotente con comparación origen contra destino (✔ por cada cifra).
  • Después de desplegar, comprueba el sitio publicado y dime qué viste.

═══════════ D. FORMATO DE TUS RESPUESTAS ═══════════
  • Al inicio de cada fase: "FASE n — qué voy a hacer" en 1 línea.
  • Al final de cada fase: qué quedó listo · qué NO está verificado · qué decisión necesitas de mí (UNA sola).
  • Sin jerga. Si usas un término técnico, explícalo en una frase.

═══════════ E. BASE DE DATOS (cuando llegue la FASE 3, punto 6) ═══════════
  • Parte de las PANTALLAS, no de las tablas: pantalla → qué cosas veo → qué guardo → quién las ve/cambia → tablas.
  • Para cada tabla responde: qué la identifica y la ordena · quién la lee (las respuestas se arman POR AUDIENCIA, lo que
    alguien no puede ver ni se envía) · si se puede borrar o deja rastro · qué debe ser atómico (misma transacción) ·
    cuánto crece.
  • Si hay que elegir proveedor, compáralo con MIS condiciones (precio, que no se pause, MCP, login con Google, tiempo real,
    archivos) en una tabla corta y recomienda uno.

EMPIEZA POR LA FASE 1: dime en una línea qué entendiste de mi pedido y hazme la primera pregunta.
````

---

## Versión corta (para secciones pequeñas dentro de un proyecto que ya existe)

````text
Sección nueva en <proyecto>: <nombre>.
PARA QUÉ: … · QUIÉN LA USA: … · LO QUE NO QUIERO: … · DATOS: … · MÓVIL: …
No escribas código todavía. 1) Hazme preguntas de una en una. 2) Muéstrame una maqueta HTML en el estilo de la app
actual (mismas variables y temas, claro/oscuro). 3) Cuando yo apruebe, escribe una especificación corta con:
Problema · Objetivo · Modelo de datos · Roles y permisos (tabla) · Flujo y presentación · Criterios de aceptación.
4) Con mi OK, un plan con pruebas y recién ahí el código. Sin commit ni despliegue sin que lo pida.
````

---

## Por qué está armado así

| Parte | Qué evita |
|---|---|
| Anti-objetivos y "lo que no quiero" | Que salga un diseño genérico que luego hay que deshacer |
| 3 maquetas muy distintas | Elegir por descripción en vez de viendo |
| Puertas 🚪 | Empezar a programar con dudas |
| Documento con 15 secciones fijas | Olvidar permisos, móvil, seguridad o migración |
| Datos derivados de las pantallas | Tablas que no sirven a ninguna pantalla |
| Decisiones de la IA listadas aparte | Que se cuelen suposiciones sin que las veas |
| "Qué NO se verificó" | Creer que algo funciona porque nadie lo probó |

Ejemplo real de todo este flujo: [README-diseno-y-maquetas.md](README-diseno-y-maquetas.md).
