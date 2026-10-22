import { useCallback, useState } from 'react';

/** Una preferencia de sí/no guardada en este navegador (dentro de try/catch: puede no haber almacenamiento). */
export function usePersistentFlag(key: string, initial = false): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === '1';
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch {
        /* la preferencia dura hasta cerrar la pestaña */
      }
    },
    [key],
  );
  return [value, set];
}
