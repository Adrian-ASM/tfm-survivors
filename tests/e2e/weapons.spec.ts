import { expect, test } from './fixtures';
import { collect, focusGame, probe } from './probe';

const GAME_TICKS_15_S = 15 * 60;

test('Comprobación en el navegador: con ?seed=7 y sin input, en ≤ 15 s hay proyectiles y bajas', async ({
  page,
}) => {
  test.setTimeout(45_000);
  const problems = collect(page, ['error', 'warning']);
  await page.goto('./?e2e&seed=7');
  await expect.poll(async () => (await probe(page))?.snapshot?.tick ?? null).not.toBeNull();
  await focusGame(page);

  // Solo las armas dan de baja: un id visto que deja de estar con la partida en curso es una baja.
  let seen = new Set<number>();
  let projectiles = 0;
  let kills = 0;
  let tick = 0;
  while (tick <= GAME_TICKS_15_S && (projectiles === 0 || kills === 0)) {
    const snap = (await probe(page))?.snapshot;
    if (snap) {
      tick = snap.tick;
      projectiles = Math.max(projectiles, snap.projectiles.length);
      const alive = new Set(snap.enemies.map((e) => e.id));
      if (snap.status === 'running') for (const id of seen) if (!alive.has(id)) kills += 1;
      seen = alive;
      // Política de elección fija: con una oferta abierta se pulsa 1 (opción 0).
      if (snap.offer.length > 0) await page.keyboard.press('1');
    }
    await page.waitForTimeout(50);
  }

  expect(projectiles).toBeGreaterThanOrEqual(1);
  expect(kills).toBeGreaterThanOrEqual(1);
  expect(tick).toBeLessThanOrEqual(GAME_TICKS_15_S + 60);
  expect(problems).toEqual([]);
});
