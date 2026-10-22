// Utilidades de PRUEBAS: leen los CSS del proyecto. No se importan desde la aplicación.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');

/** Todos los `.css` bajo `src/` (estilos propios, funciones y copias de React Bits). */
export function cssPaths(dir = SRC): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...cssPaths(path));
    else if (name.endsWith('.css')) out.push(path);
  }
  return out.sort();
}

export const readCss = (path: string) => readFileSync(path, 'utf8');

/** CSS sin comentarios. */
export const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

export type Rule = { selector: string; body: string; file: string };

/** Reglas de primer nivel y dentro de `@media`/`@supports` (suficiente para las comprobaciones de estilo). */
export function rulesOf(css: string, file = ''): Rule[] {
  const rules: Rule[] = [];
  const text = stripComments(css);
  const walk = (chunk: string) => {
    let i = 0;
    while (i < chunk.length) {
      const open = chunk.indexOf('{', i);
      if (open === -1) break;
      const head = chunk.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < chunk.length && depth > 0) {
        if (chunk[j] === '{') depth++;
        else if (chunk[j] === '}') depth--;
        j++;
      }
      const body = chunk.slice(open + 1, j - 1);
      if (head.startsWith('@media') || head.startsWith('@supports')) walk(body);
      else if (!head.startsWith('@')) rules.push({ selector: head, body, file });
      i = j;
    }
  };
  walk(text);
  return rules;
}

export const allRules = () => cssPaths().flatMap((path) => rulesOf(readCss(path), path));

/** `--nombre: valor;` de un cuerpo de regla. */
export function declarations(body: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[match[1]] = match[2].trim();
  return vars;
}
