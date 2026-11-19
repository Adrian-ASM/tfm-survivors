import { expect, test } from '@playwright/test';
import { collect, focusGame, playChoosingFirst, probe, snapshotOf } from './probe';

// Bucle jugar → perder → resultados → reiniciar (spec run-results, "Derrota y reinicio en el
// navegador"). Núcleo, semilla 42 sin input con la política de elección fija: derrota en el tick
// 4682 (≈ 78 s de juego; medición de la tarea 0.2 de 0006). Plazo de la spec: 120 s de juego.
const GAME_TICKS_120_S = 120 * 60;
const ONE_SECOND_TICKS = 60;

const mmss = (tick: number): string => {
  const s = Math.floor(tick / 60);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

test('Derrota y reinicio en el navegador: ?seed=42 sin input pierde, muestra resultados y R reinicia', async ({
  page,
}) => {
  test.setTimeout(160_000);
  const problems = collect(page, ['error', 'warning']);
  await page.goto('./?e2e&seed=42');
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);

  const ended = await playChoosingFirst(page, (s) => s.status === 'over', 130_000, 250);

  expect(ended).not.toBeNull();
  expect(ended?.outcome).toBe('lost');
  expect(ended?.tick).toBeLessThanOrEqual(GAME_TICKS_120_S);
  const shown = (await probe(page))?.results;
  expect(shown).toMatchObject({
    title: 'Derrota',
    time: mmss(ended?.tick ?? 0),
    level: ended?.progression.level,
    kills: ended?.kills,
  });

  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshotOf(page))?.status).toBe('running');
  const fresh = await probe(page);

  expect(fresh?.snapshot?.tick).toBeLessThanOrEqual(ONE_SECOND_TICKS);
  expect(fresh?.snapshot).toMatchObject({
    status: 'running',
    outcome: null,
    kills: 0,
    progression: { level: 1, xp: 0 },
  });
  expect(fresh?.results).toBeNull();
  expect(problems).toEqual([]);
});
