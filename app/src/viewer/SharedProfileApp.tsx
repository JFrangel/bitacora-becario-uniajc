import { useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { initialsOf } from '../features/profile/names';
import { useStuck } from '../lib/useConnectivity';

/** Perfil personal público. La consulta entrega únicamente los campos aprobados por quien generó el enlace. */
export function SharedProfileApp({ token }: { token: string }) {
  const profile = useQuery(api.viewer.sharedProfile, { token });
  const stuck = useStuck(profile === undefined);

  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = existing?.content;
    const robots = existing ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }));
    robots.content = 'noindex, nofollow';
    return () => {
      if (previous === undefined) robots.remove();
      else robots.content = previous;
    };
  }, []);

  if (profile === undefined) {
    return (
      <main className="profile-public" aria-live="polite">
        <PublicBrand />
        <p className="profile-public-status">{stuck ? 'No se pudo cargar el perfil. Revisa tu conexión e inténtalo de nuevo.' : 'Cargando perfil…'}</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="profile-public">
        <PublicBrand />
        <section className="profile-public-status" role="status">
          <h1>Este perfil ya no está disponible</h1>
          <p>El enlace pudo desactivarse o reemplazarse por uno nuevo.</p>
        </section>
      </main>
    );
  }

  const academic = [profile.program, profile.term].filter(Boolean).join(' · ');
  return (
    <main className="profile-public">
      <PublicBrand />
      <article className="profile-public-card" aria-labelledby="publicProfileName">
        <div className="profile-public-person">
          {profile.photoDataUrl ? (
            <img className="profile-public-photo" src={profile.photoDataUrl} alt={`Foto de ${profile.name}`} />
          ) : (
            <span className="profile-public-initials" aria-hidden="true">{initialsOf(profile.name)}</span>
          )}
          <div>
            <p className="eyebrow">Perfil compartido</p>
            <h1 id="publicProfileName">{profile.name}</h1>
            <p className="profile-public-role">{profile.roleLabel}</p>
          </div>
        </div>
        {(academic || profile.institution || profile.group) && (
          <dl className="profile-public-facts">
            {academic && <div><dt>Formación</dt><dd>{academic}</dd></div>}
            {profile.institution && <div><dt>Institución</dt><dd>{profile.institution}</dd></div>}
            {profile.group && <div><dt>Grupo</dt><dd>{profile.group}</dd></div>}
          </dl>
        )}
      </article>
      <p className="profile-public-foot">Bitácora · Perfil individual de solo lectura</p>
    </main>
  );
}

function PublicBrand() {
  return (
    <header className="profile-public-brand brand">
      <span className="mark" aria-hidden="true" />
      <span className="brand-text">Bitácora</span>
    </header>
  );
}
