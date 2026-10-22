import { LIMITS } from '../../../convex/lib/limits';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FULL_MAX_SIDE = 1400;
const THUMB_MAX_SIDE = 480;
const FULL_MAX_BYTES = 1.2 * 1024 * 1024;
const DECODE_TIMEOUT_MS = 10_000;

/** El navegador no pudo abrir el archivo como imagen (por ejemplo un HEIC). */
export class ImageReadError extends Error {
  constructor() {
    super('No se pudo leer esa imagen. Prueba con un JPG o un PNG.');
    this.name = 'ImageReadError';
  }
}

/** Reduce (nunca amplía) manteniendo la proporción hasta que el lado mayor mida `max`. */
export function fitWithin(width: number, height: number, max: number): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) };
}

/** Mensaje si el archivo no se puede adjuntar (no es imagen, pasa de 5 MB o ya hay 4); `null` si está bien. */
export function checkImageFile(file: File, alreadyAttached: number): string | null {
  if (!file.type.startsWith('image/')) return 'Se omitió un archivo que no es una imagen.';
  if (file.size > MAX_IMAGE_BYTES) return `${file.name} supera el límite de 5 MB.`;
  if (alreadyAttached >= LIMITS.photos) return `Puedes adjuntar hasta ${LIMITS.photos} imágenes por registro.`;
  return null;
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Respaldo para navegadores sin `createImageBitmap` o que no abren este formato con él.
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      // Algunos navegadores no avisan nunca cuando no pueden abrir el formato: se espera un máximo.
      const giveUp = setTimeout(() => reject(new ImageReadError()), DECODE_TIMEOUT_MS);
      el.onload = () => {
        clearTimeout(giveUp);
        resolve(el);
      };
      el.onerror = () => {
        clearTimeout(giveUp);
        reject(new ImageReadError());
      };
      el.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageReadError())), 'image/jpeg', quality));

function draw(source: CanvasImageSource, width: number, height: number, max: number): HTMLCanvasElement {
  const { w, h } = fitWithin(width, height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageReadError();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, w, h);
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, w, h);
  return canvas;
}

/**
 * Comprime en el navegador: JPEG con el lado mayor a 1400 px (y de máximo 1,2 MB) y una miniatura de 480 px que se
 * usa en las listas. Lanza `ImageReadError` si el navegador no puede abrir el archivo.
 */
export async function compressImage(file: File): Promise<{ full: Blob; thumb: Blob }> {
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new ImageReadError();
  }
  try {
    const canvas = draw(decoded.source, decoded.width, decoded.height, FULL_MAX_SIDE);
    let full = await toJpeg(canvas, 0.86);
    for (const quality of [0.78, 0.7, 0.62, 0.54]) {
      if (full.size <= FULL_MAX_BYTES) break;
      full = await toJpeg(canvas, quality);
    }
    const thumb = await toJpeg(draw(decoded.source, decoded.width, decoded.height, THUMB_MAX_SIDE), 0.8);
    return { full, thumb };
  } finally {
    decoded.close();
  }
}
