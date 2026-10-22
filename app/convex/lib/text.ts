import { fail } from './errors';

/** Minúsculas, sin tildes y con los espacios colapsados: sirve para buscar «analisis» y encontrar «Análisis». */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Recorta el texto y lanza `VALIDATION` si supera `max` caracteres. */
export function cleanText(text: string, max: number, message?: string): string {
  const clean = text.trim();
  if (clean.length > max) throw fail('VALIDATION', message ?? `Máximo ${max} caracteres.`);
  return clean;
}
