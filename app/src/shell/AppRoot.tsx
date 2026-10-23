import type { ReactNode } from 'react';
import { useAppearance } from '../appearance/AppearanceProvider';
import { useRoute } from '../router';

/** Elemento raíz `.app`: aquí viven las variables de color del estilo y del tema activos. */
export function AppRoot({ children }: { children: ReactNode }) {
  const { appearance } = useAppearance();
  const route = useRoute();
  const readOnly = route.name === 'viewer' || route.name === 'profileShare';
  return (
    <div className="app" data-theme={appearance.style} data-mode={appearance.mode} data-readonly={readOnly ? 'true' : undefined}>
      {children}
    </div>
  );
}
