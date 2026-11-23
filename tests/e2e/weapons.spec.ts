import { expect, test } from './fixtures';
import {
  collect,
  expectManual,
  focusGame,
  gameUrl,
  stepUntil,
  waitForRun,
  type SnapshotView,
} from './probe';

// En modo manual (change 0014): el plazo de 15 s de juego es el tope de ticks, sin reloj.
const GAME_TICKS_15_S = 15 * 60;
/** Ticks por step: lo bastante pocos para ver un proyectil en vuelo entre dos lecturas. */
const CHUNK = 10;

test('Comprobación en el navegador: con ?seed=7 y sin input, en ≤ 15 s hay proyectiles y bajas', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto(gameUrl({ seed: 7, manual: true }));
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);

  // Solo las armas dan de baja: un id visto que deja de estar con la partida en curso es una baja.
  let seen = new Set<number>();
  let projectiles = 0;
  let kills = 0;
  const record = (snap: SnapshotView): boolean => {
    projectiles = Math.max(projectiles, snap.projectiles.length);
    const alive = new Set(snap.enemies.map((e) => e.id));
    if (snap.status === 'running') for (const id of seen) if (!alive.has(id)) kills += 1;
    seen = alive;
    return projectiles > 0 && kills > 0;
  };
  const done = await stepUntil(page, record, GAME_TICKS_15_S, CHUNK);

  expect(projectiles).toBeGreaterThanOrEqual(1);
  expect(kills).toBeGreaterThanOrEqual(1);
  expect(done?.tick).toBeLessThanOrEqual(GAME_TICKS_15_S);
  expect(problems).toEqual([]);
});
