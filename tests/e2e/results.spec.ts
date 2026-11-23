import { expect, test } from '@playwright/test';
import {
  E2E_SPEED,
  collect,
  expectSpeed,
  focusGame,
  gameUrl,
  playChoosingFirst,
  probe,
  snapshotOf,
  firstFrameOfNextRun,
  startSpriteSampler,
  stopSpriteSampler,
  watchNextRun,
} from './probe';

// Bucle jugar → perder → resultados → reiniciar (spec run-results, "Derrota y reinicio en el
// navegador"). Núcleo, semilla 42 sin input con la política de elección fija: derrota en el tick
// 4.762 con el mundo 2x (≈ 79 s de juego; 4.682 en 0006). Plazo de este test: 120 s de juego,
// dentro del de la spec run-outcome ("Derrota E2E con una semilla del conjunto", ≤ 180 s).
// Se juega a ?speed=8 (design 0008): mismo resultado, unas 8 veces menos de tiempo real.
const GAME_TICKS_120_S = 120 * 60;
/**
 * Primer segundo de la partida nueva (spec: tick ≤ 60). Se mira su primer frame pintado, capturado
 * en la página (`watchNextRun`), no la sonda en el momento en que llega la lectura: sin input, la
 * primera baja llega en el tick 185 con la semilla 42 y en el 113 como pronto con las semillas
 * 1..200 (los reinicios usan semilla nueva); en CI la lectura tardía ya la veía.
 */
const FRESH_MAX_TICKS = 60;
/** Margen de reloj (no es la aserción): la derrota acelerada tarda unos 10 s. */
const PLAY_TIMEOUT_MS = 45_000;
/** Plazo real de la derrota acelerada (proposal 0008: medido 9,9 s). */
const MAX_DEFEAT_REAL_MS = 12_000;

const mmss = (tick: number): string => {
  const s = Math.floor(tick / 60);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

test('Derrota y reinicio en el navegador: ?seed=42 sin input pierde, muestra resultados y R reinicia', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const problems = collect(page, ['error', 'warning']);
  await page.goto(gameUrl({ seed: 42, speed: E2E_SPEED }));
  await expectSpeed(page, E2E_SPEED);
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);

  const startedAt = Date.now();
  const ended = await playChoosingFirst(page, (s) => s.status === 'over', PLAY_TIMEOUT_MS);
  const realMs = Date.now() - startedAt;

  expect(ended).not.toBeNull();
  // Criterio de éxito de 0008: con ?e2e&speed=8, la derrota llega en ≤ 12 s reales (reloj de Node).
  test.info().annotations.push({ type: 'defeat-real-ms', description: String(realMs) });
  // Medida de rendimiento de la máquina, no requisito de spec: en CI (sin GPU) solo se anota.
  if (!process.env.CI) expect(realMs).toBeLessThanOrEqual(MAX_DEFEAT_REAL_MS);
  expect(ended?.outcome).toBe('lost');
  expect(ended?.tick).toBeLessThanOrEqual(GAME_TICKS_120_S);
  const shown = (await probe(page))?.results;
  expect(shown).toMatchObject({
    title: 'Derrota',
    time: mmss(ended?.tick ?? 0),
    level: ended?.progression.level,
    kills: ended?.kills,
  });

  await watchNextRun(page);
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
  const fresh = await firstFrameOfNextRun(page);

  expect(fresh.runs).toBe(2);
  expect(fresh.snapshot?.tick).toBeLessThanOrEqual(FRESH_MAX_TICKS);
  expect(fresh.snapshot).toMatchObject({
    status: 'running',
    outcome: null,
    kills: 0,
    progression: { level: 1, xp: 0 },
  });
  expect(fresh.results).toBeNull();
  // Spec simulation-loop, "La velocidad se mantiene al reiniciar": R no relee la URL.
  expect(fresh.speed).toBe(E2E_SPEED);
  expect(problems).toEqual([]);
});

// Change 0012 (spec run-results): cinco reinicios con R y una sexta partida con la sonda coherente.
test('Scenario: Cinco reinicios seguidos (0 cadáveres al empezar cada una; sexta coherente)', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const problems = collect(page, ['error']);
  await page.goto(gameUrl({ seed: 42, speed: E2E_SPEED }));
  await expectSpeed(page, E2E_SPEED);
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  const corpsesAtStart: number[] = [];
  for (let game = 0; game < 5; game++) {
    const ended = await playChoosingFirst(page, (s) => s.status === 'over', 50_000);
    expect(ended, `partida ${String(game + 1)}`).not.toBeNull();
    expect((ended?.enemies.length ?? 0) > 0 && (ended?.gems.length ?? 0) > 0).toBe(true);
    await watchNextRun(page);
    await page.keyboard.press('r');
    // Primer frame de la partida nueva (spec), capturado en la página: no depende de cuándo se lee.
    const first = await firstFrameOfNextRun(page);
    expect(first.snapshot?.tick ?? Infinity).toBeLessThanOrEqual(FRESH_MAX_TICKS);
    corpsesAtStart.push(first.sprites?.corpses.visible ?? -1);
  }
  await startSpriteSampler(page);
  await playChoosingFirst(page, (s) => s.tick >= 600 || s.status === 'over', 30_000);
  const sample = await stopSpriteSampler(page);

  expect(corpsesAtStart).toEqual([0, 0, 0, 0, 0]);
  expect(sample.mismatches).toEqual([]);
  expect(problems).toEqual([]);
});
