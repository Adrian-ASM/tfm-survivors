import { expect, test } from '@playwright/test';
import { collect, probe } from './probe';

// Sustituye al E2E de 0003 "la vida baja en ≤ 20 s": con las armas activas el primer golpe llega
// más tarde (núcleo, semilla 42: tick 4100). Plazo de la spec player-health: 80 s de juego.
const GAME_TICKS_80_S = 80 * 60;

test('Primer golpe en el navegador: con ?seed=42 y sin input, la vida baja en ≤ 80 s', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = collect(page, ['error', 'warning']);
  await page.goto('./?e2e&seed=42');
  await expect.poll(async () => (await probe(page))?.snapshot?.tick ?? null).not.toBeNull();
  const start = (await probe(page))?.snapshot;
  expect(start?.player.health).toBe(start?.player.maxHealth);
  expect(start?.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);

  await expect
    .poll(async () => (await probe(page))?.snapshot?.player.health ?? Infinity, {
      timeout: 100_000,
      intervals: [250],
    })
    .toBeLessThan(start?.player.maxHealth ?? 0);

  const snap = (await probe(page))?.snapshot;
  expect(snap?.tick).toBeLessThanOrEqual(GAME_TICKS_80_S);
  expect(snap?.player.health).toBeGreaterThan(0);
  expect(snap?.status).toBe('running');
  expect(snap?.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);
  expect(problems).toEqual([]);
});
