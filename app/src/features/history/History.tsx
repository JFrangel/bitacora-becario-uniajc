import type { CSSProperties } from 'react';
import type { EventDto } from '../../../convex/lib/events';
import { dayLabel, eventLine } from './eventLine';

export type HistoryProps = {
  events: EventDto[];
  /** Personas del filtro «Todas las personas». */
  people: Array<{ id: string; name: string }>;
  actorId: string;
  onActor: (id: string) => void;
  hasMore: boolean;
  loadingMore?: boolean;
  onLoadMore: () => void;
  /** Id de quien mira (nulo en el enlace de solo lectura: ahí siempre aparece el nombre). */
  meId: string | null;
  now: number;
};

/** Línea de tiempo de lo que cambió, quién y cuándo. Solo se lee: no hay ninguna acción de editar o borrar. */
export function History({ events, people, actorId, onActor, hasMore, loadingMore = false, onLoadMore, meId, now }: HistoryProps) {
  return (
    <section className="view active" id="view-history">
      <div className="head">
        <div>
          <p className="eyebrow">Qué cambió, quién y cuándo</p>
          <h1>
            Historial
            <em>
              <span>.</span>
            </em>
          </h1>
        </div>
      </div>
      <div className="filters">
        <select className="jsel" aria-label="Filtrar por persona" value={actorId} onChange={(event) => onActor(event.target.value)}>
          <option value="">Todas las personas</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </div>
      {events.length === 0 ? (
        <div className="empty">
          <h3>Todavía no hay actividad</h3>
          <p>{actorId ? 'Esa persona aún no ha hecho cambios.' : 'Aquí aparecerá cada cambio del tablero.'}</p>
        </div>
      ) : (
        <ul className="hist">
          {events.map((event, index) => {
            const line = eventLine(event, meId);
            return (
              <li key={event.id} className="hist-item" style={{ '--i': Math.min(index, 14) } as CSSProperties}>
                <time className="hist-time" dateTime={new Date(event.at).toISOString()}>
                  {dayLabel(event.at, now)}
                </time>
                <div className="hist-mark">
                  <span aria-hidden="true">{line.glyph}</span>
                </div>
                <p className="hist-text">
                  <b>{line.who}</b> {line.verb}
                  {line.subject && (
                    <>
                      {' '}
                      <i>{line.subject}</i>
                    </>
                  )}
                  {line.detail && <small>{line.detail}</small>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <button className="more-cards load-more" type="button" disabled={loadingMore} onClick={onLoadMore}>
          Cargar más
        </button>
      )}
    </section>
  );
}
