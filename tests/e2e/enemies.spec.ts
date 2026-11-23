import { expect, test } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import {
  collect,
  probe,
  snapshotOf,
  startCameraSampler,
  stopCameraSampler,
  waitFrames,
} from './probe';

/** Mundo y vista del contenido (una sola fuente, spec run-outcome 0013). */
const ARENA = { width: arena.width, height: arena.height };
const VIEW = arena.view;
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

// Spec enemy-spawning (0013), "Fuera de pantalla en una partida real": con el jugador quieto en el
// centro, ninguna aparición cae dentro del rectángulo visible (480, 270)–(1.440, 810).
test('Scenario: Fuera de pantalla en una partida real (?e2e&seed=42, sin input, 600 frames)', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto('./?e2e&seed=42');
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await startCameraSampler(page, VIEW);
  await waitFrames(page, 600);
  const sample = await stopCameraSampler(page);

  const visible = sample.firstSeen.filter(
    ({ x, y, camera }) =>
      x > camera.x && x < camera.x + camera.width && y > camera.y && y < camera.y + camera.height,
  );
  expect(sample.firstSeen.length).toBeGreaterThan(0);
  const centered = { x: (ARENA.width - VIEW.width) / 2, y: (ARENA.height - VIEW.height) / 2 };
  expect(
    sample.firstSeen.every(({ camera }) => camera.x === centered.x && camera.y === centered.y),
  ).toBe(true);
  expect(visible).toEqual([]);
  expect(problems).toEqual([]);
});
