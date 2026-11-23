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
  menuPanel,
  pauseOverlay,
  playChoosingFirst,
  probe,
  snapshotOf,
  startCameraSampler,
  stopCameraSampler,
  toScreen,
  waitFrames,
  walkToCorner,
  watchNextRun,
  type FirstFrameView,
  type SnapshotView,
} from './probe';
import { cardLayout } from '../../src/infrastructure/phaser/cardLayout';

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

/** Esquina por nombre del recorrido. */
const cornerNamed = (name: string) => {
  const c = CORNERS.find((x) => x.name === name);
  if (!c) throw new Error(`Sin esquina ${name}`);
  return c;
};

/** Partida `?e2e&seed=7` a E2E_SPEED con el jugador llevado a la esquina dada. */
async function atCorner(page: Page, name: string): Promise<SnapshotView | null> {
  await page.goto(gameUrl({ seed: 7, speed: E2E_SPEED }));
  await expectSpeed(page, E2E_SPEED);
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  return walkToCorner(page, cornerNamed(name), WORLD, CORNER_TIMEOUT_MS);
}

/** Espera sin input (y sin elegir) a que se abra una oferta; null si termina antes. */
async function waitOffer(page: Page): Promise<SnapshotView | null> {
  const deadline = Date.now() + DEFEAT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const snap = await snapshotOf(page);
    if (snap?.status === 'over') return null;
    if (snap && snap.offer.length === 3) return snap;
    await page.waitForTimeout(50);
  }
  return null;
}

/**
 * La cámara de referencia es la de (480, 270), recortada en (0, 0): la misma que en la esquina
 * superior izquierda, que se alcanza con el mismo recorrido de teclado.
 */
const REFERENCE = 'tl';

test.describe('HUD y overlays con la cámara movida', () => {
  test.setTimeout(120_000);

  for (const [name, cameraAt] of [
    ['br', { x: WORLD.width - VIEW.width, y: WORLD.height - VIEW.height }],
    [REFERENCE, { x: 0, y: 0 }],
  ] as const) {
    test(`Scenario: Overlay de elección con la cámara movida (clic en la 3.ª carta, esquina ${name})`, async ({
      page,
    }) => {
      const problems = collect(page, ['error', 'warning']);
      expect(await atCorner(page, name)).not.toBeNull();

      const offered = await waitOffer(page);
      expect(offered).not.toBeNull();
      expect((await probe(page))?.camera).toMatchObject(cameraAt);
      const third = cardLayout(VIEW, 3)[2];
      await page
        .locator('#game canvas')
        .click({ position: { x: third?.x ?? 0, y: third?.y ?? 0 } });

      await expect.poll(async () => (await snapshotOf(page))?.offer.length).toBe(0);
      const after = await snapshotOf(page);
      const chosen = offered?.offer[2];
      expect(after?.upgrades).toContainEqual({ id: chosen?.id, level: chosen?.nextLevel });
      expect(problems).toEqual([]);
    });
  }

  test('Scenario: Resultados y pausa con la cámara movida ((1.904, 16) frente a la referencia)', async ({
    page,
  }) => {
    const boxes: Record<string, { canvas: unknown; pause: unknown; results: unknown }> = {};
    for (const name of ['tr', REFERENCE]) {
      expect(await atCorner(page, name)).not.toBeNull();
      await page.keyboard.press('Escape');
      await expect(pauseOverlay(page)).toBeVisible();
      const pause = await pauseOverlay(page).boundingBox();
      await pauseOverlay(page).getByRole('button', { name: 'Reanudar' }).click();
      await focusGame(page);
      const ended = await playChoosingFirst(page, (s) => s.status === 'over', DEFEAT_TIMEOUT_MS);
      expect(ended?.outcome).toBe('lost');
      await expect(page.locator('.results-panel')).toBeVisible();
      boxes[name] = {
        canvas: await page.locator('#game canvas').boundingBox(),
        pause,
        results: await page.locator('.results-panel').boundingBox(),
      };
    }
    expect(boxes.tr).toEqual(boxes[REFERENCE]);

    expect(await atCorner(page, 'tr')).not.toBeNull();
    await backToMenu(page);
    await expect(menuPanel(page)).toBeVisible();
  });
});

// Spec world-camera (0013), "Elementos de la partida en coordenadas de mundo": pantalla = mundo −
// esquina del rectángulo visible de la sonda.
test('Scenario: Enemigo a la derecha del jugador ((1.200, 600) → pantalla (720, 330))', async ({
  page,
}) => {
  await page.goto(gameUrl({ seed: 42 }));
  await expect.poll(async () => (await probe(page))?.camera ?? null).not.toBeNull();
  const camera = (await probe(page))?.camera;
  if (!camera) throw new Error('Sin cámara');

  expect(toScreen({ x: 1200, y: 600 }, camera)).toEqual({ x: 720, y: 330 });
});

test('Scenario: Jugador junto a una esquina ((16, 1.064) → pantalla (16, 524))', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const at = await atCorner(page, 'bl');
  const camera = (await probe(page))?.camera;
  if (!at || !camera) throw new Error('Sin esquina o sin cámara');

  expect([at.player.x, at.player.y]).toEqual([16, WORLD.height - 16]);
  expect(toScreen(at.player, camera)).toEqual({ x: 16, y: VIEW.height - 16 });
});
