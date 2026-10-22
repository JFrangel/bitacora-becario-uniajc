import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { badgeGeometry, columnTuning, px } from './geometry';
import { IdBadge } from './IdBadge';
import { relayPointer } from './pointerRelay';
import { useProfileUi } from './ProfileUi';
import { useBadgeData, useBadgeDesign } from './useBadge';

/** El carné cuelga a un lado de la Bitácora solo en escritorio ancho (el CSS lo oculta por debajo de 1100 px). */
export const WIDE_QUERY = '(min-width: 1101px)';

const VARS = ['--nav-h', '--stage-left', '--stage-w', '--hit-left', '--strap-left'] as const;

/**
 * Mide la barra superior y publica en `.app` las variables que el CSS usa para colgar el carné: un lienzo de borde a borde
 * de la aplicación (así el carné no se corta al arrastrarlo hacia ningún lado) y las dos zonas que reciben el puntero.
 * También abre el hueco de la barra (`journal-wide`). Devuelve en qué fracción del ancho del lienzo cuelga la cinta.
 */
function useBadgeLayout(column: RefObject<HTMLElement>, enabled: boolean): number | undefined {
  const [anchor, setAnchor] = useState<number>();
  useLayoutEffect(() => {
    const root = column.current;
    const app = root?.closest<HTMLElement>('.app');
    const aside = root?.closest<HTMLElement>('.journal-badge');
    const nav = app?.querySelector<HTMLElement>('.nav');
    if (!enabled || !app || !aside || !nav) return undefined;

    const sync = () => {
      // Primero se abre el hueco (cambia dónde queda «Apariencia») y después se mide.
      app.classList.add('journal-wide');
      const appearance = app.querySelector('.appearance');
      if (!appearance) return;
      const g = badgeGeometry({
        appLeft: app.getBoundingClientRect().left,
        appRight: app.getBoundingClientRect().right,
        badgeLeft: aside.getBoundingClientRect().left,
        inviteRight: app.querySelector('#invite')?.getBoundingClientRect().right,
        appearanceLeft: appearance.getBoundingClientRect().left,
      });
      app.style.setProperty('--nav-h', `${nav.offsetHeight}px`);
      app.style.setProperty('--stage-left', px(g.stageLeft));
      app.style.setProperty('--stage-w', px(g.stageWidth));
      setAnchor(Math.round(g.anchor * 1000) / 1000);
      app.style.setProperty('--hit-left', px(g.hitLeft));
      app.style.setProperty('--strap-left', px(g.strapLeft));
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener('resize', schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      app.classList.remove('journal-wide');
      VARS.forEach((name) => app.style.removeProperty(name));
    };
  }, [column, enabled]);
  return anchor;
}

/**
 * Cuando el lienzo 3D aparece (el componente se descarga aparte) le deja de dar los clics y le reenvía el puntero desde las
 * zonas indicadas. Devuelve `true` cuando ya está enlazado: hasta entonces las zonas siguen ocultas.
 */
function usePointerRelay(column: RefObject<HTMLElement>, zones: Array<RefObject<HTMLElement>>, enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const root = column.current;
    if (!enabled || !root) return undefined;
    let release: Array<() => void> = [];
    let wired: Element | null = null;
    const wire = () => {
      const canvas = root.querySelector<HTMLCanvasElement>('.badge-stage canvas');
      if (canvas === wired) return;
      release.forEach((fn) => fn());
      release = [];
      wired = canvas;
      if (!canvas) {
        setReady(false);
        return;
      }
      zones.forEach((zone) => zone.current && release.push(relayPointer(zone.current, canvas)));
      setReady(true);
    };
    const observer = new MutationObserver(wire);
    observer.observe(root, { childList: true, subtree: true });
    wire();
    return () => {
      observer.disconnect();
      release.forEach((fn) => fn());
      setReady(false);
    };
    // Las zonas son refs estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column, enabled]);
  return ready;
}

/** El alto de la ventana, al día con los cambios de tamaño. */
function useViewportHeight(): number {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return height;
}

/**
 * El carné de la columna derecha de la Bitácora. Nunca hay dos lienzos 3D a la vez: mientras el panel de perfil o la
 * galería de diseños están abiertos, este se desmonta (el hueco de la barra se queda como está).
 */
export function BadgeColumn() {
  const wide = useMediaQuery(WIDE_QUERY);
  const data = useBadgeData();
  const { design } = useBadgeDesign(data);
  const { blocked } = useProfileUi();
  const column = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const strap = useRef<HTMLDivElement>(null);
  const showing = wide && !blocked && Boolean(data);

  const anchor = useBadgeLayout(column, wide);
  const { size, strapLength } = columnTuning(useViewportHeight());
  const ready = usePointerRelay(column, [body, strap], showing);

  if (!wide) return null;
  return (
    <div className="badge-col" ref={column}>
      {showing && data && (
        <>
          <IdBadge data={data} design={design} variant="column" anchor={anchor} size={size} strapLength={strapLength} stageId="journalBadgeStage" />
          <div className="badge-hit" id="journalBadgeHit" ref={body} hidden={!ready} />
          <div className="badge-hit strap" ref={strap} hidden={!ready} />
        </>
      )}
    </div>
  );
}
