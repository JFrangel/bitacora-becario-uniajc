import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { api } from '../../../convex/_generated/api';
import type { BadgeData } from '../../../convex/lib/profile';
import { useAppearance } from '../../appearance/AppearanceProvider';
import { useSession } from '../../audience';
import { DEFAULT_DESIGN, isDesignId } from './badgeDesigns';
import type { BadgeDesignId } from './badgeDesigns';
import { cachedFaces, drawBadgeFaces, faceKey, loadBadgeFonts } from './badgeFaces';
import type { Faces, Palette } from './badgeFaces';
import { scheduleIdle } from './badgeSupport';
import { loadImage } from './photo';
import logoUrl from '../../assets/athenia-mark.png';

/** El carné que se muestra: el propio de quien tiene sesión, o el de la dueña en el enlace de solo lectura. */
export function useBadgeData(): BadgeData | undefined {
  const { audience, shareToken } = useSession();
  const own = useQuery(api.profile.get, audience === 'viewer' ? 'skip' : {});
  const shared = useQuery(api.viewer.profile, audience === 'viewer' ? { shareToken: shareToken! } : 'skip');
  return audience === 'viewer' ? shared : own;
}

/* ---- Diseño elegido solo para esta persona (invitadas y enlace de solo lectura): vive en este navegador, nunca en el servidor ---- */
export const LOCAL_DESIGN_KEYS = { viewer: 'bitacora.viewerBadgeDesign', member: 'bitacora.memberBadgeDesign' } as const;

const listeners = new Set<() => void>();
/** Solo se usa si el navegador no deja escribir en `localStorage`: la elección dura hasta cerrar la pestaña. */
const memory = new Map<string, BadgeDesignId>();

function readLocal(key: string): BadgeDesignId | undefined {
  try {
    const value = localStorage.getItem(key);
    if (isDesignId(value)) return value;
  } catch {
    /* sin almacenamiento */
  }
  return memory.get(key);
}

function writeLocal(key: string, id: BadgeDesignId) {
  try {
    localStorage.setItem(key, id);
    memory.delete(key);
  } catch {
    memory.set(key, id);
  }
  listeners.forEach((listener) => listener());
}

const subscribeLocal = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

/**
 * El diseño del carné. La dueña lo guarda en su perfil (`profile.badgeDesign`); las demás personas, y quien mira el enlace
 * de solo lectura, lo eligen **solo para sí**: se guarda en este navegador, sobrevive a recargar y nunca se envía al servidor.
 * Todos los carnés de la pantalla (columna, perfil, galería) comparten esa elección.
 */
export function useBadgeDesign(data: BadgeData | undefined): { design: BadgeDesignId; setDesign: (id: BadgeDesignId) => Promise<void>; isLocal: boolean } {
  const { audience } = useSession();
  const update = useMutation(api.profile.update);
  const localKey = audience === 'viewer' ? LOCAL_DESIGN_KEYS.viewer : LOCAL_DESIGN_KEYS.member;
  const local = useSyncExternalStore(
    subscribeLocal,
    () => (audience === 'owner' ? undefined : readLocal(localKey)),
    () => undefined,
  );

  const serverDesign = isDesignId(data?.badgeDesign) ? data!.badgeDesign : undefined;
  const design: BadgeDesignId = audience === 'owner' ? (serverDesign ?? DEFAULT_DESIGN) : (local ?? serverDesign ?? DEFAULT_DESIGN);

  const setDesign = useCallback(
    async (id: BadgeDesignId) => {
      if (audience === 'owner') {
        await update({ badgeDesign: id });
        return;
      }
      writeLocal(localKey, id);
    },
    [audience, localKey, update],
  );
  return { design, setDesign, isLocal: audience !== 'owner' };
}

/** Colores y letras del estilo y tema activos, leídos de las variables CSS de la aplicación. */
export function readPalette(dark: boolean): Palette {
  const style = getComputedStyle(document.querySelector('.app') ?? document.documentElement);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    bg: get('--surface', '#16181c'),
    ink: get('--ink', '#f2f2f0'),
    muted: get('--muted', '#9a9a94'),
    accent: get('--accent', '#f5a623'),
    line: get('--line', '#333333'),
    fontMono: get('--font-mono', 'monospace'),
    fontBody: get('--font-body', 'Inter, sans-serif'),
    dark,
  };
}

let logoPromise: Promise<HTMLImageElement | null> | null = null;
const loadLogo = () => (logoPromise ??= loadImage(logoUrl));

const photoKey = (value: string | undefined) => {
  if (!value) return '';
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `${value.length}:${hash >>> 0}`;
};

/** Lo que, al cambiar, obliga a dibujar de nuevo el carné. */
export const dataKeyOf = (data: BadgeData) => JSON.stringify([
  data.name, data.roleLabel, data.program, data.term, data.institution, data.group, data.frontDescription,
  data.backTitle, data.backDescription, data.backFooter,
  photoKey(data.photoDataUrl), photoKey(data.groupLogoDataUrl), data.updatedAt,
]);

type Theme = { style: string; mode: string };

/** Las caras del carné (frente, reverso y cinta). Con la misma combinación de diseño, tema y perfil no se dibuja dos veces. */
export function facesFor(data: BadgeData, design: BadgeDesignId, scale: number, theme: Theme): Promise<Faces> {
  return cachedFaces(faceKey(design, scale, theme.style, theme.mode, data.updatedAt, dataKeyOf(data)), async () => {
    await loadBadgeFonts();
    const [photo, logoMask, groupLogo] = await Promise.all([
      data.photoDataUrl ? loadImage(data.photoDataUrl) : Promise.resolve(null),
      loadLogo(),
      data.groupLogoDataUrl ? loadImage(data.groupLogoDataUrl) : Promise.resolve(null),
    ]);
    return drawBadgeFaces({ design, data, palette: readPalette(theme.mode === 'dark'), photo, logoMask, groupLogo, scale });
  });
}

/** Las caras del carné para esta persona, diseño y tema. `null` mientras se dibujan. */
export function useBadgeFaces(data: BadgeData | undefined, design: BadgeDesignId, scale = 2): Faces | null {
  const { appearance } = useAppearance();
  const [faces, setFaces] = useState<Faces | null>(null);
  const dataKey = useMemo(() => (data ? dataKeyOf(data) : ''), [data]);

  useEffect(() => {
    if (!data) return undefined;
    let alive = true;
    facesFor(data, design, scale, appearance)
      .then((result) => alive && setFaces(result))
      .catch(() => alive && setFaces(null));
    return () => {
      alive = false;
    };
    // `data` cambia de identidad en cada respuesta del servidor; `dataKey` solo cuando el carné cambia de verdad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, design, scale, appearance.style, appearance.mode]);

  return faces;
}

/**
 * Deja listo el carné antes de entrar a la Bitácora: con el navegador libre, 2,5 s después de abrir la aplicación, descarga
 * el componente 3D y dibuja las caras. Así entrar a la Bitácora no cuesta nada y el arranque no se retrasa.
 */
export function usePrewarmBadge(enabled: boolean, data: BadgeData | undefined, design: BadgeDesignId, scale = 2) {
  const { appearance } = useAppearance();
  const dataKey = data ? dataKeyOf(data) : '';
  useEffect(() => {
    if (!enabled || !data) return undefined;
    return scheduleIdle(() => {
      void import('../../reactbits/Lanyard/Lanyard').catch(() => {});
      void facesFor(data, design, scale, appearance).catch(() => {});
    }, 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dataKey, design, scale, appearance.style, appearance.mode]);
}
