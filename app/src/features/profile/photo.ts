import { LIMITS } from '../../../convex/lib/limits';

/** Lado del encuadre en pantalla (px): el desplazamiento y la escala se guardan en estas unidades. */
export const CROP_VIEW = 220;
const OUTPUT = 1024;
const QUALITIES = [0.92, 0.86, 0.8, 0.72, 0.62];

export type Crop = { scale: number; ox: number; oy: number };
type Drawable = CanvasImageSource & { width: number; height: number };

const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);

/**
 * «Mejorar imagen»: máscara de enfoque (detalle fino) más un poco de claridad local (detalle ancho). No inventa
 * información: evita perderla al reducir y al acercar. `fine` y `wide` son la misma imagen desenfocada poco y mucho;
 * el cambio por canal queda acotado a ±18 niveles y los `edge` píxeles del borde no se tocan.
 */
export function enhanceImageData(img: ImageData, fine: Uint8ClampedArray, wide: Uint8ClampedArray, edge: number): void {
  const { width: w, height: h, data } = img;
  for (let y = edge; y < h - edge; y += 1) {
    for (let x = edge; x < w - edge; x += 1) {
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k += 1) {
        const v = data[i + k];
        const detail = clamp((v - fine[i + k]) * 0.35 + (v - wide[i + k]) * 0.08, -18, 18);
        data[i + k] = clamp(v + detail, 0, 255);
      }
    }
  }
}

/** Obtiene los dos desenfoques con el filtro del propio lienzo (proporcionales al ancho) y aplica `enhanceImageData`. */
export function enhanceCanvas(canvas: HTMLCanvasElement): void {
  const { width: w, height: h } = canvas;
  const context = canvas.getContext('2d');
  if (!context) return;
  const base = context.getImageData(0, 0, w, h);
  const blurred = (radius: number) => {
    const copy = document.createElement('canvas');
    copy.width = w;
    copy.height = h;
    const c = copy.getContext('2d')!;
    c.filter = `blur(${radius}px)`;
    c.drawImage(canvas, 0, 0);
    return c.getImageData(0, 0, w, h).data;
  };
  enhanceImageData(base, blurred(1.6 * (w / OUTPUT)), blurred(14 * (w / OUTPUT)), Math.round(24 * (w / OUTPUT)));
  context.putImageData(base, 0, 0);
}

const decodedBytes = (dataUrl: string) => {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
};

/** Redimensiona el logo sin recortarlo y conserva transparencia cuando usa PNG o WebP. */
export function optimizeBadgeLogo(img: Drawable, makeCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): string {
  for (const maxSide of [512, 384, 256]) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = makeCanvas();
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo procesar el logo.');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);

    const png = canvas.toDataURL('image/png');
    if (decodedBytes(png) <= LIMITS.badgeLogoBytes) return png;
    for (const quality of [0.9, 0.82, 0.74]) {
      const webp = canvas.toDataURL('image/webp', quality);
      if (webp.startsWith('data:image/webp;base64,') && decodedBytes(webp) <= LIMITS.badgeLogoBytes) return webp;
    }
  }
  throw new Error('El logo no se pudo comprimir a 180 KB. Prueba con una imagen más pequeña.');
}

/**
 * La foto del carné: un cuadrado de 1024 px en JPEG de a lo sumo 400 KB. `t` describe el encuadre en las unidades de la
 * vista previa de 220 px. Baja la calidad (0,92 → 0,62) hasta que cabe. Con `enhance: false` no toca la imagen.
 */
export function cropToJpeg(
  img: Drawable,
  t: Crop,
  opts: { size?: number; enhance?: boolean } = {},
  deps: { makeCanvas?: () => HTMLCanvasElement; enhance?: (canvas: HTMLCanvasElement) => void } = {},
): string {
  const { size = OUTPUT, enhance = true } = opts;
  const canvas = (deps.makeCanvas ?? (() => document.createElement('canvas')))();
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const k = size / CROP_VIEW;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.drawImage(img, t.ox * k, t.oy * k, img.width * t.scale * k, img.height * t.scale * k);
  if (enhance) (deps.enhance ?? enhanceCanvas)(canvas);
  for (const quality of QUALITIES) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (decodedBytes(url) <= LIMITS.photoBytes) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.5);
}

/** Abre una imagen (dirección `blob:` o `data:`). `null` si el navegador no puede leerla. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const giveUp = setTimeout(() => resolve(null), 10_000);
    img.onload = () => {
      clearTimeout(giveUp);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(giveUp);
      resolve(null);
    };
    img.src = src;
  });
}
