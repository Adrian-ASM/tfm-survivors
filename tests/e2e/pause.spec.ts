import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  E2E_SPEED,
  expectManual,
  expectSpeed,
  collect,
  focusGame,
  gameUrl,
  playToEnd,
  probe,
  snapshotOf,
  step,
  stepUntil,
  ticksPerFrame,
  waitForRun,
  type SnapshotView,
} from './probe';

// Pausa con Esc (spec main-menu, "Pausa con Esc"; simulation-loop, "Sin tiempo acumulado durante
// la pausa"). Los ticks exactos con frames reales (0 en pausa, n + 1 al reanudar) se prueban en
// Node con PauseGate; aquí, en modo manual (change 0014), lo observable en el navegador: overlay,
// snapshot congelado, teclas sin efecto y `step` que no avanza en pausa. Sin esperas de reloj.

/** Tick antes de pausar: distingue la misma partida de una reiniciada. */
const MIN_TICK = 120;
/** Ticks que se piden en pausa: un `step` en pausa devuelve 0 y deja pasar al menos un frame. */
const PAUSED_TICKS = 60;

const pauseOverlay = (page: Page) => page.getByRole('dialog', { name: 'Pausa' });

/** Partida en modo manual en el tick `MIN_TICK`, con el foco en el canvas. */
async function startPlaying(page: Page, seed = 42): Promise<SnapshotView> {
  await page.goto(gameUrl({ seed, manual: true }));
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);
  expect(await step(page, MIN_TICK)).toBe(MIN_TICK);
  return (await snapshotOf(page)) as SnapshotView;
}

async function pause(page: Page): Promise<SnapshotView> {
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeVisible();
  await expect.poll(async () => (await probe(page))?.screen).toBe('paused');
  return (await snapshotOf(page)) as SnapshotView;
}

/** Tras reanudar: la pantalla vuelve a `playing` y `step(1)` da exactamente n + 1. */
async function expectResumedFrom(page: Page, paused: SnapshotView): Promise<void> {
  await expect(pauseOverlay(page)).toBeHidden();
  await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
  expect(await step(page, 1)).toBe(1);
  expect((await snapshotOf(page))?.tick).toBe(paused.tick + 1);
}

test('Pausar y reanudar con Esc: overlay visible, snapshot congelado y después sigue', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await startPlaying(page);

  const paused = await pause(page);
  expect(await step(page, PAUSED_TICKS)).toBe(0);

  await expect(pauseOverlay(page)).toBeVisible();
  await expect(pauseOverlay(page)).toContainText('Pausa');
  await expect(pauseOverlay(page).getByRole('button', { name: 'Reanudar' })).toBeVisible();
  await expect(pauseOverlay(page).getByRole('button', { name: 'Volver al menú' })).toBeVisible();
  expect(paused.status).toBe('running');
  expect(await snapshotOf(page)).toStrictEqual(paused);
  await expect(page.locator('.results-panel')).toBeHidden();

  await page.keyboard.press('Escape');
  await expectResumedFrom(page, paused);
  expect(problems).toEqual([]);
});

test('Reanudar con el botón: el overlay se oculta y el tick avanza', async ({ page }) => {
  await startPlaying(page);
  const paused = await pause(page);

  await pauseOverlay(page).getByRole('button', { name: 'Reanudar' }).click();

  await expectResumedFrom(page, paused);
  // Esc sigue funcionando tras el clic (el botón soltó el foco).
  await pause(page);
});

test('Teclas sin efecto en pausa: R, 1, 2, 3 y el movimiento no cambian nada', async ({ page }) => {
  await startPlaying(page);
  const paused = await pause(page);

  for (const key of ['r', '1', '2', '3']) await page.keyboard.press(key);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowDown');
  const inPause = await step(page, PAUSED_TICKS);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowDown');

  expect(inPause).toBe(0);
  expect(await snapshotOf(page)).toStrictEqual(paused);
  await page.keyboard.press('Escape');
  // Misma partida: no se ha reiniciado (sigue en n + 1 y con las mismas bajas o más).
  await expectResumedFrom(page, paused);
  expect((await snapshotOf(page))?.kills).toBeGreaterThanOrEqual(paused.kills);
  expect((await probe(page))?.runs).toBe(1);
});

test(
  'Modo E2E con velocidad: tras reanudar a ?speed=8 el tick avanza de 8 en 8',
  {
    tag: '@realtime',
  },
  async ({ page }) => {
    await page.goto(gameUrl({ seed: 42, speed: E2E_SPEED }));
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(MIN_TICK);
    await focusGame(page);
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
  await startPlaying(page, 7);
  const offered = await stepUntil(page, (s) => s.status === 'choosing', 60 * 60);
  expect(offered).not.toBeNull();

  await page.keyboard.press('Escape');
  // Un frame atiende el Esc: con la oferta abierta no pausa ni avanza.
  expect(await step(page, 10)).toBe(0);
  await expect(pauseOverlay(page)).toBeHidden();
  expect((await probe(page))?.screen).toBe('playing');
  await page.keyboard.press('1');
  expect(await step(page, 1)).toBe(1);

  const after = await snapshotOf(page);
  expect(after?.offer).toHaveLength(0);
  expect(after?.upgrades).toEqual([{ id: offered?.offer[0]?.id, level: 1 }]);
  await expect(pauseOverlay(page)).toBeHidden();
});

test('Esc con la partida terminada: no pausa y R crea una partida nueva', async ({ page }) => {
  await startPlaying(page);
  const ended = await playToEnd(page);
  expect(ended?.status).toBe('over');

  await page.keyboard.press('Escape');
  // Un frame atiende el Esc: con la partida terminada no pausa ni avanza.
  expect(await step(page, 10)).toBe(0);
  await expect(pauseOverlay(page)).toBeHidden();
  expect((await snapshotOf(page))?.tick).toBe(ended?.tick);

  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshotOf(page))?.status).toBe('running');
  await expect(pauseOverlay(page)).toBeHidden();
  // R crea exactamente 1 partida nueva: la de la carga y la del reinicio.
  expect((await probe(page))?.runs).toBe(2);
});
