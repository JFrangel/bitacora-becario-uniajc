/** Posición entre dos vecinos (`before` < `after`); `null` significa «sin vecino» en ese lado. */
export function orderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}
