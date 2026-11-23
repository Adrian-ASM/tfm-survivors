import { expect, test } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import {
  collect,
  gameUrl,
  probe,
  snapshotOf,
  startCameraSampler,
  stopCameraSampler,
  waitFrames,
} from './probe';

// Spec world-camera (0013): cámara que sigue al jugador dentro del mundo y su sonda E2E. Mundo y
// vista salen de content/arena.json (una sola fuente).
const VIEW = arena.view;
const WORLD = { width: arena.width, height: arena.height };
const FRAMES = 600;
/** Margen para frames que el muestreador no ve (no es la aserción: el recuento de frames). */
const MIN_SAMPLED = FRAMES - 10;

test('Scenario: Rectángulo coherente con el jugador (?e2e&seed=42, 600 frames)', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto(gameUrl({ seed: 42 }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();

  const first = await probe(page);
  expect(first?.world).toEqual(WORLD);
  expect(first?.camera).toMatchObject({ x: 480, y: 270, ...VIEW });

  await startCameraSampler(page, VIEW);
  await waitFrames(page, FRAMES);
  const sample = await stopCameraSampler(page);

  expect(sample.frames).toBeGreaterThanOrEqual(MIN_SAMPLED);
  expect(sample.mismatches).toEqual([]);
  expect(sample.outsideWorld).toBe(0);
  expect(problems).toEqual([]);
});
