import type { Page } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import mapJson from '../../content/map.json' with { type: 'json' };
import player from '../../content/player.json' with { type: 'json' };
import { MAP_GOLDEN, signatureOf } from '../support/mapGolden';
import { expect, test } from './fixtures';
import {
  backToMenu,
  collect,
  expectManual,
  focusGame,
  gameUrl,
  holdKey,
  menuButton,
  playToEnd,
  playerUrl,
  probe,
  snapshotOf,
  waitForRun,
  type MapView,
} from './probe';

// Spec procedural-map (0015): sonda del mapa, `?e2e&map=empty` y mapa real en la build. Proyecto
// `logic` (modo manual, sin esperas de reloj). Los E2E no importan `src/`: comparan con la firma
// dorada (`tests/support/mapGolden.ts`, fijada contra el núcleo por un test unitario).

const mapOf = async (page: Page): Promise<MapView | null> => (await probe(page))?.map ?? null;
const mentionsMap = (messages: string[]): string[] => messages.filter((m) => /\bmap\b/.test(m));

async function openGame(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await waitForRun(page);
  await focusGame(page);
}

/** Celda (c, r) de un punto (última columna/fila para x = ancho, y = alto). */
const cellOf = (m: MapView, x: number, y: number) => ({
  col: Math.min(Math.floor(x / m.cellSize), m.cols - 1),
  row: Math.min(Math.floor(y / m.cellSize), m.rows - 1),
});

/** ¿Solapa el círculo (x, y, r) una celda `trunk` o `water`? (tangencia no es solape). */
function overlapsBlocked(m: MapView, x: number, y: number, r: number): boolean {
  const s = m.cellSize;
  for (let row = 0; row < m.rows; row++) {
    for (let col = 0; col < m.cols; col++) {
      const t = m.cells[row * m.cols + col];
      if (t !== 'trunk' && t !== 'water') continue;
      const nx = Math.max(col * s, Math.min(x, (col + 1) * s));
      const ny = Math.max(row * s, Math.min(y, (row + 1) * s));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r - 1e-6) return true;
    }
  }
  return false;
}

/** Invariantes de un mapa generado sin el núcleo: recuentos, zona de inicio y conectividad. */
function expectGeneratedMap(m: MapView): void {
  const counted = { grass: 0, trunk: 0, water: 0, bridge: 0 };
  for (const t of m.cells) counted[t] += 1;
  expect(m.cells).toHaveLength(m.cols * m.rows);
  expect(m.counts).toEqual(counted);
  const walkable = (i: number) => m.cells[i] === 'grass' || m.cells[i] === 'bridge';
  const start = cellOf(m, m.start.x, m.start.y);
  const seen = new Set([start.row * m.cols + start.col]);
  const queue = [...seen];
  while (queue.length > 0) {
    const i = queue.pop() ?? 0;
    const c = i % m.cols;
    const near = [c > 0 ? i - 1 : -1, c < m.cols - 1 ? i + 1 : -1, i - m.cols, i + m.cols];
    for (const j of near) {
      if (j < 0 || j >= m.cells.length || seen.has(j) || !walkable(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  expect(seen.size).toBe(counted.grass + counted.bridge);
  expect(counted.trunk).toBeGreaterThan(0);
}

test('Scenario: Sonda coherente con el núcleo (?e2e&manual&seed=42)', async ({ page }) => {
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  await expectManual(page);
  const m = await mapOf(page);
  expect([m?.cols, m?.rows, m?.cellSize]).toEqual([32, 18, 60]);
  expect(signatureOf(m?.cells ?? [])).toBe(MAP_GOLDEN[42]);
  const sum = Object.values(m?.counts ?? {}).reduce((a, b) => a + b, 0);
  expect(sum).toBe(576);
  expect(m?.start).toEqual({
    x: arena.width / 2,
    y: arena.height / 2,
    radius: mapJson.startRadius,
  });
  expect(m?.emptyForced).toBe(false);
  if (m) expectGeneratedMap(m);
});

test('Scenario: Sonda en el menú (null tras Volver al menú; Jugar la repone)', async ({ page }) => {
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  await backToMenu(page);
  await expect.poll(() => mapOf(page)).toBeNull();
  await menuButton(page, 'Jugar').click();
  await waitForRun(page);
  await expect.poll(async () => (await mapOf(page))?.cells.length ?? 0).toBe(576);
});

test('Scenario: Sin sonda fuera de E2E (?seed=42 y Jugar)', async ({ page }) => {
  await page.goto(playerUrl('?seed=42'));
  await menuButton(page, 'Jugar').click();
  expect(
    await page.evaluate(() => 'undefined' === typeof (window as { __sprint?: unknown }).__sprint),
  ).toBe(true);
});

test('Scenario: Mapa vacío forzado (?e2e&map=empty&seed=42)', async ({ page }) => {
  const warnings = collect(page, ['warning']);
  await openGame(page, gameUrl({ seed: 42, manual: true }));
  const m = await mapOf(page);
  expect(m?.emptyForced).toBe(true);
  expect(m?.counts.grass).toBe(576);
  expect(mentionsMap(warnings)).toEqual([]);
});

test('Scenario: Mapa real por defecto en E2E (?e2e&seed=42)', async ({ page }) => {
  const warnings = collect(page, ['warning']);
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  const m = await mapOf(page);
  expect(m?.emptyForced).toBe(false);
  expect(signatureOf(m?.cells ?? [])).toBe(MAP_GOLDEN[42]);
  expect(mentionsMap(warnings)).toEqual([]);
});

for (const search of [
  '?e2e&manual&map&seed=42',
  '?e2e&manual&map=&seed=42',
  '?e2e&manual&map=real&seed=42',
]) {
  test(`Scenario: Valor inválido (${search})`, async ({ page }) => {
    const warnings = collect(page, ['warning']);
    await openGame(page, `./${search}`);
    const m = await mapOf(page);
    expect(m?.emptyForced).toBe(false);
    expect(signatureOf(m?.cells ?? [])).toBe(MAP_GOLDEN[42]);
    expect(mentionsMap(warnings)).toHaveLength(1);
  });
}

test('Scenario: Ignorado fuera de E2E (?map=empty&seed=42)', async ({ page }) => {
  const warnings = collect(page, ['warning']);
  await page.goto(playerUrl('?map=empty&seed=42'));
  await menuButton(page, 'Jugar').click();
  expect(
    await page.evaluate(() => 'undefined' === typeof (window as { __sprint?: unknown }).__sprint),
  ).toBe(true);
  expect(mentionsMap(warnings)).toEqual([]);
});

test('Scenario: Se mantiene en todas las partidas de la carga (map=empty: fin, R, menú y Jugar)', async ({
  page,
}) => {
  const warnings = collect(page, ['warning']);
  await openGame(page, gameUrl({ manual: true }));
  const grass = async () => (await mapOf(page))?.counts.grass ?? 0;
  expect(await grass()).toBe(576);
  expect((await playToEnd(page))?.status).toBe('over');
  await page.keyboard.press('r');
  await expect.poll(async () => (await probe(page))?.runs).toBe(2);
  expect(await grass()).toBe(576);
  await backToMenu(page);
  await menuButton(page, 'Jugar').click();
  await waitForRun(page);
  await expect.poll(async () => (await probe(page))?.runs).toBe(3);
  expect(await grass()).toBe(576);
  expect((await mapOf(page))?.emptyForced).toBe(true);
  expect(mentionsMap(warnings)).toEqual([]);
});

test('Scenario: Reinicio con otra semilla (R tras la 42: mapa nuevo, generado y válido)', async ({
  page,
}) => {
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  expect((await playToEnd(page))?.status).toBe('over');
  await page.keyboard.press('r');
  await expect.poll(async () => (await probe(page))?.runs).toBe(2);
  const m = await mapOf(page);
  expect(signatureOf(m?.cells ?? [])).not.toBe(MAP_GOLDEN[42]);
  if (m) expectGeneratedMap(m);
});

test('Scenario: Sin solapes en la build con el mapa real (derecha y abajo, 20 × step(60))', async ({
  page,
}) => {
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  const m = await mapOf(page);
  if (!m) throw new Error('sin mapa');
  const world = (await probe(page))?.world;
  const overlaps: string[] = [];
  const outside: string[] = [];
  for (const key of [
    ...Array<string>(10).fill('ArrowRight'),
    ...Array<string>(10).fill('ArrowDown'),
  ]) {
    const before = await snapshotOf(page);
    if (before && before.offer.length > 0) await page.keyboard.press('1');
    await holdKey(page, key, 60);
    const s = await snapshotOf(page);
    const cam = (await probe(page))?.camera;
    if (!s) continue;
    if (overlapsBlocked(m, s.player.x, s.player.y, player.radius)) overlaps.push(String(s.tick));
    if (cam && world) {
      const inside =
        cam.x >= 0 &&
        cam.y >= 0 &&
        cam.x + cam.width <= world.width &&
        cam.y + cam.height <= world.height;
      if (!inside) outside.push(String(s.tick));
    }
  }
  expect(overlaps).toEqual([]);
  // Spec world-camera, "Nada fuera del mundo con el mapa real".
  expect(outside).toEqual([]);
});
