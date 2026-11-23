import { expect, test, type Page } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import {
  CORNERS,
  E2E_SPEED,
  backToMenu,
  collect,
  cornerTour,
  expectSpeed,
  firstFrameOfNextRun,
  focusGame,
  gameUrl,
  menuButton,
  playChoosingFirst,
  probe,
  snapshotOf,
  startCameraSampler,
  stopCameraSampler,
  waitFrames,
  walkToCorner,
  watchNextRun,
  type FirstFrameView,
  type SnapshotView,
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

test('Scenario: Nada fuera del mundo en una partida real (?e2e&seed=7, cuatro esquinas)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = collect(page, ['error', 'warning']);

  const { walked, sample } = await cornerTour(page, VIEW, WORLD);

  expect(walked).toEqual(['tl', 'tr', 'br', 'bl']);
  expect([...sample.corners].sort()).toEqual(['bl', 'br', 'tl', 'tr']);
  expect(sample.mismatches).toEqual([]);
  expect(sample.outsideWorld).toBe(0);
  expect(problems).toEqual([]);
});

/** Esquina inferior derecha del recorrido (jugador en (W − r, H − r)). */
const BOTTOM_RIGHT = CORNERS.find((c) => c.name === 'br');
/** Margen de reloj (no es la aserción): llegar a la esquina y perder quieto a E2E_SPEED. */
const CORNER_TIMEOUT_MS = 20_000;
const DEFEAT_TIMEOUT_MS = 60_000;

/** Partida en `?e2e&seed=7` a E2E_SPEED con el jugador llevado a la esquina inferior derecha. */
async function toBottomRight(page: Page): Promise<SnapshotView | null> {
  if (!BOTTOM_RIGHT) throw new Error('Sin esquina br');
  await page.goto(gameUrl({ seed: 7, speed: E2E_SPEED }));
  await expectSpeed(page, E2E_SPEED);
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  return walkToCorner(page, BOTTOM_RIGHT, WORLD, CORNER_TIMEOUT_MS);
}

/** Lo que exige la spec del primer frame de una partida nueva: jugador y cámara en el centro. */
function expectCentered(frame: FirstFrameView): void {
  // Primer frame pintado: a E2E_SPEED ya lleva hasta 8 ticks; sin input, el jugador no se ha movido.
  expect(frame.snapshot?.tick).toBeLessThanOrEqual(E2E_SPEED);
  expect([frame.snapshot?.player.x, frame.snapshot?.player.y]).toEqual([
    WORLD.width / 2,
    WORLD.height / 2,
  ]);
  expect(frame.camera).toEqual({
    x: (WORLD.width - VIEW.width) / 2,
    y: (WORLD.height - VIEW.height) / 2,
    ...VIEW,
  });
}

test('Scenario: Partida nueva tras acabar en una esquina (R tras perder en (1.904, 1.064))', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = collect(page, ['error', 'warning']);
  const corner = await toBottomRight(page);
  expect([corner?.player.x, corner?.player.y]).toEqual([WORLD.width - 16, WORLD.height - 16]);

  const ended = await playChoosingFirst(page, (s) => s.status === 'over', DEFEAT_TIMEOUT_MS);
  expect(ended?.outcome).toBe('lost');
  expect((await probe(page))?.camera).toMatchObject({ x: WORLD.width - VIEW.width });
  await watchNextRun(page);
  await page.keyboard.press('r');

  expectCentered(await firstFrameOfNextRun(page));
  expect(problems).toEqual([]);
});

test('Scenario: Partida nueva tras acabar en una esquina (Volver al menú y Jugar)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = collect(page, ['error', 'warning']);
  const corner = await toBottomRight(page);
  expect(corner).not.toBeNull();

  await backToMenu(page);
  expect((await probe(page))?.camera).toBeNull();
  await watchNextRun(page);
  await menuButton(page, 'Jugar').click();

  expectCentered(await firstFrameOfNextRun(page));
  expect(problems).toEqual([]);
});
