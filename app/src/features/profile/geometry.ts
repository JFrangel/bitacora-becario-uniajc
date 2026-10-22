// El carné de la Bitácora cuelga de la barra superior, en el hueco que queda entre «Invitar» y «Apariencia».

/** Ancho de la zona que recibe el puntero debajo de la barra, y de la que agarra la cinta dentro de ella (px). */
export const HIT_WIDTH = 380;
export const STRAP_HIT = 28;
/** Espacio libre a la izquierda de «Apariencia» cuando no hay botón «Invitar» (el CSS le deja 34 px de margen). */
const FREE_GAP_CENTER = 17;

export type GeometryInput = {
  /** Bordes izquierdo y derecho de la aplicación, y borde izquierdo de la columna del carné. */
  appLeft: number;
  appRight: number;
  badgeLeft: number;
  /** Borde derecho de «Invitar» (no existe en el enlace de solo lectura) y borde izquierdo de «Apariencia». */
  inviteRight?: number;
  appearanceLeft: number;
};

/** `anchor`: la fracción (0 a 1) del ancho del lienzo donde cuelga la cinta. */
export type Geometry = { gapX: number; stageLeft: number; stageWidth: number; anchor: number; hitLeft: number; strapLeft: number };

/** Cuánto sobresale el lienzo a cada lado de la aplicación: un quinto de su ancho, hasta 300 px. La pantalla recorta lo que sobra. */
export const OVERHANG_SHARE = 0.2;
export const OVERHANG_MAX = 300;

/**
 * El lienzo (transparente) es **más ancho que la aplicación, a los dos lados**: el carné se arrastra y se lanza por toda la
 * pantalla sin chocar con ningún «muro» invisible (el borde del lienzo queda fuera de la pantalla). La cinta cuelga del
 * hueco de la barra (`anchor` es esa posición como fracción del ancho del lienzo).
 */
export function badgeGeometry(input: GeometryInput): Geometry {
  const gapX = input.inviteRight === undefined ? input.appearanceLeft - FREE_GAP_CENTER : (input.inviteRight + input.appearanceLeft) / 2;
  const fromBadge = gapX - input.badgeLeft;
  const appWidth = Math.max(1, input.appRight - input.appLeft);
  const overhang = Math.min(OVERHANG_MAX, appWidth * OVERHANG_SHARE);
  const stageWidth = appWidth + overhang * 2;
  return {
    gapX,
    stageLeft: input.appLeft - overhang - input.badgeLeft,
    stageWidth,
    anchor: Math.min(1, Math.max(0, (gapX - (input.appLeft - overhang)) / stageWidth)),
    hitLeft: fromBadge - HIT_WIDTH / 2,
    strapLeft: fromBadge - STRAP_HIT / 2,
  };
}

export const px = (value: number) => `${value.toFixed(1)}px`;

const COLUMN = { size: 0.66, strapLength: 0.5, heightMax: 700, heightMargin: 60 };
/** El carné cuelga a esta fracción del alto del lienzo (el componente: `mix(0.12, 0.42, strapLength)`). */
const topShare = (strapLength: number) => 0.12 + (0.42 - 0.12) * strapLength;

/**
 * El lienzo de la columna era de `min(700, alto − 60)` px y ahora mide todo el alto de la ventana (más sitio para bajar el
 * carné). El componente escala el carné con el alto del lienzo, así que estos dos ajustes lo dejan del mismo tamaño y en el
 * mismo lugar que antes: solo hay más lienzo vacío alrededor.
 */
export function columnTuning(viewportHeight: number): { size: number; strapLength: number } {
  const before = Math.min(COLUMN.heightMax, Math.max(1, viewportHeight - COLUMN.heightMargin));
  const share = before / Math.max(1, viewportHeight);
  const strapLength = (topShare(COLUMN.strapLength) * share - 0.12) / (0.42 - 0.12);
  return { size: COLUMN.size * share, strapLength: Math.min(1, Math.max(0, strapLength)) };
}
