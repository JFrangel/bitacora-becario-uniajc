import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialCrop, zoomOf } from './cropMath';
import { PhotoCropper } from './PhotoCropper';
import type { PhotoState } from './PhotoCropper';

const image = { width: 2000, height: 1000 } as HTMLImageElement;
const withPhoto = (): PhotoState => ({ img: image, crop: initialCrop(image), changed: false, removed: false });
const empty = (): PhotoState => ({ img: null, crop: null, changed: false, removed: false });

function Harness({ start, onMessage = () => {} }: { start: PhotoState; onMessage?: (text: string) => void }) {
  const [state, setState] = useState(start);
  return (
    <>
      <PhotoCropper value={state} name="Jose Padilla" onChange={setState} onMessage={onMessage} />
      <output data-testid="state">{JSON.stringify({ ox: state.crop?.ox, oy: state.crop?.oy, zoom: state.crop ? zoomOf(state.crop) : null, changed: state.changed, removed: state.removed, hasImage: Boolean(state.img) })}</output>
    </>
  );
}
const read = () => JSON.parse(screen.getByTestId('state').textContent!) as { ox: number; oy: number; zoom: number | null; changed: boolean; removed: boolean; hasImage: boolean };

afterEach(() => vi.unstubAllGlobals());

describe('PhotoCropper', () => {
  it('is a focusable image with instructions, plus the upload, zoom and remove controls', () => {
    render(<Harness start={empty()} />);
    const canvas = screen.getByRole('img', { name: 'Encuadre de la foto. Arrastra para moverla o usa las flechas.' });
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(screen.getByText('＋ Subir foto')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Acercar' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Quitar foto' })).toBeTruthy();
  });

  it('moves the frame 8 px with the arrow keys and marks the photo as changed', async () => {
    const user = userEvent.setup();
    render(<Harness start={{ ...withPhoto(), crop: { ...initialCrop(image), ox: -50 } }} />);
    const before = read().ox;
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowLeft}');
    expect(read().ox).toBe(before + 8);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(read().ox).toBe(before - 8);
    expect(read().changed).toBe(true);
  });

  it('never lets the photo leave empty space: it stops at the edge', async () => {
    const user = userEvent.setup();
    render(<Harness start={withPhoto()} />);
    screen.getByRole('img').focus();
    for (let i = 0; i < 100; i += 1) await user.keyboard('{ArrowLeft}');
    expect(read().ox).toBe(0);
  });

  it('ignores the arrows when there is no photo', async () => {
    const user = userEvent.setup();
    render(<Harness start={empty()} />);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowLeft}');
    expect(read().changed).toBe(false);
  });

  it('zooms from 1 to 3 with the slider', () => {
    render(<Harness start={withPhoto()} />);
    const slider = screen.getByRole('slider', { name: 'Acercar' }) as HTMLInputElement;
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('3');
    fireEvent.change(slider, { target: { value: '2' } });
    expect(read().zoom).toBeCloseTo(2);
    fireEvent.change(slider, { target: { value: '3' } });
    expect(read().zoom).toBeCloseTo(3);
  });

  it('drags the photo with the pointer', () => {
    render(<Harness start={{ ...withPhoto(), crop: { ...initialCrop(image), ox: -100 } }} />);
    const canvas = screen.getByRole('img');
    canvas.getBoundingClientRect = () => ({ width: 220, height: 220, left: 0, top: 0, right: 220, bottom: 220, x: 0, y: 0, toJSON() {} });
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 130, clientY: 100, pointerId: 1 });
    expect(read().ox).toBeCloseTo(-70);
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 100, pointerId: 1 });
    expect(read().ox).toBeCloseTo(-70);
  });

  it('removes the photo', async () => {
    render(<Harness start={withPhoto()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(read()).toMatchObject({ removed: true, changed: true, hasImage: false });
  });

  describe('choosing a file', () => {
    const choose = (file: File) => fireEvent.change(document.getElementById('photoFile')!, { target: { files: [file] } });

    it('refuses what is not an image', async () => {
      const onMessage = vi.fn();
      render(<Harness start={empty()} onMessage={onMessage} />);
      choose(new File(['x'], 'nota.pdf', { type: 'application/pdf' }));
      await waitFor(() => expect(onMessage).toHaveBeenCalledWith('Se omitió un archivo que no es una imagen.'));
    });

    it('refuses an image over 5 MB, saying which one', async () => {
      const onMessage = vi.fn();
      render(<Harness start={empty()} onMessage={onMessage} />);
      choose(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' }));
      await waitFor(() => expect(onMessage).toHaveBeenCalledWith('grande.jpg supera el límite de 5 MB.'));
    });

    it('says so, without breaking, when the browser cannot read the image (for example HEIC)', async () => {
      class Broken {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }
      vi.stubGlobal('Image', Broken);
      const onMessage = vi.fn();
      render(<Harness start={empty()} onMessage={onMessage} />);
      choose(new File(['x'], 'foto.heic', { type: 'image/heic' }));
      await waitFor(() => expect(onMessage).toHaveBeenCalledWith('No se pudo leer esa imagen. Prueba con un JPG o un PNG.'));
      expect(read().hasImage).toBe(false);
    });

    it('takes a readable image and frames it', async () => {
      class Good {
        width = 3000;
        height = 2000;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
      vi.stubGlobal('Image', Good);
      const onMessage = vi.fn();
      render(<Harness start={empty()} onMessage={onMessage} />);
      choose(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
      await waitFor(() => expect(read().hasImage).toBe(true));
      expect(read()).toMatchObject({ changed: true, removed: false });
      expect(onMessage).toHaveBeenLastCalledWith('');
    });
  });
});
