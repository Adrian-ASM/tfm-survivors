import type { Page } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import { expect, test } from './fixtures';
import {
  CORNERS,
  collect,
  cornerTour,
  expectManual,
  focusGame,
  gameUrl,
  menuButton,
  menuPanel,
  pauseOverlay,
  playToEnd,
  probe,
  snapshotOf,
  startCameraSampler,
  stepToCorner,
  stepUntil,
  stopCameraSampler,
  toScreen,
  waitForRun,
  waitFrames,
  type SnapshotView,
} from './probe';
import { cardLayout } from '../../src/infrastructure/phaser/cardLayout';

// Spec world-camera (0013): cámara que sigue al jugador dentro del mundo y su sonda E2E. Mundo y
// vista salen de content/arena.json (una sola fuente). Change 0014: los dos primeros tests muestrean
// la cámara en cada frame real pintado (@realtime); el resto son reglas y van en modo manual. La
// cámara sigue al jugador sin suavizado (CameraRig, DIRECT_FOLLOW): al terminar un `step`, su
// rectángulo es el del snapshot pintado.
const VIEW = arena.view;
const WORLD = { width: arena.width, height: arena.height };
const FRAMES = 600;
/** Margen para frames que el muestreador no ve (no es la aserción: el recuento de frames). */
const MIN_SAMPLED = FRAMES - 10;
/** Tope de ticks para esperar una oferta o el fin desde una esquina (duración de la partida). */
const MAX_TICKS = 36_000;

test(
  'Scenario: Rectángulo coherente con el jugador (?e2e&seed=42, 600 frames)',
  { tag: '@realtime' },
  async ({ page }) => {
    const problems = collect(page, ['error', 'warning']);
    await page.goto(gameUrl({ seed: 42 }));
    await waitForRun(page);

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
  },
);

test(
  'Scenario: Nada fuera del mundo en una partida real (?e2e&seed=7, cuatro esquinas)',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(90_000);
    const problems = collect(page, ['error', 'warning']);

    const { walked, sample } = await cornerTour(page, VIEW, WORLD);

    expect(walked).toEqual(['tl', 'tr', 'br', 'bl']);
    expect([...sample.corners].sort()).toEqual(['bl', 'br', 'tl', 'tr']);
    expect(sample.mismatches).toEqual([]);
    expect(sample.outsideWorld).toBe(0);
    expect(problems).toEqual([]);
  },
);

/** Esquina por nombre del recorrido. */
const cornerNamed = (name: string) => {
  const c = CORNERS.find((x) => x.name === name);
  if (!c) throw new Error(`Sin esquina ${name}`);
  return c;
};

/** Partida `?e2e&manual&seed=7` con el jugador llevado a la esquina dada. */
async function atCorner(page: Page, name: string): Promise<SnapshotView | null> {
  await page.goto(gameUrl({ seed: 7, manual: true }));
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);
  return stepToCorner(page, cornerNamed(name), WORLD);
}

/** Lo que exige la spec de una partida nueva: tick 0, jugador y cámara en el centro. */
async function expectCentered(page: Page): Promise<void> {
  const fresh = await probe(page);
  // Sin step la partida nueva sigue en su primer frame (modo manual): tick 0 por construcción.
  expect(fresh?.snapshot?.tick).toBe(0);
  expect([fresh?.snapshot?.player.x, fresh?.snapshot?.player.y]).toEqual([
    WORLD.width / 2,
    WORLD.height / 2,
  ]);
  expect(fresh?.camera).toEqual({
    x: (WORLD.width - VIEW.width) / 2,
    y: (WORLD.height - VIEW.height) / 2,
    ...VIEW,
  });
}

/**
 * Pausa con Esc (solo actúa con la partida `running`): antes elige la opción 1 de cualquier oferta
 * abierta. Reintenta si Esc cayó en un frame con oferta (esperas de evento, sin reloj del tick).
 */
async function pauseWhileRunning(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const snap = await snapshotOf(page);
      if (snap?.status === 'choosing') {
        await page.keyboard.press('1');
        return false;
      }
      if (await pauseOverlay(page).isVisible()) return true;
      await page.keyboard.press('Escape');
      return pauseOverlay(page).isVisible();
    })
    .toBe(true);
}

test('Scenario: Partida nueva tras acabar en una esquina (R tras perder en (1.904, 1.064))', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  const corner = await atCorner(page, 'br');
  expect([corner?.player.x, corner?.player.y]).toEqual([WORLD.width - 16, WORLD.height - 16]);

  const ended = await playToEnd(page);
  expect(ended?.outcome).toBe('lost');
  expect((await probe(page))?.camera).toMatchObject({ x: WORLD.width - VIEW.width });
  await page.keyboard.press('r');
  await expect.poll(async () => (await probe(page))?.runs).toBe(2);

  await expectCentered(page);
  expect(problems).toEqual([]);
});

test('Scenario: Partida nueva tras acabar en una esquina (Volver al menú y Jugar)', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  const corner = await atCorner(page, 'br');
  expect(corner).not.toBeNull();

  await pauseWhileRunning(page);
  await pauseOverlay(page).getByRole('button', { name: 'Volver al menú' }).click();
  await expect(menuPanel(page)).toBeVisible();
  expect((await probe(page))?.camera).toBeNull();
  await menuButton(page, 'Jugar').click();
  await expect.poll(async () => (await probe(page))?.runs).toBe(2);
  await waitForRun(page);

  await expectCentered(page);
  expect(problems).toEqual([]);
});

/**
 * La cámara de referencia es la de (480, 270), recortada en (0, 0): la misma que en la esquina
 * superior izquierda, que se alcanza con el mismo recorrido de teclado.
 */
const REFERENCE = 'tl';

test.describe('HUD y overlays con la cámara movida', () => {
  for (const [name, cameraAt] of [
    ['br', { x: WORLD.width - VIEW.width, y: WORLD.height - VIEW.height }],
    [REFERENCE, { x: 0, y: 0 }],
  ] as const) {
    test(`Scenario: Overlay de elección con la cámara movida (clic en la 3.ª carta, esquina ${name})`, async ({
      page,
    }) => {
      const problems = collect(page, ['error', 'warning']);
      expect(await atCorner(page, name)).not.toBeNull();

      // Sin input y sin elegir: la primera oferta desde la esquina.
      const offered = await stepUntil(page, (s) => s.offer.length === 3, MAX_TICKS);
      expect(offered).not.toBeNull();
      expect((await probe(page))?.camera).toMatchObject(cameraAt);
      const third = cardLayout(VIEW, 3)[2];
      await page
        .locator('#game canvas')
        .click({ position: { x: third?.x ?? 0, y: third?.y ?? 0 } });

      await expect.poll(async () => (await snapshotOf(page))?.offer.length).toBe(0);
      const after = await snapshotOf(page);
      const chosen = offered?.offer[2];
      expect(after?.tick).toBe(offered?.tick);
      expect(after?.upgrades).toContainEqual({ id: chosen?.id, level: chosen?.nextLevel });
      expect(problems).toEqual([]);
    });
  }

  test('Scenario: Resultados y pausa con la cámara movida ((1.904, 16) frente a la referencia)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const boxes: Record<string, { canvas: unknown; pause: unknown; results: unknown }> = {};
    for (const name of ['tr', REFERENCE]) {
      expect(await atCorner(page, name)).not.toBeNull();
      await pauseWhileRunning(page);
      const pause = await pauseOverlay(page).boundingBox();
      await pauseOverlay(page).getByRole('button', { name: 'Reanudar' }).click();
      await focusGame(page);
      const ended = await playToEnd(page);
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
    await pauseWhileRunning(page);
    await pauseOverlay(page).getByRole('button', { name: 'Volver al menú' }).click();
    await expect(menuPanel(page)).toBeVisible();
  });
});

// Spec world-camera (0013), "Elementos de la partida en coordenadas de mundo": pantalla = mundo −
// esquina del rectángulo visible de la sonda.
test('Scenario: Enemigo a la derecha del jugador ((1.200, 600) → pantalla (720, 330))', async ({
  page,
}) => {
  await page.goto(gameUrl({ seed: 42, manual: true }));
  await expectManual(page);
  await expect.poll(async () => (await probe(page))?.camera ?? null).not.toBeNull();
  const camera = (await probe(page))?.camera;
  if (!camera) throw new Error('Sin cámara');

  expect(toScreen({ x: 1200, y: 600 }, camera)).toEqual({ x: 720, y: 330 });
});

test('Scenario: Jugador junto a una esquina ((16, 1.064) → pantalla (16, 524))', async ({
  page,
}) => {
  const at = await atCorner(page, 'bl');
  const camera = (await probe(page))?.camera;
  if (!at || !camera) throw new Error('Sin esquina o sin cámara');

  expect([at.player.x, at.player.y]).toEqual([16, WORLD.height - 16]);
  expect(toScreen(at.player, camera)).toEqual({ x: 16, y: VIEW.height - 16 });
});
