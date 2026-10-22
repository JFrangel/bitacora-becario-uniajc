// Audita los componentes de React Bits copiados en src/reactbits/ contra la política de seguridad de contenido
// (script-src/style-src 'self', sin peticiones a otros dominios). Sale con código 1 si algún componente usa una de
// estas construcciones: `eval`, `new Function`, etiquetas <style> o estilos inyectados, `fetch(` o `XMLHttpRequest`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'reactbits');

export const PATTERNS = [
  ['eval', /\beval\s*\(/],
  ['new Function', /\bnew\s+Function\b/],
  ['<style', /<style\b/i],
  ["createElement('style')", /createElement\(\s*['"`]style['"`]/],
  ['insertRule', /\binsertRule\b/],
  ['adoptedStyleSheets', /\badoptedStyleSheets\b/],
  ['fetch(', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
];

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

const results = [];
for (const entry of readdirSync(root)) {
  const folder = join(root, entry);
  if (!statSync(folder).isDirectory()) continue;
  const hits = [];
  for (const file of files(folder).filter((f) => /\.(tsx?|jsx?|css)$/.test(f) && !/\.test\./.test(f))) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const [name, pattern] of PATTERNS) if (pattern.test(line)) hits.push(`${relative(root, file)}:${index + 1} ${name}`);
    });
  }
  results.push({ component: entry, hits });
}

for (const { component, hits } of results) {
  console.log(`${hits.length === 0 ? 'OK     ' : 'FALLA  '}${component}${hits.length ? `\n  ${hits.join('\n  ')}` : ''}`);
}
if (results.length === 0) console.log('(no hay componentes en src/reactbits)');
process.exit(results.some((r) => r.hits.length > 0) ? 1 : 0);
