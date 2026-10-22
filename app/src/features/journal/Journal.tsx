import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import type { JournalDto } from '../../../convex/lib/journalDto';
import { normalizeSearch } from '../../../convex/lib/text';
import type { ActivityStatus } from '../../../convex/lib/types';
import { CountUp } from '../../components/CountUp';
import { ScrollList } from '../../components/ScrollList/ScrollList';
import { Lightbox } from '../../shell/Lightbox';
import { EntryCard } from './EntryCard';
import './journal.css';

export type JournalSummary = { activities: number; hours: number; completed: number; drafts: number };

export type JournalProps = {
  entries: JournalDto[];
  summary: JournalSummary;
  projects: Array<{ id: string; name: string }>;
  /** Enlace de solo lectura: se ve todo, no se escribe nada. */
  readOnly: boolean;
  onNew: () => void;
  onEdit: (entry: JournalDto) => void;
  onReorder: (date: string, orderedIds: string[]) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  /** El carné de la columna derecha (solo se monta en escritorio ancho). */
  badge?: ReactNode;
};

const STATUSES: ActivityStatus[] = ['Completada', 'En progreso', 'Pendiente de revisión'];

function matches(entry: JournalDto, q: string): boolean {
  const words = normalizeSearch(q).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearch([entry.projectName, entry.activity, entry.objective, entry.development, entry.result, entry.observations, ...entry.links.map((l) => l.label)].filter(Boolean).join(' '));
  return words.every((word) => haystack.includes(word));
}

/** Vista Bitácora: resumen, herramientas de búsqueda y la línea de tiempo con el detalle plegable de cada actividad. */
export function Journal({ entries, summary, projects, readOnly, onNew, onEdit, onReorder, onExport, onImport, badge }: JournalProps) {
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [onlyDrafts, setOnlyDrafts] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const filtering = Boolean(q.trim() || projectId || status || onlyDrafts);
  const rows = useMemo(
    () => entries.filter((e) => (!projectId || e.projectId === projectId) && (!status || e.activityStatus === status) && (!onlyDrafts || e.isDraft) && matches(e, q)),
    [entries, projectId, status, onlyDrafts, q],
  );

  const reorderFor = (entry: JournalDto) => {
    if (readOnly) return undefined;
    const day = entries.filter((e) => e.date === entry.date);
    const index = day.findIndex((e) => e.id === entry.id);
    return {
      canUp: index > 0,
      canDown: index < day.length - 1,
      disabledReason: filtering ? 'Quita los filtros para reordenar' : undefined,
      onMove: (direction: -1 | 1) => {
        const ids = day.map((e) => e.id as string);
        const [moved] = ids.splice(index, 1);
        ids.splice(index + direction, 0, moved);
        onReorder(entry.date, ids);
      },
    };
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (chosen) onImport(chosen);
  };

  return (
    <section className="view active" id="view-journal">
      <div className="head">
        <div>
          <p className="eyebrow">Seguimiento académico</p>
          <h1>
            Bitácora
            <em>
              <span>.</span>
            </em>
          </h1>
          <p className="institution">Institución Universitaria Antonio José Camacho</p>
          <span className="lock">{readOnly ? 'Vista de solo lectura' : 'Privada · solo tú escribes aquí'}</span>
        </div>
        <div className="stats" aria-label="Resumen de la bitácora">
          <div className="stat" style={{ '--i': 0 } as CSSProperties}>
            <CountUp value={summary.activities} />
            <span>Actividades</span>
          </div>
          <div className="stat" style={{ '--i': 1 } as CSSProperties}>
            <CountUp value={summary.hours} decimals={2} />
            <span>Horas registradas</span>
          </div>
          <div className="stat" style={{ '--i': 2 } as CSSProperties}>
            <CountUp value={summary.completed} />
            <span>Completadas</span>
          </div>
          <div className="stat" style={{ '--i': 3 } as CSSProperties}>
            <CountUp value={summary.drafts} />
            <span>Por documentar</span>
          </div>
        </div>
      </div>

      <div className="jtools">
        <input className="search" type="search" placeholder="Buscar actividades o resultados" aria-label="Buscar en actividades" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="jsel" aria-label="Filtrar por área" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">Todas las áreas</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select className="jsel" aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className={`chip${onlyDrafts ? ' on' : ''}`} type="button" aria-pressed={onlyDrafts} onClick={() => setOnlyDrafts(!onlyDrafts)}>
          Solo borradores
        </button>
        {!readOnly && (
          <button className="newtask" id="newEntry" type="button" onClick={onNew}>
            ＋ Registrar actividad
          </button>
        )}
      </div>
      <p className="jcount">
        {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
      </p>

      <ScrollList
        items={rows}
        getKey={(entry) => entry.id}
        wrapClassName="tl"
        className="tl-scroll"
        trackClassName="tl-track"
        empty={
          <div className="empty">
            <h3>{entries.length ? 'No hay resultados' : 'Todavía no hay actividades'}</h3>
            <p>{entries.length ? 'Prueba otra búsqueda o cambia los filtros.' : 'Completa el formulario para comenzar a construir tu historial de trabajo.'}</p>
          </div>
        }
        renderItem={(entry, index) => (
          <EntryCard
            entry={entry}
            index={index}
            open={Boolean(open[entry.id])}
            readOnly={readOnly}
            reorder={reorderFor(entry)}
            onToggle={(id) => setOpen((current) => ({ ...current, [id]: !current[id] }))}
            onEdit={onEdit}
            onImage={(url, name) => setImage({ url, name })}
          />
        )}
      />

      {!readOnly && (
        <div className="journal-foot">
          <button type="button" onClick={onExport}>
            Descargar copia
          </button>
          <button type="button" onClick={() => file.current?.click()}>
            Restaurar copia
          </button>
          <input ref={file} className="sr-only" type="file" accept="application/json,.json" aria-label="Archivo de la copia" onChange={pick} />
        </div>
      )}

      <aside className="journal-badge" id="journalBadge" aria-label="Mi carné">
        {badge}
      </aside>
      {image && <Lightbox url={image.url} name={image.name} onClose={() => setImage(null)} />}
    </section>
  );
}
