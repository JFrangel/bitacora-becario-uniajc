import { useLayoutEffect, useRef } from 'react';
import { canInvite, tabsFor } from '../audience';
import type { Audience } from '../audience';
import { TABS } from '../router';
import type { Tab } from '../router';
import { AppearanceMenu } from './AppearanceMenu';

type NavbarProps = {
  audience: Audience;
  active: Tab;
  /** Solo el enlace de solo lectura: ¿incluye la Bitácora? */
  includesJournal?: boolean;
  /** Borradores por documentar (insignia de la pestaña Bitácora). */
  draftCount?: number;
  /** «Tú · Becario» o «Solo lectura». */
  whoText: string;
  /** Iniciales del botón de perfil. */
  initials: string;
  profileLabel: string;
  onSelect: (tab: Tab) => void;
  onInvite?: () => void;
  onProfile: () => void;
};

/** Barra superior: marca, pestañas con indicador deslizante, «Invitar», «Apariencia» y el perfil. */
export function Navbar({ audience, active, includesJournal = false, draftCount = 0, whoText, initials, profileLabel, onSelect, onInvite, onProfile }: NavbarProps) {
  const visible = tabsFor(audience, includesJournal);
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);

  // Lee la posición de la pestaña activa y la escribe en el indicador (una lectura, luego una escritura).
  useLayoutEffect(() => {
    const place = () => {
      const tab = nav.current?.querySelector<HTMLElement>('.tab.active');
      const el = indicator.current;
      if (!tab || !el) return;
      const [width, left] = [tab.offsetWidth, tab.offsetLeft];
      el.style.width = `${width}px`;
      el.style.transform = `translateX(${left}px)`;
    };
    place();
    window.addEventListener('resize', place);
    void document.fonts?.ready.then(place);
    return () => window.removeEventListener('resize', place);
  }, [active, draftCount, visible.length]);

  return (
    <header className="nav">
      <div className="brand">
        <span className="mark" />
        <span className="brand-text">
          Bitácora<em>.</em>
        </span>
      </div>
      <nav className="tabs" ref={nav} aria-label="Secciones">
        <span className="indicator" ref={indicator} />
        {TABS.filter((tab) => visible.includes(tab.id)).map((tab) => (
          <button key={tab.id} type="button" className={`tab${tab.id === active ? ' active' : ''}`} aria-current={tab.id === active ? 'page' : undefined} onClick={() => onSelect(tab.id)}>
            {tab.label}
            {tab.id === 'journal' && draftCount > 0 && (
              <span className="badge" data-n={draftCount}>
                {draftCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="who">
        {canInvite(audience) && (
          <button className="invite" id="invite" type="button" onClick={onInvite}>
            Invitar
          </button>
        )}
        <AppearanceMenu />
        <span className="who-text">{whoText}</span>
        <button className="avatar" id="profileBtn" type="button" data-who="B" aria-haspopup="dialog" aria-label={profileLabel} title={profileLabel} onClick={onProfile}>
          {initials}
        </button>
      </div>
    </header>
  );
}
