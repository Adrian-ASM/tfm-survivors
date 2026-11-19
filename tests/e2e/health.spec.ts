import { expect, test } from '@playwright/test';
import { collect, focusGame, playChoosingFirst, probe } from './probe';

// Primer golpe con las armas y las mejoras activas (núcleo, semilla 42 con la política de elección
// fija: tick 4122). Plazo de la spec player-health: 80 s de juego, pulsando 1 en cada oferta.
const GAME_TICKS_80_S = 80 * 60;

test('Primer golpe en el navegador: con ?seed=42 y sin input, la vida baja en ≤ 80 s', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const problems = collect(page, ['error', 'warning']);
  await page.goto('./?e2e&seed=42');
  await expect.poll(async () => (await probe(page))?.snapshot?.tick ?? null).not.toBeNull();
  const start = (await probe(page))?.snapshot;
  expect(start?.player.health).toBe(start?.player.maxHealth);
  expect(start?.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);
  await focusGame(page);

  const snap = await playChoosingFirst(
    page,
    (s) => s.player.health < s.player.maxHealth,
    130_000,
    250,
  );

  expect(snap).not.toBeNull();
  expect(snap?.tick).toBeLessThanOrEqual(GAME_TICKS_80_S);
  expect(snap?.player.health).toBeGreaterThan(0);
  expect(snap?.status).not.toBe('over');
  expect(snap?.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);
  expect(problems).toEqual([]);
});
