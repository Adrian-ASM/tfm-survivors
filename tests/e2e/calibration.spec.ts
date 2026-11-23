import { expect, test } from './fixtures';
import { E2E_SPEED, expectSpeed, focusGame, gameUrl, measureFrames, snapshotOf } from './probe';

// Sonda de calibración del frenado de CPU (design 0014 §4.3): mide fps, p95 del intervalo entre
// frames y ticks por frame con la escena cargada, para comparar el PC local (CI_LIKE y
// CPU_THROTTLE) con el runner de CI. Solo registra: nunca falla por lento.

/** Tick a partir del que la escena tiene enemigos, proyectiles y gemas (20 s de juego). */
const LOADED_TICK = 1200;
/** Frames de requestAnimationFrame medidos. */
const FRAMES = 300;
/** Cada cuánto se mira si hay oferta durante la medida (reloj real; test de tiempo real). */
const CHOICE_POLL_MS = 50;

test(
  '[calibration] fps, p95 y ticks por frame con la escena cargada',
  { tag: '@realtime' },
  async ({ page, cpuThrottle }) => {
    test.setTimeout(120_000);
    await page.goto(gameUrl({ seed: 42, speed: E2E_SPEED }));
    await expectSpeed(page, E2E_SPEED);
    await focusGame(page);
    await expect
      .poll(async () => (await snapshotOf(page))?.tick ?? 0, { timeout: 90_000 })
      .toBeGreaterThanOrEqual(LOADED_TICK);

    // Política de elección fija mientras se mide: una oferta sin elegir pararía la simulación
    // (con la semilla 42 la primera llega en el tick 1.773, dentro de la ventana).
    const state = { measuring: true };
    const measure = measureFrames(page, FRAMES).finally(() => {
      state.measuring = false;
    });
    while (state.measuring) {
      if (((await snapshotOf(page))?.offer.length ?? 0) > 0) await page.keyboard.press('1');
      await page.waitForTimeout(CHOICE_POLL_MS);
    }
    const m = await measure;

    const line =
      `[calibration] throttle=${String(cpuThrottle)} fps=${m.fps.toFixed(1)} ` +
      `p95=${m.p95.toFixed(1)} tpf=${m.ticksPerFrame.toFixed(2)}`;
    console.log(line);
    test.info().annotations.push({ type: 'calibration', description: line });
    expect(m.fps).toBeGreaterThan(0);
    expect([m.fps, m.p95, m.ticksPerFrame].every(Number.isFinite)).toBe(true);
  },
);
