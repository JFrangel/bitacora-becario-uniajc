// Quién «inició sesión» en la vista previa. Se guarda en este navegador y viaja en cada llamada al servidor de ejemplo.
export type Who = 'owner' | 'ana' | 'carlos' | 'anonymous';

export const WHO_LABELS: Record<Who, string> = {
  owner: 'Dueña (Jose)',
  ana: 'Persona invitada (Ana, directora)',
  carlos: 'Cuenta de Google sin invitación',
  anonymous: 'Sin sesión',
};

const KEY = 'demo.who';
const listeners = new Set<() => void>();

const read = (): Who => {
  try {
    const value = localStorage.getItem(KEY);
    if (value === 'owner' || value === 'ana' || value === 'carlos' || value === 'anonymous') return value;
  } catch {
    /* sin almacenamiento */
  }
  return 'owner';
};

let current: Who = read();

export const getWho = () => current;
export const subscribeWho = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function setWho(next: Who) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* sin almacenamiento */
  }
  listeners.forEach((listener) => listener());
}
