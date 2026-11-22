import { expect, test, type Page } from '@playwright/test';
import {
  collect,
  cspState,
  gameUrl,
  menuButton,
  menuPanel,
  playerUrl,
  probe,
  snapshotOf,
  startSpriteSampler,
  stopSpriteSampler,
  waitFrames,
  watchCsp,
} from './probe';

interface Probe {
  __sprint?: { snapshot: { tick: number; player: { x: number; y: number } } | null };
}

const playerX = (page: Page): Promise<number | null> =>
  page.evaluate(() => (window as unknown as Probe).__sprint?.snapshot?.player.x ?? null);

test('Sin overlay durante la partida: progreso vacío, sin botones y CSP sin violaciones', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await watchCsp(page);
  await page.goto('./?e2e');
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(30);

  const progress = (await probe(page))?.progress;

  expect(progress).toMatchObject({
    records: { bestTimeSeconds: 0, bestLevel: 0, maxKills: 0 },
    history: [],
    shown: null,
  });
  await expect(page.getByRole('button', { name: 'Exportar' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Importar' })).toBeHidden();
  // Spec progress-persistence, CSP: una sola meta en la página servida y ninguna violación al cargar.
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(problems).toEqual([]);
});

test('el juego carga sin errores y el jugador se mueve con la flecha derecha', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('./?e2e');
  const canvas = page.locator('#game canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => playerX(page)).not.toBeNull();

  const before = await playerX(page);
  await canvas.click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  const after = await playerX(page);

  // 200 px/s durante ~0,5 s ⇒ ~100 px; margen amplio para runners lentos.
  expect(after).not.toBeNull();
  expect((after ?? 0) - (before ?? 0)).toBeGreaterThan(40);
  expect(errors).toEqual([]);
});

// Change 0012 (spec sprite-rendering y main-menu): arte con CSP intacta, sin reservas y con el
// título nuevo, desde el menú y con ?e2e.
test('Scenario: Partida con arte (?e2e&seed=42, 600 frames: suelo, 0 reservas, sonda coherente)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const problems = collect(page, ['error']);
  await watchCsp(page);
  await page.goto(gameUrl({ seed: 42 }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(0);
  await startSpriteSampler(page);
  await waitFrames(page, 600);
  const sample = await stopSpriteSampler(page);

  expect(sample.frames).toBeGreaterThanOrEqual(590);
  expect(sample.mismatches).toEqual([]);
  expect([sample.groundMisses, sample.placeholderFrames]).toEqual([0, 0]);
  expect(sample.fullFrames).toBeGreaterThan(0);
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(problems).toEqual([]);
});

test('Scenario: Desde el menú (Jugar y 300 frames: 0 violaciones de CSP ni errores)', async ({
  page,
}) => {
  const problems = collect(page, ['error']);
  await watchCsp(page);
  await page.goto(playerUrl());
  await menuButton(page, 'Jugar').click();
  await expect(menuPanel(page)).toBeHidden();
  await waitFrames(page, 300);

  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(problems).toEqual([]);
});

test('Scenario: Con e2e (semilla 42, en curso, 0 reservas, sin menú y sin violaciones)', async ({
  page,
}) => {
  await watchCsp(page);
  await page.goto(gameUrl({ seed: 42 }));
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThanOrEqual(15);
  const p = await probe(page);
  const sprites = p?.sprites;
  const reserve = sprites
    ? [sprites.ground, sprites.player, sprites.enemies, sprites.projectiles, sprites.gems].reduce(
        (n, k) => n + k.placeholder,
        0,
      )
    : -1;

  expect([p?.seed, p?.snapshot?.status, reserve]).toEqual([42, 'running', 0]);
  await expect(menuPanel(page)).toBeHidden();
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
});

test('Scenario: Título en el menú y en el documento (Greentide Vanguard, nada de Sprint Survivors)', async ({
  page,
}) => {
  await page.goto(playerUrl());
  await expect(menuPanel(page)).toBeVisible();

  expect(await page.title()).toContain('Greentide Vanguard');
  expect(await page.locator('body').innerText()).not.toContain('Sprint Survivors');
  expect(await page.title()).not.toContain('Sprint Survivors');
});
