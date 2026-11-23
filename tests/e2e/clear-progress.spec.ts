import { readFileSync } from 'node:fs';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { EMPTY_PROGRESS } from '../../src/domain/progress/Progress';
import { decodeProgress } from '../../src/infrastructure/progress/progressCodec';
import {
  backToMenu,
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
  step,
  waitForRun,
  waitFrames,
} from './probe';
import { F, P0, progressText, seedProgress } from './progressFixtures';

// Borrar datos con confirmación propia (spec main-menu, "Confirmación de Borrar datos"; spec
// progress-persistence, "Borrado del progreso").
const KEY = 'sprint-survivors/progress';
/** G: 2 entradas guardadas. */
const G_TEXT = progressText({
  records: { bestTimeSeconds: 300, bestLevel: 20, maxKills: 10 },
  history: [...F.history, ...P0.history],
});
const DAMAGED = '{"schemaVersion":1,"records":';
/**
 * Las partidas tras Volver al menú usan una semilla aleatoria nueva (spec simulation-loop) y se
 * juegan en modo manual (change 0014) con la política de elección fija. Los tests solo exigen que
 * la partida termine (victoria o derrota): el peor caso es la duración, 36.000 ticks, unos 60
 * frames de 600 ticks. El margen de reloj cubre ese peor caso; no es la aserción.
 */
const TEST_TIMEOUT_MS = 60_000;
/** Ticks de la partida abandonada antes de volver al menú. */
const ABANDONED_TICKS = 11;
/** Frames sin efecto que se esperan en el menú (un número de frames, no un tiempo). */
const IDLE_FRAMES = 30;

const stored = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), KEY);
const menuMessage = (page: Page) => menuPanel(page).getByRole('status');

async function exportMenu(page: Page): Promise<string> {
  const download = page.waitForEvent('download');
  await menuButton(page, 'Exportar').click();
  return readFileSync(await (await download).path(), 'utf8');
}

const decoded = (text: string) => {
  const d = decodeProgress(text);
  return d.ok ? d.value : null;
};

/** Cuenta los diálogos nativos (`alert`, `confirm`, `prompt`) que abre la página. */
function countNativeDialogs(page: Page): { count: number } {
  const counter = { count: 0 };
  page.on('dialog', (d) => {
    counter.count += 1;
    void d.dismiss();
  });
  return counter;
}

async function openClear(page: Page): Promise<void> {
  await menuButton(page, 'Borrar datos').click();
  await expect(confirmDialog(page)).toBeVisible();
}

/** Juega la partida que empieza tras Jugar sin input hasta que termina (modo manual). */
async function playUntilOver(page: Page) {
  await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
  await waitForRun(page);
  await focusGame(page);
  const ended = await playToEnd(page);
  expect(ended?.status).toBe('over');
  return ended;
}

/** Carga con ?e2e en modo manual y vuelve al menú sin terminar la partida. */
async function menuInE2E(page: Page): Promise<void> {
  await page.goto(gameUrl({ manual: true }));
  await expectManual(page);
  await waitForRun(page);
  expect(await step(page, ABANDONED_TICKS)).toBe(ABANDONED_TICKS);
  await focusGame(page);
  await backToMenu(page);
}

test('Diálogo propio: Confirmar y Cancelar, 0 diálogos nativos y opciones bloqueadas', async ({
  page,
}) => {
  const native = countNativeDialogs(page);
  await seedProgress(page, G_TEXT);
  await page.goto(playerUrl());
  let downloads = 0;
  page.on('download', () => {
    downloads += 1;
  });

  await openClear(page);
  await expect(confirmDialog(page).getByRole('button', { name: 'Confirmar' })).toBeVisible();
  await expect(confirmDialog(page).getByRole('button', { name: 'Cancelar' })).toBeVisible();
  await expect(menuButton(page, 'Jugar')).toBeDisabled();
  await menuButton(page, 'Jugar').click({ force: true });
  await menuButton(page, 'Exportar').click({ force: true });
  await menuButton(page, 'Jugar').dispatchEvent('click');
  await menuButton(page, 'Exportar').dispatchEvent('click');
  await page.keyboard.press('Escape');
  await page.keyboard.press('r');
  await waitFrames(page, IDLE_FRAMES);

  await expect(confirmDialog(page)).toBeVisible();
  await expect(menuPanel(page)).toBeVisible();
  expect(downloads).toBe(0);
  expect(native.count).toBe(0);
  expect(await stored(page)).toBe(G_TEXT);
});

test('Cancelar no cambia nada: E2 igual byte a byte a E1 y G intacto', async ({ page }) => {
  await seedProgress(page, G_TEXT);
  await page.goto(playerUrl());
  const e1 = await exportMenu(page);

  await openClear(page);
  await confirmDialog(page).getByRole('button', { name: 'Cancelar' }).click();
  const e2 = await exportMenu(page);

  await expect(confirmDialog(page)).toBeHidden();
  expect(e2).toBe(e1);
  expect(await stored(page)).toBe(G_TEXT);
  await expect(menuButton(page, 'Jugar')).toBeEnabled();
});

test('Confirmar borra: mensaje borrado, export vacío y, tras recargar, vacío sin avisos', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await seedProgress(page, G_TEXT);
  await page.goto(playerUrl());

  await openClear(page);
  await confirmDialog(page).getByRole('button', { name: 'Confirmar' }).click();

  await expect(confirmDialog(page)).toBeHidden();
  await expect(menuMessage(page)).toContainText('borrado');
  expect(decoded(await exportMenu(page))).toStrictEqual(EMPTY_PROGRESS);
  expect(await stored(page)).toBeNull();

  await page.reload();
  await expect(menuPanel(page)).toBeVisible();
  expect(decoded(await exportMenu(page))).toStrictEqual(EMPTY_PROGRESS);
  expect(problems.filter((p) => p.includes('progress'))).toEqual([]);
});

test('Confirmar dos veces seguidas y borrar el progreso vacío: sin errores', async ({ page }) => {
  const problems = collect(page, ['error']);
  await page.goto(playerUrl());

  await openClear(page);
  // Dos clics seguidos sobre el mismo botón, antes de que nada más ocurra.
  await confirmDialog(page)
    .getByRole('button', { name: 'Confirmar' })
    .evaluate((b: HTMLElement) => {
      b.click();
      b.click();
    });
  await expect(confirmDialog(page)).toBeHidden();
  await openClear(page);
  await confirmDialog(page).getByRole('button', { name: 'Confirmar' }).click();

  await expect(menuMessage(page)).toContainText('borrado');
  expect(decoded(await exportMenu(page))).toStrictEqual(EMPTY_PROGRESS);
  expect(problems).toEqual([]);
});

// Dos formas de bloqueo: lanza al acceder a `localStorage`, o lanza cada operación (leer, escribir
// y borrar) de un `localStorage` que sí existe.
for (const mode of ['acceso', 'operaciones'] as const) {
  test(`Menú con almacenamiento bloqueado (SecurityError en ${mode}): borrado, export vacío y Jugar`, async ({
    page,
  }) => {
    const problems = collect(page, ['error']);
    await page.addInitScript((blockAccess) => {
      const blocked = () => {
        throw new DOMException('almacenamiento bloqueado', 'SecurityError');
      };
      if (blockAccess) {
        Object.defineProperty(window, 'localStorage', { configurable: true, get: blocked });
        return;
      }
      Storage.prototype.getItem = blocked;
      Storage.prototype.setItem = blocked;
      Storage.prototype.removeItem = blocked;
    }, mode === 'acceso');
    await page.goto(playerUrl());
    await expectBlockedMenu(page, problems);
  });
}

async function expectBlockedMenu(page: Page, problems: string[]): Promise<void> {
  await expect(menuPanel(page)).toBeVisible();
  expect(decoded(await exportMenu(page))).toStrictEqual(EMPTY_PROGRESS);

  await openClear(page);
  await confirmDialog(page).getByRole('button', { name: 'Confirmar' }).click();

  await expect(menuMessage(page)).toContainText('borrado');
  expect(decoded(await exportMenu(page))).toStrictEqual(EMPTY_PROGRESS);
  await menuButton(page, 'Jugar').click();
  await expect(menuPanel(page)).toBeHidden();
  await waitFrames(page, 30);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Pausa' })).toBeVisible();
  expect(problems).toEqual([]);
}

test('Fallo al borrar (QuotaExceededError): no se ha podido borrar y G intacto', async ({
  page,
}) => {
  const problems = collect(page, ['error']);
  await seedProgress(page, G_TEXT);
  await page.addInitScript(() => {
    const quota = () => {
      throw new DOMException('lleno', 'QuotaExceededError');
    };
    Storage.prototype.removeItem = quota;
  });
  await page.goto(playerUrl());

  await openClear(page);
  await confirmDialog(page).getByRole('button', { name: 'Confirmar' }).click();

  await expect(menuMessage(page)).toContainText('no se ha podido borrar');
  await expect(menuMessage(page)).not.toContainText('borrado');
  expect(await stored(page)).toBe(G_TEXT);
  expect(decoded(await exportMenu(page))).toStrictEqual(EMPTY_PROGRESS);
  expect(problems).toEqual([]);
});

test('Cancelar con datos dañados: el valor sigue intacto y el overlay avisa de dañados', async ({
  page,
}) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  await seedProgress(page, DAMAGED);
  await menuInE2E(page);

  await openClear(page);
  await confirmDialog(page).getByRole('button', { name: 'Cancelar' }).click();
  expect(await stored(page)).toBe(DAMAGED);
  await menuButton(page, 'Jugar').click();
  await playUntilOver(page);

  const notices = (await probe(page))?.progress?.notices ?? [];
  expect(notices.some((n) => n.includes('dañados'))).toBe(true);
});

test('Borrar datos dañados y jugar: sin aviso de dañados y 1 entrada con esa partida', async ({
  page,
}) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  await seedProgress(page, DAMAGED);
  await menuInE2E(page);

  await openClear(page);
  await confirmDialog(page).getByRole('button', { name: 'Confirmar' }).click();
  await expect(menuMessage(page)).toContainText('borrado');
  // Un rechazo en el menú (no cambia el progreso): ni él ni el de borrado pasan al overlay.
  const chooser = page.waitForEvent('filechooser');
  await menuButton(page, 'Importar').click();
  await (
    await chooser
  ).setFiles({ name: 'x.json', mimeType: 'text/plain', buffer: Buffer.from('hola') });
  await expect(menuMessage(page)).toContainText('no válido');
  await menuButton(page, 'Jugar').click();
  const ended = await playUntilOver(page);

  const progress = (await probe(page))?.progress;
  expect(progress?.message).toBeNull();
  expect(progress?.notices.some((n) => n.includes('dañados'))).toBe(false);
  expect(progress?.records).toStrictEqual({
    bestTimeSeconds: Math.floor((ended?.tick ?? 0) / 60),
    bestLevel: ended?.progression.level,
    maxKills: ended?.kills,
  });
  const saved = decoded((await stored(page)) ?? '');
  expect(saved?.history).toHaveLength(1);
});
