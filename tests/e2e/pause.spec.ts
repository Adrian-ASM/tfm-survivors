import { expect, test, type Page } from '@playwright/test';
import {
  E2E_SPEED,
  collect,
  expectSpeed,
  focusGame,
  gameUrl,
  playChoosingFirst,
  probe,
  snapshotOf,
  ticksPerFrame,
  type SnapshotView,
} from './probe';

// Pausa con Esc (spec main-menu, "Pausa con Esc"; simulation-loop, "Sin tiempo acumulado durante
// la pausa"). Los ticks exactos (0 en pausa, n + 1 al reanudar) se prueban en Node con PauseGate;
// aquí se comprueba lo observable en el navegador: overlay, snapshot congelado y teclas sin efecto.

/** Unos 120 frames de 60 Hz en pausa (reloj real). */
const PAUSED_MS = 2_000;
/** Tick mínimo antes de pausar: distingue la misma partida de una reiniciada. */
const MIN_TICK = 120;
/** Margen de reloj para jugar hasta un evento lejano a ?speed=8. */
const PLAY_TIMEOUT_MS = 45_000;

const pauseOverlay = (page: Page) => page.getByRole('dialog', { name: 'Pausa' });

async function startPlaying(page: Page, url: string): Promise<SnapshotView> {
  await page.goto(url);
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(MIN_TICK);
  await focusGame(page);
  return (await snapshotOf(page)) as SnapshotView;
}

async function pause(page: Page): Promise<SnapshotView> {
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeVisible();
  return (await snapshotOf(page)) as SnapshotView;
}

test('Pausar y reanudar con Esc: overlay visible, snapshot congelado y después sigue', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await startPlaying(page, gameUrl({ seed: 42 }));

  const paused = await pause(page);
  await page.waitForTimeout(PAUSED_MS);

  await expect(pauseOverlay(page)).toBeVisible();
  await expect(pauseOverlay(page)).toContainText('Pausa');
  await expect(pauseOverlay(page).getByRole('button', { name: 'Reanudar' })).toBeVisible();
  await expect(pauseOverlay(page).getByRole('button', { name: 'Volver al menú' })).toBeVisible();
  expect(paused.status).toBe('running');
  expect(await snapshotOf(page)).toStrictEqual(paused);
  await expect(page.locator('.results-panel')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeHidden();
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(paused.tick);
  expect(problems).toEqual([]);
});

test('Reanudar con el botón: el overlay se oculta y el tick avanza', async ({ page }) => {
  await startPlaying(page, gameUrl({ seed: 42 }));
  const paused = await pause(page);

  await pauseOverlay(page).getByRole('button', { name: 'Reanudar' }).click();

  await expect(pauseOverlay(page)).toBeHidden();
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(paused.tick);
  // Esc sigue funcionando tras el clic (el botón soltó el foco).
  await pause(page);
});

test('Teclas sin efecto en pausa: R, 1, 2, 3 y el movimiento no cambian nada', async ({ page }) => {
  await startPlaying(page, gameUrl({ seed: 42 }));
  const paused = await pause(page);

  for (const key of ['r', '1', '2', '3']) await page.keyboard.press(key);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1_000);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowDown');

  expect(await snapshotOf(page)).toStrictEqual(paused);
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeHidden();
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(paused.tick);
  const after = await snapshotOf(page);
  // Misma partida: no se ha reiniciado (el tick sigue por encima del de la pausa).
  expect(after?.tick).toBeGreaterThan(paused.tick);
  expect(after?.kills).toBeGreaterThanOrEqual(paused.kills);
});

test(
  'Modo E2E con velocidad: tras reanudar a ?speed=8 el tick avanza de 8 en 8',
  {
    tag: '@realtime',
  },
  async ({ page }) => {
    await startPlaying(page, gameUrl({ seed: 42, speed: E2E_SPEED }));
    await expectSpeed(page, E2E_SPEED);
    const paused = await pause(page);
    await page.waitForTimeout(500);
    expect((await snapshotOf(page))?.tick).toBe(paused.tick);

    await page.keyboard.press('Escape');
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(paused.tick);
    // Ritmo acelerado tras reanudar, medido por frame del navegador (no por reloj de pared): los
    // ticks exactos, n + 8 y n + 16, se prueban en Node. Velocidad 1 daría ~1 tick por frame.
    expect(await ticksPerFrame(page)).toBeGreaterThan(2);
  },
);

test('Esc mientras se elige mejora: no pausa y la tecla 1 elige', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(gameUrl({ seed: 7, speed: E2E_SPEED }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  await expect
    .poll(async () => (await snapshotOf(page))?.status, { timeout: PLAY_TIMEOUT_MS })
    .toBe('choosing');
  const offered = (await snapshotOf(page)) as SnapshotView;

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(pauseOverlay(page)).toBeHidden();
  await page.keyboard.press('1');

  await expect.poll(async () => (await snapshotOf(page))?.offer.length).toBe(0);
  expect((await snapshotOf(page))?.upgrades).toEqual([{ id: offered.offer[0]?.id, level: 1 }]);
  await expect(pauseOverlay(page)).toBeHidden();
});

test('Esc con la partida terminada: no pausa y R crea una partida nueva', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(gameUrl({ seed: 42, speed: E2E_SPEED }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  const ended = await playChoosingFirst(page, (s) => s.status === 'over', PLAY_TIMEOUT_MS);
  expect(ended?.status).toBe('over');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(pauseOverlay(page)).toBeHidden();
  expect((await snapshotOf(page))?.tick).toBe(ended?.tick);

  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshotOf(page))?.status).toBe('running');
  await expect(pauseOverlay(page)).toBeHidden();
  // R crea exactamente 1 partida nueva: la de la carga y la del reinicio.
  expect((await probe(page))?.runs).toBe(2);
});
