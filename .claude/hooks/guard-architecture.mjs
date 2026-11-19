#!/usr/bin/env node
// Guardarraíl 1/3 (tiempo de agente): impide que la IA rompa la regla de dependencias
// o el determinismo del núcleo ANTES de escribir el fichero. ESLint (IDE/pre-commit) y CI son las capas 2 y 3.
import { readHookInput, relativePath, newContent, block } from './lib.mjs';

const ENGINE = String.raw`(phaser|kaplay)(\/[^'"]*)?`;
// Origen de un import: estático (from '…'), de efecto (import '…') o dinámico (import('…')).
const SOURCE = String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]`;
const importOf = (target) => new RegExp(String.raw`${SOURCE}${target}['"]`);
const layerImport = (layers) => new RegExp(String.raw`${SOURCE}[^'"]*\/(${layers})(\/|['"])`);

const RULES = {
  'src/domain/': [
    { re: importOf(ENGINE), msg: 'El dominio no puede importar el motor de juego.' },
    {
      re: layerImport('application|infrastructure|composition'),
      msg: 'El dominio no depende de ninguna otra capa.',
    },
  ],
  'src/application/': [
    { re: importOf(ENGINE), msg: 'La aplicación no puede importar el motor de juego.' },
    {
      re: layerImport('infrastructure|composition'),
      msg: 'La aplicación solo depende del dominio y de sus puertos.',
    },
  ],
};

/** obj.prop por punto, ?., corchetes o desestructuración (const { prop } = obj), con o sin llamada. */
const access = (obj, prop) =>
  new RegExp(
    String.raw`\b${obj}\s*(\?\.|\.)\s*${prop}\b|\b${obj}\s*(\?\.)?\[\s*['"${'`'}]${prop}['"${'`'}]\s*\]` +
      String.raw`|\{[^}]*\b${prop}\b[^}]*\}\s*=\s*${obj}\b`,
  );

const IMPURE = [
  {
    re: access('Math', 'random'),
    msg: 'Math.random rompe el determinismo: usa el puerto RandomGenerator.',
  },
  { re: access('Date', 'now'), msg: 'Date.now rompe el determinismo: usa el puerto Clock.' },
  { re: /\bnew\s+Date\s*\(\s*\)/, msg: 'new Date() rompe el determinismo: usa el puerto Clock.' },
  {
    re: access('performance', 'now'),
    msg: 'performance.now rompe el determinismo: usa el puerto Clock.',
  },
  {
    re: /\b(window|document|localStorage|sessionStorage|indexedDB)\s*(\?\.|\.|\[)/,
    msg: 'APIs del navegador solo en infrastructure.',
  },
  {
    re: /\bglobalThis\b|\bself\s*(\?\.|\.|\[)/,
    msg: 'globalThis/self dan acceso a las APIs del navegador: solo en infrastructure.',
  },
  { re: /\bimport\s*\(/, msg: 'import() dinámico prohibido en el núcleo: usa imports estáticos.' },
];

const input = await readHookInput();
const path = relativePath(input.tool_input?.file_path);
if (!/\.(ts|tsx|mts|js|mjs)$/.test(path)) process.exit(0);

// startsWith para rutas relativas al proyecto; includes como red de seguridad (rutas absolutas, worktrees).
const layer = Object.keys(RULES).find(
  (prefix) => path.startsWith(prefix) || path.includes(`/${prefix}`),
);
if (!layer) process.exit(0);

// Ignora comentarios para no bloquear documentación del propio código.
const code = newContent(input.tool_input)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const violations = [...RULES[layer], ...IMPURE]
  .filter(({ re }) => re.test(code))
  .map(({ msg }) => `- ${msg}`);

if (violations.length > 0) {
  block([
    `Guardarraíl de arquitectura: escritura bloqueada en ${path}`,
    ...violations,
    'Reglas completas: AGENTS.md §3. Corrige el diseño (puerto + adaptador) en lugar de saltarte la regla.',
    'Anota este incidente en docs/ai-log/ (evidencia para el TFM).',
  ]);
}
