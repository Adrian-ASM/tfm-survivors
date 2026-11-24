// Capas de Clean Architecture para la presentación y una réplica, solo para la demo, de las reglas
// de `.claude/hooks/guard-architecture.mjs` (el hook real usa Node y no se puede cargar en el navegador).
// Si cambian las reglas del hook, cambia también estas.

export type LayerId = 'domain' | 'application' | 'infrastructure' | 'composition';

export interface Layer {
  readonly id: LayerId;
  readonly name: string;
  readonly path: string;
  readonly role: string;
  readonly mayImport: readonly LayerId[];
  readonly rules: readonly string[];
}

export const LAYERS: readonly Layer[] = [
  {
    id: 'composition',
    name: 'Composición',
    path: 'src/composition/',
    role: 'Composition root: el único sitio que conoce las implementaciones concretas y las conecta.',
    mayImport: ['domain', 'application', 'infrastructure'],
    rules: ['Crea los adaptadores y los inyecta en los casos de uso.'],
  },
  {
    id: 'infrastructure',
    name: 'Infraestructura',
    path: 'src/infrastructure/',
    role: 'Adaptadores: Phaser (render, input, cámara), localStorage, reloj y azar reales.',
    mayImport: ['domain', 'application'],
    rules: [
      'Único sitio donde se puede importar el motor.',
      'Valida con zod toda entrada externa.',
    ],
  },
  {
    id: 'application',
    name: 'Aplicación',
    path: 'src/application/',
    role: 'Casos de uso (StartRun, ChooseUpgrade…) y puertos (Clock, RandomGenerator, repositorios).',
    mayImport: ['domain'],
    rules: ['Sin motor ni APIs del navegador.', 'Habla con el exterior solo a través de puertos.'],
  },
  {
    id: 'domain',
    name: 'Dominio',
    path: 'src/domain/',
    role: 'Simulación pura y determinista: Run, oleadas, armas, campo de flujo, peligros…',
    mayImport: [],
    rules: [
      'No importa ninguna otra capa ni el motor.',
      'Sin Math.random, Date.now, window, document ni localStorage.',
      'Misma semilla y mismas entradas ⇒ misma partida.',
    ],
  },
];

const ENGINE = String.raw`(phaser|kaplay)(\/[^'"]*)?`;
const SOURCE = String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]`;
const importOf = (target: string): RegExp => new RegExp(String.raw`${SOURCE}${target}['"]`);
const layerImport = (layers: string): RegExp =>
  new RegExp(String.raw`${SOURCE}[^'"]*\/(${layers})(\/|['"])`);

interface Rule {
  readonly re: RegExp;
  readonly msg: string;
}

const LAYER_RULES: Partial<Record<LayerId, readonly Rule[]>> = {
  domain: [
    { re: importOf(ENGINE), msg: 'El dominio no puede importar el motor de juego.' },
    {
      re: layerImport('application|infrastructure|composition'),
      msg: 'El dominio no depende de ninguna otra capa.',
    },
  ],
  application: [
    { re: importOf(ENGINE), msg: 'La aplicación no puede importar el motor de juego.' },
    {
      re: layerImport('infrastructure|composition'),
      msg: 'La aplicación solo depende del dominio y de sus puertos.',
    },
  ],
};

const IMPURE: readonly Rule[] = [
  {
    re: /\bMath\s*(\?\.|\.)\s*random\b/,
    msg: 'Math.random rompe el determinismo: usa el puerto RandomGenerator.',
  },
  { re: /\bDate\s*(\?\.|\.)\s*now\b/, msg: 'Date.now rompe el determinismo: usa el puerto Clock.' },
  { re: /\bnew\s+Date\s*\(\s*\)/, msg: 'new Date() rompe el determinismo: usa el puerto Clock.' },
  {
    re: /\b(window|document|localStorage|sessionStorage|indexedDB)\s*(\?\.|\.|\[)/,
    msg: 'APIs del navegador solo en infrastructure.',
  },
];

export interface Verdict {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

/** Lo que diría el hook si un agente escribiera `code` en un fichero de la capa `layer`. */
export function checkImport(layer: LayerId, code: string): Verdict {
  const rules = LAYER_RULES[layer];
  if (!rules) return { ok: true, reasons: [] };
  const reasons = [...rules, ...IMPURE].filter(({ re }) => re.test(code)).map(({ msg }) => msg);
  return { ok: reasons.length === 0, reasons };
}
