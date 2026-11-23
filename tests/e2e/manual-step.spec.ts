import { expect, test, type Page } from '@playwright/test';
import {
  collect,
  focusGame,
  menuButton,
  playChoosingFirst,
  playerUrl,
  probe,
  snapshotOf,
  step,
  ticksPerFrame,
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
