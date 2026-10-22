import { useEffect, useState } from 'react';
import type { BadgeData } from '../../../convex/lib/profile';
import { useSession } from '../../audience';
import { errorMessage } from '../../convexClient';
import { Panel } from '../../shell/Panel';
import { useToast } from '../../shell/Toast';
import type { BadgeDesignId } from './badgeDesigns';
import { DesignGallery } from './DesignGallery';
import { IdBadge, useBadge3D } from './IdBadge';
import { ProfileForm } from './ProfileForm';
import { useProfileUi } from './ProfileUi';
import { useBadgeData, useBadgeDesign } from './useBadge';

const SINCE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
const joinDot = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' · ');

const factsOf = (data: BadgeData): Array<[string, string]> => {
  const rows: Array<[string, string]> = [
    ['Nombre', data.name],
    ['Rol', data.roleLabel],
    ['Programa', joinDot(data.program, data.term)],
    ['Institución', data.institution ?? ''],
    ['Grupo', data.group ?? ''],
  ];
  if (!data.isOwner) rows.push(['En la bitácora desde', SINCE.format(data.since)]);
  return rows.filter(([, value]) => value);
};

type BodyProps = {
  data: BadgeData;
  design: BadgeDesignId;
  mode: 'view' | 'edit';
  readOnly: boolean;
  isOwner: boolean;
  onMode: (mode: 'view' | 'edit') => void;
  onAccess?: () => void;
  onSignOut?: () => void;
};

function ProfileBody({ data, design, mode, readOnly, isOwner, onMode, onAccess, onSignOut }: BodyProps) {
  const ui = useProfileUi();
  const use3D = useBadge3D();
  const { setBodyMounted } = ui;
  useEffect(() => {
    setBodyMounted(true);
    return () => setBodyMounted(false);
  }, [setBodyMounted]);

  if (mode === 'edit') return <ProfileForm data={data} isOwner={isOwner} onDone={() => onMode('view')} onCancel={() => onMode('view')} />;

  return (
    <div id="profileView">
      {!ui.galleryOpen && <IdBadge data={data} design={design} stageId="badgeStage" />}
      {use3D && (
        <p className="badge-hint" id="badgeHint">
          Arrástralo, lánzalo o púlsalo para girarlo.
        </p>
      )}
      <dl className="profile-facts">
        {factsOf(data).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="profile-actions">
        {!readOnly && (
          <button className="fill primary" type="button" onClick={() => onMode('edit')}>
            Editar perfil
          </button>
        )}
        <button className="ghost" type="button" onClick={() => ui.setGalleryOpen(true)}>
          Ver diseños
        </button>
        {isOwner && onAccess && (
          <button className="ghost" type="button" onClick={onAccess}>
            Acceso
          </button>
        )}
        {!readOnly && onSignOut && (
          <button className="ghost" type="button" onClick={onSignOut}>
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}

type ProfilePanelProps = {
  /** Abre el panel de acceso (solo la dueña ve el botón). */
  onAccess?: () => void;
  onSignOut?: () => void;
};

/**
 * «Mi perfil»: el carné (3D si el navegador puede), los datos, «Editar perfil», «Ver diseños» y «Cerrar sesión». En el enlace
 * de solo lectura es el «Perfil» de la dueña: solo se puede mirar el carné y elegir cómo verlo en este navegador.
 */
export function ProfilePanel({ onAccess, onSignOut }: ProfilePanelProps) {
  const ui = useProfileUi();
  const { audience } = useSession();
  const toast = useToast();
  const data = useBadgeData();
  const { design, setDesign, isLocal } = useBadgeDesign(data);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const readOnly = audience === 'viewer';

  useEffect(() => {
    if (!ui.panelOpen) setMode('view');
  }, [ui.panelOpen]);

  const pick = async (id: BadgeDesignId) => {
    try {
      await setDesign(id);
      toast(isLocal ? 'Diseño cambiado en este navegador.' : 'Diseño del carné actualizado.');
      ui.setGalleryOpen(false);
    } catch (error) {
      toast(errorMessage(error) ?? 'No se pudo cambiar el diseño.');
    }
  };

  const title = readOnly ? 'Perfil' : mode === 'edit' ? 'Editar perfil' : 'Mi perfil';
  return (
    <>
      <Panel open={ui.panelOpen} onClose={ui.closePanel} title={title} className="profile">
        {data ? (
          <ProfileBody data={data} design={design} mode={mode} readOnly={readOnly} isOwner={audience === 'owner'} onMode={setMode} onAccess={onAccess} onSignOut={onSignOut} />
        ) : (
          <p className="muted">Cargando…</p>
        )}
      </Panel>
      {ui.galleryOpen && data && <DesignGallery data={data} current={design} local={isLocal} onPick={(id) => void pick(id)} onClose={() => ui.setGalleryOpen(false)} />}
    </>
  );
}
