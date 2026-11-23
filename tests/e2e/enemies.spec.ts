import arena from '../../content/arena.json' with { type: 'json' };
import { expect, test } from './fixtures';
import {
  collect,
  expectManual,
  gameUrl,
  probe,
  snapshotOf,
  startCameraSampler,
  step,
  stepUntil,
  stopCameraSampler,
  waitForRun,
  waitFrames,
} from './probe';

// Las reglas, en modo manual (change 0014): la partida avanza con step, sin esperas de reloj.
/** Mundo y vista del contenido (una sola fuente, spec run-outcome 0013). */
const ARENA = { width: arena.width, height: arena.height };
const VIEW = arena.view;
/** Tope de ticks para ver el primer enemigo (5 s de juego). */
const FIRST_ENEMY_TICKS = 5 * 60;
const MAX_SEED = 4294967295;

test('?seed=42: semilla 42, aparecen enemigos dentro de la arena y sin errores ni avisos', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto(gameUrl({ seed: 42, manual: true }));
  await expect(page.locator('#game canvas')).toBeVisible();
  await expectManual(page);
  await waitForRun(page);

  expect((await probe(page))?.seed).toBe(42);
  // Presupuesto de 1 por segundo (content/waves.json): el primero llega hacia el tick 60.
  const first = await stepUntil(page, (s) => s.enemies.length > 0, FIRST_ENEMY_TICKS, 10);

  const enemies = first?.enemies ?? [];
  expect(enemies.length).toBeGreaterThanOrEqual(1);
  for (const e of enemies) {
    expect(e.x).toBeGreaterThanOrEqual(e.radius);
    expect(e.x).toBeLessThanOrEqual(ARENA.width - e.radius);
    expect(e.y).toBeGreaterThanOrEqual(e.radius);
    expect(e.y).toBeLessThanOrEqual(ARENA.height - e.radius);
  }
  expect(problems).toEqual([]);
});

test('?seed=abc: exactamente 1 aviso que menciona seed y la partida avanza', async ({ page }) => {
  const warnings = collect(page, ['warning']);
  await page.goto('./?e2e&manual&seed=abc');
  await expectManual(page);
  await waitForRun(page);

  expect(await step(page, 31)).toBe(31);
  expect((await snapshotOf(page))?.tick).toBe(31);
  const seed = (await probe(page))?.seed ?? -1;
  expect(Number.isInteger(seed)).toBe(true);
  expect(seed).toBeGreaterThanOrEqual(0);
  expect(seed).toBeLessThanOrEqual(MAX_SEED);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('seed');
});

// Spec enemy-spawning (0013), "Fuera de pantalla en una partida real": con el jugador quieto en el
// centro, ninguna aparición cae dentro del rectángulo visible (480, 270)–(1.440, 810).
// @realtime (change 0014): muestrea la cámara en cada frame real pintado, a 1 tick por frame; la
// regla de colocación se prueba en Node (place-spawn.test).
test(
  'Scenario: Fuera de pantalla en una partida real (?e2e&seed=42, sin input, 600 frames)',
  {
    tag: '@realtime',
  },
  async ({ page }) => {
    const problems = collect(page, ['error', 'warning']);
    await page.goto('./?e2e&seed=42');
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
    await startCameraSampler(page, VIEW);
    await waitFrames(page, 600);
    const sample = await stopCameraSampler(page);

    const visible = sample.firstSeen.filter(
      ({ x, y, camera }) =>
        x > camera.x && x < camera.x + camera.width && y > camera.y && y < camera.y + camera.height,
    );
    expect(sample.firstSeen.length).toBeGreaterThan(0);
    const centered = { x: (ARENA.width - VIEW.width) / 2, y: (ARENA.height - VIEW.height) / 2 };
    expect(
      sample.firstSeen.every(({ camera }) => camera.x === centered.x && camera.y === centered.y),
    ).toBe(true);
    expect(visible).toEqual([]);
    expect(problems).toEqual([]);
  },
);
