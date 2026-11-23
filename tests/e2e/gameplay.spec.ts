import { type Page } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import player from '../../content/player.json' with { type: 'json' };
import { MAP_GOLDEN, signatureOf } from '../support/mapGolden';
import { expect, test } from './fixtures';
import {
  collect,
  expectManual,
  focusGame,
  gameUrl,
  holdKey,
  probe,
  snapshotOf,
  startSpriteSampler,
  step,
  stepUntil,
  stopSpriteSampler,
  waitForRun,
  type MapView,
} from './probe';

// Suite de humo (chore e2e-lite): lo que solo se ve en el navegador durante la partida (overlay de
// mejoras, cámara, sprites y mapa pintado), en modo manual y sin esperas de reloj.
const WORLD = { width: arena.width, height: arena.height };
/** Ventana de `playwright.config.ts`: por debajo del tope, la vista mide lo mismo (0017). */
const VIEW = { width: 1280, height: 720 };

async function openGame(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);
}

// Spec upgrades, "Recorrido en el navegador". Semilla 7 sin input: primera oferta en el tick 1.527
// con el mundo de 0017 (plazo de 80 s de juego).
const FIRST_OFFER_LIMIT = 80 * 60;

test('Subida de nivel: con ?seed=7 aparece la oferta de 3, se pulsa 1 y la partida sigue', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await openGame(page, gameUrl({ seed: 7, manual: true }));

  const offered = await stepUntil(page, (s) => s.offer.length > 0, FIRST_OFFER_LIMIT);

  expect(offered?.status).toBe('choosing');
  expect(offered?.offer).toHaveLength(3);
  // Con la oferta abierta la partida no avanza aunque se pida.
  expect(await step(page, 30)).toBe(0);
  await page.keyboard.press('1');
  expect(await step(page, 1)).toBe(1);
  const after = await snapshotOf(page);
  expect(after?.offer).toHaveLength(0);
  expect(after?.progression.level).toBe(2);
  expect(after?.upgrades).toEqual([{ id: offered?.offer[0]?.id, level: 1 }]);
  expect(problems).toEqual([]);
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Spec world-camera (0017), "Redimensionado con la oferta abierta [E2E]": vista nueva desde el primer
// frame, sin ticks, y el clic en el centro de la ventana elige la carta central (índice 1).
test('Redimensionado con la oferta abierta: vista 1.000 × 600, mismo tick y clic central → offer[1]', async ({
  page,
}) => {
  const problems = collect(page, ['error']);
  await openGame(page, gameUrl({ seed: 7, manual: true }));
  const offered = await stepUntil(page, (s) => s.offer.length > 0, FIRST_OFFER_LIMIT);
  if (!offered) throw new Error('sin oferta');

  await page.setViewportSize({ width: 1000, height: 600 });
  await expect.poll(async () => (await probe(page))?.camera?.width ?? null).toBe(1000);

  const p = await probe(page);
  const s = p?.snapshot;
  const cam = p?.camera;
  if (!s || !cam) throw new Error('sin sonda');
  expect(p.viewport).toEqual({ width: 1000, height: 600, uiScale: 1 });
  expect([cam.width, cam.height]).toEqual([1000, 600]);
  expect(Math.abs(cam.x - clamp(s.player.x - 500, 0, WORLD.width - 1000))).toBeLessThanOrEqual(1);
  expect(Math.abs(cam.y - clamp(s.player.y - 300, 0, WORLD.height - 600))).toBeLessThanOrEqual(1);
  expect(s.tick).toBe(offered.tick);
  expect(s.offer.map((o) => o.id)).toEqual(offered.offer.map((o) => o.id));

  await page.mouse.click(500, 300);
  expect(await step(page, 1)).toBe(1);
  const after = await snapshotOf(page);
  expect(after?.upgrades).toEqual([{ id: offered.offer[1]?.id, level: 1 }]);
  expect(problems).toEqual([]);
});

// Spec world-camera, "Nada fuera del mundo con el mapa real": la cámara sigue al jugador sin
// suavizado y recortada al mundo.
test('Cámara: centrada al empezar y sigue al jugador hacia la derecha sin salir del mundo', async ({
  page,
}) => {
  await openGame(page, gameUrl({ seed: 7, manual: true, map: 'real' }));
  const first = await probe(page);
  expect(first?.world).toEqual(WORLD);
  // 0017: ventana 1.280 × 720 a ×1; la vista mide lo mismo y sigue la fórmula de la cámara.
  expect(first?.viewport).toEqual({ ...VIEW, uiScale: 1 });
  const p0 = first?.snapshot?.player ?? { x: 0, y: 0 };
  expect(first?.camera).toEqual({
    x: clamp(p0.x - VIEW.width / 2, 0, WORLD.width - VIEW.width),
    y: clamp(p0.y - VIEW.height / 2, 0, WORLD.height - VIEW.height),
    ...VIEW,
  });
  expect([first?.camera?.x, first?.camera?.y]).toEqual([1310, 810]);

  const problems: string[] = [];
  for (let i = 0; i < 20; i++) {
    if ((await snapshotOf(page))?.offer.length) await page.keyboard.press('1');
    await holdKey(page, 'ArrowRight', 60);
    const p = await probe(page);
    const cam = p?.camera;
    const s = p?.snapshot;
    if (!cam || !s) {
      problems.push(`lectura ${String(i)} sin cámara`);
      continue;
    }
    const inside =
      cam.x >= 0 &&
      cam.y >= 0 &&
      cam.x + cam.width <= WORLD.width &&
      cam.y + cam.height <= WORLD.height;
    const ex = clamp(s.player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const ey = clamp(s.player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    if (!inside || Math.abs(cam.x - ex) > 1 || Math.abs(cam.y - ey) > 1) {
      problems.push(`tick ${String(s.tick)}: (${String(cam.x)}, ${String(cam.y)})`);
    }
  }
  expect(problems).toEqual([]);
});

// Spec sprite-rendering: sonda de sprites coherente con el snapshot en cada frame pintado y
// aspecto de reserva solo para el tipo cuya hoja no carga.
const TORCH_SHEET = '**/Factions/Goblins/Troops/Torch/Red/Torch_Red.png';
/** Hojas del mapa (0016) que también se bloquean: agua, espuma, árbol, puente y castillo. */
const MAP_SHEETS = ['Water.png', 'Foam.png', 'Tree.png', 'Bridge_All.png', 'Castle_Blue.png'];
const BLOCKED = ['Torch_Red.png', ...MAP_SHEETS];
/** Ticks por step mientras se muestrea: varios frames pintados. */
const SAMPLED_CHUNK = 10;
const SAMPLED_TICKS = 600;

test('Sprites: recuentos de la sonda iguales al snapshot y reserva si fallan Torch y las hojas del mapa', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Solo se ignora el "Failed to load resource" de las hojas abortadas.
    const blocked = BLOCKED.some((f) => m.location().url.includes(f));
    if (!(blocked && m.text().startsWith('Failed to load resource'))) problems.push(m.text());
  });
  await page.route(TORCH_SHEET, (route) => route.abort());
  for (const sheet of MAP_SHEETS) await page.route(`**/${sheet}`, (route) => route.abort());
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));

  // Spec sprite-rendering (0016), "Hojas del mapa bloqueadas": reserva por elemento del mapa.
  expect(await step(page, 60)).toBe(60);
  const blockedMap = await probe(page);
  const counts = blockedMap?.map?.counts;
  const art = blockedMap?.sprites?.mapArt;
  if (!counts || !art) throw new Error('sin sonda del mapa');
  expect(blockedMap.snapshot?.tick).toBe(60);
  expect([art.water, art.tree, art.bridge]).toEqual([
    { painted: counts.water, fallback: counts.water },
    { painted: counts.trunk, fallback: counts.trunk },
    { painted: counts.bridge, fallback: counts.bridge },
  ]);
  expect(art.castle).toEqual({ painted: 1, fallback: 1 });
  expect([art.foam.painted, art.canopy.painted]).toEqual([0, 0]);

  await startSpriteSampler(page, 'goblin-torch');
  const reached = await stepUntil(
    page,
    (s) => s.tick >= SAMPLED_TICKS,
    2 * SAMPLED_TICKS,
    SAMPLED_CHUNK,
  );
  const sample = await stopSpriteSampler(page);

  expect(reached).not.toBeNull();
  expect(sample.frames).toBeGreaterThan(0);
  expect(sample.mismatches).toEqual([]);
  expect(sample.typeMismatches).toBe(0);
  expect(sample.placeholderFrames).toBeGreaterThan(0);
  expect([sample.groundMisses, sample.cellMisses]).toEqual([0, 0]);
  expect(problems).toEqual([]);
});

/** ¿Solapa el círculo (x, y, r) una celda `trunk`, `water` o `castle`? (tangencia no es solape). */
function overlapsBlocked(m: MapView, x: number, y: number, r: number): boolean {
  const s = m.cellSize;
  for (let row = 0; row < m.rows; row++) {
    for (let col = 0; col < m.cols; col++) {
      const t = m.cells[row * m.cols + col];
      if (t !== 'trunk' && t !== 'water' && t !== 'castle') continue;
      const nx = Math.max(col * s, Math.min(x, (col + 1) * s));
      const ny = Math.max(row * s, Math.min(y, (row + 1) * s));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r - 1e-6) return true;
    }
  }
  return false;
}

/** Celdas `grass`, `trunk` o `castle` con ≥ 1 vecina 4-conexa `water` o `bridge` en la rejilla. */
function shoreCount(m: MapView): number {
  const at = (c: number, r: number) =>
    c < 0 || r < 0 || c >= m.cols || r >= m.rows ? undefined : m.cells[r * m.cols + c];
  const wet = (t: string | undefined) => t === 'water' || t === 'bridge';
  let n = 0;
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      const t = at(c, r);
      if (t !== 'grass' && t !== 'trunk' && t !== 'castle') continue;
      if (wet(at(c, r - 1)) || wet(at(c + 1, r)) || wet(at(c, r + 1)) || wet(at(c - 1, r))) n++;
    }
  }
  return n;
}

// Spec procedural-map, "Sonda coherente con el núcleo", y player-movement, "Sin solapes en la
// build con el mapa real". Los E2E no importan `src/`: la firma dorada se fija en un unitario.
test('Mapa real: sonda igual a la firma de la semilla 42, castillo y salida, y sin atravesar troncos, agua ni castillo', async ({
  page,
}) => {
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  const first = await probe(page);
  const m = first?.map;
  if (!m) throw new Error('sin mapa');
  expect(signatureOf(m.cells)).toBe(MAP_GOLDEN[42]);
  expect(m.emptyForced).toBe(false);
  expect(m.counts.trunk).toBeGreaterThan(0);
  // 0017, "Sonda con castillo y salida": 64 × 36, huella 30–34 × 15–18 y salida (1.950, 1.170).
  expect([m.cols, m.rows]).toEqual([64, 36]);
  expect(m.counts.castle).toBe(20);
  expect(m.castle).toEqual({ firstCol: 30, lastCol: 34, firstRow: 15, lastRow: 18 });
  expect([m.start.x, m.start.y]).toEqual([1950, 1170]);
  expect([first.snapshot?.player.x, first.snapshot?.player.y]).toEqual([1950, 1170]);
  expect(first.sprites?.cells).toEqual({
    trunk: m.counts.trunk,
    water: m.counts.water,
    bridge: m.counts.bridge,
    castle: 20,
  });
  // "Recuentos del mapa pintado": orillas calculadas aquí sobre la lista de celdas de la sonda.
  const shores = shoreCount(m);
  const art = first.sprites?.mapArt;
  const ok = (painted: number) => ({ painted, fallback: 0 });
  expect(art && { ...art, objects: undefined }).toEqual({
    water: ok(m.counts.water),
    shore: ok(shores),
    foam: ok(shores),
    tree: ok(m.counts.trunk),
    canopy: ok(m.counts.trunk),
    bridge: ok(m.counts.bridge),
    castle: ok(1),
    objects: undefined,
  });
  expect(shores).toBeGreaterThan(0);

  const overlaps: string[] = [];
  for (const key of [
    ...Array<string>(10).fill('ArrowRight'),
    ...Array<string>(10).fill('ArrowDown'),
  ]) {
    if ((await snapshotOf(page))?.offer.length) await page.keyboard.press('1');
    await holdKey(page, key, 60);
    const s = await snapshotOf(page);
    if (s && overlapsBlocked(m, s.player.x, s.player.y, player.radius)) {
      overlaps.push(String(s.tick));
    }
  }
  expect(overlaps).toEqual([]);
});
