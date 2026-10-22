import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { SessionProvider, tabsFor } from '../audience';
import type { SessionInfo } from '../audience';
import type { Me } from '../auth';
import { AccessPanel } from '../features/access/AccessPanel';
import { LandedProvider } from '../features/board/landed';
import { WIDE_QUERY } from '../features/profile/BadgeColumn';
import { initialsOf } from '../features/profile/names';
import { ProfilePanel } from '../features/profile/ProfilePanel';
import { ProfileUiProvider, useProfileUi } from '../features/profile/ProfileUi';
import { useBadgeData, useBadgeDesign, usePrewarmBadge } from '../features/profile/useBadge';
import { TaskPanelProvider } from '../features/tasks/TaskPanelHost';
import { useMediaQuery } from '../lib/useMediaQuery';
import { hrefFor, navigate, useRoute } from '../router';
import type { Tab } from '../router';
import { Page } from '../views/Pages';
import { Navbar } from './Navbar';

type Active = Extract<Me, { status: 'active' }>;
const SECTIONS: string[] = ['board', 'calendar', 'journal', 'history'];

/** La barra, la sección activa y los paneles de una persona con acceso vigente. */
function MemberShell({ me }: { me: Active }) {
  const route = useRoute();
  const ui = useProfileUi();
  const { signOut } = useAuthActions();
  const summary = useQuery(api.journal.summary, me.isOwner ? {} : 'skip');
  const audience = me.isOwner ? 'owner' : 'member';
  const [accessOpen, setAccessOpen] = useState(false);

  // Deja listo el carné antes de entrar a la Bitácora (solo donde la columna del carné existe).
  const wide = useMediaQuery(WIDE_QUERY);
  const data = useBadgeData();
  const { design } = useBadgeDesign(data);
  usePrewarmBadge(wide, data, design);

  const wanted: Tab = SECTIONS.includes(route.name) ? (route.name as Tab) : 'board';
  const active: Tab = tabsFor(audience, false).includes(wanted) ? wanted : 'board';

  return (
    <>
      <Navbar
        audience={audience}
        active={active}
        draftCount={summary?.drafts ?? 0}
        whoText={`Tú · ${me.roleLabel}`}
        initials={initialsOf(me.name)}
        profileLabel="Ver mi perfil"
        onSelect={(tab) => navigate(hrefFor(tab))}
        onInvite={() => setAccessOpen(true)}
        onProfile={ui.openPanel}
      />
      <main className="stage enter" id="stage">
        <Page tab={active} />
      </main>
      <AccessPanel open={accessOpen} onClose={() => setAccessOpen(false)} />
      <ProfilePanel
        onAccess={
          me.isOwner
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
  const audience = me.isOwner ? 'owner' : 'member';

  // Marca que la persona abrió la aplicación (el servidor lo guarda como mucho una vez al día).
  useEffect(() => {
    void touch({}).catch(() => {});
  }, [touch]);

  const session: SessionInfo = {
    audience,
    memberId: me.memberId,
    name: me.name,
    roleLabel: me.roleLabel,
    includesJournal: me.isOwner,
    showsDescriptions: true,
  };

  return (
    <SessionProvider value={session}>
      <LandedProvider>
        <TaskPanelProvider>
          <ProfileUiProvider>
            <MemberShell me={me} />
          </ProfileUiProvider>
        </TaskPanelProvider>
      </LandedProvider>
    </SessionProvider>
  );
}
