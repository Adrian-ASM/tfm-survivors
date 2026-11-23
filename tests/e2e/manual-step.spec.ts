import { expect, test, type Page } from '@playwright/test';
import {
  collect,
  expectManual,
  focusGame,
  gameUrl,
  menuButton,
  playChoosingFirst,
  playerUrl,
  probe,
  snapshotOf,
  step,
  ticksPerFrame,
  waitFrames,
} from './probe';

// Spec simulation-loop (change 0014): modo de avance manual `?e2e&manual` y `step(n)`. Las
// reglas exactas de tick se prueban en Node (advance-ticks, manual-stepper); aquí, la sonda, los
// avisos y el cableado. Lo marcado `@realtime` depende de frames o de tiempo reales.

const mentions = (messages: string[], word: string): string[] =>
  messages.filter((m) => m.includes(word));

/** Espera a que la partida de la carga exista (evento: snapshot no nulo, sin reloj del tick). */
async function waitForRun(page: Page): Promise<void> {
  await expect.poll(async () => (await snapshotOf(page)) !== null).toBe(true);
}

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

test.describe('Resolución de manual', () => {
  for (const value of ['', '=1', '=true']) {
    test(`Scenario: Modo manual activo (?e2e&manual${value}&seed=7)`, async ({ page }) => {
      const warnings = collect(page, ['warning']);
      await page.goto(`./?e2e&manual${value}&seed=7`);
      await waitForRun(page);

      const p = await probe(page);
      expect([p?.manual, p?.seed]).toEqual([true, 7]);
      expect(mentions(warnings, 'manual')).toEqual([]);
    });
  }

  for (const raw of ['0', 'false', 'abc', '2']) {
    test(`Scenario: Valor de manual inválido en modo E2E (manual=${raw})`, async ({ page }) => {
      const warnings = collect(page, ['warning']);
      await page.goto(`./?e2e&manual=${raw}&seed=7`);
      await waitForRun(page);

      expect((await probe(page))?.manual).toBe(false);
      expect(mentions(warnings, 'manual')).toHaveLength(1);
    });
  }

  test('Scenario: Avisos independientes de seed, speed y manual (1 de cada)', async ({ page }) => {
    const warnings = collect(page, ['warning']);
    await page.goto('./?e2e&seed=abc&manual=abc&speed=abc');
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
    await page.goto('./?e2e&seed=7');
    await waitForRun(page);

    expect(await step(page, 60)).toBe(0);
    const pace = await ticksPerFrame(page);

    expect(mentions(warnings, 'manual')).toHaveLength(1);
    expect(pace).toBeGreaterThan(0.5);
    expect(pace).toBeLessThan(1.5);
  });

  test('Scenario: Manual inválido no anula speed (?e2e&manual=abc&speed=8)', async ({ page }) => {
    await page.goto('./?e2e&manual=abc&speed=8&seed=7');
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
    });
  }

  test('Scenario: Manual inválido y varios reinicios (3 R: 1 aviso de manual en total)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const warnings = collect(page, ['warning']);
    await page.goto('./?e2e&manual=abc&speed=15&seed=42');
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
    await manualGame(page, './?e2e&manual&speed=8&seed=7');

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
    await manualGame(page, './?e2e&manual&speed=abc&seed=7');

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

    // Semilla 7: ofertas en 3.332, 4.233 y 4.743 (política de elección fija); fin en 4.769.
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

test.describe('Sin avance por tiempo real', { tag: '@realtime' }, () => {
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
