import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  collect,
  cspState,
  focusGame,
  playChoosingFirst,
  probe,
  snapshotOf,
  watchCsp,
} from './probe';

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

const PLAY_TIMEOUT_MS = 120_000;
const MAX_IMPORT_BYTES = 65_536;

const mmss = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/** Récords en el formato del panel (spec run-results). */
const shownRecords = (r: { bestTimeSeconds: number; bestLevel: number; maxKills: number }) => [
  `Mejor tiempo ${mmss(r.bestTimeSeconds)}`,
  `Mejor nivel ${String(r.bestLevel)}`,
  `Máx. bajas ${String(r.maxKills)}`,
];

/** Juega sin input con la política de elección fija hasta la derrota. */
async function playToDefeat(page: Page) {
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  const ended = await playChoosingFirst(page, (s) => s.status === 'over', PLAY_TIMEOUT_MS, 250);
  expect(ended?.outcome).toBe('lost');
  return ended;
}

/** Pulsa Exportar y devuelve el nombre sugerido y el contenido del fichero descargado. */
async function exportFile(page: Page): Promise<{ name: string; text: string }> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const file = await download;
  return { name: file.suggestedFilename(), text: readFileSync(await file.path(), 'utf8') };
}

/** Pulsa Importar y elige un fichero con el contenido dado. */
async function importFile(page: Page, content: string | Buffer): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar' }).click();
  await (
    await chooser
  ).setFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(content) });
}

/** Espera `n` frames del navegador. */
const frames = (page: Page, n: number) =>
  page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const step = () => {
          left -= 1;
          if (left <= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    n,
  );

const message = (page: Page) => page.getByRole('status');

test('Exportar, recargar e importar en el navegador (?seed=42, bucle completo y CSP)', async ({
  page,
}) => {
  test.setTimeout(260_000);
  const problems = collect(page, ['error', 'warning']);
  await watchCsp(page);
  await page.goto('./?e2e&seed=42');

  // 1.ª partida: derrota, récords R en el panel y Exportar.
  const first = await playToDefeat(page);
  const r1 = (await probe(page))?.progress?.records;
  expect(r1).toEqual({
    bestTimeSeconds: Math.floor((first?.tick ?? 0) / 60),
    bestLevel: first?.progression.level,
    maxKills: first?.kills,
  });
  await expect(page.getByRole('region', { name: 'Progreso' })).toContainText(
    shownRecords(r1 ?? EMPTY_RECORDS).join(''),
  );

  const exported = await exportFile(page);
  expect(exported.name).toBe('sprint-survivors-progress.json');
  const doc = JSON.parse(exported.text) as { history: Record<string, unknown>[] };
  expect(doc.history).toHaveLength(1);
  expect(doc.history[0]).toMatchObject({
    seed: 42,
    outcome: 'defeat',
    timeSeconds: r1?.bestTimeSeconds,
    level: first?.progression.level,
    kills: first?.kills,
  });

  // Exportar no cambia la partida: 60 frames después, el mismo snapshot y el overlay visible.
  await frames(page, 60);
  expect(await snapshotOf(page)).toEqual(first);
  expect((await probe(page))?.results).not.toBeNull();

  // Borrar almacenamiento, recargar y 2.ª derrota.
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  const second = await playToDefeat(page);
  const r2 = (await probe(page))?.progress?.records;
  expect((await probe(page))?.progress?.history).toHaveLength(1);

  // Importar el fichero exportado: récords = máximo de R y de la 2.ª partida, 2 entradas.
  await importFile(page, exported.text);
  await expect(message(page)).toContainText('importado');
  const merged = {
    bestTimeSeconds: Math.max(r1?.bestTimeSeconds ?? 0, r2?.bestTimeSeconds ?? 0),
    bestLevel: Math.max(r1?.bestLevel ?? 0, r2?.bestLevel ?? 0),
    maxKills: Math.max(r1?.maxKills ?? 0, r2?.maxKills ?? 0),
  };
  expect((await probe(page))?.progress?.records).toEqual(merged);
  expect((await probe(page))?.progress?.shown).toEqual(shownRecords(merged));
  const afterImport = await exportFile(page);
  expect((JSON.parse(afterImport.text) as { history: unknown[] }).history).toHaveLength(2);

  // Spec run-results, "Imports rechazados en el navegador" (y progress-persistence, "Fichero demasiado
  // grande" / "Fichero no JSON o fuera de esquema"): mensaje y ni récords ni export cambian. Va dentro de
  // este test porque necesita una partida terminada (otra derrota costaría ~80 s más).
  await test.step('Scenario: Imports rechazados en el navegador', async () => {
    await importFile(page, 'hola');
    await expect(message(page)).toContainText('no válido');
    await importFile(page, ' '.repeat(MAX_IMPORT_BYTES + 1));
    await expect(message(page)).toContainText('64 KiB');
    expect((await probe(page))?.progress?.records).toEqual(merged);
    expect((await exportFile(page)).text).toBe(afterImport.text);
    expect(await snapshotOf(page)).toEqual(second);
  });

  // R tras usar los botones: 1 partida nueva en curso y el panel oculto.
  const seedBefore = (await probe(page))?.seed;
  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshotOf(page))?.status).toBe('running');
  const fresh = await probe(page);
  expect(fresh?.snapshot?.tick).toBeLessThanOrEqual(60);
  expect(fresh?.results).toBeNull();
  expect(fresh?.seed).not.toBe(seedBefore);
  await expect(page.getByRole('button', { name: 'Exportar' })).toBeHidden();

  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(problems).toEqual([]);
});

// Tarea 0.1: la semilla 90 sin input es la que antes pierde en el núcleo (tick 4501, ≈ 75 s).
const FAST_DEFEAT_SEED = 90;

test('Almacenamiento bloqueado: se juega, el overlay avisa de que no se guarda y R reinicia', async ({
  page,
}) => {
  test.setTimeout(160_000);
  const problems = collect(page, ['error', 'warning']);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('almacenamiento bloqueado', 'SecurityError');
      },
    });
  });
  await page.goto(`./?e2e&seed=${String(FAST_DEFEAT_SEED)}`);

  const ended = await playToDefeat(page);
  const progress = (await probe(page))?.progress;

  expect(progress?.notices.some((n) => n.includes('no se guarda'))).toBe(true);
  expect(progress?.shown).toEqual(
    shownRecords({
      bestTimeSeconds: Math.floor((ended?.tick ?? 0) / 60),
      bestLevel: ended?.progression.level ?? 0,
      maxKills: ended?.kills ?? 0,
    }),
  );
  await expect(page.getByText('no se guarda')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importar' })).toBeVisible();

  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshotOf(page))?.status).toBe('running');
  expect((await probe(page))?.results).toBeNull();
  expect(problems).toEqual([]);
});

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
