// Utilidades de PRUEBAS: un lienzo falso que registra el texto que se dibuja (jsdom no dibuja de verdad).
export type FakeCanvas = HTMLCanvasElement & { texts: string[]; draws: number; fills: number };

export function fakeCanvasFactory() {
  const canvases: FakeCanvas[] = [];
  const make = (): HTMLCanvasElement => {
    const texts: string[] = [];
    const counters = { draws: 0, fills: 0 };
    const store: Record<string, unknown> = {};
    const context = new Proxy(store, {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        if (prop === 'measureText') return (text: string) => ({ width: String(text).length * 12 });
        if (prop === 'fillText' || prop === 'strokeText') return (text: string) => void texts.push(String(text));
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (prop === 'drawImage') return () => void (counters.draws += 1);
        if (prop === 'fillRect') return () => void (counters.fills += 1);
        return () => undefined;
      },
      set(target, prop: string, value) {
        target[prop] = value;
        return true;
      },
    });
    const canvas = {
      width: 0,
      height: 0,
      texts,
      get draws() {
        return counters.draws;
      },
      get fills() {
        return counters.fills;
      },
      getContext: () => context,
      toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(['x'])),
    } as unknown as FakeCanvas;
    canvases.push(canvas);
    return canvas;
  };
  return { make, canvases };
}

export const logoMask = { width: 551, height: 413 } as unknown as CanvasImageSource;
export const portrait = { width: 1024, height: 1024 } as unknown as CanvasImageSource;
