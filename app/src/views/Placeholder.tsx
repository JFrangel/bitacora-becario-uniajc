import type { Tab } from '../router';

const TITLES: Record<Tab, string> = { board: 'Tablero', calendar: 'Calendario', journal: 'Bitácora', history: 'Historial' };

/** Marcador de posición de las secciones que se construyen en las tareas siguientes. */
export function Placeholder({ tab }: { tab: Tab }) {
  return (
    <section className="view active" id={`view-${tab}`}>
      <div className="head">
        <h1>
          {TITLES[tab]}
          <em>
            <span>.</span>
          </em>
        </h1>
      </div>
    </section>
  );
}
