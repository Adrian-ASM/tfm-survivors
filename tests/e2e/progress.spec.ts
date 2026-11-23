import { readFileSync } from 'node:fs';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { EMPTY_PROGRESS } from '../../src/domain/progress/Progress';
import { decodeProgress } from '../../src/infrastructure/progress/progressCodec';
import {
  collect,
  confirmDialog,
  expectManual,
  focusGame,
  gameUrl,
  menuButton,
  menuPanel,
  playToEnd,
  playerUrl,
  probe,
  waitForRun,
} from './probe';
import { F, P0, progressText, seedProgress } from './progressFixtures';

// Suite de humo (chore e2e-lite): progreso local con almacenamiento real del navegador (spec
// progress-persistence y main-menu). Validaciones y fusión al detalle, en Node.
const KEY = 'sprint-survivors/progress';
const FILE_NAME = 'sprint-survivors-progress.json';
/** G: progreso guardado con 2 entradas (P0 + la de F). */
const G_TEXT = progressText({
  records: { bestTimeSeconds: 300, bestLevel: 20, maxKills: 10 },
  history: [...F.history, ...P0.history],
});

const stored = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), KEY);

const menuMessage = (page: Page) => menuPanel(page).getByRole('status');

async function exportMenu(page: Page): Promise<string> {
  const download = page.waitForEvent('download');
  await menuButton(page, 'Exportar').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(FILE_NAME);
  return readFileSync(await file.path(), 'utf8');
}

async function importMenu(page: Page, content: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await menuButton(page, 'Importar').click();
  await (
    await chooser
  ).setFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(content) });
}

const decoded = (text: string) => {
  const d = decodeProgress(text);
  return d.ok ? d.value : null;
};

test('Exportar e importar desde el menú: el fichero es lo guardado y el import fusiona', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await seedProgress(page, progressText(P0));
  await page.goto(playerUrl());

  expect(decoded(await exportMenu(page))).toStrictEqual(P0);
  await importMenu(page, progressText(F));

  await expect(menuMessage(page)).toContainText('importado');
  const merged = await exportMenu(page);
  expect(decoded(merged)?.records).toStrictEqual({
    bestTimeSeconds: 300,
    bestLevel: 20,
    maxKills: 10,
  });
  expect(merged).toBe(await stored(page));
  await expect(menuPanel(page)).toBeVisible();
  expect(problems).toEqual([]);
});

test('Borrar datos con confirmación propia: Cancelar no toca nada y Confirmar borra', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  let nativeDialogs = 0;
  page.on('dialog', (d) => {
    nativeDialogs += 1;
    void d.dismiss();
  });
  await seedProgress(page, G_TEXT);
  await page.goto(playerUrl());

  await menuButton(page, 'Borrar datos').click();
  await expect(confirmDialog(page)).toBeVisible();
  await confirmDialog(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirmDialog(page)).toBeHidden();
  expect(await stored(page)).toBe(G_TEXT);

  await menuButton(page, 'Borrar datos').click();
  await confirmDialog(page).getByRole('button', { name: 'Confirmar' }).click();

  await expect(confirmDialog(page)).toBeHidden();
  await expect(menuMessage(page)).toContainText('borrado');
  expect(await stored(page)).toBeNull();
  await page.reload();
  await expect(menuPanel(page)).toBeVisible();
  expect(decoded(await exportMenu(page))).toStrictEqual(EMPTY_PROGRESS);
  expect(nativeDialogs).toBe(0);
  expect(problems).toEqual([]);
});

test('Récord guardado: tras perder con ?seed=42, recargar carga los récords y el historial', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto(gameUrl({ seed: 42, manual: true }));
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);

  const ended = await playToEnd(page);
  expect(ended?.outcome).toBe('lost');
  const played = {
    bestTimeSeconds: Math.floor((ended?.tick ?? 0) / 60),
    bestLevel: ended?.progression.level ?? 0,
    maxKills: ended?.kills ?? 0,
  };

  await page.reload();
  await waitForRun(page);
  const reloaded = (await probe(page))?.progress;

  expect(reloaded?.records).toEqual(played);
  expect(reloaded?.history).toHaveLength(1);
  expect(reloaded?.history[0]).toMatchObject({
    seed: 42,
    outcome: 'lost',
    timeSeconds: played.bestTimeSeconds,
    level: played.bestLevel,
    kills: played.maxKills,
  });
  expect(problems).toEqual([]);
});
