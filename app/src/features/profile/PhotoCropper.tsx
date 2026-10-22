import { useEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent, PointerEvent } from 'react';
import { MAX_IMAGE_BYTES } from '../journal/images';
import { clampCrop, initialCrop, KEY_STEP, MAX_ZOOM, MIN_ZOOM, moveCrop, zoomCrop, zoomOf } from './cropMath';
import type { CropState } from './cropMath';
import { initialsOf } from './names';
import { CROP_VIEW, loadImage } from './photo';

/** La foto que se está encuadrando. `changed` es verdadero si hay que volver a guardarla. */
export type PhotoState = { img: HTMLImageElement | null; crop: CropState | null; changed: boolean; removed: boolean };

type PhotoCropperProps = {
  value: PhotoState;
  /** Nombre que se está escribiendo: sin foto se dibujan sus iniciales. */
  name: string;
  onChange: (next: PhotoState) => void;
  onMessage: (text: string) => void;
};

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [KEY_STEP, 0], ArrowRight: [-KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP] };

/** Encuadre de la foto del carné: se arrastra, se acerca (1 a 3) y se mueve con las flechas de a 8 px. */
export function PhotoCropper({ value, name, onChange, onMessage }: PhotoCropperProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const { img, crop } = value;

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const k = element.width / CROP_VIEW;
    const style = getComputedStyle(element);
    context.clearRect(0, 0, element.width, element.height);
    if (img && crop) {
      context.fillStyle = style.getPropertyValue('--bg').trim() || '#111111';
      context.fillRect(0, 0, element.width, element.height);
      context.drawImage(img, crop.ox * k, crop.oy * k, img.width * crop.scale * k, img.height * crop.scale * k);
    } else {
      context.fillStyle = style.getPropertyValue('--accent').trim() || '#66c6a9';
      context.fillRect(0, 0, element.width, element.height);
      context.fillStyle = '#0e0e0e';
      context.font = `700 ${Math.round(element.width * 0.4)}px ${style.getPropertyValue('--font-body').trim() || 'sans-serif'}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(initialsOf(name || 'Becario'), element.width / 2, element.height / 2 + 6);
    }
  }, [img, crop, name]);

  const update = (next: CropState) => onChange({ ...value, crop: next, changed: true, removed: false });

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!img || !crop) return;
    drag.current = { x: event.clientX, y: event.clientY, ox: crop.ox, oy: crop.oy };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const start = drag.current;
    if (!start || !img || !crop) return;
    const f = CROP_VIEW / (event.currentTarget.getBoundingClientRect().width || CROP_VIEW);
    update(clampCrop({ ...crop, ox: start.ox + (event.clientX - start.x) * f, oy: start.oy + (event.clientY - start.y) * f }, img));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const move = ARROWS[event.key];
    if (!move || !img || !crop) return;
    event.preventDefault();
    update(moveCrop(crop, move[0], move[1], img));
  };

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return onMessage('Se omitió un archivo que no es una imagen.');
    if (file.size > MAX_IMAGE_BYTES) return onMessage(`${file.name} supera el límite de 5 MB.`);
    let url = '';
    try {
      url = URL.createObjectURL(file);
    } catch {
      return onMessage('No se pudo leer esa imagen. Prueba con un JPG o un PNG.');
    }
    const loaded = await loadImage(url);
    URL.revokeObjectURL(url);
    if (!loaded) return onMessage('No se pudo leer esa imagen. Prueba con un JPG o un PNG.');
    onMessage('');
    onChange({ img: loaded, crop: initialCrop(loaded, loaded.height > loaded.width ? 0.2 : 0.5), changed: true, removed: false });
  };

  return (
    <div className="photo-edit">
      <canvas
        ref={canvas}
        className="crop-canvas"
        width={CROP_VIEW * 2}
        height={CROP_VIEW * 2}
        tabIndex={0}
        role="img"
        aria-label="Encuadre de la foto. Arrastra para moverla o usa las flechas."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
      />
      <div className="photo-ctrl">
        <label className="filebtn" htmlFor="photoFile">
          ＋ Subir foto
        </label>
        <input id="photoFile" className="sr-only" type="file" accept="image/*" onChange={(event) => void pick(event)} />
        <label className="zoom">
          <span className="lbl">Acercar</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={crop ? zoomOf(crop) : 1}
            disabled={!img}
            aria-label="Acercar"
            onChange={(event) => crop && img && update(zoomCrop(crop, Number(event.target.value), img))}
          />
        </label>
        <button type="button" className="ghost2" onClick={() => onChange({ img: null, crop: null, changed: true, removed: true })}>
          Quitar foto
        </button>
      </div>
    </div>
  );
}
