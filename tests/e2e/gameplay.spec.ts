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
const VIEW = arena.view;
const WORLD = { width: arena.width, height: arena.height };

async function openGame(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);
}

// Spec upgrades, "Recorrido en el navegador". Semilla 7 sin input: primera oferta en el tick 4.346
// con el mundo 2x (plazo de 80 s de juego).
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

// Spec world-camera, "Nada fuera del mundo con el mapa real": la cámara sigue al jugador sin
// suavizado y recortada al mundo.
test('Cámara: centrada al empezar y sigue al jugador hacia la derecha sin salir del mundo', async ({
  page,
}) => {
  await openGame(page, gameUrl({ seed: 7, manual: true, map: 'real' }));
  const first = await probe(page);
  expect(first?.world).toEqual(WORLD);
  expect(first?.camera).toEqual({
    x: (WORLD.width - VIEW.width) / 2,
    y: (WORLD.height - VIEW.height) / 2,
    ...VIEW,
  });

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
/** Ticks por step mientras se muestrea: varios frames pintados. */
const SAMPLED_CHUNK = 10;
const SAMPLED_TICKS = 600;

test('Sprites: recuentos de la sonda iguales al snapshot y reserva si la hoja de Torch falla', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Solo se ignora el "Failed to load resource" de la hoja abortada.
    const torch = m.location().url.includes('Torch_Red.png');
    if (!(torch && m.text().startsWith('Failed to load resource'))) problems.push(m.text());
  });
  await page.route(TORCH_SHEET, (route) => route.abort());
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));

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

// Spec procedural-map, "Sonda coherente con el núcleo", y player-movement, "Sin solapes en la
// build con el mapa real". Los E2E no importan `src/`: la firma dorada se fija en un unitario.
test('Mapa real: sonda igual a la firma de la semilla 42 y el jugador no atraviesa troncos ni agua', async ({
  page,
}) => {
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  const first = await probe(page);
  const m = first?.map;
  if (!m) throw new Error('sin mapa');
  expect(signatureOf(m.cells)).toBe(MAP_GOLDEN[42]);
  expect(m.emptyForced).toBe(false);
  expect(m.counts.trunk).toBeGreaterThan(0);
  expect(first.sprites?.cells).toEqual({
    trunk: m.counts.trunk,
    water: m.counts.water,
    bridge: m.counts.bridge,
  });

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
