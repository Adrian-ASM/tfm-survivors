import { expect, test } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import {
  backToMenu,
  cornerTour,
  focusGame,
  gameUrl,
  menuButton,
  playerUrl,
  probe,
  snapshotOf,
  startSpriteSampler,
  stopSpriteSampler,
  waitFrames,
} from './probe';

// Spec sprite-rendering (change 0012): aspecto de reserva ante una hoja rota y sonda de sprites.
const TORCH_SHEET = '**/Factions/Goblins/Troops/Torch/Red/Torch_Red.png';

test(
  'Scenario: Hoja que no carga (Torch abortada: solo goblin-torch en reserva, la partida sigue)',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(60_000);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // R3: solo se ignora el "Failed to load resource" de la hoja abortada.
      const torch = m.location().url.includes('Torch_Red.png');
      if (!(torch && m.text().startsWith('Failed to load resource'))) problems.push(m.text());
    });
    await page.route(TORCH_SHEET, (route) => route.abort());
    await page.goto(gameUrl({ seed: 42 }));
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(0);
    await startSpriteSampler(page, 'goblin-torch');
    await waitFrames(page, 600);
    const sample = await stopSpriteSampler(page);
    const last = await snapshotOf(page);

    expect(sample.typeMismatches).toBe(0);
    expect(sample.mismatches).toEqual([]);
    expect(sample.placeholderFrames).toBeGreaterThan(0);
    expect(last?.status === 'over' || (last?.tick ?? 0) >= 590).toBe(true);
    expect(problems).toEqual([]);
  },
);

test(
  'Scenario: Recuento coherente con el snapshot (600 frames, cadáveres ≤ 64)',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(gameUrl({ seed: 42 }));
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(0);
    await startSpriteSampler(page);
    await waitFrames(page, 600);
    const sample = await stopSpriteSampler(page);

    expect(sample.mismatches).toEqual([]);
    expect(sample.maxCorpses).toBeLessThanOrEqual(64);
    expect(sample.frames).toBeGreaterThanOrEqual(590);
  },
);

test(
  'Scenario: Sonda en el menú (tras Volver al menú, todo a 0)',
  { tag: '@realtime' },
  async ({ page }) => {
    await page.goto(gameUrl({ seed: 42 }));
    await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(30);
    await focusGame(page);
    await backToMenu(page);
    await waitFrames(page, 1);
    const s = (await probe(page))?.sprites;

    expect(
      [s?.player, s?.enemies, s?.corpses, s?.projectiles, s?.pulses, s?.gems].map(
        (k) => k?.visible,
      ),
    ).toEqual([0, 0, 0, 0, 0, 0]);
  },
);

test(
  'Scenario: Sin sonda fuera de E2E (?seed=42 y Jugar)',
  { tag: '@realtime' },
  async ({ page }) => {
    await page.goto(playerUrl('?seed=42'));
    await menuButton(page, 'Jugar').click();
    await waitFrames(page, 10);

    expect(await page.evaluate(() => typeof (window as { __sprint?: unknown }).__sprint)).toBe(
      'undefined',
    );
  },
);

// Spec sprite-rendering (0013): el fondo cubre el mundo entero, (0, 0)–(W, H), también en reserva.
// El rectángulo del fondo es el del mundo (ground-view.test.ts), así que "dentro del fondo" es
// "dentro del mundo" en la sonda de cámara.
const VIEW = arena.view;
const WORLD = { width: arena.width, height: arena.height };
const GROUND_SHEET = '**/Terrain/Ground/Tilemap_Flat.png';

test(
  'Scenario: Fondo en las cuatro esquinas (?e2e&seed=7)',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(90_000);

    const { walked, sample } = await cornerTour(page, VIEW, WORLD);

    expect(walked).toEqual(['tl', 'tr', 'br', 'bl']);
    expect(sample.frames).toBeGreaterThan(0);
    expect([sample.outsideWorld, sample.groundMisses, sample.groundPlaceholderFrames]).toEqual([
      0, 0, 0,
    ]);
  },
);

test(
  'Scenario: Fondo de reserva en el mundo entero (hoja del suelo abortada)',
  { tag: '@realtime' },
  async ({ page }) => {
    test.setTimeout(90_000);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const ground = m.location().url.includes('Tilemap_Flat.png');
      if (!(ground && m.text().startsWith('Failed to load resource'))) problems.push(m.text());
    });
    await page.route(GROUND_SHEET, (route) => route.abort());

    const { walked, sample } = await cornerTour(page, VIEW, WORLD);

    expect(walked).toEqual(['tl', 'tr', 'br', 'bl']);
    expect(sample.groundPlaceholderFrames).toBe(sample.frames);
    expect([sample.outsideWorld, sample.groundMisses]).toEqual([0, 0]);
    expect(problems).toEqual([]);
  },
);
