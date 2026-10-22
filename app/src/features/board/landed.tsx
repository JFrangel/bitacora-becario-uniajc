import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { TaskStatus } from '../../../convex/lib/types';
import { sparks } from '../../lib/sparks';

type LandedApi = { landedId: string | undefined; mark: (id: string, status?: TaskStatus) => void };
const LandedContext = createContext<LandedApi>({ landedId: undefined, mark: () => {} });

/** Cuánto se espera a que la tarjeta aparezca en su columna nueva antes de rendirse (no se sueltan chispas en el lugar equivocado). */
const SEEK_MS = 2500;
const BOUNCE_MS = 900;

/**
 * Recuerda un instante qué tarjeta acaba de moverse o crearse: rebota y suelta chispas **en su lugar nuevo**. Con `status`
 * se espera a que la tarjeta ya esté en esa columna (el servidor puede tardar un momento en mover la tarjeta en pantalla);
 * sin él, a que exista.
 */
export function LandedProvider({ children }: { children: ReactNode }) {
  const [landedId, setLandedId] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const mark = useCallback((id: string, status?: TaskStatus) => {
    const deadline = performance.now() + SEEK_MS;
    const seek = () => {
      if (!alive.current) return;
      const card = document.querySelector<HTMLElement>(`.card[data-id="${CSS.escape(id)}"]`);
      if (card && (!status || card.dataset.col === status)) {
        setLandedId(id);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setLandedId(undefined), BOUNCE_MS);
        sparks(card);
        return;
      }
      if (performance.now() < deadline) requestAnimationFrame(seek);
    };
    requestAnimationFrame(seek);
  }, []);

  const value = useMemo(() => ({ landedId, mark }), [landedId, mark]);
  return <LandedContext.Provider value={value}>{children}</LandedContext.Provider>;
}

export const useLanded = () => useContext(LandedContext);
