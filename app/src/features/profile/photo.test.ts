import { describe, expect, it, vi } from 'vitest';
import { LIMITS } from '../../../convex/lib/limits';
import { CROP_VIEW, cropToJpeg, enhanceImageData, optimizeBadgeLogo } from './photo';

/** ImageData falso: 3 canales + alfa, `width` × `height`. */
const image = (width: number, height: number, fill: (x: number, y: number) => number) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = fill(x, y);
      data[i + 3] = 255;
    }
  }
  return { width, height, data } as unknown as ImageData;
};
const copy = (source: ImageData) => new Uint8ClampedArray(source.data);
const flat = (source: ImageData, value: number) => new Uint8ClampedArray(source.data.length).fill(value);

describe('enhanceImageData', () => {
  it('raises the local contrast at an edge: the bright side gets brighter, the dark side darker', () => {
    const w = 40;
    const img = image(w, 40, (x) => (x < 20 ? 80 : 180));
    const before = copy(img);
    // «fino» y «ancho» son versiones desenfocadas: en un borde se acercan al promedio de los dos lados.
    const blur = (r: number) => image(w, 40, (x) => Math.round(80 + (100 * Math.min(Math.max((x - (20 - r)) / (2 * r), 0), 1)))).data;
    enhanceImageData(img, blur(2), blur(8), 2);
    const at = (data: Uint8ClampedArray, x: number) => data[(20 * w + x) * 4];
    expect(at(img.data, 21)).toBeGreaterThan(at(before, 21));
    expect(at(img.data, 18)).toBeLessThan(at(before, 18));
  });

  it('does not change a flat image', () => {
    const img = image(30, 30, () => 120);
    const before = copy(img);
    enhanceImageData(img, flat(img, 120), flat(img, 120), 2);
    expect(Array.from(img.data)).toEqual(Array.from(before));
  });

  it('leaves the border pixels untouched', () => {
    const img = image(20, 20, (x) => x * 10);
    const before = copy(img);
    enhanceImageData(img, flat(img, 90), flat(img, 90), 4);
    for (let y = 0; y < 20; y += 1) {
      for (let x = 0; x < 20; x += 1) {
        if (x < 4 || y < 4 || x >= 16 || y >= 16) expect(img.data[(y * 20 + x) * 4], `${x},${y}`).toBe(before[(y * 20 + x) * 4]);
      }
    }
  });

  it('never changes a channel by more than 18 levels, and never leaves 0 to 255', () => {
    const img = image(30, 30, (x) => (x % 2 ? 255 : 0));
    const before = copy(img);
    enhanceImageData(img, flat(img, 128), flat(img, 128), 1);
    for (let i = 0; i < img.data.length; i += 4) {
      expect(Math.abs(img.data[i] - before[i])).toBeLessThanOrEqual(18);
      expect(img.data[i]).toBeGreaterThanOrEqual(0);
      expect(img.data[i]).toBeLessThanOrEqual(255);
      expect(img.data[i + 3]).toBe(255);
    }
  });
});

/** Un lienzo falso que devuelve imágenes más pequeñas a menor calidad. */
function fakeCanvas(sizeFor: (quality: number) => number) {
  const calls: string[] = [];
  const context = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: '',
    fillStyle: '',
    fillRect: vi.fn(() => calls.push('fill')),
    drawImage: vi.fn(() => calls.push('draw')),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toDataURL: vi.fn((_type: string, quality: number) => `data:image/jpeg;base64,${'A'.repeat(Math.ceil((sizeFor(quality) * 4) / 3))}`),
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, context, calls, toDataURL: canvas.toDataURL };
}
const photo = { width: 2000, height: 1500 } as unknown as CanvasImageSource & { width: number; height: number };

describe('cropToJpeg', () => {
  it('draws a 1024 × 1024 square, scaling the crop from the 220 px preview to the final size', () => {
    const { canvas, context, toDataURL } = fakeCanvas(() => 50_000);
    cropToJpeg(photo, { scale: 0.11, ox: -30, oy: -10 }, { enhance: false }, { makeCanvas: () => canvas, enhance: vi.fn() });
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(1024);
    const k = 1024 / CROP_VIEW;
    expect(context.drawImage).toHaveBeenCalledWith(photo, -30 * k, -10 * k, 2000 * 0.11 * k, 1500 * 0.11 * k);
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92);
  });

  it('lowers the quality step by step until the file is at most 400 KB', () => {
    const { canvas, toDataURL } = fakeCanvas((q) => (q >= 0.8 ? 600_000 : q >= 0.7 ? 450_000 : 380_000));
    const url = cropToJpeg(photo, { scale: 0.1, ox: 0, oy: 0 }, { enhance: false }, { makeCanvas: () => canvas, enhance: vi.fn() });
    expect(toDataURL.mock.calls.map((c) => c[1])).toEqual([0.92, 0.86, 0.8, 0.72, 0.62]);
    const bytes = Math.floor(((url.length - 'data:image/jpeg;base64,'.length) * 3) / 4);
    expect(bytes).toBeLessThanOrEqual(LIMITS.photoBytes);
  });

  it('calls the enhancer only when «Mejorar imagen» is on', () => {
    const on = vi.fn();
    const off = vi.fn();
    cropToJpeg(photo, { scale: 0.1, ox: 0, oy: 0 }, { enhance: true }, { makeCanvas: () => fakeCanvas(() => 10_000).canvas, enhance: on });
    cropToJpeg(photo, { scale: 0.1, ox: 0, oy: 0 }, { enhance: false }, { makeCanvas: () => fakeCanvas(() => 10_000).canvas, enhance: off });
    expect(on).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
  });

  it('enhances by default', () => {
    const enhance = vi.fn();
    cropToJpeg(photo, { scale: 0.1, ox: 0, oy: 0 }, undefined, { makeCanvas: () => fakeCanvas(() => 10_000).canvas, enhance });
    expect(enhance).toHaveBeenCalledTimes(1);
  });
});

describe('optimizeBadgeLogo', () => {
  it('keeps a transparent PNG, preserves the aspect ratio and caps its longest side at 512 px', () => {
    const context = { clearRect: vi.fn(), drawImage: vi.fn() };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      toDataURL: vi.fn(() => 'data:image/png;base64,AAAA'),
    } as unknown as HTMLCanvasElement;
    const image = { width: 1600, height: 800 } as HTMLImageElement;

    expect(optimizeBadgeLogo(image, () => canvas)).toBe('data:image/png;base64,AAAA');
    expect([canvas.width, canvas.height]).toEqual([512, 256]);
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 512, 256);
  });

  it('falls back to compressed WebP when the transparent PNG would exceed the profile budget', () => {
    const context = { clearRect: vi.fn(), drawImage: vi.fn() };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      toDataURL: vi.fn((type: string) => (type === 'image/png' ? `data:image/png;base64,${'A'.repeat(250000)}` : 'data:image/webp;base64,AAAA')),
    } as unknown as HTMLCanvasElement;

    expect(optimizeBadgeLogo({ width: 512, height: 512 } as HTMLImageElement, () => canvas)).toBe('data:image/webp;base64,AAAA');
  });
});
