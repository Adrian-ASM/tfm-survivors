import { expect, test, type Page } from '@playwright/test';
import { collect, probe, snapshotOf } from './probe';

// Spec progress-persistence: guardado local, export/import y CSP en la build de producción.
const KEY = 'sprint-survivors/progress';
const TWO_SECONDS_TICKS = 120;
const EMPTY_RECORDS = { bestTimeSeconds: 0, bestLevel: 0, maxKills: 0 };

const VALID_V1 =
  '{"schemaVersion":1,"records":{"bestTimeSeconds":20,"bestLevel":3,"maxKills":41},"history":[{' +
  '"playedAt":1763596800000,"seed":42,"outcome":"defeat","timeSeconds":20,"level":3,"kills":41}]}';

const stored = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), KEY);

/** Siembra el valor guardado antes de que carguen los scripts de la página. */
const seedStorage = (page: Page, value: string) =>
  page.addInitScript(
    ([key, v]) => {
      window.localStorage.setItem(key, v);
    },
    [KEY, value] as const,
  );

const waitTicks = (page: Page, ticks: number) =>
  expect
    .poll(async () => (await snapshotOf(page))?.tick ?? 0, { timeout: 10_000 })
    .toBeGreaterThan(ticks);

test.describe('Carga del progreso guardado (sin jugar hasta el final)', () => {
  for (const [name, value] of [
    ['Datos guardados dañados', '{"schemaVersion":1,"records":'],
    ['Versión futura guardada', VALID_V1.replace('"schemaVersion":1', '"schemaVersion":2')],
  ] as const) {
    test(`${name}: 1 aviso con progress, progreso vacío y valor intacto tras 2 s`, async ({
      page,
    }) => {
      const warnings = collect(page, ['warning']);
      await seedStorage(page, value);
      await page.goto('./?e2e');
      await waitTicks(page, TWO_SECONDS_TICKS);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('progress');
      expect((await probe(page))?.progress).toMatchObject({ records: EMPTY_RECORDS, history: [] });
      expect(await stored(page)).toBe(value);
    });
  }

  test('Partida sin terminar: recargar a mitad de partida no guarda nada', async ({ page }) => {
    const problems = collect(page, ['error', 'warning']);
    await page.goto('./?e2e');
    await waitTicks(page, TWO_SECONDS_TICKS);

    await page.reload();
    await waitTicks(page, 30);

    expect(await stored(page)).toBeNull();
    expect(problems).toEqual([]);
  });
});
