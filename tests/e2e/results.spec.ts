import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  collect,
  expectManual,
  focusGame,
  gameUrl,
  playToEnd,
  probe,
  startSpriteSampler,
  stepUntil,
  stopSpriteSampler,
  waitForRun,
} from './probe';

// Bucle jugar → perder → resultados → reiniciar (spec run-results, "Derrota y reinicio en el
// navegador"). Núcleo, semilla 42 sin input con la política de elección fija: derrota en el tick
// 4.762 con el mundo 2x (≈ 79 s de juego; 4.682 en 0006). Plazo de este test: 120 s de juego,
// dentro del de la spec run-outcome ("Derrota E2E con una semilla del conjunto", ≤ 180 s).
// En modo manual (change 0014): la partida avanza solo con step, así que la partida nueva tras R
// está en el tick 0 por construcción (sin capturar su primer frame) y no hay esperas de reloj.
const GAME_TICKS_120_S = 120 * 60;
/** Ticks por step en la sexta partida: varios frames pintados para el muestreador de sprites. */
const SAMPLED_CHUNK = 10;

const mmss = (tick: number): string => {
  const s = Math.floor(tick / 60);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Pulsa R y espera la partida nueva (evento: `runs` sube). */
async function restart(page: Page, runs: number): Promise<void> {
  await page.keyboard.press('r');
  await expect.poll(async () => (await probe(page))?.runs).toBe(runs + 1);
}

test('Derrota y reinicio en el navegador: ?seed=42 sin input pierde, muestra resultados y R reinicia', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto(gameUrl({ seed: 42, manual: true }));
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);

  const ended = await playToEnd(page, GAME_TICKS_120_S);

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
  // Reinicio inmediato (spec progress-persistence): nada más pulsar R, la partida ya está guardada.
  const saved = await page.evaluate(() => window.localStorage.getItem('sprint-survivors/progress'));
  const doc = JSON.parse(saved ?? 'null') as { history: Record<string, unknown>[] } | null;
  expect(doc?.history).toHaveLength(1);
  expect(doc?.history[0]).toMatchObject({
    seed: 42,
    outcome: 'defeat',
    timeSeconds: Math.floor((ended?.tick ?? 0) / 60),
    level: ended?.progression.level,
    kills: ended?.kills,
  });
  await expect.poll(async () => (await probe(page))?.runs).toBe(2);
  const fresh = await probe(page);

  expect(fresh?.snapshot).toMatchObject({
    tick: 0,
    status: 'running',
    outcome: null,
    kills: 0,
    progression: { level: 1, xp: 0 },
  });
  expect(fresh?.results).toBeNull();
  // Spec simulation-loop, "Manual tras reiniciar con R": R no relee la URL.
  expect(fresh?.manual).toBe(true);
  expect(problems).toEqual([]);
});

// Change 0012 (spec run-results): cinco reinicios con R y una sexta partida con la sonda coherente.
test('Scenario: Cinco reinicios seguidos (0 cadáveres al empezar cada una; sexta coherente)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = collect(page, ['error']);
  await page.goto(gameUrl({ seed: 42, manual: true }));
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);
  const corpsesAtStart: number[] = [];
  for (let game = 0; game < 5; game++) {
    const ended = await playToEnd(page);
    expect(ended, `partida ${String(game + 1)}`).not.toBeNull();
    expect((ended?.enemies.length ?? 0) > 0 && (ended?.gems.length ?? 0) > 0).toBe(true);
    await restart(page, game + 1);
    // Sin step la partida nueva sigue en su primer frame: tick 0 y sus cadáveres en la sonda.
    const first = await probe(page);
    expect(first?.snapshot?.tick).toBe(0);
    corpsesAtStart.push(first?.sprites?.corpses.visible ?? -1);
  }
  await startSpriteSampler(page);
  await stepUntil(page, (s) => s.tick >= 600, 600, SAMPLED_CHUNK);
  const sample = await stopSpriteSampler(page);

  expect(corpsesAtStart).toEqual([0, 0, 0, 0, 0]);
  expect(sample.frames).toBeGreaterThan(0);
  expect(sample.mismatches).toEqual([]);
  expect(problems).toEqual([]);
});
