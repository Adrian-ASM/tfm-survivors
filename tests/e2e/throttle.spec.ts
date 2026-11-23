import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { gameUrl, waitForRun } from './probe';

// Frenado de CPU por CDP del proyecto `realtime` con CI_LIKE (design 0014 §4.2). Solo corre con
// `cpuThrottle > 1`: compara un bucle JS fijo en la página frenada con otra página del mismo
// contexto sin frenar, al cargar y tras `page.reload()`.

/** Iteraciones del bucle de referencia: decenas de ms sin frenar en un PC normal. */
const LOOP_ITERATIONS = 20_000_000;

/** Mediana de 3 medidas del bucle fijo en la página (ms de reloj real). */
const loopMs = (page: Page): Promise<number> =>
  page.evaluate((n) => {
    const runs: number[] = [];
    for (let r = 0; r < 3; r += 1) {
      const start = performance.now();
      let acc = 0;
      for (let i = 0; i < n; i += 1) acc = (acc + i * 7) % 1_000_003;
      runs.push(performance.now() - start + (acc < 0 ? 1 : 0));
    }
    runs.sort((a, b) => a - b);
    return runs[1] ?? 0;
  }, LOOP_ITERATIONS);

/** Página en modo manual (sin ticks: no compite por CPU con la medida). */
async function idleGame(page: Page): Promise<void> {
  await page.goto(gameUrl({ manual: true }));
  await waitForRun(page);
}

test.describe('Frenado de CPU', { tag: '@realtime' }, () => {
  test('el frenado se aplica al cargar y sobrevive a page.reload()', async ({
    page,
    cpuThrottle,
  }) => {
    test.skip(cpuThrottle <= 1, 'Solo con CI_LIKE y CPU_THROTTLE > 1');
    test.setTimeout(120_000);
    const free = await page.context().newPage();
    await idleGame(free);
    await idleGame(page);

    const afterGoto = (await loopMs(page)) / (await loopMs(free));
    await page.reload();
    await waitForRun(page);
    const afterReload = (await loopMs(page)) / (await loopMs(free));

    test.info().annotations.push({
      type: 'throttle',
      description: `rate=${String(cpuThrottle)} goto=${afterGoto.toFixed(2)} reload=${afterReload.toFixed(2)}`,
    });
    expect(afterGoto).toBeGreaterThanOrEqual(cpuThrottle / 2);
    expect(afterReload).toBeGreaterThanOrEqual(cpuThrottle / 2);
  });
});
