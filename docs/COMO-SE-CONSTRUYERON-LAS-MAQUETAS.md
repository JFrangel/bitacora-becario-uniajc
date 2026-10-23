# Cómo se construyeron las maquetas (con las herramientas reales que se usaron)

Este documento sale del **registro de herramientas de la sesión** del 21 y 22 de octubre de 2026, no de memoria.
Las horas están en UTC (Colombia es UTC−5).

## 1. Respuesta corta

Sí: **no fue solo «HTML a mano»**. La maqueta es una mezcla de cuatro cosas:

| Parte de la maqueta | Cómo se hizo | Lenguaje |
|---|---|---|
| Pantallas, estilos, tablero, calendario, Bitácora, paneles | Archivos escritos a mano y retocados con ediciones sucesivas | HTML + CSS + JavaScript (sin React) |
| Servirla y verla en el navegador | La **habilidad `superpowers:brainstorming`** y su «compañero visual» (un servidor local) | script de shell + Node |
| Catálogo de ideas y código de React Bits | Consultas web y descarga directa desde GitHub | — |
| **El carné 3D** | Se bajó el componente **real** `Lanyard.tsx` de React Bits, se instaló React + three + esbuild en una carpeta aparte y se **compiló a un solo archivo `badge.js`** que la maqueta carga | **React + TypeScript + three.js**, compilado |

O sea: la maqueta es JavaScript simple **salvo el carné**, que es React de verdad empaquetado. Por eso notaste que «se
empezó con código» antes de que hubiera app: hubo un mini-proyecto de compilación solo para el carné.

## 2. Herramientas usadas, una por una

| Herramienta | Para qué | Dónde queda |
|---|---|---|
| Habilidad `superpowers:brainstorming` | Método de preguntas y regla de «no construir hasta que apruebes» | plugin de Claude (no está en el repo) |
| Compañero visual: `start-server.sh --project-dir /d/becario` (de esa habilidad) | Servidor local que sirve la carpeta `content/` para ver las maquetas en el navegador | `.superpowers/brainstorm/<sesión>/` (ignorada por git) |
| Escritura/edición de archivos (`Write`, `Edit`) | Crear `direccion-visual.html/.css/.js` y retocarlos en cada ronda (decenas de ediciones por versión) | `.superpowers/brainstorm/4866-1792629770/content/` |
| Consultas web (`WebFetch`, `WebSearch`) | Leer catálogos, precios y documentación (lista en la sección 4) | — |
| `curl` a GitHub (`api.github.com`, `raw.githubusercontent.com`) | Bajar `Lanyard.tsx` y `Lanyard.css` (variante `ts-default`) del repositorio de React Bits | carpeta de trabajo temporal |
| `npm` + **esbuild** + `react@18` + `react-dom@18` + `three` | Compilar el carné a un solo archivo | carpeta temporal, no en el repo |
| `sed` y scripts de Node (`patch-live.cjs`, `patch-v2.cjs`) | Parchear el Lanyard (resolución, halo, límites) antes de compilar | carpeta temporal |
| `pngjs` (script de Node) | Convertir el logotipo de AthenIA en máscara de una tinta (`athenia-mark.png`) | `docs/…/2026-10-21-mockup/` |
| `node --check` | Revisar la sintaxis del JavaScript de la maqueta | — |
| `cp` | Copiar la versión aprobada a `docs/superpowers/specs/assets/2026-10-21-mockup/` | repositorio |

También existe una **demo anterior en React** (`react-demo/`, con Vite y `jsrepo` apuntando a `https://reactbits.dev/r`, que
instaló los componentes `Counter` y `AnimatedList`), y dos tableros sueltos (`standalone-task-board.html`,
`task-board-flow.html`). Esa carpeta se creó el 21 de octubre alrededor de las 22:19 UTC, **en una sesión anterior a este
registro**, así que no puedo contarte desde aquí quién la lanzó ni con qué órdenes; solo sé qué contiene.

## 3. Paso a paso, en orden

1. **21 oct 23:57** · Se activa la habilidad *brainstorming*. Se leen los archivos del proyecto actual (`.gitignore`,
   `server.mjs`, `netlify.toml`, lista de archivos). Se abre el primer enlace que diste (`modulify.ai/templates`) y el de
   React Bits.
2. **22 oct 00:01–00:39** · Se consultan REA, HyperFrames y React Bits, y se **compara la base de datos** (precios y límites
   de Convex, Turso y Neon; documentación de Convex Auth y de su MCP). Se registra el MCP de Convex.
3. **22 oct 00:42** · Se lee la guía del compañero visual y se **arranca su servidor**. Se revisan sus rutas y cabeceras de
   seguridad para saber cómo servir archivos.
4. **22 oct 00:48–00:50** · Primera maqueta: se escribe `direccion-visual.css` (los tres estilos), luego `direccion-visual.js`
   y `direccion-visual.html`.
5. **00:51 → 02:06** · Rondas de cambios con tus comentarios. Cada ronda = editar CSS/JS y **guardar una página nueva**
   (`-v2`, `-v3`, `-v4`, `-v5`) sin pisar la anterior:
   - v2: Grafito por defecto con tema claro y oscuro, marca «Bitácora» sin «jurídica», horas.
   - v3: formulario real de la Bitácora (campos de tu sitio publicado).
   - v4: «Nueva tarea», muchas tarjetas por columna, vista compacta.
   - v5: scroll animado (estilo AnimatedList), subtareas, color mínimo por columna, Bitácora con panel lateral.
6. **22 oct 01:29** · Se escribe el documento de diseño con lo aprobado.
7. **22 oct 02:26–02:41 · El carné** (la parte «más programada»):
   1. `curl` baja `Lanyard.tsx` y `Lanyard.css` de `DavidHDev/react-bits`.
   2. En una carpeta aparte: `npm init`, `npm i react@18 react-dom@18 three esbuild`.
   3. Se escribe `entry.tsx`, que expone `window.mountBadge(elemento, propiedades)`.
   4. Se compila con esbuild a un archivo único que la maqueta carga con una etiqueta `<script>`.
   5. Se revisa el resultado buscando construcciones prohibidas por la política de seguridad
      (`eval(`, `new Function`, `insertRule`, `XMLHttpRequest`…).
   6. Se convierte el logotipo a máscara con `pngjs`.
   7. Se reemplaza en el JavaScript de la maqueta el bloque «Perfil y carné» y se copia la versión final a `docs/`.
8. **22 oct 02:52–03:24** · Parches al Lanyard (resolución al doble, halo en GPU, etc.) y recompilado.
9. **22 oct 03:43** · **Recién aquí empieza `app/`** (`package.json` de la app real), ya con el diseño y el plan aprobados.

## 4. De dónde se leyó cada cosa

| Consultado | Para qué |
|---|---|
| `modulify.ai/templates` (tu enlace) | Catálogo de componentes (categorías y nombres). No trae código ni licencia. |
| `reactbits.dev/get-started/index` y `/installation` | Formas de instalar y las cuatro variantes (JS/TS × CSS/Tailwind). |
| `github.com/DavidHDev/react-bits` + `raw.githubusercontent.com` | Código real y licencia de los componentes. |
| `github.com/morluto/rea` y `heygen-com/hyperframes` | Instalación de REA y HyperFrames, que pediste. |
| `convex.dev/pricing`, `docs.convex.dev/production/state/limits`, `turso.tech/pricing`, `neon.com/pricing` | Comparar bases de datos con tus condiciones. |
| `docs.convex.dev/ai/convex-mcp-server`, `neon.com/docs/ai/neon-mcp-server` | Conectar el MCP de la base elegida. |
| `docs.convex.dev/auth/convex-auth`, `labs.convex.dev/auth/...` | Login con Google. |

## 5. Por qué hay dos lenguajes en la maqueta

- **Para decidir el aspecto** basta HTML/CSS/JS plano: se abre con doble clic y cambia en un minuto.
- **El carné no se puede imitar con CSS**: es una escena 3D con física. Lo único razonable era usar el componente real,
  y ese componente es React + three. Como la maqueta no tenía React, se **empaquetó aparte** y se enchufó.
- Consecuencia: en la maqueta el carné solo funciona con ese `badge.js`. **No está en el repositorio** (por la licencia
  Commons Clause de React Bits, que no permite redistribuir el componente suelto). Sin él, la maqueta muestra la imagen
  plana. En la app real, el componente vive en `app/src/reactbits/Lanyard/` y se compila con Vite como cualquier módulo.

## 6. Cómo repetirlo en otro proyecto

1. **Maqueta base** (3 archivos):
   ```text
   mockup/index.html        ← estructura
   mockup/estilos.css       ← variables por estilo: .app[data-theme="a|b|c"][data-mode="light|dark"]
   mockup/comportamiento.js ← datos inventados + interacción
   ```
   Cada versión nueva es otra página (`index-v2.html`…) que reutiliza el mismo CSS y JS.
2. **Servirla**: abre `index.html` con doble clic, o usa cualquier servidor estático local.
3. **Si necesitas un componente de React Bits** que no se puede imitar (3D, WebGL):
   ```bash
   mkdir trabajo && cd trabajo && npm init -y
   npm i react@18 react-dom@18 three esbuild
   curl -sSL -o Componente.tsx https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/ts-default/Components/<Nombre>/<Nombre>.tsx
   curl -sSL -o Componente.css https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/ts-default/Components/<Nombre>/<Nombre>.css
   # entry.tsx: expón una función en window que monte el componente en un elemento
   npx esbuild entry.tsx --bundle --minify --format=iife --jsx=automatic --loader:.css=css \
     --define:process.env.NODE_ENV='"production"' --outfile=out/componente.js
   ```
   Para componentes simples, la CLI de React Bits (`jsrepo`, registro `https://reactbits.dev/r`) los copia a `src/components`.
4. **Antes de usar un componente**, léelo: busca `eval`, `new Function`, `<style>` inyectado y `fetch`, y lee su licencia.
5. **Guarda cada versión** y anota cada cambio tuyo como decisión.

## 7. Lo que no puedo afirmar

- Quién creó la demo `react-demo/` y los tableros sueltos de la carpeta `4336-…` (sesión anterior a este registro).
- Que existan más herramientas fuera de este historial: si en otra sesión se usó algo, no aparece aquí.
