import { type Page } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import player from '../../content/player.json' with { type: 'json' };
import { expect, test } from './fixtures';
import { cardLayout } from '../../src/infrastructure/phaser/cardLayout';
import {
  backToMenu,
  collect,
  expectManual,
  focusGame,
  gameUrl,
  holdKey,
  menuButton,
  pauseOverlay,
  playChoosingFirst,
  playToEnd,
  playerUrl,
  probe,
  snapshotOf,
  step,
  stepUntil,
  ticksPerFrame,
  waitForRun,
  waitFrames,
} from './probe';

// Spec simulation-loop (change 0014): modo de avance manual `?e2e&manual` y `step(n)`. Las
// reglas exactas de tick se prueban en Node (advance-ticks, manual-stepper); aquí, la sonda, los
// avisos y el cableado. Lo marcado `@realtime` depende de frames o de tiempo reales.

const mentions = (messages: string[], word: string): string[] =>
  messages.filter((m) => m.includes(word));

/** Captura del canvas (sin sonda: la única forma de ver que la partida avanza). */
const canvasShot = (page: Page): Promise<Buffer> => page.locator('#game canvas').screenshot();

/** Partida en modo manual con la semilla dada, ya creada y con el foco en el canvas. */
async function manualGame(page: Page, url = gameUrl({ seed: 7, manual: true })): Promise<void> {
  await page.goto(url);
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);
}

const tickOf = async (page: Page): Promise<number | null> => (await snapshotOf(page))?.tick ?? null;

/**
 * Semilla 7 sin input, política de elección fija, mundo 2x de 0013 (medido en Node): ofertas en
 * los ticks 4.346 y 4.688 y derrota en el 4.885.
 */
const SEED7_FIRST_OFFER = 4346;
const SEED7_LAST_OFFER = 4688;
const SEED7_END = 4885;
/**
 * `step` de "Oferta a mitad de step": mayor que k. La spec dice 3.600, que era mayor que la
 * primera oferta antes del mundo 2x (3.332); con 0013 se usa el plazo de level-up (80 s).
 */
const OFFER_STEP = 80 * 60;
/** Tick desde el que "Oferta en el último tick del step" pide justo los que faltan. */
const BEFORE_OFFER = 4000;
/** Paso del jugador por tick a la velocidad del contenido (player.json, 210 px/s desde 0015). */
const STEP_PX = player.speed / 60;
const START_X = arena.width / 2;

/** Clic en la carta de índice `i` del overlay (posición de `cardLayout`, escalada al canvas). */
async function clickCard(page: Page, i: number, count: number): Promise<void> {
  const canvas = page.locator('#game canvas');
  const box = await canvas.boundingBox();
  // Tamaño del canvas en unidades de la vista (la composición lo crea con `arena.view`).
  const view = await canvas.evaluate((c: HTMLCanvasElement) => ({
    width: c.width,
    height: c.height,
  }));
  const card = cardLayout(view, count)[i];
  if (!box || !card) throw new Error('Sin canvas o sin carta');
  const position = { x: (card.x * box.width) / view.width, y: (card.y * box.height) / view.height };
  await canvas.click({ position });
}

/** Dos `step(30)` en el mismo `evaluate`: la segunda llega antes de que termine la primera. */
const twoSteps = (page: Page): Promise<number[]> =>
  page.evaluate(() => {
    const s = (window as unknown as { __sprint: { step: (n: number) => Promise<number> } }).__sprint
      .step;
    return Promise.all([s(30), s(30)]);
  });

test.describe('Resolución de manual', () => {
  for (const value of ['', '=1', '=true']) {
    test(`Scenario: Modo manual activo (?e2e&manual${value}&seed=7)`, async ({ page }) => {
      const warnings = collect(page, ['warning']);
      await page.goto(`./?e2e&map=empty&manual${value}&seed=7`);
      await waitForRun(page);

      const p = await probe(page);
      expect([p?.manual, p?.seed]).toEqual([true, 7]);
      expect(mentions(warnings, 'manual')).toEqual([]);
    });
  }

  for (const raw of ['0', 'false', 'abc', '2']) {
    test(`Scenario: Valor de manual inválido en modo E2E (manual=${raw})`, async ({ page }) => {
      const warnings = collect(page, ['warning']);
      await page.goto(`./?e2e&map=empty&manual=${raw}&seed=7`);
      await waitForRun(page);

      expect((await probe(page))?.manual).toBe(false);
      expect(mentions(warnings, 'manual')).toHaveLength(1);
    });
  }

  test('Scenario: Avisos independientes de seed, speed y manual (1 de cada)', async ({ page }) => {
    const warnings = collect(page, ['warning']);
    await page.goto('./?e2e&map=empty&seed=abc&manual=abc&speed=abc');
    await waitForRun(page);

    expect((await probe(page))?.manual).toBe(false);
    expect(mentions(warnings, 'seed')).toHaveLength(1);
    expect(mentions(warnings, 'manual')).toHaveLength(1);
    expect(mentions(warnings, 'speed')).toHaveLength(1);
  });
});

test.describe('Sin modo manual', { tag: '@realtime' }, () => {
  test('Scenario: Step sin modo manual (step(60): 0, 1 aviso de manual y ~1 tick por frame)', async ({
    page,
  }) => {
    const warnings = collect(page, ['warning']);
    await page.goto('./?e2e&map=empty&seed=7');
    await waitForRun(page);

    expect(await step(page, 60)).toBe(0);
    const pace = await ticksPerFrame(page);

    expect(mentions(warnings, 'manual')).toHaveLength(1);
    expect(pace).toBeGreaterThan(0.5);
    expect(pace).toBeLessThan(1.5);
  });

  test('Scenario: Manual inválido no anula speed (?e2e&manual=abc&speed=8)', async ({ page }) => {
    await page.goto('./?e2e&map=empty&manual=abc&speed=8&seed=7');
    await waitForRun(page);

    expect((await probe(page))?.speed).toBe(8);
    expect(await ticksPerFrame(page)).toBeGreaterThan(2);
  });

  for (const search of ['?manual', '?manual=1&seed=42', '?manual=abc']) {
    test(`Scenario: Manual ignorado fuera de E2E (${search})`, async ({ page }) => {
      const warnings = collect(page, ['warning']);
      await page.goto(playerUrl(search));
      await menuButton(page, 'Jugar').click();
      const first = await canvasShot(page);

      // Sin sonda: la partida avanza si el canvas cambia (animaciones, oleadas).
      await expect.poll(async () => (await canvasShot(page)).equals(first)).toBe(false);
      expect(await page.evaluate(() => '__sprint' in window)).toBe(false);
      expect(mentions(warnings, 'manual')).toEqual([]);
      // El guardado al terminar se prueba en Node (tests/composition/manual-outside-e2e.test.ts):
      // jugarla aquí entera sin sonda ni speed cuesta minutos de CPU (W7).
    });
  }

  test('Scenario: Manual inválido y varios reinicios (3 R: 1 aviso de manual en total)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const warnings = collect(page, ['warning']);
    await page.goto('./?e2e&map=empty&manual=abc&speed=15&seed=42');
    await waitForRun(page);
    await focusGame(page);

    for (let r = 1; r <= 3; r++) {
      const ended = await playChoosingFirst(page, (s) => s.status === 'over', 50_000);
      expect(ended).not.toBeNull();
      await page.keyboard.press('r');
      await expect.poll(async () => (await probe(page))?.runs).toBe(1 + r);
    }

    expect((await probe(page))?.manual).toBe(false);
    expect(mentions(warnings, 'manual')).toHaveLength(1);
  });
});

test.describe('Avance manual con step', () => {
  test('Scenario: Avance exacto y Un solo tick (step(60): 60; step(1): 61)', async ({ page }) => {
    await manualGame(page);

    const sixty = await step(page, 60);
    const atSixty = await tickOf(page);
    const one = await step(page, 1);

    expect([sixty, atSixty, one, await tickOf(page)]).toEqual([60, 60, 1, 61]);
  });

  test('Scenario: Más de 15 ticks en un step (step(225): 225)', async ({ page }) => {
    await manualGame(page);

    expect(await step(page, 225)).toBe(225);
    expect(await tickOf(page)).toBe(225);
  });

  test('Scenario: Manual gana a speed (120 frames sin step: tick 0; step(10): 10)', async ({
    page,
  }) => {
    await manualGame(page, './?e2e&map=empty&manual&speed=8&seed=7');

    await waitFrames(page, 120);
    const idle = await tickOf(page);

    expect([(await probe(page))?.speed, idle]).toEqual([1, 0]);
    expect(await step(page, 10)).toBe(10);
    expect(await tickOf(page)).toBe(10);
  });

  test('Scenario: Manual con speed inválida (?e2e&manual&speed=abc: sin aviso de speed)', async ({
    page,
  }) => {
    const warnings = collect(page, ['warning']);
    await manualGame(page, './?e2e&map=empty&manual&speed=abc&seed=7');

    expect(await step(page, 10)).toBe(10);
    expect((await probe(page))?.speed).toBe(1);
    expect(mentions(warnings, 'speed')).toEqual([]);
  });

  test('Scenario: n inválido (7 llamadas: 0 cada una, 7 avisos de step y snapshot igual)', async ({
    page,
  }) => {
    const warnings = collect(page, ['warning']);
    await manualGame(page);
    await step(page, 30);
    const before = await snapshotOf(page);

    const results = await page.evaluate(async () => {
      const s = (window as unknown as { __sprint: { step: (n?: unknown) => Promise<number> } })
        .__sprint.step;
      return Promise.all([s(0), s(-1), s(2.5), s(NaN), s(Infinity), s('10'), s()]);
    });

    expect(results).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(await snapshotOf(page)).toStrictEqual(before);
    expect(mentions(warnings, 'step')).toHaveLength(7);
  });

  test('Scenario: n muy grande (step(MAX_SAFE_INTEGER) hasta el fin, sin avisos de step)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const warnings = collect(page, ['warning']);
    await manualGame(page);
    let snap = await snapshotOf(page);
    let start = 0;
    let last = 0;

    // Semilla 7: ofertas en 4.346 y 4.688 (política de elección fija); fin en 4.885.
    while (snap && snap.status !== 'over') {
      if (snap.status === 'choosing') await page.keyboard.press('1');
      start = snap.tick;
      last = await step(page, Number.MAX_SAFE_INTEGER);
      snap = await snapshotOf(page);
    }

    expect(snap?.status).toBe('over');
    expect(last).toBeGreaterThan(0);
    expect(snap?.tick).toBe(start + last);
    expect(mentions(warnings, 'step')).toEqual([]);
  });
});

test.describe('Estados de la partida en modo manual', () => {
  test('Scenario: Oferta a mitad de step (step(4800): k con oferta; 0 sin elegir; 10 tras elegir)', async ({
    page,
  }) => {
    await manualGame(page);

    const k = await step(page, OFFER_STEP);
    const offered = await snapshotOf(page);
    const blocked = await step(page, 10);
    const still = await tickOf(page);
    await page.keyboard.press('1');
    const after = await step(page, 10);

    expect(k).toBe(SEED7_FIRST_OFFER);
    expect(k).toBeLessThan(OFFER_STEP);
    expect([offered?.tick, offered?.status, offered?.offer.length]).toEqual([k, 'choosing', 3]);
    expect([blocked, still]).toEqual([0, k]);
    expect([after, await tickOf(page)]).toEqual([10, k + 10]);
  });

  test('Scenario: Oferta en el último tick del step (desde 4.000, step(346): 346 eligiendo)', async ({
    page,
  }) => {
    await manualGame(page);
    await step(page, BEFORE_OFFER);

    const r = await step(page, SEED7_FIRST_OFFER - BEFORE_OFFER);
    const snap = await snapshotOf(page);

    expect([r, snap?.tick, snap?.status]).toEqual([
      SEED7_FIRST_OFFER - BEFORE_OFFER,
      SEED7_FIRST_OFFER,
      'choosing',
    ]);
  });

  test('Scenario: Fin de partida a mitad de step (resultados e historial al resolver; luego 0)', async ({
    page,
  }) => {
    await manualGame(page);
    // Hasta la última oferta antes del fin; después se elige y un solo step cruza el fin.
    const lastOffer = await stepUntil(
      page,
      (s) => s.tick >= SEED7_LAST_OFFER && s.status === 'choosing',
      SEED7_END,
    );
    await page.keyboard.press('1');

    const m = await step(page, SEED7_END - (lastOffer?.tick ?? 0) + 1000);
    const atEnd = await probe(page);
    const visible = await page.locator('.results-panel').isVisible();
    const later = await step(page, 10);

    expect(m).toBe(SEED7_END - (lastOffer?.tick ?? 0));
    expect([atEnd?.snapshot?.tick, atEnd?.snapshot?.status, atEnd?.snapshot?.outcome]).toEqual([
      SEED7_END,
      'over',
      'lost',
    ]);
    expect(atEnd?.results).not.toBeNull();
    expect(visible).toBe(true);
    expect(atEnd?.progress?.history).toHaveLength(1);
    expect([later, await tickOf(page)]).toEqual([0, SEED7_END]);
  });

  test('playToEnd juega hasta el fin con la política de elección fija', async ({ page }) => {
    await manualGame(page);

    const ended = await playToEnd(page);

    expect([ended?.tick, ended?.status]).toEqual([SEED7_END, 'over']);
    expect((await probe(page))?.progress?.history).toHaveLength(1);
  });

  test('Scenario: Pausa sin step y Step en pausa (Esc: pausa en n; step(60): 0; Esc y step(1))', async ({
    page,
  }) => {
    await manualGame(page);
    await step(page, 100);
    const before = await snapshotOf(page);

    await page.keyboard.press('Escape');
    await expect.poll(async () => (await probe(page))?.screen).toBe('paused');
    await expect(pauseOverlay(page)).toBeVisible();
    const paused = await snapshotOf(page);
    const inPause = await step(page, 60);
    const unchanged = await snapshotOf(page);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
    const one = await step(page, 1);

    expect(paused).toStrictEqual(before);
    expect(inPause).toBe(0);
    expect(unchanged).toStrictEqual(before);
    expect([one, await tickOf(page)]).toEqual([1, 101]);
  });

  test('Scenario: Elección sin step (clic en la carta 0: oferta cerrada, mismo tick)', async ({
    page,
  }) => {
    await manualGame(page);
    const offered = await stepUntil(page, (s) => s.status === 'choosing', OFFER_STEP);
    const id = offered?.offer[0]?.id;

    await clickCard(page, 0, offered?.offer.length ?? 0);
    await expect.poll(async () => (await snapshotOf(page))?.offer.length).toBe(0);
    const after = await snapshotOf(page);

    expect([after?.tick, after?.status]).toEqual([offered?.tick, 'running']);
    expect(after?.upgrades).toEqual([{ id, level: 1 }]);
  });

  test('Scenario: Step en el menú (tras Volver al menú: 0 y ninguna partida nueva)', async ({
    page,
  }) => {
    await manualGame(page);
    await step(page, 50);
    await backToMenu(page);
    const runs = (await probe(page))?.runs;

    expect(await step(page, 60)).toBe(0);
    await waitFrames(page, 10);
    expect([(await probe(page))?.runs, (await probe(page))?.screen]).toEqual([runs, 'menu']);
  });

  test('Scenario: Llamadas simultáneas ([30, 30] y tick 60)', async ({ page }) => {
    await manualGame(page);

    expect(await twoSteps(page)).toEqual([30, 30]);
    expect(await tickOf(page)).toBe(60);
  });

  test('Scenario: Llamada simultánea que encuentra la oferta (oferta en 20: [20, 0])', async ({
    page,
  }) => {
    await manualGame(page);
    await step(page, SEED7_FIRST_OFFER - 20);

    expect(await twoSteps(page)).toEqual([20, 0]);
    const snap = await snapshotOf(page);
    expect([snap?.tick, snap?.status]).toEqual([SEED7_FIRST_OFFER, 'choosing']);
  });

  test('Scenario: Input leído al empezar el step (flecha derecha en step(8))', async ({ page }) => {
    await manualGame(page);
    const x0 = (await snapshotOf(page))?.player.x;

    expect(await holdKey(page, 'ArrowRight', 8)).toBe(8);

    expect(x0).toBe(START_X);
    expect((await snapshotOf(page))?.player.x).toBeCloseTo(START_X + 8 * STEP_PX, 2);
  });

  test('Scenario: Pulsación sin step entre medias (pulsar y soltar; step(8): x igual)', async ({
    page,
  }) => {
    await manualGame(page);

    await page.keyboard.press('ArrowRight');
    expect(await step(page, 8)).toBe(8);

    expect((await snapshotOf(page))?.player.x).toBeCloseTo(START_X, 3);
  });

  test('Scenario: Reinicio sin step (R tras el fin: partida nueva en el tick 0)', async ({
    page,
  }) => {
    await manualGame(page);
    await playToEnd(page);

    await page.keyboard.press('r');
    await expect.poll(async () => (await probe(page))?.runs).toBe(2);
    await waitFrames(page, 120);

    const snap = await snapshotOf(page);
    expect([snap?.tick, snap?.status]).toEqual([0, 'running']);
    expect(await step(page, 10)).toBe(10);
    expect(await tickOf(page)).toBe(10);
  });

  test('Scenario: Manual tras volver al menú (tick 50, menú, Jugar, 120 frames: tick 0)', async ({
    page,
  }) => {
    await manualGame(page);
    await step(page, 50);
    await backToMenu(page);

    await menuButton(page, 'Jugar').click();
    await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
    await waitForRun(page);
    await waitFrames(page, 120);

    expect(await tickOf(page)).toBe(0);
    expect(await step(page, 10)).toBe(10);
    expect(await tickOf(page)).toBe(10);
  });
});

test.describe('Sin avance por tiempo real', { tag: '@realtime' }, () => {
  test('Scenario: Reinicio sin step y Manual tras reiniciar con R (2 s reales: tick 0)', async ({
    page,
  }) => {
    await manualGame(page);
    await playToEnd(page);

    await page.keyboard.press('r');
    await expect.poll(async () => (await probe(page))?.runs).toBe(2);
    await page.waitForTimeout(2_000);

    expect(await tickOf(page)).toBe(0);
    expect(await step(page, 10)).toBe(10);
    expect(await tickOf(page)).toBe(10);
  });

  test('Scenario: Sin step no avanza (2 s reales: tick 0)', async ({ page }) => {
    await manualGame(page);

    await page.waitForTimeout(2_000);

    expect(await tickOf(page)).toBe(0);
  });

  test('Scenario: Avance exacto (2 s reales tras step(60): sigue en 60)', async ({ page }) => {
    await manualGame(page);
    await step(page, 60);

    await page.waitForTimeout(2_000);

    expect(await tickOf(page)).toBe(60);
  });
});
