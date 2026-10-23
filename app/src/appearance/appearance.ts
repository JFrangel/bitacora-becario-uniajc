export type Style = 'grafito' | 'papel' | 'tinta';
export type Mode = 'dark' | 'light';
export type Appearance = { style: Style; mode: Mode };

export const STYLES: readonly Style[] = ['grafito', 'papel', 'tinta'];
export const MODES: readonly Mode[] = ['dark', 'light'];

/** Grafito claro: apariencia inicial para navegadores sin preferencia guardada. */
export const DEFAULT_APPEARANCE: Appearance = { style: 'grafito', mode: 'light' };

const KEY = 'bitacora.appearance';

/** Fondo de cada tema; coincide con `--bg` de los CSS (lo comprueba `contrast.test.ts`). */
export const THEME_COLORS: Record<`${Style}-${Mode}`, string> = {
  'grafito-dark': '#0a0c0d',
  'grafito-light': '#f4f6f5',
  'papel-light': '#f3eee4',
  'papel-dark': '#17140f',
  'tinta-light': '#efeee7',
  'tinta-dark': '#060606',
};

/** La apariencia es una preferencia local del navegador; si no se puede leer o está corrupta, se usa la predeterminada. */
export function loadAppearance(): Appearance {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (parsed && typeof parsed === 'object') {
      const { style, mode } = parsed as Partial<Appearance>;
      if (STYLES.includes(style as Style) && MODES.includes(mode as Mode)) return { style: style as Style, mode: mode as Mode };
    }
  } catch {
    /* almacenamiento bloqueado o JSON dañado */
  }
  return { ...DEFAULT_APPEARANCE };
}

export function saveAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(appearance));
  } catch {
    /* ventana privada o datos bloqueados: la elección dura hasta cerrar la pestaña */
  }
}

/** Escribe `data-theme` y `data-mode` en la raíz de la aplicación y el color de la barra del navegador. */
export function applyAppearance(root: HTMLElement, appearance: Appearance): void {
  root.dataset.theme = appearance.style;
  root.dataset.mode = appearance.mode;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLORS[`${appearance.style}-${appearance.mode}`];
}
