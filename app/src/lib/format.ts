import { bogotaDate } from '../../convex/lib/dates';

/** Hoy en Bogotá (`AAAA-MM-DD`): "hoy" es el mismo día para todas las personas, estén donde estén. */
export const todayBogota = (now: number = Date.now()) => bogotaDate(now);

const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
const local = (iso: string) => {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d);
};

/** «20 oct» */
export const formatShort = (iso?: string) => {
  if (!iso) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(local(iso)).replace('.', '').replace(' de ', ' ');
};

/** «viernes, 16 de octubre de 2026» */
export const formatWeekday = (iso: string) => new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(local(iso));

/** «Miércoles, 21 de octubre» */
export const formatToday = (iso: string) => {
  const text = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(local(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Horas con coma decimal y hasta dos decimales: 1,5 · 17,5 · 2 */
export const formatHours = (hours: number) => Number(hours).toLocaleString('es-CO', { maximumFractionDigits: 2 });

/** «1 hora» · «2 horas» · «0,5 horas» */
export const hoursLabel = (hours: number) => `${formatHours(hours)} ${Number(hours) === 1 ? 'hora' : 'horas'}`;
