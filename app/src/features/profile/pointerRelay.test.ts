import { afterEach, describe, expect, it, vi } from 'vitest';
import { relayPointer } from './pointerRelay';

const press = (target: Element, type: string, init: PointerEventInit = {}) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 20, ...init }));

afterEach(() => {
  document.body.replaceChildren();
});

function setup() {
  const hit = document.createElement('div');
  const canvas = document.createElement('canvas');
  document.body.append(hit, canvas);
  const seen: Array<{ type: string; x: number; y: number }> = [];
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    canvas.addEventListener(type, (event) => seen.push({ type, x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }));
  }
  return { hit, canvas, seen };
}

describe('relayPointer', () => {
  it('stops the canvas from taking clicks itself, so the strap can cross the top bar without covering it', () => {
    const { hit, canvas } = setup();
    relayPointer(hit, canvas);
    expect(canvas.style.pointerEvents).toBe('none');
  });

  it('forwards down, move, up and cancel from the zone to the canvas with the same position', () => {
    const { hit, seen, canvas } = setup();
    relayPointer(hit, canvas);
    press(hit, 'pointerdown');
    press(hit, 'pointermove', { clientX: 30, clientY: 40 });
    press(hit, 'pointerup');
    press(hit, 'pointercancel');
    expect(seen).toEqual([
      { type: 'pointerdown', x: 10, y: 20 },
      { type: 'pointermove', x: 30, y: 40 },
      { type: 'pointerup', x: 10, y: 20 },
      { type: 'pointercancel', x: 10, y: 20 },
    ]);
  });

  it('keeps following the pointer outside the zone while it is pressed (capture), and tolerates a missing pointer', () => {
    const { hit, canvas } = setup();
    const capture = vi.fn(() => {
      throw new Error('NotFoundError');
    });
    hit.setPointerCapture = capture;
    relayPointer(hit, canvas);
    expect(() => press(hit, 'pointerdown')).not.toThrow();
    expect(capture).toHaveBeenCalled();
  });

  it('copies the cursor the canvas asks for (grab / grabbing) onto the zone', () => {
    const { hit, canvas } = setup();
    relayPointer(hit, canvas);
    canvas.addEventListener('pointermove', () => (canvas.style.cursor = 'grabbing'));
    press(hit, 'pointermove');
    expect(hit.style.cursor).toBe('grabbing');
  });

  it('stops forwarding and gives the canvas its clicks back when released', () => {
    const { hit, canvas, seen } = setup();
    const release = relayPointer(hit, canvas);
    release();
    press(hit, 'pointerdown');
    expect(seen).toEqual([]);
    expect(canvas.style.pointerEvents).toBe('');
  });
});
