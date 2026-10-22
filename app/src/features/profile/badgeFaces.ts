import type { BadgeData } from '../../../convex/lib/profile';
import { DESIGNS, DEFAULT_DESIGN, isDesignId } from './badgeDesigns';
import type { BadgeDesignId, Canvas, DrawEnv, Ctx2D, Finish, Fx } from './badgeDesigns';
import { initialsOf, nameLines } from './names';

export const FACE_W = 1024;
export const FACE_H = 1440;
const MARGIN = 84;
const SANS = '"Space Grotesk", Inter, sans-serif';

/** Colores y tipografías del estilo y tema activos (se leen de las variables CSS de la aplicación). */
export type Palette = { bg: string; ink: string; muted: string; accent: string; line: string; fontMono: string; fontBody: string; dark: boolean };

export type FacesInput = {
  design: BadgeDesignId;
  data: BadgeData;
  palette: Palette;
  /** La foto ya recortada (cuadrada) o `null` para usar las iniciales. */
  photo?: CanvasImageSource | null;
  /** El logotipo de AthenIA como máscara de una sola tinta. */
  logoMask?: CanvasImageSource | null;
  /** Factor de resolución de las caras (2 = 2048 × 2880). */
  scale?: number;
};

export type Faces = { front: string; back: string; strap: string; cardColor: string; finish: Finish; fx?: Fx };

const defaultCanvas = (): Canvas => document.createElement('canvas');

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export const hasGroupLogo = (group: string | undefined) => /athen/i.test(group ?? '');

/** Texto legible sobre el color de acento del estilo: oscuro sobre claro y blanco sobre oscuro. */
export const onAccentFor = (accent: string) => (isHex(accent) && luminance(accent) < 0.179 ? '#ffffff' : '#0e0e0e');

/** Color de marca del carné: el azul de AthenIA si el grupo tiene logotipo; si no, el acento del estilo. */
export function brandColors(accent: string, dark: boolean, logoOn: boolean) {
  return {
    brand: logoOn ? (dark ? '#6aa5ff' : '#0f4aa8') : accent,
    // Sin logotipo el texto va sobre el acento del estilo: blanco u oscuro, el que contraste (AA en los seis temas).
    onBrand: logoOn ? (dark ? '#071533' : '#ffffff') : onAccentFor(accent),
  };
}

const rgba = (hex: string, alpha: number) => {
  if (!isHex(hex)) return 'transparent';
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${(n & 255)}, ${alpha})`;
};

const joinDot = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' · ');

/** Tipografías que se cargan solo cuando se dibuja un carné (no entran en el paquete principal). */
let fontsReady: Promise<unknown> | null = null;
export function loadBadgeFonts(): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  fontsReady ??= (async () => {
    await Promise.all([import('@fontsource/anton/latin-400.css'), import('@fontsource/jetbrains-mono/latin-800.css')]).catch(() => null);
    await Promise.all(['700 90px "Space Grotesk"', '700 90px Inter', '400 90px Anton', '800 90px "JetBrains Mono"', '500 30px "JetBrains Mono"'].map((font) => document.fonts.load(font).catch(() => null)));
  })();
  return fontsReady;
}

const toBlobUrl = (canvas: Canvas, type: string, quality?: number) =>
  new Promise<string>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('No se pudo codificar el carné.'))), type, quality),
  );

/**
 * Dibuja el frente, el reverso y la cinta del carné con el diseño elegido y los datos de la persona, y los devuelve
 * como imágenes (`blob:`). Los datos son solo los del carné: nombre, rol, programa, semestre, institución y grupo.
 */
export async function drawBadgeFaces(input: FacesInput, makeCanvas: () => Canvas = defaultCanvas, encode: typeof toBlobUrl = toBlobUrl): Promise<Faces> {
  const { design, data, palette, photo = null, logoMask = null, scale = 2 } = input;
  const spec = DESIGNS[isDesignId(design) ? design : DEFAULT_DESIGN];
  const group = (data.group ?? '').trim();
  const logoOn = hasGroupLogo(group) && Boolean(logoMask);
  const { brand, onBrand } = brandColors(palette.accent, palette.dark, logoOn);
  const [W, H, CX] = [FACE_W, FACE_H, FACE_W / 2];

  const label: DrawEnv['label'] = (c, text, x, y, color = palette.muted, size = 30, spacing = 3) => {
    c.fillStyle = color;
    c.font = `500 ${size}px ${palette.fontMono}`;
    c.letterSpacing = `${spacing}px`;
    c.fillText(text, x, y);
    c.letterSpacing = '0px';
  };
  const fit: DrawEnv['fit'] = (c, text, weight, size, maxWidth, min = 28, family = SANS, style = '') => {
    let current = size;
    do {
      c.font = `${style} ${weight} ${current}px ${family}`.trim();
      if (c.measureText(text).width <= maxWidth) break;
      current -= 2;
    } while (current > min);
  };
  const wrap: DrawEnv['wrap'] = (c, text, x, y, maxWidth, lineHeight) => {
    let row = '';
    let yy = y;
    text.split(' ').forEach((word) => {
      const test = row ? `${row} ${word}` : word;
      if (c.measureText(test).width > maxWidth && row) {
        c.fillText(row, x, yy);
        row = word;
        yy += lineHeight;
      } else row = test;
    });
    c.fillText(row, x, yy);
    return yy;
  };
  /** El nombre del grupo con «IA» resaltado. Con `left`, `x` es el borde izquierdo; si no, el centro. */
  const wordmark: DrawEnv['wordmark'] = (c, x, y, size, base, accentColor, family = SANS, weight = 700, left = false) => {
    const word = group || 'AthenIA';
    const cut = /ia$/i.test(word) ? word.length - 2 : word.length;
    c.font = `${weight} ${size}px ${family}`;
    const [a1, a2] = [word.slice(0, cut), word.slice(cut)];
    const [wa, wb] = [c.measureText(a1).width, c.measureText(a2).width];
    const x0 = left ? x : x - (wa + wb) / 2;
    c.textAlign = 'left';
    c.fillStyle = base;
    c.fillText(a1, x0, y);
    c.fillStyle = accentColor;
    c.fillText(a2, x0 + wa, y);
    return wa + wb;
  };
  /** El logotipo (máscara de una sola tinta) teñido del color pedido y al ancho pedido. */
  const tint: DrawEnv['tint'] = async (color, width) => {
    if (!logoMask) return null;
    const source = logoMask as CanvasImageSource & { width: number; height: number };
    const canvas = makeCanvas();
    canvas.width = width;
    canvas.height = Math.round((width * source.height) / source.width);
    const c = canvas.getContext('2d')!;
    c.drawImage(source, 0, 0, canvas.width, canvas.height);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const role = data.roleLabel;
  const env: DrawEnv = {
    W, H, M: MARGIN, CX,
    mono: palette.fontMono, body: palette.fontBody, bg: palette.bg, ink: palette.ink, muted: palette.muted, accent: palette.accent,
    onAccent: onAccentFor(palette.accent), line: palette.line, dark: palette.dark, brand, onBrand, deep: '#0b2f73', rgba,
    photo, group, logoOn,
    name: data.name, role, program: data.program ?? '', term: data.term ?? '', school: data.institution ?? '',
    lines: nameLines(data.name), initials: initialsOf(data.name),
    pill: (group ? `${role} de ${group}` : role).toUpperCase(),
    detail: joinDot(data.program, data.term),
    markBack: logoOn ? await tint('#ffffff', 520) : null,
    label, fit, wrap, wordmark, tint,
  };

  const face = (): [Canvas, Ctx2D] => {
    const canvas = makeCanvas();
    canvas.width = W * scale;
    canvas.height = H * scale;
    const c = canvas.getContext('2d')!;
    c.scale(scale, scale);
    return [canvas, c];
  };
  const [front, f] = face();
  const [back, b] = face();
  const strap = makeCanvas();
  strap.width = 1024;
  strap.height = 96;
  const s = strap.getContext('2d')!;

  const result = await spec.draw(env, f, b, s);
  const [frontUrl, backUrl, strapUrl] = await Promise.all([encode(front, 'image/jpeg', 0.95), encode(back, 'image/jpeg', 0.95), encode(strap, 'image/png')]);
  return { front: frontUrl, back: backUrl, strap: strapUrl, cardColor: spec.cardColor ?? palette.bg, finish: spec.finish, fx: result && result.fx ? result.fx : undefined };
}

/* ---- Caché de caras: entrar a la Bitácora o abrir «Mi perfil» no vuelve a dibujar ni a codificar nada. ---- */
const cache = new Map<string, Promise<Faces>>();
const MAX_CACHED = 12;

export const faceKey = (design: string, scale: number, theme: string, mode: string, updatedAt: number | undefined, extra = '') => `${design}|${scale}|${theme}|${mode}|${updatedAt ?? 0}|${extra}`;

/** Misma combinación de diseño, tema y perfil ⇒ la misma imagen; si cambia `updatedAt` del perfil, se dibuja de nuevo. */
export function cachedFaces(key: string, make: () => Promise<Faces>): Promise<Faces> {
  const hit = cache.get(key);
  if (hit) return hit;
  const promise = make();
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  while (cache.size > MAX_CACHED) {
    const [oldest] = cache.keys();
    const old = cache.get(oldest);
    cache.delete(oldest);
    void old?.then((faces) => [faces.front, faces.back, faces.strap].forEach((url) => URL.revokeObjectURL(url))).catch(() => {});
  }
  return promise;
}

export function clearFaceCache() {
  const old = [...cache.values()];
  cache.clear();
  old.forEach((promise) => void promise.then((faces) => [faces.front, faces.back, faces.strap].forEach((url) => URL.revokeObjectURL(url))).catch(() => {}));
}
