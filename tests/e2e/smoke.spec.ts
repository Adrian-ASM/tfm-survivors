import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  backToMenu,
  collect,
  DESKTOP_VIEWPORT_EXTRA,
  cspState,
  expectManual,
  focusGame,
  gameUrl,
  menuButton,
  menuPanel,
  pauseOverlay,
  playToEnd,
  playerUrl,
  probe,
  snapshotOf,
  step,
  waitForRun,
  waitFrames,
  watchCsp,
  type SnapshotView,
} from './probe';

// Suite de humo (chore e2e-lite): un test por flujo del bucle de partida, en modo manual
// (`?e2e&manual` y `step(n)`), sin esperas de reloj. Las reglas exactas se prueban en Node.

/** Partida en modo manual con la semilla dada, ya creada y con el foco en el canvas. */
async function manualGame(page: Page, seed = 42): Promise<void> {
  await page.goto(gameUrl({ seed, manual: true }));
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);
}

const tickOf = async (page: Page): Promise<number | null> => (await snapshotOf(page))?.tick ?? null;

const mmss = (tick: number): string => {
  const s = Math.floor(tick / 60);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const MENU_BUTTONS = ['Jugar', 'Cómo jugar', 'Exportar', 'Importar', 'Borrar datos'];

/** La caja del elemento está entera dentro de la ventana. */
async function expectInside(
  target: Locator,
  size: { readonly width: number; readonly height: number },
): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('elemento sin caja');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height);
}

test('Arranque y menú: botones, guía, título, sin errores de consola ni de CSP', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  let nativeDialogs = 0;
  page.on('dialog', (d) => {
    nativeDialogs += 1;
    void d.dismiss();
  });
  await watchCsp(page);
  await page.goto(playerUrl());
  await expect(menuPanel(page)).toBeVisible();
  // Unos frames con el menú pintado (un número de frames, no un tiempo).
  await waitFrames(page, 30);

  // Spec main-menu (0032), "Menú con piezas en el navegador": a 1.280 × 720 (k = 1), marco de la
  // pieza `panel` bajo la base, esquinas de margen × 1 px (16 con los datos del repositorio) y la
  // fuente pixel disponible.
  const kit = await menuPanel(page).evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      source: style.borderImageSource,
      width: style.borderImageWidth,
      font: document.fonts.check('16px "Departure Mono"'),
    };
  });
  expect(kit.source).toContain('/tfm-survivors/assets/tiny-swords/UI/Banners/Carved_9Slides.png');
  expect(kit.width).toMatch(/^16px( 16px){0,3}$/);
  expect(kit.font).toBe(true);

  expect(await menuPanel(page).getByRole('button').allTextContents()).toEqual(MENU_BUTTONS);
  expect(await page.title()).toContain('Greentide Vanguard');
  // 0017 (D11): el título es el h1 del panel del menú (un único bloque centrado).
  await expect(menuPanel(page).getByRole('heading', { level: 1 })).toHaveText('Greentide Vanguard');

  // Spec menu-guide (0028), "Recorrido de la guía en el smoke": solo DOM, sin sonda ni reloj.
  const guide = page.locator('.guide-modal');
  const indicator = guide.locator('.guide-modal__page');
  const control = (name: string) => guide.getByRole('button', { name, exact: true });
  await expect(guide).toBeHidden();
  await menuButton(page, 'Cómo jugar').click();
  await expect(guide).toBeVisible();
  await expect(indicator).toHaveText('1 de 7');
  await expect(control('Anterior')).toBeHidden();
  await expect(guide.locator('img.resource-icon')).toHaveCount(0);
  for (let k = 2; k <= 3; k += 1) {
    await page.keyboard.press('ArrowRight');
    await expect(indicator).toHaveText(`${String(k)} de 7`);
  }
  // "Iconos de las páginas de recursos y de obra": los cinco de la página 3, en orden, con la CSP
  // de siempre (hojas del mismo origen y la gema como `data:`).
  const icons = guide.locator('img.resource-icon');
  await expect(icons).toHaveCount(5);
  expect(await icons.evaluateAll((list) => list.map((i) => i.getAttribute('alt')))).toEqual([
    'gemas',
    'oro',
    'madera',
    'carne',
    'piedra',
  ]);
  for (let k = 4; k <= 7; k += 1) {
    await page.keyboard.press('ArrowRight');
    await expect(indicator).toHaveText(`${String(k)} de 7`);
  }
  await page.keyboard.press('ArrowRight');
  await expect(indicator).toHaveText('7 de 7');
  await expect(control('Siguiente')).toBeHidden();
  // Spec main-menu, "Guía entera en la ventana mínima y con escala ×2" (página 7) y
  // world-camera, "Redimensionado con la guía abierta": recuadro y botones enteros, centrados y
  // en la misma página.
  for (const size of [
    { width: 960, height: 540 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await waitFrames(page, 2);
    await expect(indicator).toHaveText('7 de 7');
    await expectInside(guide, size);
    for (const name of ['Anterior', 'Cerrar']) await expectInside(control(name), size);
    const box = await guide.boundingBox();
    if (!box) throw new Error('guía sin caja');
    expect(Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y + box.height / 2 - size.height / 2)).toBeLessThanOrEqual(1);
  }
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  await expect(menuPanel(page)).toBeVisible();
  expect(await menuPanel(page).getByRole('button').allTextContents()).toEqual(MENU_BUTTONS);
  await expect(menuButton(page, 'Cómo jugar')).toBeFocused();

  expect(nativeDialogs).toBe(0);
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(problems).toEqual([]);
});

test('Jugar desde el menú tras cerrar la guía: partida nueva en el tick 0 y Esc pausa', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await manualGame(page);
  await backToMenu(page);
  // Spec world-camera (0017), "Sonda en el menú": ventana y escala sin partida; cámara null.
  const inMenu = await probe(page);
  expect([inMenu?.viewport, inMenu?.camera]).toEqual([
    { width: 1280, height: 720, uiScale: 1, ...DESKTOP_VIEWPORT_EXTRA },
    null,
  ]);
  // Spec hud (0022), "Sin HUD en el menú": la sonda del HUD (oro y madera incluidos) vale null en
  // los frames del menú, porque la escena de la partida está parada.
  await waitFrames(page, 60);
  expect((await probe(page))?.hud).toBeNull();

  // Spec menu-guide (0028): con la guía abierta sigue el menú, sin HUD (sonda null); se cierra con
  // Esc y, después, "Jugar y pausa tras cerrar la guía".
  const guide = page.locator('.guide-modal');
  await menuButton(page, 'Cómo jugar').click();
  await expect(guide).toBeVisible();
  await waitFrames(page, 2);
  expect([(await probe(page))?.screen, (await probe(page))?.hud]).toEqual(['menu', null]);
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  await expect(pauseOverlay(page)).toBeHidden();
  expect([(await probe(page))?.screen, (await probe(page))?.hud]).toEqual(['menu', null]);

  await menuButton(page, 'Jugar').click();

  await expect(menuPanel(page)).toBeHidden();
  await expect.poll(async () => (await probe(page))?.runs).toBe(2);
  await waitForRun(page);
  expect((await probe(page))?.screen).toBe('playing');
  // "HUD tras volver al menú y jugar": en el tick 0 de la partida nueva, oro 0 y madera 0.
  expect((await probe(page))?.hud).toEqual({ gold: '0', wood: '0', stone: '0' });
  // Sin step la partida nueva sigue en su primer frame (modo manual).
  expect(await tickOf(page)).toBe(0);
  expect(await step(page, 30)).toBe(30);
  // Una sola pulsación de Esc, sin otro clic, pausa la partida nueva (la guía ya no escucha).
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeVisible();
  await expect(guide).toBeHidden();
  expect(problems).toEqual([]);
});

// Spec run-results, "Derrota y reinicio en el navegador". Semilla 42 sin input con la política de
// elección fija: derrota hacia el tick 4.762 (≈ 79 s de juego), dentro de los 120 s del plazo.
const GAME_TICKS_120_S = 120 * 60;

test('Derrota y reinicio: ?seed=42 sin input pierde, muestra resultados y R reinicia', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await manualGame(page);

  const ended = await playToEnd(page, GAME_TICKS_120_S);

  expect(ended?.outcome).toBe('lost');
  expect(ended?.tick).toBeLessThanOrEqual(GAME_TICKS_120_S);
  expect((await probe(page))?.results).toMatchObject({
    title: 'Derrota',
    time: mmss(ended?.tick ?? 0),
    level: ended?.progression.level,
    kills: ended?.kills,
  });

  await page.keyboard.press('r');
  await expect.poll(async () => (await probe(page))?.runs).toBe(2);
  const fresh = await probe(page);
  expect(fresh?.snapshot).toMatchObject({
    tick: 0,
    status: 'running',
    outcome: null,
    kills: 0,
    progression: { level: 1, xp: 0 },
  });
  expect(fresh?.results).toBeNull();
  expect(problems).toEqual([]);
});

/** Ticks antes de pausar: distingue la misma partida de una reiniciada. */
const MIN_TICK = 120;

async function pause(page: Page): Promise<SnapshotView> {
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeVisible();
  await expect.poll(async () => (await probe(page))?.screen).toBe('paused');
  return (await snapshotOf(page)) as SnapshotView;
}

test('Pausa con Esc: congela la partida, Esc reanuda y Volver al menú muestra el menú', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await manualGame(page);
  expect(await step(page, MIN_TICK)).toBe(MIN_TICK);

  const paused = await pause(page);
  expect(await step(page, 60)).toBe(0);
  expect(await snapshotOf(page)).toStrictEqual(paused);
  await expect(pauseOverlay(page).getByRole('button', { name: 'Reanudar' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeHidden();
  await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
  expect(await step(page, 1)).toBe(1);
  expect(await tickOf(page)).toBe(paused.tick + 1);

  await pause(page);
  await pauseOverlay(page).getByRole('button', { name: 'Volver al menú' }).click();
  await expect(menuPanel(page)).toBeVisible();
  await expect(pauseOverlay(page)).toBeHidden();
  expect((await probe(page))?.screen).toBe('menu');
  // 0026, "Sonda de solares en el menú": tras Volver al menú, `sites` vale null.
  expect((await probe(page))?.sites).toBeNull();
  expect(problems).toEqual([]);
});

// Spec simulation-loop, "Avance exacto", "Un solo tick" y "Más de 15 ticks en un step".
test('step(n) avanza exactamente n ticks (60, 1 y 225)', async ({ page }) => {
  await manualGame(page, 7);

  const sixty = await step(page, 60);
  const atSixty = await tickOf(page);
  const one = await step(page, 1);
  const atSixtyOne = await tickOf(page);
  const many = await step(page, 225);

  expect([sixty, atSixty, one, atSixtyOne, many, await tickOf(page)]).toEqual([
    60, 60, 1, 61, 225, 286,
  ]);
});
