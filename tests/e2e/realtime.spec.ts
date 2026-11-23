import { expect, test } from './fixtures';
import {
  E2E_SPEED,
  collect,
  expectSpeed,
  focusGame,
  gameUrl,
  measureFrames,
  probe,
  snapshotOf,
} from './probe';

// Proyecto `realtime` (chore e2e-lite): frames y reloj reales, solo a demanda
// (`npm run test:e2e:realtime` o el workflow `e2e-realtime`), nunca en `test:e2e` ni en el CI.
// Solo registran o comprueban el cableado: ningún umbral de fps ni de tiempo real.

/** Tick a partir del que la escena tiene enemigos, proyectiles y gemas (20 s de juego). */
const LOADED_TICK = 1200;
/** Frames de requestAnimationFrame medidos. */
const FRAMES = 300;
/** Cada cuánto se mira si hay oferta durante la medida (reloj real; test de tiempo real). */
const CHOICE_POLL_MS = 50;

// Sonda de calibración (design 0014 §4.3): fps, p95 del intervalo entre frames y ticks por frame
// con la escena cargada, para comparar el PC local (con CI_LIKE y CPU_THROTTLE) con el runner.
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

// Spec sprite-rendering (0016, tope 1.000 en 0017), "Coste de render del mapa (a demanda)": objetos
// de la sonda ≤ 1.000 y fps con el mapa real (mediana de 3 pasadas) frente a la base de rectángulos
// de 0015. Informativo.
const MAP_FPS_BASE: Readonly<Record<number, number>> = { 42: 21.6, 123: 21.9 };
const MAX_MAP_OBJECTS = 1000;
const PASSES = 3;

test(
  '[map] Objetos del mapa y fps con el mapa real (semillas 42 y 123)',
  { tag: '@realtime' },
  async ({ page, cpuThrottle }) => {
    test.setTimeout(240_000);
    for (const seed of [42, 123]) {
      await page.goto(gameUrl({ seed, map: 'real' }));
      await focusGame(page);
      await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(0);
      const objects = (await probe(page))?.sprites?.mapArt.objects ?? Infinity;
      expect(objects).toBeLessThanOrEqual(MAX_MAP_OBJECTS);
      const fps: number[] = [];
      for (let i = 0; i < PASSES; i++) fps.push((await measureFrames(page, FRAMES)).fps);
      const median = [...fps].sort((a, b) => a - b)[Math.floor(PASSES / 2)] ?? 0;
      const base = MAP_FPS_BASE[seed] ?? 1;
      const line =
        `[map] seed=${String(seed)} throttle=${String(cpuThrottle)} objects=${String(objects)} ` +
        `fps=${median.toFixed(1)} (${((100 * median) / base).toFixed(0)} % de ${String(base)})`;
      console.log(line);
      test.info().annotations.push({ type: 'map-fps', description: line });
      expect(median).toBeGreaterThan(0);
    }
  },
);

// Spec simulation-loop, "Velocidad válida en modo E2E": resolución en el navegador (el avance a
// velocidad N se prueba en Node con advanceFrame).
test(
  'Scenario: Velocidad válida en modo E2E (?e2e&speed=8: speed 8, avanza y sin avisos)',
  { tag: '@realtime' },
  async ({ page }) => {
    const warnings = collect(page, ['warning']);
    await page.goto(gameUrl({ speed: E2E_SPEED }));
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(0);

    expect((await probe(page))?.speed).toBe(E2E_SPEED);
    expect(warnings.filter((m) => m.includes('speed'))).toEqual([]);
  },
);
