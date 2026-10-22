/**
 * Chispas al soltar una tarjeta: 14 puntos que salen de su centro y desaparecen (solo `transform` y `opacity`).
 * Con «reducir movimiento» no se dibuja nada.
 */
export function sparks(from: HTMLElement | null | undefined): void {
  if (!from || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const app = from.closest<HTMLElement>('.app');
  if (!app) return;
  const [a, r] = [app.getBoundingClientRect(), from.getBoundingClientRect()];
  const cx = r.left - a.left + r.width / 2;
  const cy = r.top - a.top + r.height / 2;
  for (let i = 0; i < 14; i += 1) {
    const spark = document.createElement('i');
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const distance = 46 + Math.random() * 54;
    spark.className = 'spark';
    spark.style.left = `${cx}px`;
    spark.style.top = `${cy}px`;
    spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    app.append(spark);
    setTimeout(() => spark.remove(), 850);
  }
}
