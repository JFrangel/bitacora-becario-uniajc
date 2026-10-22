import { useEffect, useState } from 'react';
import { todayBogota } from './format';

/** El día de hoy en Bogotá; se actualiza solo al cambiar de día aunque la pestaña quede abierta toda la noche. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayBogota());
  useEffect(() => {
    const timer = setInterval(() => setToday(todayBogota()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
