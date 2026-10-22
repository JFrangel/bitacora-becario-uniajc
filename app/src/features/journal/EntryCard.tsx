import type { CSSProperties } from 'react';
import type { JournalDto } from '../../../convex/lib/journalDto';
import { formatWeekday, hoursLabel } from '../../lib/format';

const UPDATED = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });

/** «18 oct 2026, 09:32 a. m.» (hora de Bogotá). */
export function updatedLabel(at: number): string {
  const part = (type: Intl.DateTimeFormatPartTypes) => UPDATED.formatToParts(new Date(at)).find((p) => p.type === type)?.value ?? '';
  const period = part('dayPeriod').replace(/[\s  .]/g, '').toLowerCase() === 'pm' ? 'p. m.' : 'a. m.';
  return `${part('day')} ${part('month').replace('.', '')} ${part('year')}, ${part('hour')}:${part('minute')} ${period}`;
}

type EntryCardProps = {
  entry: JournalDto;
  index: number;
  open: boolean;
  readOnly: boolean;
  /** ↑ ↓ dentro del mismo día; `undefined` oculta las flechas. */
  reorder?: { canUp: boolean; canDown: boolean; disabledReason?: string; onMove: (direction: -1 | 1) => void };
  onToggle: (id: string) => void;
  onEdit: (entry: JournalDto) => void;
  onImage: (url: string, name: string) => void;
};

/** Tarjeta de la línea de tiempo: el título de la actividad, la vista previa del Resultado y el detalle plegable. */
export function EntryCard({ entry, index, open, readOnly, reorder, onToggle, onEdit, onImage }: EntryCardProps) {
  const style = { '--i': Math.min(index, 12), '--p': `var(--p${entry.projectColorSlot})` } as CSSProperties;
  const fields = [
    ['Objetivo', entry.objective],
    ['Desarrollo', entry.development],
    ['Resultado', entry.result],
    ['Observaciones', entry.observations],
  ].filter((pair): pair is [string, string] => Boolean(pair[1]));

  const top = (
    <div className="entry-top">
      <time dateTime={entry.date}>{formatWeekday(entry.date)}</time>
      <span className="proj">{entry.projectName}</span>
      <span className="stag" data-s={entry.activityStatus}>
        {entry.activityStatus}
      </span>
      {entry.taskDeleted && (
        <span className="stag" data-s="nota">
          Tarea eliminada
        </span>
      )}
      <span className="hours">{entry.isDraft || entry.hours === undefined ? '— horas' : hoursLabel(entry.hours)}</span>
      {!readOnly && (
        <span className="entry-actions">
          {reorder && (
            <>
              <button className="ibtn" type="button" aria-label="Subir en el día" title={reorder.disabledReason ?? 'Subir en el día'} disabled={!reorder.canUp || Boolean(reorder.disabledReason)} onClick={() => reorder.onMove(-1)}>
                ↑
              </button>
              <button className="ibtn" type="button" aria-label="Bajar en el día" title={reorder.disabledReason ?? 'Bajar en el día'} disabled={!reorder.canDown || Boolean(reorder.disabledReason)} onClick={() => reorder.onMove(1)}>
                ↓
              </button>
            </>
          )}
          <button className="ibtn" type="button" aria-label="Editar registro" title="Editar registro" onClick={() => onEdit(entry)}>
            ✎
          </button>
        </span>
      )}
    </div>
  );

  const className = `entry${entry.isDraft ? ' pending' : ''}${open ? ' open' : ''}`;

  if (entry.isDraft) {
    return (
      <article className={className} data-entry={entry.id} data-s={entry.activityStatus} style={style}>
        {top}
        <h3>{entry.activity}</h3>
        <div className="draft">
          <span className="dot" />
          Completa los detalles de esta tarea
        </div>
        <p className="hint">
          {readOnly ? 'Esta actividad aún no está documentada: sus horas no suman todavía.' : 'Las horas no se calculan solas: las registras tú al documentar. Mientras tanto no suman a tus indicadores.'}
        </p>
        {!readOnly && (
          <button className="fill" type="button" onClick={() => onEdit(entry)}>
            Completar detalles
          </button>
        )}
      </article>
    );
  }

  return (
    <article className={className} data-entry={entry.id} data-s={entry.activityStatus} style={style}>
      {top}
      <h3>{entry.activity}</h3>
      {entry.result && (
        <p className="entry-result">
          <span>Resultado</span>
          {entry.result}
        </p>
      )}
      <div className="entry-body">
        <div>
          <dl>
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {entry.photos.length > 0 && (
            <div className="entry-photos">
              {entry.photos.map((photo, i) =>
                photo.thumbUrl || photo.url ? (
                  <button key={photo.storageId ?? i} type="button" className="thumb" aria-label={`Ampliar ${photo.name}`} onClick={() => photo.url && onImage(photo.url, photo.name)}>
                    <img src={photo.thumbUrl ?? photo.url} alt={photo.name} loading="lazy" />
                  </button>
                ) : null,
              )}
            </div>
          )}
          {entry.links.length > 0 && (
            <div className="entry-links">
              {entry.links.map((link, i) => (
                <a key={i} className="elink" href={link.url} target="_blank" rel="noopener noreferrer">
                  ↗ {link.label}
                </a>
              ))}
            </div>
          )}
          <p className="updated">Última actualización: {updatedLabel(entry.updatedAt)}</p>
        </div>
      </div>
      <button className="entry-more" type="button" aria-expanded={open} onClick={() => onToggle(entry.id)}>
        {open ? 'Ocultar detalle' : 'Ver detalle'}
      </button>
    </article>
  );
}
