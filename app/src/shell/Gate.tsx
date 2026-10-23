import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

/** Las ocho pantallas de entrada de la especificación 4.1. Ninguna muestra datos de la dueña. */
export type GateState = 'login' | 'invite' | 'inviteName' | 'noAccess' | 'invalidInvite' | 'invalidLink' | 'revoked' | 'offline';

type GateProps = {
  state: GateState;
  /** Correo de la cuenta de Google con la sesión abierta (solo `noAccess` e `inviteName`). */
  email?: string;
  /** Nombre que Google conoce de la cuenta, para precargar el formulario de la invitación. */
  suggestedName?: string;
  /** Error que devolvió el servidor al aceptar la invitación. */
  error?: string;
  busy?: boolean;
  onGoogle: () => void;
  onHome: () => void;
  onRetry: () => void;
  onOtherAccount?: () => void;
  onAccept: (values: { name: string; roleLabel: string }) => void;
};

const NAME_MESSAGE = 'Escribe tu nombre (2 a 60 caracteres).';
const ROLE_MESSAGE = 'Escribe tu rol (2 a 60 caracteres).';
const validLength = (text: string) => text.trim().length >= 2 && text.trim().length <= 60;

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.9z" />
    </svg>
  );
}

const Title = ({ children, status = false }: { children: ReactNode; status?: boolean }) => (
  <h1 id="gateTitle" className={status ? 'gate-status' : undefined}>
    {children}
  </h1>
);
const Dot = () => (
  <em>
    <span>.</span>
  </em>
);

function InviteForm({ email, suggestedName, error, busy, onAccept, onOtherAccount }: Pick<GateProps, 'email' | 'suggestedName' | 'error' | 'busy' | 'onAccept' | 'onOtherAccount'>) {
  const [message, setMessage] = useState('');
  const name = useRef<HTMLInputElement>(null);
  const role = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const values = { name: name.current!.value.trim(), roleLabel: role.current!.value.trim() };
    if (!validLength(values.name)) {
      setMessage(NAME_MESSAGE);
      name.current!.focus();
    } else if (!validLength(values.roleLabel)) {
      setMessage(ROLE_MESSAGE);
      role.current!.focus();
    } else {
      setMessage('');
      onAccept(values);
    }
  };

  const first = (suggestedName ?? '').trim().split(/\s+/)[0];
  return (
    <>
      <p className="eyebrow">Casi listo</p>
      <Title status>
        {first ? `Hola, ${first}` : 'Hola'}
        <Dot />
      </Title>
      <p className="gate-lead">
        Entraste como <b>{email}</b>. Confirma cómo quieres aparecer en el tablero.
      </p>
      <form className="fill-form gate-form" noValidate onSubmit={submit}>
        <label>
          <span className="lbl">Tu nombre</span>
          <input ref={name} name="name" type="text" maxLength={60} defaultValue={suggestedName ?? ''} autoComplete="name" data-autofocus />
        </label>
        <label>
          <span className="lbl">Tu rol</span>
          <input ref={role} name="role" type="text" maxLength={60} placeholder="Ej. Directora" autoComplete="off" />
        </label>
        <p className="form-error" role="alert">
          {message || error}
        </p>
        <button className="fill primary wide" type="submit" disabled={busy}>
          Aceptar y entrar
        </button>
      </form>
      <p className="gate-small">Verás el tablero, el calendario y el historial, y podrás crear y editar tareas. La Bitácora y las horas son privadas.</p>
      <button className="gate-link" type="button" onClick={onOtherAccount}>
        Usar otra cuenta
      </button>
    </>
  );
}

/** Pantalla completa de entrada: inicio de sesión, invitación y los avisos de enlace inválido, acceso retirado o sin conexión. */
export function Gate(props: GateProps) {
  const { state, email, onGoogle, onHome, onRetry } = props;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = root.current?.querySelector<HTMLElement>('[data-autofocus], .gbtn');
    target?.focus({ preventScroll: true });
  }, [state]);

  const status = (glyph: string, title: string, text: ReactNode, button: ReactNode) => (
    <>
      <span className="gate-icon" aria-hidden="true">
        {glyph}
      </span>
      <Title status>{title}</Title>
      <p className="gate-lead">{text}</p>
      {button}
    </>
  );
  const homeButton = (
    <button className="gbtn" type="button" onClick={onHome}>
      <span>Ir al inicio</span>
    </button>
  );

  let body: ReactNode;
  switch (state) {
    case 'login':
      body = (
        <>
          <p className="eyebrow">Seguimiento académico</p>
          <Title>
            Bitácora
            <Dot />
          </Title>
          <p className="gate-lead">Tablero, calendario y bitácora de actividades en un solo lugar.</p>
          <button className="gbtn" type="button" onClick={onGoogle} data-autofocus>
            <GoogleG />
            <span>Entrar con Google</span>
          </button>
          <p className="gate-note">Para entrar necesitas una invitación.</p>
          <p className="gate-small">¿Te enviaron un enlace? Ábrelo directamente: no necesitas contraseña ni cuenta de Google.</p>
        </>
      );
      break;
    case 'invite':
      body = (
        <>
          <p className="eyebrow">Invitación</p>
          <Title>
            Te invitaron
            <Dot />
          </Title>
          <p className="gate-lead">Inicia sesión con Google para aceptar. Este enlace es de un solo uso.</p>
          <button className="gbtn" type="button" onClick={onGoogle} data-autofocus>
            <GoogleG />
            <span>Continuar con Google</span>
          </button>
          <p className="gate-small">Usamos tu cuenta solo para identificarte; nunca vemos tu contraseña.</p>
        </>
      );
      break;
    case 'inviteName':
      body = <InviteForm email={email} suggestedName={props.suggestedName} error={props.error} busy={props.busy} onAccept={props.onAccept} onOtherAccount={props.onOtherAccount} />;
      break;
    case 'noAccess':
      body = status(
        '!',
        'Tu cuenta no tiene acceso',
        <>
          Iniciaste sesión como <b>{email}</b>, pero esa cuenta no tiene una invitación. Pide un enlace de invitación a quien administra la bitácora.
        </>,
        <button className="gbtn" type="button" onClick={props.onOtherAccount ?? onHome}>
          <span>Entrar con otra cuenta</span>
        </button>,
      );
      break;
    case 'invalidInvite':
      body = status('✕', 'Esta invitación ya no es válida', 'Pudo usarse antes o caducar: duran 7 días. Pide a quien te invitó un enlace nuevo.', homeButton);
      break;
    case 'invalidLink':
      body = status('✕', 'Este enlace ya no está activo', 'La persona que lo compartió lo desactivó o lo reemplazó por uno nuevo.', homeButton);
      break;
    case 'revoked':
      body = status('!', 'Tu acceso ya no está activo.', 'Se retiró tu acceso a la Bitácora. Si crees que es un error, escribe a quien te invitó.', homeButton);
      break;
    case 'offline':
      body = status(
        '↻',
        'No se pudo abrir tu bitácora',
        'Revisa tu conexión a internet e inténtalo de nuevo.',
        <button className="gbtn" type="button" onClick={onRetry}>
          <span>Reintentar</span>
        </button>,
      );
      break;
  }

  return (
    <div className="gate" ref={root} role="dialog" aria-modal="true" aria-labelledby="gateTitle">
      <div className="gate-brand brand">
        <span className="mark" />
        <span className="brand-text">Bitácora</span>
      </div>
      <main className="gate-main">{body}</main>
    </div>
  );
}
