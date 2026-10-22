# Auditoría de componentes de React Bits

Licencia: MIT con cláusula Commons Clause (`LICENSE.md`, copiada tal cual). Se usan **dentro de esta aplicación**; no se
venden, sublicencian ni redistribuyen como componentes.

Política de seguridad de contenido de la aplicación: `script-src 'self'`, `style-src 'self'`, sin `eval`, sin estilos
inyectados y sin peticiones a otros dominios. `node scripts/audit-reactbits.mjs` revisa cada carpeta de `src/reactbits/`
y busca `eval`, `new Function`, `<style`, `createElement('style')`, `insertRule`, `adoptedStyleSheets`, `fetch(` y
`XMLHttpRequest`. La auditoría de origen (22 de octubre de 2026, rama `main` de `DavidHDev/react-bits`, variante
`src/ts-default`) se hizo con las mismas búsquedas sobre los ocho componentes del plan más Lanyard.

| Componente | Origen | Veredicto de seguridad | Uso en la aplicación |
|---|---|---|---|
| Lanyard | `Components/Lanyard` | **Pasa.** Solo importa `three`; no usa `eval`, estilos inyectados ni `fetch`. | **Copiado** a `src/reactbits/Lanyard/` y parchado (ver abajo). Carné 3D. |
| SpotlightCard | `Components/SpotlightCard` | Pasa. | **No se copia.** La versión actual dibuja grano con `mix-blend-mode` y máscaras por tarjeta; con cientos de tarjetas rompe el presupuesto de movimiento. Se usa el foco de luz de la maqueta aprobada (una variable CSS por tarjeta). |
| ShinyText | `TextAnimations/ShinyText` | Pasa. | **No se copia.** Anima por JavaScript cada cuadro y no se detiene solo (la especificación pide 3 vueltas). Se usa la animación CSS de la maqueta. |
| CountUp | `TextAnimations/CountUp` | Pasa, pero exige la dependencia `motion`. | **No se copia.** Menos dependencias es mejor: el conteo de 800 ms de la maqueta ocupa 15 líneas. |
| TiltedCard | `Components/TiltedCard` | Pasa. | **No se copia.** Es una tarjeta de imagen con capas; la inclinación de Papel de la maqueta es una variable CSS por tarjeta. |
| Magnet | `Animations/Magnet` | Pasa. | **No se copia.** Se usa el imán de la maqueta (un solo oyente de puntero). |
| ClickSpark | `Animations/ClickSpark` | Pasa. | **No se copia.** Ocupa un lienzo a pantalla completa; las chispas de la maqueta son 14 puntos que nacen en la tarjeta movida. |
| ElectricBorder | `Animations/ElectricBorder` | Pasa. | **No se copia.** Anima un filtro SVG, que el presupuesto de movimiento prohíbe en elementos repetidos. |
| PillNav | `Components/PillNav` | Pasa. | **No se copia.** La barra de la maqueta (indicador deslizante de 500 ms) ya está construida en `shell/Navbar.tsx`. |

Criterio para no copiar: "donde un componente encaje directamente y no añada dependencias, se usa; donde no, se usa el
CSS de la maqueta" (especificación, sección 9). Todos pasan la auditoría de seguridad; los que no se copian se descartan
por **rendimiento, dependencias o por no coincidir con la maqueta aprobada**, no por la política de seguridad.
Si algún día se quiere uno de ellos, se copia a `src/reactbits/<Nombre>/` y esta prueba lo vuelve a auditar.

## Parches a Lanyard

La copia de `Lanyard.tsx` (variante TypeScript de React Bits, solo depende de `three`) tiene estos diez cambios. Ninguno
añade dependencias, estilos inyectados ni peticiones de red; la prueba de `audit.test.ts` los revisa igual que al resto.

| # | Cambio | Para qué |
|---|---|---|
| a | `FACE_WIDTH = 2048` (el original usa una textura menor). | Las caras se dibujan a 2048 × 2880: el texto del carné se lee al acercarlo. |
| b | Resolución adaptativa en `resize`: `setPixelRatio(min(3, max(1, min(max(2, dpr), √(2,4·10⁶ / (ancho · alto))))))`. El original usa `min(dpr, 2)` y se veía borroso a 1×. | Nítido en pantallas de densidad 1, sin pasar de 2,4 millones de píxeles (no se atasca en pantallas grandes). |
| c | Propiedad `fx?: { size, dot?, dotColor? }`. Uniformes `fxOn`, `fxTime`, `fxSize`, `fxDot`, `fxDotColor` en el material del frente; el sombreador suma a `outgoingLight` un halo que late alrededor del punto de «ACTIVO» (diseño Circuito). `resting` es falso mientras haya `fx`. | La única animación del carné; se calcula en el sombreador: **no se repinta ni se vuelve a subir la textura 2D por cuadro**. Con «reducir movimiento» no hay 3D y por tanto tampoco halo. |
| d | Propiedad `bounds` (activa por defecto) y `keepInside()`: tras cada paso de la simulación limita la posición horizontal de los nodos de la cuerda y del carné al ancho visible del lienzo (menos el semiancho del carné). | El carné **nunca se corta** al arrastrarlo o lanzarlo hacia los lados, tampoco en el enlace de solo lectura. |
| e | En `tick`, sin puntero encima, arrastre ni presión durante 2,5 s (`activeUntil`), se omiten los cuadros que llegan a menos de 32 ms del anterior. | ≈ 30 cuadros por segundo en reposo: el carné colgado no gasta batería ni compite con el desplazamiento de las listas. |
| f | `pickBand`: la cinta también se agarra. Se busca el punto de la cuerda más cercano al puntero en pantalla (a menos de 22 px) y el carné se agarra desde ahí, como una palanca. Pulsar la cinta no gira el carné. | En la Bitácora la cinta cruza la barra superior: poder arrastrarlo desde ella, también en el enlace de solo lectura. |
| g | La propiedad `anchor` acepta también un número de 0 a 1 (la fracción del ancho del lienzo donde cuelga la cinta), además de `left`/`center`/`right`. | El lienzo de la Bitácora ocupa todo el ancho de la aplicación y la cinta cuelga del hueco de la barra, donde sea que caiga. |
| h | `introUntil`: durante los primeros 2,5 s de la entrada del carné (cae de lado desde la derecha) no rige `bounds`. | En un lienzo angosto la cuerda empieza fuera del límite y el carné se quedaba atascado arriba. `IdBadge` además solo activa `bounds` en la columna de la Bitácora, no en el panel de perfil. |
| i | Cuadros lentos (equipo sin aceleración gráfica): tras 12 cuadros seguidos de más de 60 ms baja la resolución (hasta el 60 %) y la devuelve tras 60 cuadros rápidos seguidos; no cuenta la carga de la página (primeros 4 s). La entrada del carné (`introDeadline`) no puede durar más de 3 s: pasado ese tiempo queda colgando. | El carné no parece «atascado» arriba a la derecha cuando el equipo dibuja a 1–3 cuadros por segundo, y una pausa al cargar la página no lo deja borroso para siempre. |
| j | Propiedad `pixelBudget` (por omisión 2,4 millones de píxeles). | La columna de la Bitácora, con un lienzo del tamaño de la pantalla, pide 5 millones: con el presupuesto por omisión la resolución caía a 1× y el carné se veía borroso. |

El lienzo de la columna de la Bitácora es más grande que la pantalla: sobresale un quinto del ancho de la aplicación (hasta 300 px)
a cada lado (`--stage-left` y `--stage-w` los publica `BadgeColumn`) y mide todo el alto de la ventana (`height: 100vh` en
`layout.css`, y la zona de puntero igual). El borde del lienzo queda fuera de la pantalla: el carné se mueve por toda ella sin
«muros» invisibles a media página. No se tocó la física.

`filter: drop-shadow` sobre el lienzo (que mencionaba la especificación) **no se usa**: `motion.test.ts` prohíbe `filter` en
cualquier lienzo o contenedor del carné porque obliga a recomponer el lienzo en cada cuadro. El carné ya tiene su propia
iluminación y sombra en la escena 3D.
