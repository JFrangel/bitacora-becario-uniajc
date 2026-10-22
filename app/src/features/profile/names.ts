/** Mitad y mitad por palabras: 4 palabras ⇒ 2 + 2; 3 ⇒ 2 + 1; 1 ⇒ [palabra, '']. */
export function nameLines(name: string): [string, string] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['', ''];
  if (words.length === 1) return [words[0], ''];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
}

/** Iniciales para el avatar y el monograma del carné: primer nombre y primer apellido («Jose Frangel Padilla Camacho» ⇒ JP). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const half = Math.ceil(words.length / 2);
  const letters = words.length > 1 ? words[0][0] + words[half][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
}
