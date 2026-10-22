import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkImageFile, compressImage, fitWithin, ImageReadError, MAX_IMAGE_BYTES } from './images';

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

describe('fitWithin', () => {
  it('scales the longer side down to the maximum, keeping the proportion', () => {
    expect(fitWithin(4000, 3000, 1400)).toEqual({ w: 1400, h: 1050 });
    expect(fitWithin(3000, 4000, 1400)).toEqual({ w: 1050, h: 1400 });
    expect(fitWithin(1000, 1000, 480)).toEqual({ w: 480, h: 480 });
  });

  it('never enlarges', () => {
    expect(fitWithin(800, 600, 1400)).toEqual({ w: 800, h: 600 });
  });

  it('keeps at least one pixel on the short side', () => {
    expect(fitWithin(10000, 1, 1400)).toEqual({ w: 1400, h: 1 });
  });
});

describe('checkImageFile', () => {
  it('accepts an image', () => {
    expect(checkImageFile(file('a.jpg', 'image/jpeg'), 0)).toBeNull();
  });

  it('refuses a file that is not an image', () => {
    expect(checkImageFile(file('nota.pdf', 'application/pdf'), 0)).toBe('Se omitió un archivo que no es una imagen.');
  });

  it('refuses an image over 5 MB, saying which one', () => {
    expect(checkImageFile(file('grande.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1), 0)).toBe('grande.jpg supera el límite de 5 MB.');
    expect(checkImageFile(file('justa.jpg', 'image/jpeg', MAX_IMAGE_BYTES), 0)).toBeNull();
  });

  it('refuses the fifth image', () => {
    expect(checkImageFile(file('a.jpg', 'image/jpeg'), 4)).toBe('Puedes adjuntar hasta 4 imágenes por registro.');
    expect(checkImageFile(file('a.jpg', 'image/jpeg'), 3)).toBeNull();
  });
});

describe('compressImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('(punto) reports an image the browser cannot decode, such as HEIC, with the exact message', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode'); }));
    // Como un navegador real ante un formato que no abre: el elemento de imagen avisa con `onerror`.
    class BrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', BrokenImage);
    const error = await compressImage(file('foto.heic', 'image/heic')).catch((e) => e);
    expect(error).toBeInstanceOf(ImageReadError);
    expect(error.message).toBe('No se pudo leer esa imagen. Prueba con un JPG o un PNG.');
  });
});
