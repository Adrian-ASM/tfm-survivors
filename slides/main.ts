import Reveal from 'reveal.js';
import Notes from 'reveal.js/plugin/notes';
import 'reveal.js/reset.css';
import 'reveal.js/reveal.css';
import './slides.css';
import { BALANCE, BALANCE_BAND, FIGURES, LINKS, STAGES } from './data.ts';
import { checkImport, LAYERS, type LayerId } from './layers.ts';
import { mountIcons, mountSprites, paintBackdrops } from './sprites.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/** Enlaces: cualquier `[data-link="game"]` recibe su URL de `LINKS`. */
function fillLinks(): void {
  for (const node of document.querySelectorAll<HTMLAnchorElement>('a[data-link]')) {
    const key = node.dataset['link'] as keyof typeof LINKS | undefined;
    if (!key || !(key in LINKS)) continue;
    node.href = LINKS[key];
    if (!node.textContent) node.textContent = LINKS[key].replace(/^https:\/\//, '');
  }
}

/** Diagrama de capas: al elegir una capa se marca a cuáles puede importar y sus reglas. */
function mountLayers(root: HTMLElement): void {
  const stack = el('div', 'layers-stack');
  const detail = el('div', 'layers-detail');
  const buttons = new Map<LayerId, HTMLButtonElement>();

  const select = (id: LayerId): void => {
    const layer = LAYERS.find((l) => l.id === id);
    if (!layer) return;
    for (const [other, button] of buttons) {
      button.classList.toggle('is-active', other === id);
      button.classList.toggle('is-allowed', layer.mayImport.includes(other));
    }
    detail.replaceChildren(
      el('h4', undefined, layer.path),
      el('p', undefined, layer.role),
      ...layer.rules.map((rule) => el('p', 'rule', rule)),
    );
  };

  for (const layer of LAYERS) {
    const button = el('button', `layer layer--${layer.id}`);
    button.type = 'button';
    button.append(el('strong', undefined, layer.name), el('span', undefined, layer.path));
    button.addEventListener('click', () => {
      select(layer.id);
    });
    buttons.set(layer.id, button);
    stack.append(button);
  }
  root.append(stack, detail);
  select('domain');
}

/** "Prueba el guardarraíl": simula la regla de capas del hook sobre un import escrito a mano. */
function mountGuard(root: HTMLElement): void {
  const form = el('form', 'guard-form');
  const file = el('select');
  for (const layer of LAYERS) file.append(new Option(`${layer.path}x.ts`, layer.id));
  const input = el('input');
  file.value = 'domain';
  input.value = 'const roll = Math.random();';
  input.spellcheck = false;
  const run = el('button', undefined, 'Escribir');
  run.type = 'submit';
  const out = el('pre', 'guard-out');

  const presets = el('div', 'guard-presets');
  const samples = [
    "import Phaser from 'phaser';",
    'const roll = Math.random();',
    "import { Run } from '../domain/Run';",
    "localStorage.setItem('k', 'v');",
  ];
  for (const sample of samples) {
    const chip = el('button', 'chip', sample);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      input.value = sample;
      form.requestSubmit();
    });
    presets.append(chip);
  }

  // Escenario: el barril explota si el hook bloquea; el arquero dispara si la escritura pasa.
  const stage = el('div', 'guard-stage');
  const boom = el('div', 'boom');
  boom.dataset['sprite'] = 'explosion';
  boom.dataset['scale'] = '1.3';
  const archer = el('div', 'shooter');
  archer.dataset['sprite'] = 'archer-shoot';
  archer.dataset['scale'] = '0.75';
  stage.append(boom, archer);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const verdict = checkImport(file.value as LayerId, input.value);
    stage.classList.toggle('is-blocked', !verdict.ok);

    out.className = `guard-out ${verdict.ok ? 'is-ok' : 'is-blocked'}`;
    out.textContent = verdict.ok
      ? '✓ Escritura permitida'
      : [
          `✗ Guardarraíl de arquitectura: escritura bloqueada en ${file.selectedOptions[0]?.text ?? ''}`,
          ...verdict.reasons.map((reason) => `  - ${reason}`),
        ].join('\n');
  });

  form.append(file, input, run);
  const result = el('div', 'guard-result');
  result.append(out, stage);
  root.append(form, presets, result);
  form.requestSubmit();
}

/** Gráfica de victorias del bot por change, con la banda objetivo. */
function mountBalance(root: HTMLElement): void {
  const width = 880;
  const height = 330;
  const pad = { top: 16, right: 16, bottom: 44, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = BALANCE_BAND.seeds;
  const y = (wins: number): number => pad.top + plotH * (1 - wins / max);
  const step = plotW / BALANCE.length;

  const chart = svg('svg', {
    viewBox: `0 0 ${String(width)} ${String(height)}`,
    class: 'balance-chart',
  });
  chart.append(
    svg('rect', {
      x: pad.left,
      y: y(BALANCE_BAND.max),
      width: plotW,
      height: y(BALANCE_BAND.min) - y(BALANCE_BAND.max),
      class: 'band',
    }),
  );
  for (const tick of [0, 10, 20, 30, 40, 50]) {
    chart.append(
      svg('line', { x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick), class: 'grid' }),
    );
    const label = svg('text', {
      x: pad.left - 8,
      y: y(tick) + 5,
      class: 'axis',
      'text-anchor': 'end',
    });
    label.textContent = String(tick);
    chart.append(label);
  }

  const caption = el('p', 'balance-caption no-print', 'Pasa el ratón por una barra.');
  BALANCE.forEach((entry, index) => {
    const barW = step * 0.56;
    const x = pad.left + index * step + (step - barW) / 2;
    const bar = svg('rect', {
      x,
      y: y(entry.wins),
      width: barW,
      height: y(0) - y(entry.wins),
      rx: 4,
      class: 'bar',
    });
    bar.addEventListener('mouseenter', () => {
      caption.textContent = `${entry.change} · ${String(entry.wins)}/${String(max)} victorias · ${entry.note}`;
    });
    const value = svg('text', {
      x: x + barW / 2,
      y: y(entry.wins) - 6,
      class: 'value',
      'text-anchor': 'middle',
    });
    value.textContent = String(entry.wins);
    const label = svg('text', {
      x: x + barW / 2,
      y: height - 18,
      class: 'axis',
      'text-anchor': 'middle',
    });
    label.textContent = entry.change;
    chart.append(bar, value, label);
  });
  // Bordes de la banda encima de las barras, para que se vea dónde está el objetivo.
  for (const limit of [BALANCE_BAND.min, BALANCE_BAND.max]) {
    const edge = { x1: pad.left, x2: width - pad.right, y1: y(limit), y2: y(limit) };
    chart.append(svg('line', { ...edge, class: 'band-edge' }));
  }
  root.append(chart, caption);
}

/** Cifras y etapas del proyecto por bloques de changes. */
function mountFigures(root: HTMLElement): void {
  const grid = el('div', 'figures');
  for (const figure of FIGURES) {
    const cell = el('div', 'figure');
    cell.append(el('strong', undefined, figure.value), el('span', undefined, figure.label));
    grid.append(cell);
  }
  const stages = el('div', 'stages');
  for (const stage of STAGES) {
    const card = el('div', 'stage');
    const icon = el('div', 'stage-icon');
    const sprite = el('div');
    sprite.dataset['sprite'] = stage.sprite;
    sprite.dataset['scale'] = String(stage.scale);
    icon.append(sprite);
    const pills = el('div', 'pills');
    const first = stage.ids[0] ?? '';
    const last = stage.ids[stage.ids.length - 1] ?? '';
    pills.append(
      el('span', 'pill', first === last ? first : `${first}–${last}`),
      el('span', 'pill-count', `${String(stage.ids.length)} changes`),
    );
    card.append(icon, el('h3', undefined, stage.name), el('p', undefined, stage.summary), pills);
    stages.append(card);
  }
  root.append(grid, stages);
}

const MOUNTS: Record<string, (root: HTMLElement) => void> = {
  layers: mountLayers,
  guard: mountGuard,
  balance: mountBalance,
  figures: mountFigures,
};

fillLinks();
for (const root of document.querySelectorAll<HTMLElement>('[data-widget]')) {
  MOUNTS[root.dataset['widget'] ?? '']?.(root);
}
mountSprites();
mountIcons();
// Los fondos se pintan antes de arrancar reveal (que lee data-background-image al iniciar).
// Si una hoja no carga, las slides siguen con el color de fondo.
await paintBackdrops().catch((error: unknown) => {
  console.warn('Fondos sin arte:', error);
});

await Reveal.initialize({
  hash: true,
  width: 1280,
  height: 720,
  margin: 0.04,
  transition: 'slide',
  slideNumber: 'c/t',
  // En el PDF, una página por slide con todos sus fragmentos visibles.
  pdfSeparateFragments: false,
  // reveal detecta `?print-pdf` con una regex global (estado en lastIndex) y a veces falla en dev.
  view: new URLSearchParams(window.location.search).has('print-pdf') ? 'print' : null,
  plugins: [Notes],
});
