import { useEffect, useState } from 'react';

/** ¿Se cumple esta media query? Se actualiza al cambiar el tamaño de la ventana. Sin `matchMedia` (pruebas) es falso. */
export function useMediaQuery(query: string): boolean {
  const supported = typeof matchMedia === 'function';
  const [matches, setMatches] = useState(() => (supported ? matchMedia(query).matches : false));
  useEffect(() => {
    if (!supported) return;
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, [query, supported]);
  return matches;
}

export const useIsPhone = () => useMediaQuery('(max-width: 640px)');
