import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng, makeMask } from '../scripts/make-logo-mask.mjs';
import type { Image } from '../scripts/make-logo-mask.mjs';

const image = (width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Image => {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) rgba.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, rgba };
};
const at = (img: Image, x: number, y: number) => [...img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

/** Un PNG de color RGB con los cinco filtros, escrito a mano: así el lector se prueba contra algo que no escribió él mismo. */
function filteredRgbPng(width: number, height: number, rgb: (x: number, y: number) => [number, number, number]): Buffer {
  const stride = width * 3;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) pixels.set(rgb(x, y), y * stride + x * 3);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const filter = y % 5;
    rows[y * (stride + 1)] = filter;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 3 ? pixels[y * stride + x - 3] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 3 ? pixels[(y - 1) * stride + x - 3] : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      rows[y * (stride + 1) + 1 + x] = (pixels[y * stride + x] - predictor) & 255;
    }
  }
  const chunk = (type: string, body: Buffer) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'latin1');
    body.copy(out, 8);
    return out; // el lector no comprueba el CRC
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

describe('PNG reading and writing', () => {
  it('writes what it reads back, pixel by pixel', () => {
    const original = image(7, 5, (x, y) => [x * 30, y * 40, (x * y) % 256, 255 - x * 10]);
    const back = decodePng(encodePng(original));
    expect([back.width, back.height]).toEqual([7, 5]);
    expect([...back.rgba]).toEqual([...original.rgba]);
  });

  it('reads the five PNG filters (Sub, Up, Average, Paeth) correctly', () => {
    const rgb = (x: number, y: number): [number, number, number] => [(x * 37 + y * 11) % 256, (x * 5 + y * 91) % 256, (x * y * 3) % 256];
    const decoded = decodePng(filteredRgbPng(9, 10, rgb));
    for (let y = 0; y < 10; y += 1) for (let x = 0; x < 9; x += 1) expect(at(decoded, x, y)).toEqual([...rgb(x, y), 255]);
  });

  it('reads the real logo mask of the project', () => {
    const real = decodePng(readFileSync(join(__dirname, '..', 'src', 'assets', 'athenia-mark.png')));
    expect([real.width, real.height]).toEqual([551, 413]);
  });

  it('refuses files that are not a plain PNG, saying what is wrong', () => {
    expect(() => decodePng(Buffer.from('hola'))).toThrow('Eso no es un archivo PNG.');
    const interlaced = encodePng(image(2, 2, () => [0, 0, 0, 255]));
    interlaced[8 + 8 + 12] = 1; // bandera de entrelazado del encabezado
    expect(() => decodePng(interlaced)).toThrow(/entrelazado/);
  });
});

describe('makeMask', () => {
  it('makes light disappear and dark ink solid: alpha = clamp((0.88 − luminance) / 0.5)', () => {
    const greys = [0, 160, 225, 255, 0];
    const mask = makeMask(image(5, 1, (x) => [greys[x], greys[x], greys[x], 255]));
    // Negro ⇒ 255. 160/255 = 0,627 ⇒ (0,88 − 0,627) / 0,5 = 0,506 ⇒ 129. 225 ⇒ 0,882 > 0,88 ⇒ 0. Blanco ⇒ 0.
    expect(mask.width).toBe(5);
    expect([0, 1, 2, 3, 4].map((x) => at(mask, x, 0)[3])).toEqual([255, 129, 0, 0, 255]);
  });

  it('keeps the original transparency: a transparent pixel stays transparent even if it is black', () => {
    const mask = makeMask(image(2, 1, (x) => [0, 0, 0, x === 0 ? 255 : 0]));
    expect(at(mask, 0, 0)[3]).toBe(255);
    expect(mask.width).toBe(1);
  });

  it('crops to the box of what is visible', () => {
    const source = image(10, 8, (x, y) => (x >= 3 && x <= 6 && y >= 2 && y <= 4 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const mask = makeMask(source);
    expect([mask.width, mask.height]).toEqual([4, 3]);
  });

  it('paints the ink white, like the logo the project already has, so the badge can tint it', () => {
    const mask = makeMask(image(2, 2, () => [10, 10, 10, 255]));
    expect(at(mask, 0, 0).slice(0, 3)).toEqual([255, 255, 255]);
  });

  it('says so when nothing is left (for example a white logo on a transparent background)', () => {
    expect(() => makeMask(image(3, 3, () => [255, 255, 255, 255]))).toThrow(/quedó vacío/);
  });
});
