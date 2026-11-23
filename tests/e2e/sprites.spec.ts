import arena from '../../content/arena.json' with { type: 'json' };
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  backToMenu,
  cornerTour,
  focusGame,
  gameUrl,
  menuButton,
  playToEnd,
  playerUrl,
  probe,
  snapshotOf,
  startSpriteSampler,
  stopSpriteSampler,
  waitForRun,
  waitFrames,
} from './probe';

// Spec sprite-rendering (change 0012): aspecto de reserva ante una hoja rota y sonda de sprites.
const TORCH_SHEET = '**/Factions/Goblins/Troops/Torch/Red/Torch_Red.png';

test(
  'Scenario: Hoja que no carga (Torch abortada: solo goblin-torch en reserva, la partida sigue)',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(60_000);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // R3: solo se ignora el "Failed to load resource" de la hoja abortada.
      const torch = m.location().url.includes('Torch_Red.png');
      if (!(torch && m.text().startsWith('Failed to load resource'))) problems.push(m.text());
    });
    await page.route(TORCH_SHEET, (route) => route.abort());
    await page.goto(gameUrl({ seed: 42, map: 'real' }));
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(0);
    await startSpriteSampler(page, 'goblin-torch');
    await waitFrames(page, 600);
    const sample = await stopSpriteSampler(page);
    const last = await snapshotOf(page);

    expect(sample.typeMismatches).toBe(0);
    expect(sample.mismatches).toEqual([]);
    expect(sample.placeholderFrames).toBeGreaterThan(0);
    expect(last?.status === 'over' || (last?.tick ?? 0) >= 590).toBe(true);
    expect(problems).toEqual([]);
  },
);

test(
  'Scenario: Recuento coherente con el snapshot (600 frames, cadáveres ≤ 64)',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(gameUrl({ seed: 42, map: 'real' }));
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(0);
    await startSpriteSampler(page);
    await waitFrames(page, 600);
    const sample = await stopSpriteSampler(page);

    expect(sample.mismatches).toEqual([]);
    expect(sample.maxCorpses).toBeLessThanOrEqual(64);
    // 0015: celdas pintadas constantes e iguales a los recuentos del mapa de la sonda.
    expect(sample.cellMisses).toBe(0);
    expect(sample.frames).toBeGreaterThanOrEqual(590);
  },
);

test(
  'Scenario: Sonda en el menú (tras Volver al menú, todo a 0)',
  { tag: '@realtime' },
  async ({ page }) => {
    await page.goto(gameUrl({ seed: 42, map: 'real' }));
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(30);
    await focusGame(page);
    await backToMenu(page);
    await waitFrames(page, 1);
    const s = (await probe(page))?.sprites;

    expect(
      [s?.player, s?.enemies, s?.corpses, s?.projectiles, s?.pulses, s?.gems].map(
        (k) => k?.visible,
      ),
    ).toEqual([0, 0, 0, 0, 0, 0]);
    expect(s?.cells).toEqual({ trunk: 0, water: 0, bridge: 0 });
  },
);

test(
  'Scenario: Sin sonda fuera de E2E (?seed=42 y Jugar)',
  { tag: '@realtime' },
  async ({ page }) => {
    await page.goto(playerUrl('?seed=42'));
    await menuButton(page, 'Jugar').click();
    await waitFrames(page, 10);

    expect(await page.evaluate(() => typeof (window as { __sprint?: unknown }).__sprint)).toBe(
      'undefined',
    );
  },
);

// Spec sprite-rendering (0013): el fondo cubre el mundo entero, (0, 0)–(W, H), también en reserva.
// El rectángulo del fondo es el del mundo (ground-view.test.ts), así que "dentro del fondo" es
// "dentro del mundo" en la sonda de cámara.
const VIEW = arena.view;
const WORLD = { width: arena.width, height: arena.height };
const GROUND_SHEET = '**/Terrain/Ground/Tilemap_Flat.png';

test(
  'Scenario: Fondo en las cuatro esquinas (?e2e&seed=7)',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(90_000);

    const { walked, sample } = await cornerTour(page, VIEW, WORLD);

    expect(walked).toEqual(['tl', 'tr', 'br', 'bl']);
    expect(sample.frames).toBeGreaterThan(0);
    expect([sample.outsideWorld, sample.groundMisses, sample.groundPlaceholderFrames]).toEqual([
      0, 0, 0,
    ]);
  },
);

test(
  'Scenario: Fondo de reserva en el mundo entero (hoja del suelo abortada)',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(90_000);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const ground = m.location().url.includes('Tilemap_Flat.png');
      if (!(ground && m.text().startsWith('Failed to load resource'))) problems.push(m.text());
    });
    await page.route(GROUND_SHEET, (route) => route.abort());

    const { walked, sample } = await cornerTour(page, VIEW, WORLD);

    expect(walked).toEqual(['tl', 'tr', 'br', 'bl']);
    expect(sample.groundPlaceholderFrames).toBe(sample.frames);
    expect([sample.outsideWorld, sample.groundMisses]).toEqual([0, 0]);
    expect(problems).toEqual([]);
  },
);

// Spec sprite-rendering (0015), "Pintado del mapa": celdas pintadas frente al mapa de la sonda.
// Proyecto `logic` (modo manual): el primer frame pintado basta.
const cellsAndMap = async (page: Page) => {
  const p = await probe(page);
  return {
    cells: p?.sprites?.cells ?? null,
    counts: p?.map?.counts ?? null,
    ground: p?.sprites?.ground,
  };
};
const paintedOf = (counts: { trunk: number; water: number; bridge: number } | null) =>
  counts && { trunk: counts.trunk, water: counts.water, bridge: counts.bridge };

test('Scenario: Celdas pintadas iguales al mapa (?e2e&manual&seed=42)', async ({ page }) => {
  await page.goto(gameUrl({ seed: 42, manual: true, map: 'real' }));
  await waitForRun(page);
  const { cells, counts } = await cellsAndMap(page);
  expect(cells).toEqual(paintedOf(counts));
  expect(cells?.trunk ?? 0).toBeGreaterThan(0);
});

test('Scenario: Mapa vacío (?e2e&map=empty&seed=42: 0 celdas y 1 fondo)', async ({ page }) => {
  await page.goto(gameUrl({ seed: 42, manual: true }));
  await waitForRun(page);
  const { cells, ground } = await cellsAndMap(page);
  expect(cells).toEqual({ trunk: 0, water: 0, bridge: 0 });
  expect(ground?.visible).toBe(1);
});

test('Scenario: Partida nueva con otro mapa (R tras la 42)', async ({ page }) => {
  await page.goto(gameUrl({ seed: 42, manual: true, map: 'real' }));
  await waitForRun(page);
  await focusGame(page);
  const before = await cellsAndMap(page);
  expect((await playToEnd(page))?.status).toBe('over');
  await page.keyboard.press('r');
  await expect.poll(async () => (await probe(page))?.runs).toBe(2);
  // Primer frame de la partida nueva: el mapa de la sonda ya es el nuevo (evento, no reloj).
  await expect
    .poll(async () => JSON.stringify((await cellsAndMap(page)).counts))
    .not.toBe(JSON.stringify(before.counts));
  const after = await cellsAndMap(page);
  expect(after.cells).toEqual(paintedOf(after.counts));
  expect(after.counts).not.toEqual(before.counts);
});

test('Scenario: Mapa sobre el fondo de reserva (hoja del suelo abortada)', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const ground = m.location().url.includes('Tilemap_Flat.png');
    if (!(ground && m.text().startsWith('Failed to load resource'))) problems.push(m.text());
  });
  await page.route(GROUND_SHEET, (route) => route.abort());
  await page.goto(gameUrl({ seed: 42, manual: true, map: 'real' }));
  await waitForRun(page);
  const { cells, counts, ground } = await cellsAndMap(page);
  expect(ground).toEqual({ visible: 1, placeholder: 1 });
  expect(cells).toEqual(paintedOf(counts));
  expect(problems).toEqual([]);
});
