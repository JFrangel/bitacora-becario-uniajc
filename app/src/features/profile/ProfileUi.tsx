import { createContext, createElement, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type ProfileUi = {
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  galleryOpen: boolean;
  setGalleryOpen: (open: boolean) => void;
  /** El contenido del panel está montado (también mientras se desliza hacia afuera). */
  setBodyMounted: (mounted: boolean) => void;
  /**
   * ¿Hay ya otro carné en pantalla (el del panel de perfil o la galería de diseños)? Nunca hay dos lienzos 3D a la vez:
   * mientras sea verdadero, el carné de la columna de la Bitácora se desmonta.
   */
  blocked: boolean;
};

const nothing = () => {};
const Context = createContext<ProfileUi>({ panelOpen: false, openPanel: nothing, closePanel: nothing, galleryOpen: false, setGalleryOpen: nothing, setBodyMounted: nothing, blocked: false });

/** Qué hay abierto del perfil: el panel «Mi perfil» y la galería de diseños. */
export function ProfileUiProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [bodyMounted, setBodyMounted] = useState(false);
  const value = useMemo<ProfileUi>(
    () => ({
      panelOpen,
      openPanel: () => setPanelOpen(true),
      closePanel: () => setPanelOpen(false),
      galleryOpen,
      setGalleryOpen,
      setBodyMounted,
      blocked: panelOpen || bodyMounted || galleryOpen,
    }),
    [panelOpen, galleryOpen, bodyMounted],
  );
  return createElement(Context.Provider, { value }, children);
}

export const useProfileUi = () => useContext(Context);
