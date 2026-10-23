import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { AppearanceProvider } from './appearance/AppearanceProvider';
import { convex } from './convexClient';
import { AppRoot } from './shell/AppRoot';
import { Root } from './shell/Root';
import { ToastProvider } from './shell/Toast';

/** Se ve solo en desarrollo, antes de conectar el proyecto de Convex. */
export function MissingConfig() {
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gateTitle">
      <div className="gate-brand brand">
        <span className="mark" />
        <span className="brand-text">Bitácora</span>
      </div>
      <main className="gate-main">
        <span className="gate-icon" aria-hidden="true">
          !
        </span>
        <h1 id="gateTitle" className="gate-status">
          Falta conectar la base de datos
        </h1>
        <p className="gate-lead">
          Define <b>VITE_CONVEX_URL</b> (la escribe <b>npx convex dev</b> en <b>.env.local</b>) y vuelve a abrir la aplicación.
        </p>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AppearanceProvider>
      <ToastProvider>
        <AppRoot>
          {convex ? (
            <ConvexAuthProvider client={convex}>
              <Root />
            </ConvexAuthProvider>
          ) : (
            <MissingConfig />
          )}
        </AppRoot>
      </ToastProvider>
    </AppearanceProvider>
  );
}
