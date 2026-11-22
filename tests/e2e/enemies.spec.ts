import { expect, test } from '@playwright/test';
import { collect, probe } from './probe';

const ARENA = { width: 960, height: 540 };
const MAX_SEED = 4294967295;

test('?seed=42: semilla 42, aparecen enemigos dentro de la arena y sin errores ni avisos', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto('./?e2e&seed=42');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(async () => (await probe(page))?.snapshot?.tick ?? null).not.toBeNull();

  expect((await probe(page))?.seed).toBe(42);
  await expect
    .poll(async () => (await probe(page))?.snapshot?.enemies.length ?? 0)
    .toBeGreaterThanOrEqual(1);

  const enemies = (await probe(page))?.snapshot?.enemies ?? [];
  for (const e of enemies) {
    expect(e.x).toBeGreaterThanOrEqual(e.radius);
    expect(e.x).toBeLessThanOrEqual(ARENA.width - e.radius);
    expect(e.y).toBeGreaterThanOrEqual(e.radius);
    expect(e.y).toBeLessThanOrEqual(ARENA.height - e.radius);
  }
  expect(problems).toEqual([]);
});

test('?seed=abc: exactamente 1 aviso que menciona seed y la partida avanza', async ({ page }) => {
  const warnings = collect(page, ['warning']);
  await page.goto('./?e2e&seed=abc');
  await expect.poll(async () => (await probe(page))?.snapshot?.tick ?? 0).toBeGreaterThan(30);

  const seed = (await probe(page))?.seed ?? -1;
  expect(Number.isInteger(seed)).toBe(true);
  expect(seed).toBeGreaterThanOrEqual(0);
  expect(seed).toBeLessThanOrEqual(MAX_SEED);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('seed');
});
