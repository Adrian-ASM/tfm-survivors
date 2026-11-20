import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  E2E_SPEED,
  collect,
  cspState,
  expectSpeed,
  focusGame,
  gameUrl,
  playChoosingFirst,
  probe,
  snapshotOf,
  watchCsp,
} from './probe';
import { F, P0, progressText, seedProgress } from './progressFixtures';
import { STILL_DEFEAT_SEED, STILL_LIMIT_TICKS } from '../support/balanceSeeds';

// Spec progress-persistence: guardado local, export/import y CSP en la build de producción. Las
// partidas hasta la derrota van a ?speed=8 y el progreso previo se siembra (design 0008): ningún
// test juega más de una derrota y los de carga no juegan ninguna.
const KEY = 'sprint-survivors/progress';
const TWO_SECONDS_TICKS = 120;
const EMPTY_RECORDS = { bestTimeSeconds: 0, bestLevel: 0, maxKills: 0 };

/** Progreso v1 válido, con el formato que guarda el juego (builder con el codec de producción). */
const VALID_V1 = progressText(P0);
const FUTURE_VERSION = JSON.stringify({
  ...(JSON.parse(VALID_V1) as Record<string, unknown>),
  schemaVersion: 2,
});
/** JSON truncado: literal a propósito (el builder no puede producir un documento dañado). */
const DAMAGED = '{"schemaVersion":1,"records":';

const stored = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), KEY);

const waitTicks = (page: Page, ticks: number) =>
  expect
    .poll(async () => (await snapshotOf(page))?.tick ?? 0, { timeout: 10_000 })
    .toBeGreaterThan(ticks);

/** Margen de reloj (no es la aserción): una derrota a ?speed=8 tarda unos 10 s. */
const PLAY_TIMEOUT_MS = 45_000;
const TEST_TIMEOUT_MS = 60_000;
const MAX_IMPORT_BYTES = 65_536;

type Records = { bestTimeSeconds: number; bestLevel: number; maxKills: number };

const mmss = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/** Récords en el formato del panel (spec run-results). */
const shownRecords = (r: Records) => [
  `Mejor tiempo ${mmss(r.bestTimeSeconds)}`,
  `Mejor nivel ${String(r.bestLevel)}`,
  `Máx. bajas ${String(r.maxKills)}`,
];

/** Máximo campo a campo (fusión de récords, spec progress-persistence). */
const maxOf = (...all: Records[]): Records => ({
  bestTimeSeconds: Math.max(...all.map((r) => r.bestTimeSeconds)),
  bestLevel: Math.max(...all.map((r) => r.bestLevel)),
  maxKills: Math.max(...all.map((r) => r.maxKills)),
});

/** Juega sin input con la política de elección fija hasta la derrota. */
async function playToDefeat(page: Page) {
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  const ended = await playChoosingFirst(page, (s) => s.status === 'over', PLAY_TIMEOUT_MS);
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
const progressOf = async (page: Page) => (await probe(page))?.progress;

test('Sin violaciones en el bucle completo (?seed=42: P0 sembrado, 1 derrota, export, import y recarga)', async ({
  page,
}) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const problems = collect(page, ['error', 'warning']);
  await watchCsp(page);
  await seedProgress(page, progressText(P0));
  await page.goto(gameUrl({ seed: 42, speed: E2E_SPEED }));
  await expectSpeed(page, E2E_SPEED);
  expect(await progressOf(page)).toMatchObject({ records: P0.records, history: P0.history });

  // La única partida: derrota acelerada; panel con máx(P0, partida) y 2 entradas.
  const ended = await playToDefeat(page);
  const played = {
    bestTimeSeconds: Math.floor((ended?.tick ?? 0) / 60),
    bestLevel: ended?.progression.level ?? 0,
    maxKills: ended?.kills ?? 0,
  };
  const afterRun = maxOf(P0.records, played);
  const afterRunProgress = await progressOf(page);
  expect(afterRunProgress?.records).toEqual(afterRun);
  expect(afterRunProgress?.history).toHaveLength(2);
  expect(afterRunProgress?.history[0]).toMatchObject({
    seed: 42,
    outcome: 'lost',
    timeSeconds: played.bestTimeSeconds,
    level: played.bestLevel,
    kills: played.maxKills,
  });
  await expect(page.getByRole('region', { name: 'Progreso' })).toContainText(
    shownRecords(afterRun).join(''),
  );

  // Exportar: el fichero es lo guardado (P0 + partida) y no cambia la partida.
  const exported = await exportFile(page);
  expect(exported.name).toBe('sprint-survivors-progress.json');
  expect(exported.text).toBe(await stored(page));
  expect((JSON.parse(exported.text) as { history: unknown[] }).history).toHaveLength(2);
  await frames(page, 60);
  expect(await snapshotOf(page)).toEqual(ended);
  expect((await probe(page))?.results).not.toBeNull();

  // Importar el fichero exportado: idempotente, mensaje de éxito y nada cambia.
  await importFile(page, exported.text);
  await expect(message(page)).toContainText('importado');
  expect((await progressOf(page))?.records).toEqual(afterRun);
  expect((await exportFile(page)).text).toBe(exported.text);

  // Importar F: fusión por máximo campo a campo (cada récord sale de una fuente distinta).
  const merged = maxOf(afterRun, F.records);
  expect(merged).toEqual({ bestTimeSeconds: 300, bestLevel: 20, maxKills: played.maxKills });
  await importFile(page, progressText(F));
  await expect.poll(async () => (await progressOf(page))?.records).toEqual(merged);
  expect((await progressOf(page))?.shown).toEqual(shownRecords(merged));
  const afterImport = await exportFile(page);
  const expectedHistory = [afterRunProgress?.history[0], ...F.history, ...P0.history];
  expect((await progressOf(page))?.history).toEqual(expectedHistory);

  // Spec run-results, "Imports rechazados en el navegador" (y progress-persistence, "Fichero demasiado
  // grande" / "Fichero no JSON o fuera de esquema"): mensaje y ni récords ni export cambian.
  await test.step('Scenario: Imports rechazados en el navegador', async () => {
    await importFile(page, 'hola');
    await expect(message(page)).toContainText('no válido');
    await importFile(page, ' '.repeat(MAX_IMPORT_BYTES + 1));
    await expect(message(page)).toContainText('64 KiB');
    expect((await progressOf(page))?.records).toEqual(merged);
    expect((await exportFile(page)).text).toBe(afterImport.text);
    expect(await snapshotOf(page)).toEqual(ended);
  });

  // 1.ª carga: CSP sin violaciones tras jugar, exportar e importar.
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });

  // R tras usar los botones: 1 partida nueva en curso y el panel oculto.
  const seedBefore = (await probe(page))?.seed;
  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshotOf(page))?.status).toBe('running');
  const fresh = await probe(page);
  expect(fresh?.results).toBeNull();
  expect(fresh?.seed).not.toBe(seedBefore);
  await expect(page.getByRole('button', { name: 'Exportar' })).toBeHidden();

  // Recarga (la siembra es de un solo uso): el progreso cargado es el fusionado, 3 entradas.
  await page.reload();
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  const reloaded = await progressOf(page);
  expect(reloaded?.records).toEqual(merged);
  expect(reloaded?.history).toHaveLength(3);
  expect(reloaded?.history).toEqual(expectedHistory);
  expect(await stored(page)).toBe(afterImport.text);

  // 2.ª carga: CSP sin violaciones.
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(problems).toEqual([]);
});

// Semilla del conjunto de balance 1..50: quieta pierde antes de 180 s, como todas (spec
// run-outcome, "Jugador quieto pierde con todas las semillas"; la 42 cae hacia el tick 4.682).

test('Almacenamiento bloqueado: se juega, el overlay avisa de que no se guarda y R reinicia', async ({
  page,
}) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const problems = collect(page, ['error', 'warning']);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('almacenamiento bloqueado', 'SecurityError');
      },
    });
  });
  await page.goto(gameUrl({ seed: STILL_DEFEAT_SEED, speed: E2E_SPEED }));
  await expectSpeed(page, E2E_SPEED);

  const ended = await playToDefeat(page);
  const progress = await progressOf(page);

  expect(ended?.tick).toBeLessThanOrEqual(STILL_LIMIT_TICKS);
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
    ['Datos guardados dañados', DAMAGED],
    ['Versión futura guardada', FUTURE_VERSION],
  ] as const) {
    test(`${name}: 1 aviso con progress, progreso vacío y valor intacto tras 2 s`, async ({
      page,
    }) => {
      const warnings = collect(page, ['warning']);
      await seedProgress(page, value);
      await page.goto(gameUrl());
      await waitTicks(page, TWO_SECONDS_TICKS);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('progress');
      expect(await progressOf(page)).toMatchObject({ records: EMPTY_RECORDS, history: [] });
      expect(await stored(page)).toBe(value);
    });
  }

  test('Partida sin terminar: recargar a mitad de partida no guarda nada', async ({ page }) => {
    const problems = collect(page, ['error', 'warning']);
    await page.goto(gameUrl());
    await waitTicks(page, TWO_SECONDS_TICKS);

    await page.reload();
    await waitTicks(page, 30);

    expect(await stored(page)).toBeNull();
    expect(problems).toEqual([]);
  });
});
