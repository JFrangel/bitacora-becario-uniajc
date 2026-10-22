import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { applyAppearance, loadAppearance, saveAppearance } from './appearance';
import type { Appearance, Mode, Style } from './appearance';

type AppearanceApi = { appearance: Appearance; setStyle: (style: Style) => void; setMode: (mode: Mode) => void };

const AppearanceContext = createContext<AppearanceApi | null>(null);

/** Estilo y tema (oscuro o claro) de este navegador. Se guardan en `localStorage` y nunca viajan al servidor. */
export function AppearanceProvider({ children, initial }: { children: ReactNode; initial?: Appearance }) {
  const [appearance, setAppearance] = useState<Appearance>(() => initial ?? loadAppearance());

  const update = useCallback((next: Appearance) => {
    setAppearance(next);
    saveAppearance(next);
  }, []);

  const value = useMemo<AppearanceApi>(
    () => ({
      appearance,
      setStyle: (style) => update({ ...appearance, style }),
      setMode: (mode) => update({ ...appearance, mode }),
    }),
    [appearance, update],
  );

  // El color de la barra del navegador sigue al tema; los atributos los pinta `AppRoot` en su propio elemento.
  useEffect(() => {
    applyAppearance(document.documentElement, appearance);
  }, [appearance]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceApi {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance debe usarse dentro de <AppearanceProvider>.');
  return context;
}
