import { useQueries } from 'convex/react';
import { useMemo, useState } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { EventDto } from '../../convex/lib/events';
import { useSession } from '../audience';

type Page = { items: EventDto[]; nextCursor: string | null };

/**
 * El historial de 50 en 50: cada «Cargar más» suma una página más (con su cursor). `subjectId` limita a un solo asunto
 * (el historial del detalle de una tarea) y `actorId` a una persona.
 */
export function useEvents(options: { actorId?: string; subjectId?: string; enabled?: boolean } = {}) {
  const { audience, shareToken, workspaceId } = useSession();
  const { actorId, subjectId, enabled = true } = options;
  const [cursors, setCursors] = useState<Array<string | null>>([null]);

  // Si cambia el filtro se vuelve a empezar desde la primera página.
  const key = `${workspaceId ?? ''}|${actorId ?? ''}|${subjectId ?? ''}`;
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setCursors([null]);
  }

  // El `useQueries` de Convex se vuelve a suscribir cada vez que cambia la IDENTIDAD de este objeto: si se creara nuevo en cada
  // pintado, cada pintado provocaría otro (bucle infinito, «Too many re-renders»). Por eso se memoriza.
  const requests = useMemo(() => {
    const out: Record<string, { query: typeof api.events.list | typeof api.viewer.events; args: Record<string, unknown> }> = {};
    if (!enabled) return out;
    cursors.forEach((cursor, index) => {
      const filters = { cursor, ...(!workspaceId ? {} : { workspaceId }), ...(actorId ? { actorId: actorId as Id<'members'> } : {}), ...(subjectId ? { subjectId } : {}) };
      out[`p${index}`] = audience === 'viewer' ? { query: api.viewer.events, args: { shareToken: shareToken!, ...filters } } : { query: api.events.list, args: filters };
    });
    return out;
  }, [enabled, cursors, audience, shareToken, actorId, subjectId, workspaceId]);
  const results = useQueries(requests as never) as Record<string, Page | Error | undefined>;

  const pages = cursors.map((_, index) => results[`p${index}`]);
  const loaded = pages.filter((page): page is Page => Boolean(page) && !(page instanceof Error));
  const last = loaded[loaded.length - 1];
  return {
    loading: enabled && pages.some((page) => page === undefined),
    events: loaded.flatMap((page) => page.items),
    hasMore: Boolean(last?.nextCursor),
    loadMore: () => last?.nextCursor && setCursors((current) => [...current, last.nextCursor]),
  };
}
