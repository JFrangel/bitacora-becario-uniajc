import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSession } from '../../audience';
import { useAuthState } from '../../auth';
import { errorMessage } from '../../convexClient';
import { formatShort } from '../../lib/format';
import { ConfirmDialog } from '../../shell/ConfirmDialog';
import { Panel } from '../../shell/Panel';
import { useToast } from '../../shell/Toast';
import { dayLabel } from '../history/eventLine';
import './access.css';

const day = (at: number) => formatShort(new Date(at - 5 * 3_600_000).toISOString().slice(0, 10));

type Copyable = { value: string; label: string };

function useCopy() {
  const toast = useToast();
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Enlace copiado.');
    } catch {
      toast('No se pudo copiar: selecciona el enlace y cópialo.');
    }
  };
}

function LinkField({ value, label }: Copyable) {
  const copy = useCopy();
  return (
    <div className="link-field">
      <input type="text" readOnly aria-label={label} value={value} onFocus={(event) => event.currentTarget.select()} />
      <button type="button" className="ghost2" onClick={() => void copy(value)}>
        Copiar
      </button>
    </div>
  );
}

/** Invitaciones de quien llama: crear un enlace de un solo uso (se muestra una vez), ver las pendientes y revocarlas. */
function Invitations() {
  const { workspaceId } = useSession();
  const scope = workspaceId ? { workspaceId } : {};
  const mine = useQuery(api.invites.mine, scope);
  const create = useMutation(api.invites.create);
  const revoke = useMutation(api.invites.revoke);
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  return (
    <section className="access-block" aria-labelledby="inviteTitle">
      <h3 id="inviteTitle">Invitar a alguien</h3>
      <p className="ev-hint">La persona entra con su cuenta de Google. El enlace es de un solo uso, caduca en 7 días y se muestra una sola vez.</p>
      <button
        type="button"
        className="fill primary"
        onClick={() => {
          setMessage('');
          create(scope)
            .then((result) => setLink(result.link))
            .catch((error) => setMessage(errorMessage(error) ?? 'No se pudo crear la invitación.'));
        }}
      >
        Invitar a alguien
      </button>
      {link && (
        <>
          <LinkField value={link} label="Enlace de invitación" />
          <p className="ev-hint">Es de un solo uso y caduca en 7 días. Cuando cierres este panel ya no podrás verlo: crea otro si lo necesitas.</p>
        </>
      )}
      <p className="form-error" role="alert">
        {message}
      </p>
      <h4>Invitaciones pendientes</h4>
      {mine && mine.length === 0 && <p className="ev-hint">No tienes invitaciones pendientes.</p>}
      <ul className="access-list" aria-label="Invitaciones pendientes">
        {(mine ?? []).map((invite) => (
          <li key={invite.id}>
            <span>Caduca el {day(invite.expiresAt)}</span>
            <button type="button" className="ghost2" onClick={() => void revoke({ ...scope, inviteId: invite.id })}>
              Revocar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Solo la dueña: quién tiene acceso (con el correo de su cuenta) y el botón para retirarlo. */
function People({ now }: { now: number }) {
  const { memberId, workspaceId } = useSession();
  const scope = workspaceId ? { workspaceId } : {};
  const people = useQuery(api.members.list, scope);
  const revoke = useMutation(api.members.revoke);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);

  return (
    <section className="access-block" aria-labelledby="peopleTitle">
      <h3 id="peopleTitle">Personas con acceso</h3>
      <ul className="access-list people" aria-label="Personas con acceso">
        {(people ?? []).map((person) => (
          <li key={person.id}>
            <div>
              <strong>{person.name}</strong> <span className="role">{person.roleLabel}</span>
              {person.revoked && <span className="stag" data-s="nota">Sin acceso</span>}
              <small>{person.email}</small>
              <small>
                {person.invitedByName ? `Invitada por ${person.invitedByName} · ` : ''}Ingresó el {day(person.createdAt)} · Última actividad: {dayLabel(person.lastSeenAt, now)}
              </small>
            </div>
            {!person.revoked && person.id !== memberId && (
              <button type="button" className="ghost2" onClick={() => setTarget({ id: person.id, name: person.name })}>
                Retirar acceso
              </button>
            )}
          </li>
        ))}
      </ul>
      {target && (
        <ConfirmDialog
          title={`¿Retirar el acceso de ${target.name}?`}
          text="Dejará de tener acceso de inmediato y se revocarán sus invitaciones pendientes. Podrás volver a invitar a esta persona."
          confirmLabel="Retirar acceso"
          onConfirm={() => {
            void revoke({ ...scope, memberId: target.id as Id<'members'> });
            setTarget(null);
          }}
          onCancel={() => setTarget(null)}
        />
      )}
    </section>
  );
}

/** Solo la dueña: activar, copiar, regenerar y desactivar el enlace de la universidad, y sus dos opciones. */
function ShareLink() {
  const { workspaceId } = useSession();
  const scope = workspaceId ? { workspaceId } : {};
  const settings = useQuery(api.settings.get, scope);
  const setShare = useMutation(api.settings.setShare);
  const regenerate = useMutation(api.settings.regenerateShare);
  const [asking, setAsking] = useState(false);
  const toast = useToast();

  if (!settings) return null;
  return (
    <section className="access-block" aria-labelledby="shareTitle">
      <h3 id="shareTitle">Enlace de solo lectura</h3>
      <p className="ev-hint">Para la universidad: ve todo, no edita nada y no necesita cuenta.</p>
      {settings.enabled && settings.link ? (
        <>
          <LinkField value={settings.link} label="Enlace de solo lectura" />
          <div className="access-actions">
            <button type="button" className="ghost2" onClick={() => setAsking(true)}>
              Regenerar enlace
            </button>
            <button type="button" className="ghost2" onClick={() => void setShare({ ...scope, enabled: false })}>
              Desactivar enlace
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="fill primary" onClick={() => void setShare({ ...scope, enabled: true })}>
          Activar enlace
        </button>
      )}
      <label className="check">
        <input type="checkbox" checked={settings.includesJournal} onChange={(event) => void setShare({ ...scope, includesJournal: event.target.checked })} />
        <span>Incluir la Bitácora</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.showsDescriptions} onChange={(event) => void setShare({ ...scope, showsDescriptions: event.target.checked })} />
        <span>Mostrar descripciones de las tareas</span>
      </label>
      {asking && (
        <ConfirmDialog
          title="¿Regenerar el enlace?"
          text="Se creará un enlace nuevo. El enlace anterior dejará de funcionar de inmediato."
          confirmLabel="Regenerar"
          onConfirm={() => {
            setAsking(false);
            void regenerate(scope).then(() => toast('Enlace nuevo creado. El anterior ya no funciona.'));
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </section>
  );
}

/** Panel «Acceso». La dueña ve además las personas y el enlace de solo lectura; el resto, solo sus invitaciones y «Cerrar sesión». */
export function AccessPanel({ open, onClose, now = Date.now() }: { open: boolean; onClose: () => void; now?: number }) {
  const { audience } = useSession();
  const { signOut } = useAuthState({ tryOwner: false });

  // Cerrar el panel olvida el enlace de invitación que se acababa de mostrar.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!open) setVersion((v) => v + 1);
  }, [open]);

  return (
    <Panel open={open} onClose={onClose} title="Acceso">
      <div className="access" key={version}>
        <Invitations />
        {audience === 'owner' && <People now={now} />}
        {audience === 'owner' && <ShareLink />}
        <div className="access-foot">
          <button type="button" className="ghost" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </Panel>
  );
}
