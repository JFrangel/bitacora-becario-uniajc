const TYPES = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;

const clone = (event: PointerEvent): Event => {
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    button: event.button,
    buttons: event.buttons,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
  };
  return typeof PointerEvent === 'function' ? new PointerEvent(event.type, init) : new MouseEvent(event.type, init);
};

/**
 * La cinta cuelga por encima de la barra superior sin tapar sus botones: el lienzo no recibe clics (`pointer-events: none`)
 * y solo las zonas `hit` (la de debajo de la barra y la de la propia cinta) le reenvían el puntero. Mientras se mantiene
 * pulsado el puntero queda capturado por la zona, así arrastrar hacia los lados no se interrumpe al salir de ella.
 * Devuelve la función que deshace todo.
 */
export function relayPointer(hit: HTMLElement, canvas: HTMLElement): () => void {
  canvas.style.pointerEvents = 'none';
  const forward = (event: Event) => {
    const pointer = event as PointerEvent;
    if (pointer.type === 'pointerdown') {
      try {
        hit.setPointerCapture?.(pointer.pointerId);
      } catch {
        /* un puntero que ya no existe: se sigue sin captura */
      }
    }
    canvas.dispatchEvent(clone(pointer));
    hit.style.cursor = canvas.style.cursor;
  };
  TYPES.forEach((type) => hit.addEventListener(type, forward));
  return () => {
    TYPES.forEach((type) => hit.removeEventListener(type, forward));
    canvas.style.pointerEvents = '';
  };
}
