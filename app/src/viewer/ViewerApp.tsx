import { useQuery } from 'convex/react';
import { Component } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../convex/_generated/api';
import { SessionProvider, tabsFor } from '../audience';
import type { SessionInfo } from '../audience';
import { errorCode } from '../convexClient';
import { useBoardData } from '../data/useBoardData';
import { LandedProvider } from '../features/board/landed';
import { useBadgeData } from '../features/profile/useBadge';
import { ProfilePanel } from '../features/profile/ProfilePanel';
import { ProfileUiProvider, useProfileUi } from '../features/profile/ProfileUi';
import { TaskPanelProvider } from '../features/tasks/TaskPanelHost';
import { useStuck } from '../lib/useConnectivity';
import { hrefFor, navigate, useRoute } from '../router';
import type { Tab } from '../router';
import { Gate } from '../shell/Gate';
import type { GateState } from '../shell/Gate';
import { Navbar } from '../shell/Navbar';
import { Page } from '../views/Pages';

const noop = () => {};
const goHome = () => navigate(hrefFor('board'));
const reload = () => window.location.reload();

const gate = (state: GateState) => <Gate state={state} onGoogle={noop} onHome={goHome} onRetry={reload} onAccept={noop} />;

/**
 * Si el servidor deja de aceptar el enlace (la dueña lo desactivó o lo cambió con la página abierta), cada consulta de esta
 * vista falla con FORBIDDEN: se muestra «Este enlace ya no está activo». Cualquier otro fallo ofrece reintentar.
 */
class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean; code?: string }> {
  state = { failed: false, code: undefined as string | undefined };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, code: errorCode(error) };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return gate(this.state.code === 'FORBIDDEN' ? 'invalidLink' : 'offline');
  }
}

/** La barra, la sección activa y el perfil de la dueña, sin nada que se pueda editar. */
function ViewerShell({ token, active, includesJournal }: { token: string; active: Tab; includesJournal: boolean }) {
  const ui = useProfileUi();
  const { summary } = useBoardData();
  const owner = useBadgeData();
  return (
    <>
      <Navbar
        audience="viewer"
        active={active}
        includesJournal={includesJournal}
        draftCount={summary?.drafts ?? 0}
        brandSubtitle={owner?.name ? `De ${owner.name}` : undefined}
        whoText="Solo lectura"
        initials="U"
        profileLabel="Ver el perfil de quien registra"
        onSelect={(tab) => navigate(hrefFor(tab, token))}
        onProfile={ui.openPanel}
      />
      <main className="stage enter" id="stage">
        <Page tab={active} />
      </main>
      <ProfilePanel />
    </>
  );
}

function ViewerContent({ token }: { token: string }) {
  const route = useRoute();
  const access = useQuery(api.viewer.access, { shareToken: token });
  const stuck = useStuck(access === undefined);

  if (access === undefined) return stuck ? gate('offline') : null;

  const tabs = tabsFor('viewer', access.includesJournal);
  const wanted: Tab = route.view ?? 'board';
  const active: Tab = tabs.includes(wanted) ? wanted : 'board';
  const session: SessionInfo = { audience: 'viewer', shareToken: token, includesJournal: access.includesJournal, showsDescriptions: access.showsDescriptions };

  return (
    <SessionProvider value={session}>
      <LandedProvider>
        <TaskPanelProvider>
          <ProfileUiProvider>
            <ViewerShell token={token} active={active} includesJournal={access.includesJournal} />
          </ProfileUiProvider>
        </TaskPanelProvider>
      </LandedProvider>
    </SessionProvider>
  );
}

/** La vista de solo lectura `/ver/<token>`: lo que la dueña eligió compartir, sin edición ni sesión. */
export function ViewerApp({ token }: { token: string }) {
  return (
    <ViewerBoundary key={token}>
      <ViewerContent token={token} />
    </ViewerBoundary>
  );
}
