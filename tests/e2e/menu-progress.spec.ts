import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { EMPTY_PROGRESS } from '../../src/domain/progress/Progress';
import { decodeProgress } from '../../src/infrastructure/progress/progressCodec';
import {
  E2E_SPEED,
  backToMenu,
  focusGame,
  gameUrl,
  menuButton,
  menuPanel,
  playChoosingFirst,
  playerUrl,
  probe,
  snapshotOf,
} from './probe';
import { F, P0, progressText, seedProgress } from './progressFixtures';
// Semilla del conjunto de balance 1..50 con derrota quieta antes de 180 s (spec run-outcome).
import { STILL_DEFEAT_SEED } from '../support/balanceSeeds';

// Exportar e Importar desde el menú (spec main-menu y progress-persistence): mismo fichero, mismas
// validaciones y mismos mensajes que en resultados; los mensajes no pasan de un sitio a otro.
const KEY = 'sprint-survivors/progress';
const FILE_NAME = 'sprint-survivors-progress.json';
/** G: progreso guardado con 2 entradas (P0 + la de F). */
const G = {
  records: { bestTimeSeconds: 300, bestLevel: 20, maxKills: 10 },
  history: [...F.history, ...P0.history],
};
const G_TEXT = progressText(G);
const PLAY_TIMEOUT_MS = 45_000;

const stored = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), KEY);

const menuMessage = (page: Page) => menuPanel(page).getByRole('status');

async function exportFrom(page: Page, exportButton: Locator): Promise<string> {
  const download = page.waitForEvent('download');
  await exportButton.click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(FILE_NAME);
  return readFileSync(await file.path(), 'utf8');
}

async function importFrom(page: Page, importButton: Locator, content: string | Buffer) {
  const chooser = page.waitForEvent('filechooser');
  await importButton.click();
  await (
    await chooser
  ).setFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(content) });
}

const decoded = (text: string) => {
  const d = decodeProgress(text);
  return d.ok ? d.value : null;
};

test('Exportar sin progreso: el fichero es el progreso vacío y no empieza ninguna partida', async ({
  page,
}) => {
  await page.goto(playerUrl());

  const text = await exportFrom(page, menuButton(page, 'Exportar'));

  expect(decoded(text)).toStrictEqual(EMPTY_PROGRESS);
  await expect(menuPanel(page)).toBeVisible();
  expect(await stored(page)).toBeNull();
});

test('Exportar desde el menú: con G guardado el fichero es G y no empieza ninguna partida', async ({
  page,
}) => {
  await seedProgress(page, G_TEXT);
  await page.goto(playerUrl());

  const text = await exportFrom(page, menuButton(page, 'Exportar'));

  expect(decoded(text)).toStrictEqual(decoded(G_TEXT));
  await expect(menuPanel(page)).toBeVisible();
  expect(await stored(page)).toBe(G_TEXT);
});

test('Importar desde el menú: mensaje con importado y récords fusionados', async ({ page }) => {
  await seedProgress(page, progressText(P0));
  await page.goto(playerUrl());

  await importFrom(page, menuButton(page, 'Importar'), progressText(F));

  await expect(menuMessage(page)).toContainText('importado');
  const text = await exportFrom(page, menuButton(page, 'Exportar'));
  expect(decoded(text)?.records).toStrictEqual({
    bestTimeSeconds: 300,
    bestLevel: 20,
    maxKills: 10,
  });
  await expect(menuPanel(page)).toBeVisible();
});

test('Import rechazado desde el menú: no válido, 64 KiB y G intacto', async ({ page }) => {
  await seedProgress(page, G_TEXT);
  await page.goto(playerUrl());

  await importFrom(page, menuButton(page, 'Importar'), 'hola');
  await expect(menuMessage(page)).toContainText('no válido');
  await importFrom(page, menuButton(page, 'Importar'), ' '.repeat(65_537));
  await expect(menuMessage(page)).toContainText('64 KiB');

  expect(await stored(page)).toBe(G_TEXT);
  expect(decoded(await exportFrom(page, menuButton(page, 'Exportar')))).toStrictEqual(
    decoded(G_TEXT),
  );
});

test('Cancelar el selector en el menú: sin mensaje y G intacto', async ({ page }) => {
  await seedProgress(page, G_TEXT);
  await page.goto(playerUrl());

  const chooser = page.waitForEvent('filechooser');
  await menuButton(page, 'Importar').click();
  await (await chooser).setFiles([]);
  await page.waitForTimeout(300);

  await expect(menuMessage(page)).toBeHidden();
  expect(await stored(page)).toBe(G_TEXT);
});

test('Jugar tras usar los botones: 1 partida nueva y el menú deja de verse con sus mensajes', async ({
  page,
}) => {
  await page.goto(gameUrl({ seed: 42 }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(10);
  await focusGame(page);
  await backToMenu(page);
  await exportFrom(page, menuButton(page, 'Exportar'));
  await importFrom(page, menuButton(page, 'Importar'), progressText(F));
  await expect(menuMessage(page)).toContainText('importado');

  await menuButton(page, 'Jugar').click();

  await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
  expect((await probe(page))?.runs).toBe(2);
  await expect(menuPanel(page)).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Pausa' })).toBeVisible();
});

// La 1.ª partida de la carga usa la semilla fija 90 (derrota determinista a ?speed=8). La dirección
// menú → overlay de los mensajes, que exige jugar una partida tras Volver al menú (semilla
// aleatoria), está en `clear-progress.spec` y en Node (`menu-progress.test`).
test('Mismo fichero desde los dos sitios y mensajes del overlay que no pasan al menú', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto(gameUrl({ seed: STILL_DEFEAT_SEED, speed: E2E_SPEED }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  const ended = await playChoosingFirst(page, (s) => s.status === 'over', PLAY_TIMEOUT_MS);
  expect(ended?.status).toBe('over');
  const results = page.locator('.results-panel');
  await expect(results).toBeVisible();

  // E1 desde resultados y un rechazo en el overlay que no debe pasar al menú.
  const e1 = await exportFrom(page, results.getByRole('button', { name: 'Exportar' }));
  await importFrom(page, results.getByRole('button', { name: 'Importar' }), 'hola');
  await expect(results.getByRole('status')).toContainText('no válido');
  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshotOf(page))?.status).toBe('running');
  await backToMenu(page);

  await expect(menuMessage(page)).toBeHidden();
  const e2 = await exportFrom(page, menuButton(page, 'Exportar'));
  expect(e2).toBe(e1);
});
