// Regenera la máscara de una sola tinta del logotipo de AthenIA (src/assets/athenia-mark.png) desde el PNG original en colores.
//   node scripts/make-logo-mask.mjs <logotipo-original.png> [salida.png]
// El carné la pinta con el color de marca de cada estilo y tema, así el logotipo se ve bien en los seis (sección 4.8).
//   alfa = clamp((0,88 − luminancia) / 0,5, 0, 1) × alfa original      (lo claro desaparece; lo oscuro queda sólido)
// y se recorta a la caja de lo que quedó visible. No necesita dependencias: lee y escribe PNG con `node:zlib`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Por debajo de este alfa (de 255) un píxel no cuenta para la caja de recorte: evita que el ruido agrande la imagen. */
const CROP_THRESHOLD = 8;

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Lee un PNG (8 o 16 bits por canal, sin entrelazado) y devuelve sus píxeles como RGBA de 8 bits. */
export function decodePng(file) {
  if (file.length < 8 || !file.subarray(0, 8).equals(SIGNATURE)) throw new Error('Eso no es un archivo PNG.');
  let header = null;
  let palette = null;
  let transparency = null;
  const data = [];
  for (let offset = 8; offset + 8 <= file.length; ) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], color: body[9], interlace: body[12] };
    else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') transparency = body;
    else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (!header) throw new Error('El PNG no tiene encabezado.');
  const { width, height, depth, color, interlace } = header;
  if (interlace) throw new Error('El PNG entrelazado no está soportado: expórtalo sin entrelazado.');
  if (depth !== 8 && depth !== 16) throw new Error(`Solo se leen PNG de 8 o 16 bits por canal (este tiene ${depth}).`);
  if (!(color in CHANNELS)) throw new Error(`Tipo de color PNG no soportado (${color}).`);
  if (color === 3 && !palette) throw new Error('El PNG indexado no tiene paleta.');

  const bytes = CHANNELS[color] * (depth / 8);
  const stride = width * bytes;
  const raw = inflateSync(Buffer.concat(data));
  if (raw.length < (stride + 1) * height) throw new Error('El PNG está incompleto.');
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytes ? pixels[y * stride + x - bytes] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= bytes ? pixels[(y - 1) * stride + x - bytes] : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      if (predictor === undefined) throw new Error(`Filtro PNG desconocido (${filter}).`);
      pixels[y * stride + x] = (line[x] + predictor) & 255;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  const sample = (index) => pixels[index * (depth / 8)];
  for (let i = 0; i < width * height; i += 1) {
    const base = i * CHANNELS[color];
    let rgb;
    let alpha = 255;
    if (color === 0) rgb = [sample(base), sample(base), sample(base)];
    else if (color === 2) rgb = [sample(base), sample(base + 1), sample(base + 2)];
    else if (color === 3) {
      const entry = sample(base);
      rgb = [palette[entry * 3], palette[entry * 3 + 1], palette[entry * 3 + 2]];
      if (transparency && entry < transparency.length) alpha = transparency[entry];
    } else if (color === 4) {
      rgb = [sample(base), sample(base), sample(base)];
      alpha = sample(base + 1);
    } else {
      rgb = [sample(base), sample(base + 1), sample(base + 2)];
      alpha = sample(base + 3);
    }
    rgba.set([...rgb, alpha], i * 4);
  }
  return { width, height, rgba };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'latin1');
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

/** Escribe un PNG RGBA de 8 bits. */
export function encodePng({ width, height, rgba }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(rows, y * (width * 4 + 1) + 1);
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** La máscara: tinta blanca (como `athenia-mark.png`) con el alfa de la fórmula, recortada a la caja de lo visible. */
export function makeMask({ width, height, rgba }) {
  const alpha = new Uint8Array(width * height);
  let [minX, minY, maxX, maxY] = [width, height, -1, -1];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const luminance = (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
      const a = Math.round(clamp((0.88 - luminance) / 0.5, 0, 1) * rgba[i + 3]);
      alpha[y * width + x] = a;
      if (a >= CROP_THRESHOLD) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) throw new Error('El logotipo quedó vacío: ¿es un PNG de tinta oscura sobre fondo claro o transparente?');
  const [w, h] = [maxX - minX + 1, maxY - minY + 1];
  const out = new Uint8Array(w * h * 4).fill(255);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) out[(y * w + x) * 4 + 3] = alpha[(y + minY) * width + x + minX];
  return { width: w, height: h, rgba: out };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [input, output = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'athenia-mark.png')] = process.argv.slice(2);
  if (!input) {
    console.log('Uso: node scripts/make-logo-mask.mjs <logotipo-original.png> [salida.png]');
    process.exit(1);
  }
  const mask = makeMask(decodePng(readFileSync(input)));
  writeFileSync(output, encodePng(mask));
  console.log(`Máscara de ${mask.width} × ${mask.height} guardada en ${output}`);
}
