import { CROP_VIEW } from './photo';

/** Encuadre de la foto en las unidades de la vista previa de 220 px: `scale` = píxeles de pantalla por píxel de imagen. */
export type CropState = { base: number; scale: number; ox: number; oy: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
export const KEY_STEP = 8;

type Size = { width: number; height: number };

/** La imagen siempre cubre el cuadrado: nunca se ve fondo vacío. */
export function clampCrop(state: CropState, img: Size): CropState {
  return {
    ...state,
    ox: Math.min(0, Math.max(CROP_VIEW - img.width * state.scale, state.ox)),
    oy: Math.min(0, Math.max(CROP_VIEW - img.height * state.scale, state.oy)),
  };
}

/** Empieza con el lado menor llenando el cuadrado; `bias` (0 a 1) decide cuánto se baja el encuadre si la foto es alta. */
export function initialCrop(img: Size, bias = 0.2): CropState {
  const base = CROP_VIEW / Math.min(img.width, img.height);
  return clampCrop({ base, scale: base, ox: (CROP_VIEW - img.width * base) / 2, oy: -(img.height * base - CROP_VIEW) * bias }, img);
}

/** Acerca o aleja desde el centro del cuadrado. `zoom` va de 1 a 3 veces el encuadre inicial. */
export function zoomCrop(state: CropState, zoom: number, img: Size): CropState {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const scale = state.base * z;
  const ratio = scale / state.scale;
  const c = CROP_VIEW / 2;
  return clampCrop({ ...state, scale, ox: c - (c - state.ox) * ratio, oy: c - (c - state.oy) * ratio }, img);
}

export function moveCrop(state: CropState, dx: number, dy: number, img: Size): CropState {
  return clampCrop({ ...state, ox: state.ox + dx, oy: state.oy + dy }, img);
}

/** Cuánto está acercada la foto (1 a 3), para el control deslizante. */
export const zoomOf = (state: CropState) => state.scale / state.base;
