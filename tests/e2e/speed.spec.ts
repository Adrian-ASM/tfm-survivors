import { expect, test } from '@playwright/test';
import { collect, probe, snapshotOf } from './probe';

// Spec simulation-loop, "Velocidad de simulación en modo E2E": resolución en el navegador, sin
// partidas largas (el avance se prueba en Node con advanceFrame).
const mentions = (messages: string[], word: string): string[] =>
  messages.filter((m) => m.includes(word));

test(
  'Scenario: Velocidad válida en modo E2E (?e2e&speed=8: speed 8 y sin avisos)',
  { tag: '@realtime' },
  async ({ page }) => {
    const warnings = collect(page, ['warning']);
    await page.goto('./?e2e&speed=8');
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(0);

    expect((await probe(page))?.speed).toBe(8);
    expect(mentions(warnings, 'speed')).toEqual([]);
  },
);

test(
  'Scenario: Avisos independientes de seed y speed (1 aviso de cada uno)',
  { tag: '@realtime' },
  async ({ page }) => {
    const warnings = collect(page, ['warning']);
    await page.goto('./?e2e&seed=abc&speed=abc');
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(0);

    expect((await probe(page))?.speed).toBe(1);
    expect(mentions(warnings, 'seed')).toHaveLength(1);
    expect(mentions(warnings, 'speed')).toHaveLength(1);
  },
);

test(
  'Scenario: Velocidad inválida ignorada fuera de E2E (?speed=abc: 0 avisos)',
  { tag: '@realtime' },
  async ({ page }) => {
    const warnings = collect(page, ['warning']);
    await page.goto('./?speed=abc');
    await expect(page.locator('#game canvas')).toBeVisible();
    // Sin ?e2e no hay probe: se deja correr un momento para que cualquier aviso llegue a la consola.
    await page.waitForTimeout(500);

    expect(await probe(page)).toBeNull();
    expect(mentions(warnings, 'speed')).toEqual([]);
  },
);
