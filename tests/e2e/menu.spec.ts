import { expect, test, type Page } from '@playwright/test';
import {
  E2E_SPEED,
  backToMenu,
  collect,
  focusGame,
  gameUrl,
  menuButton,
  menuPanel,
  pauseOverlay,
  playerUrl,
  probe,
  snapshotOf,
  ticksPerFrame,
  waitFrames,
} from './probe';

// Menú de inicio (spec main-menu): sin ?e2e se ve el menú y no hay sonda; con ?e2e la partida
// arranca al cargar y el menú se recorre con Esc → Volver al menú → Jugar.

const MENU_LABELS = ['Jugar', 'Exportar', 'Importar', 'Borrar datos'];
/**
 * Tick máximo de una partida "recién creada" al leerla tras el clic: margen de unos 2 s de frames
 * para máquinas lentas (el tick 0 exacto antes del primer tick se prueba en Node).
 */
const FRESH_MAX_TICKS = 120;

const hasProbe = (page: Page) => page.evaluate(() => '__sprint' in window);

async function expectMenuOnly(page: Page): Promise<void> {
  await expect(menuPanel(page)).toBeVisible();
  expect(await menuPanel(page).getByRole('button').allTextContents()).toEqual(MENU_LABELS);
  await expect(pauseOverlay(page)).toBeHidden();
  await expect(page.locator('.results-panel')).toBeHidden();
}

async function playingE2E(page: Page, url = gameUrl({ seed: 42 })): Promise<void> {
  await page.goto(url);
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(30);
  await focusGame(page);
}

test(
  'Carga sin parámetros: menú con sus 4 opciones, sin pausa ni resultados ni sonda',
  { tag: '@realtime' },
  async ({ page }) => {
    const problems = collect(page, ['error', 'warning']);
    await page.goto(playerUrl());

    await expectMenuOnly(page);
    await page.waitForTimeout(1_000);
    await expectMenuOnly(page);
    expect(await hasProbe(page)).toBe(false);
    expect(problems).toEqual([]);
  },
);

test(
  'Teclas sin efecto en el menú: Esc, R, 1, 2, 3 y movimiento',
  { tag: '@realtime' },
  async ({ page }) => {
    await page.goto(playerUrl());
    await expect(menuPanel(page)).toBeVisible();
    await page.locator('#game canvas').click({ position: { x: 5, y: 5 } });

    for (const key of ['Escape', 'r', '1', '2', '3']) await page.keyboard.press(key);
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(1_000);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('ArrowDown');

    await expectMenuOnly(page);
  },
);

test(
  'Carga con semilla y sin e2e: menú visible y sin sonda, también tras Jugar',
  { tag: '@realtime' },
  async ({ page }) => {
    await page.goto(playerUrl('?seed=42'));
    await expectMenuOnly(page);
    expect(await hasProbe(page)).toBe(false);

    await menuButton(page, 'Jugar').click();

    await expect(menuPanel(page)).toBeHidden();
    expect(await hasProbe(page)).toBe(false);
  },
);

test(
  'Esc funciona tras pulsar Jugar con el ratón (sin otro clic)',
  { tag: '@realtime' },
  async ({ page }) => {
    await page.goto(playerUrl());
    await menuButton(page, 'Jugar').click();
    await expect(menuPanel(page)).toBeHidden();
    // Escenario: se pintan 30 frames tras Jugar (no un tiempo de reloj).
    await waitFrames(page, 30);

    await page.keyboard.press('Escape');

    await expect(pauseOverlay(page)).toBeVisible();
  },
);

test(
  'Menú tras Volver al menú en modo E2E: screen menu, sin snapshot; Jugar crea la 2.ª partida',
  { tag: '@realtime' },
  async ({ page }) => {
    await playingE2E(page);
    expect((await probe(page))?.runs).toBe(1);

    await backToMenu(page);

    await expectMenuOnly(page);
    expect(await probe(page)).toMatchObject({ screen: 'menu', snapshot: null, results: null });
    // R en el menú tras Volver al menú: no crea ninguna partida.
    await page.keyboard.press('r');
    await page.waitForTimeout(500);
    expect(await probe(page)).toMatchObject({ screen: 'menu', snapshot: null, runs: 1 });

    await menuButton(page, 'Jugar').click();

    await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
    const fresh = await probe(page);
    expect(fresh?.runs).toBe(2);
    expect(fresh?.seed).not.toBe(42);
    expect(fresh?.snapshot?.tick).toBeLessThanOrEqual(FRESH_MAX_TICKS);
    expect(fresh?.snapshot).toMatchObject({
      status: 'running',
      kills: 0,
      player: { health: 100, maxHealth: 100 },
      progression: { level: 1 },
      upgrades: [],
    });
    await expect(menuPanel(page)).toBeHidden();
    await expect(pauseOverlay(page)).toBeHidden();
  },
);

test(
  'Velocidad tras volver al menú: con ?e2e&speed=8 la partida nueva va acelerada',
  { tag: '@realtime' },
  async ({ page }) => {
    await playingE2E(page, gameUrl({ seed: 42, speed: E2E_SPEED }));
    await backToMenu(page);

    await menuButton(page, 'Jugar').click();
    await expect.poll(async () => (await probe(page))?.screen).toBe('playing');

    expect((await probe(page))?.speed).toBe(E2E_SPEED);
    // Ritmo por frame del navegador (tick 8 exacto por frame: en Node, `pause-gate`/`advance-frame`).
    expect(await ticksPerFrame(page)).toBeGreaterThan(2);
  },
);

test(
  'Doble clic en Jugar: se crea exactamente 1 partida y avanza con normalidad',
  { tag: '@realtime' },
  async ({ page }) => {
    await playingE2E(page);
    await backToMenu(page);

    await menuButton(page, 'Jugar').dblclick();

    await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
    // Avanza con normalidad: ~1 tick por frame del navegador (sin reloj de pared).
    const pace = await ticksPerFrame(page);
    expect(pace).toBeGreaterThan(0.5);
    expect(pace).toBeLessThan(1.5);
    expect((await probe(page))?.runs).toBe(2);
  },
);

test(
  'Cinco ciclos menú-partida: 6 partidas en la carga y la última juega con normalidad',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(60_000);
    const problems = collect(page, ['error']);
    await playingE2E(page);
    for (let i = 0; i < 5; i++) {
      await backToMenu(page);
      expect((await probe(page))?.screen).toBe('menu');
      await menuButton(page, 'Jugar').click();
      await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(10);
    }

    const last = await probe(page);
    expect([last?.runs, last?.screen]).toEqual([6, 'playing']);
    expect(last?.snapshot?.status).toBe('running');
    expect(problems).toEqual([]);
  },
);
