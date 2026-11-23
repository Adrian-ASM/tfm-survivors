import { expect, test } from './fixtures';
import {
  collect,
  expectManual,
  focusGame,
  gameUrl,
  snapshotOf,
  stepUntil,
  waitForRun,
} from './probe';

// Primer golpe con las armas y las mejoras activas (núcleo, semilla 42 con la política de elección
// fija: tick 4122). Plazo de la spec player-health: 80 s de juego, pulsando 1 en cada oferta.
// En modo manual (change 0014): el plazo es el tope de ticks de stepUntil, no un reloj.
const GAME_TICKS_80_S = 80 * 60;

test('Primer golpe en el navegador: con ?seed=42 y sin input, la vida baja en ≤ 80 s', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto(gameUrl({ seed: 42, manual: true }));
  await expectManual(page);
  await waitForRun(page);
  const start = await snapshotOf(page);
  expect(start?.player.health).toBe(start?.player.maxHealth);
  expect(start?.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);
  await focusGame(page);

  const snap = await stepUntil(page, (s) => s.player.health < s.player.maxHealth, GAME_TICKS_80_S);

  expect(snap).not.toBeNull();
  expect(snap?.tick).toBeLessThanOrEqual(GAME_TICKS_80_S);
  expect(snap?.player.health).toBeGreaterThan(0);
  expect(snap?.status).not.toBe('over');
  expect(snap?.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);
  expect(problems).toEqual([]);
});
