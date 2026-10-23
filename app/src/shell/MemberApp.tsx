import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { api } from '../../convex/_generated/api';
import type { WorkspaceSummary } from '../../convex/lib/workspaces';
import { SessionProvider, tabsFor, useSession } from '../audience';
import type { SessionInfo } from '../audience';
import type { Me } from '../auth';
import { AccessPanel } from '../features/access/AccessPanel';
import { LandedProvider } from '../features/board/landed';
import { WIDE_QUERY } from '../features/profile/BadgeColumn';
import { initialsOf } from '../features/profile/names';
import { ProfilePanel } from '../features/profile/ProfilePanel';
import { ProfileUiProvider, useProfileUi } from '../features/profile/ProfileUi';
import { useBadgeData, useBadgeDesign, usePrewarmBadge } from '../features/profile/useBadge';
import { AppearanceMenu } from './AppearanceMenu';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { TaskPanelProvider } from '../features/tasks/TaskPanelHost';
import { useMediaQuery } from '../lib/useMediaQuery';
import { hrefForWorkspace, navigate, useRoute } from '../router';
import type { Tab } from '../router';
import { Page } from '../views/Pages';
import { Navbar } from './Navbar';

type Active = Extract<Me, { status: 'active' }>;
const SECTIONS: string[] = ['board', 'calendar', 'journal', 'history'];

/** La barra, la sección activa y los paneles de una persona con acceso vigente. */
function MemberShell({ me, workspaceChoices, activeWorkspace }: { me: Active; workspaceChoices: WorkspaceSummary[]; activeWorkspace?: WorkspaceSummary }) {
  const route = useRoute();
  const ui = useProfileUi();
  const { signOut } = useAuthActions();
  const { workspaceId, audience } = useSession();
  const summary = useQuery(api.journal.summary, audience === 'owner' ? { workspaceId } : 'skip');
  const [accessOpen, setAccessOpen] = useState(false);

  // Deja listo el carné antes de entrar a la Bitácora (solo donde la columna del carné existe).
  const wide = useMediaQuery(WIDE_QUERY);
  const data = useBadgeData();
  const { design } = useBadgeDesign(data);
  usePrewarmBadge(wide, data, design);

  const wanted: Tab = route.name === 'workspace' ? (route.view ?? 'board') : SECTIONS.includes(route.name) ? (route.name as Tab) : 'board';
  const active: Tab = tabsFor(audience, false).includes(wanted) ? wanted : 'board';

  return (
    <>
      <Navbar
        audience={audience}
        active={active}
        draftCount={summary?.drafts ?? 0}
        workspaces={activeWorkspace ? { choices: workspaceChoices, active: activeWorkspace } : undefined}
        whoText={`Tú · ${me.roleLabel}`}
        initials={initialsOf(me.name)}
        profileLabel="Ver mi perfil"
        onSelect={(tab) => navigate(hrefForWorkspace(tab, activeWorkspace?.id, activeWorkspace?.isInitial))}
        onInvite={() => setAccessOpen(true)}
        onProfile={ui.openPanel}
      />
      <main className="stage enter" id="stage">
        <Page tab={active} />
      </main>
      <AccessPanel open={accessOpen} onClose={() => setAccessOpen(false)} />
      <ProfilePanel
        onAccess={
          audience === 'owner'
            ? () => {
                ui.closePanel();
                setAccessOpen(true);
              }
            : undefined
        }
        onSignOut={() => {
          ui.closePanel();
          void signOut();
        }}
      />
    </>
  );
}

/** La aplicación de una persona con acceso vigente (la dueña o una persona invitada). */
export function MemberApp({ me }: { me: Active }) {
  const touch = useMutation(api.members.touch);
  const workspaces = useQuery(api.workspaces.listMine, {});
  const route = useRoute();
  const choices = workspaces?.items ?? [];
  const requested = route.name === 'workspace' ? choices.find((space) => space.id === route.workspaceId) : undefined;
  const activeWorkspace = requested ?? choices.find((space) => space.isInitial) ?? choices[0];
  const workspaceId = activeWorkspace?.id;
  const audience = activeWorkspace ? (activeWorkspace.role === 'owner' ? 'owner' : 'member') : (me.isOwner ? 'owner' : 'member');
  const noSpaces = Boolean(workspaces?.workspaceMode && !activeWorkspace);

  // Marca que la persona abrió la aplicación (el servidor lo guarda como mucho una vez al día).
  useEffect(() => {
    void touch({}).catch(() => {});
  }, [touch]);

  useEffect(() => {
    if (workspaces === undefined || route.name !== 'workspace' || requested) return;
    navigate(hrefForWorkspace('board', activeWorkspace?.id, activeWorkspace?.isInitial));
  }, [workspaces, route.name, requested, activeWorkspace]);

  const wanted = route.name === 'workspace' ? (route.view ?? 'board') : route.name;
  const allowed = tabsFor(audience, false).includes(wanted as Tab);
  useEffect(() => {
    if (allowed) return;
    navigate(hrefForWorkspace('board', activeWorkspace?.id, activeWorkspace?.isInitial));
  }, [allowed, activeWorkspace]);

  const session: SessionInfo = {
    audience,
    workspaceId,
    workspaceRole: activeWorkspace?.role,
    memberId: me.memberId,
    name: me.name,
    roleLabel: me.roleLabel,
    includesJournal: audience === 'owner',
    showsDescriptions: true,
  };

  return (
    <SessionProvider value={session}>
      {noSpaces ? <ProfileUiProvider><WorkspaceLanding me={me} /></ProfileUiProvider> : (
        <LandedProvider>
          <TaskPanelProvider>
            <ProfileUiProvider>
              <MemberShell me={me} workspaceChoices={choices} activeWorkspace={activeWorkspace} />
            </ProfileUiProvider>
          </TaskPanelProvider>
        </LandedProvider>
      )}
    </SessionProvider>
  );
}

function WorkspaceLanding({ me }: { me: Active }) {
  const ui = useProfileUi();
  const { signOut } = useAuthActions();
  return (
    <>
      <header className="nav workspace-empty-nav">
        <div className="brand">
          <span className="mark" />
          <span className="brand-text">Bitácora</span>
        </div>
        <div className="who">
          <AppearanceMenu />
          <span className="who-text">{me.name}</span>
          <button className="avatar" type="button" aria-label="Ver mi perfil" title="Ver mi perfil" onClick={ui.openPanel}>{initialsOf(me.name)}</button>
        </div>
      </header>
      <main className="stage workspace-empty-stage">
        <section className="workspace-empty">
          <p className="eyebrow">Espacios de trabajo</p>
          <h1>No tienes Bitácoras</h1>
          <p>Ya no tienes acceso a una Bitácora compartida. Puedes crear una propia; será independiente de los espacios a los que te inviten.</p>
          <WorkspaceSwitcher workspaces={[]} activeTab="board" showCreateLabel />
        </section>
      </main>
      <ProfilePanel onSignOut={() => { ui.closePanel(); void signOut(); }} />
    </>
  );
}
