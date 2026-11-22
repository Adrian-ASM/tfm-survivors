import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { EMPTY_PROGRESS } from '../../src/domain/progress/Progress';
import { decodeProgress } from '../../src/infrastructure/progress/progressCodec';
import {
  backToMenu,
  collect,
  confirmDialog,
  cspState,
  focusGame,
  gameUrl,
  menuButton,
  menuPanel,
  pauseOverlay,
  playChoosingFirst,
  playerUrl,
  probe,
  snapshotOf,
  startSpriteSampler,
  stopSpriteSampler,
  waitFrames,
  watchCsp,
} from './probe';
import { F, P0, progressText, seedProgress } from './progressFixtures';

// Recorrido del menú sin sonda (spec main-menu, "Flujo del menú observable en el navegador") en la
// build de producción: menú → Jugar → pausa → Volver al menú → Borrar datos (cancelar y confirmar).
/** P0 de 2 entradas de historial. */
const P0_TEXT = progressText({
  records: { bestTimeSeconds: 300, bestLevel: 20, maxKills: 10 },
  history: [...F.history, ...P0.history],
});

async function exportMenu(page: Page): Promise<string> {
  const download = page.waitForEvent('download');
  await menuButton(page, 'Exportar').click();
  return readFileSync(await (await download).path(), 'utf8');
}

const decoded = (text: string) => {
  const d = decodeProgress(text);
  return d.ok ? d.value : null;
};

test('Recorrido del menú sin sonda y borrado que sobrevive a la recarga', async ({ page }) => {
  test.setTimeout(60_000);
  const problems = collect(page, ['error', 'warning']);
  let nativeDialogs = 0;
  page.on('dialog', (d) => {
    nativeDialogs += 1;
    void d.dismiss();
  });
  await watchCsp(page);
  await seedProgress(page, P0_TEXT);
  await page.goto(playerUrl());

  await menuButton(page, 'Jugar').click();
  await expect(menuPanel(page)).toBeHidden();
  await page.waitForTimeout(2_000);
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeVisible();
  await expect(pauseOverlay(page).getByRole('button', { name: 'Reanudar' })).toBeVisible();
  await pauseOverlay(page).getByRole('button', { name: 'Volver al menú' }).click();
  await expect(menuPanel(page)).toBeVisible();
  await expect(pauseOverlay(page)).toBeHidden();

  const e1 = await exportMenu(page);
  await menuButton(page, 'Borrar datos').click();
  await confirmDialog(page).getByRole('button', { name: 'Cancelar' }).click();
  const e2 = await exportMenu(page);
  await menuButton(page, 'Borrar datos').click();
  await confirmDialog(page).getByRole('button', { name: 'Confirmar' }).click();
  const e3 = await exportMenu(page);

  // La partida abandonada no figura: E1 = P0.
  expect(decoded(e1)).toStrictEqual(decoded(P0_TEXT));
  expect(e2).toBe(e1);
  expect(decoded(e3)).toStrictEqual(EMPTY_PROGRESS);
  expect(nativeDialogs).toBe(0);
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });

  await page.reload();
  await expect(menuPanel(page)).toBeVisible();
  expect(decoded(await exportMenu(page))).toStrictEqual(EMPTY_PROGRESS);
  expect(problems).toEqual([]);
});

test('Jugar y Esc tras usar los botones del menú: 1 partida y en pausa', async ({ page }) => {
  await seedProgress(page, progressText(P0));
  await page.goto(gameUrl({ seed: 42 }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(10);
  await focusGame(page);
  await backToMenu(page);
  const before = await page.evaluate(() =>
    window.localStorage.getItem('sprint-survivors/progress'),
  );
  // Volver al menú no guarda la partida abandonada.
  expect(before).toBe(progressText(P0));

  await exportMenu(page);
  const chooser = page.waitForEvent('filechooser');
  await menuButton(page, 'Importar').click();
  await (
    await chooser
  ).setFiles({
    name: 'f.json',
    mimeType: 'application/json',
    buffer: Buffer.from(progressText(F)),
  });
  await expect(menuPanel(page).getByRole('status')).toContainText('importado');
  await menuButton(page, 'Borrar datos').click();
  await confirmDialog(page).getByRole('button', { name: 'Cancelar' }).click();
  await menuButton(page, 'Jugar').click();
  await waitFrames(page, 30);
  await page.keyboard.press('Escape');

  await expect(pauseOverlay(page)).toBeVisible();
  expect(await probe(page)).toMatchObject({ runs: 2, screen: 'paused' });
});

// Change 0012 (specs main-menu y sprite-rendering): limpieza de sprites al salir de la partida.
test('Scenario: Volver al menú con cadáveres en curso (?e2e&seed=7: menú a 0; partida nueva sin cadáveres)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const problems = collect(page, ['error']);
  await page.goto(gameUrl({ seed: 7 }));
  await focusGame(page);
  await expect
    .poll(async () => (await probe(page))?.sprites?.corpses.visible ?? 0, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeVisible();
  await pauseOverlay(page).getByRole('button', { name: 'Volver al menú' }).click();
  await expect(menuPanel(page)).toBeVisible();
  await startSpriteSampler(page);
  await waitFrames(page, 60);
  const inMenu = await stopSpriteSampler(page);
  await menuButton(page, 'Jugar').click();
  await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
  const first = (await probe(page))?.sprites;

  expect(inMenu.menuFrames).toBeGreaterThanOrEqual(55);
  expect(inMenu.mismatches).toEqual([]);
  expect(first?.corpses.visible).toBe(0);
  expect(problems).toEqual([]);
});

test('Scenario: Cinco ciclos menú-partida (sonda coherente y 0 cadáveres tras cada Volver al menú)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = collect(page, ['error']);
  await page.goto(gameUrl({ seed: 42 }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(30);
  await startSpriteSampler(page);
  const corpsesInMenu: number[] = [];
  for (let cycle = 0; cycle < 5; cycle++) {
    await focusGame(page);
    await waitFrames(page, 120);
    await backToMenu(page);
    await waitFrames(page, 2);
    corpsesInMenu.push((await probe(page))?.sprites?.corpses.visible ?? -1);
    await menuButton(page, 'Jugar').click();
    await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
  }
  await waitFrames(page, 120);
  const sample = await stopSpriteSampler(page);

  expect(corpsesInMenu).toEqual([0, 0, 0, 0, 0]);
  expect(sample.mismatches).toEqual([]);
  expect(sample.menuFrames).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});

test('Scenario: Volver al menú desde la pausa (tick ≥ 3.000 con enemigos, proyectiles y gemas)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto(gameUrl({ seed: 42, speed: 8 }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  const busy = (s: { tick: number; enemies: unknown[]; projectiles: unknown[]; gems: unknown[] }) =>
    s.tick >= 3000 && s.enemies.length > 0 && s.projectiles.length > 0 && s.gems.length > 0;
  const reached = await playChoosingFirst(page, (s) => busy(s) || s.status === 'over', 60_000);
  expect(reached && busy(reached)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeVisible();
  await pauseOverlay(page).getByRole('button', { name: 'Volver al menú' }).click();
  // El clic lo lee el siguiente update de la partida; el menú se muestra en el frame posterior.
  await expect(menuPanel(page)).toBeVisible();
  await waitFrames(page, 1);
  const s = (await probe(page))?.sprites;

  expect(await menuPanel(page).getByRole('button').allTextContents()).toEqual([
    'Jugar',
    'Exportar',
    'Importar',
    'Borrar datos',
  ]);
  expect(
    [s?.player, s?.enemies, s?.corpses, s?.projectiles, s?.pulses, s?.gems].map((k) => k?.visible),
  ).toEqual([0, 0, 0, 0, 0, 0]);
  await expect(pauseOverlay(page)).toBeHidden();
  await expect(page.locator('.results-panel')).toBeHidden();
});
