import { useEffect, useState } from 'react';

/** ¿Hay conexión? Sigue los eventos `online`/`offline` del navegador. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const [on, off] = [() => setOnline(true), () => setOnline(false)];
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Tiempo que se espera la respuesta del servidor antes de ofrecer «Reintentar» en lugar de una pantalla en blanco. */
export const GIVE_UP_MS = 10_000;

/** Verdadero si se está esperando datos y no hay conexión, o ya pasó demasiado tiempo sin respuesta. */
export function useStuck(loading: boolean, ms: number = GIVE_UP_MS): boolean {
  const online = useOnline();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!loading) return undefined;
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [loading, ms]);
  return loading && (!online || slow);
}
