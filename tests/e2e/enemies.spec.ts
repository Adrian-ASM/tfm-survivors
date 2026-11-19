import { expect, test, type Page } from '@playwright/test';

interface EnemyView {
  x: number;
  y: number;
  radius: number;
}
interface Probe {
  __sprint?: {
    seed: number;
    snapshot: {
      tick: number;
      status: 'running' | 'over';
      player: { health: number; maxHealth: number; invulnerable: boolean };
      enemies: EnemyView[];
    } | null;
  };
}

const ARENA = { width: 960, height: 540 };
const MAX_SEED = 4294967295;

const probe = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as Probe).__sprint;
    return p ? { seed: p.seed, snapshot: p.snapshot } : null;
  });

// Chromium headless (WebGL por software) emite avisos propios del driver, p. ej.
// "[.WebGL-0x…]GL Driver Message (…): GPU stall due to ReadPixels". No salen del juego: se ignoran.
const BROWSER_GPU_NOISE = /^\[\.WebGL-[0-9a-fx]+\]GL Driver Message/i;

/** Recoge errores de página y mensajes de consola de los tipos dados (sin el ruido del driver). */
function collect(page: Page, types: string[]): string[] {
  const messages: string[] = [];
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (types.includes(m.type()) && !BROWSER_GPU_NOISE.test(m.text())) {
      messages.push(`${m.type()}: ${m.text()}`);
    }
  });
  return messages;
}

test('?seed=42: semilla 42, aparecen enemigos dentro de la arena y sin errores ni avisos', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto('./?e2e&seed=42');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(async () => (await probe(page))?.snapshot?.tick ?? null).not.toBeNull();

  expect((await probe(page))?.seed).toBe(42);
  await expect
    .poll(async () => (await probe(page))?.snapshot?.enemies.length ?? 0, { timeout: 3000 })
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

test('Daño discreto por contacto: sin input, la vida baja en ≤ 20 s y sigue en curso', async ({
  page,
}) => {
  test.setTimeout(45_000);
  const problems = collect(page, ['error', 'warning']);
  await page.goto('./?e2e&seed=42');
  await expect.poll(async () => (await probe(page))?.snapshot?.tick ?? null).not.toBeNull();
  const start = (await probe(page))?.snapshot?.player;
  expect(start && start.health).toBe(start?.maxHealth);

  await expect
    .poll(async () => (await probe(page))?.snapshot?.player.health ?? Infinity, {
      timeout: 20_000,
    })
    .toBeLessThan(start?.maxHealth ?? 0);

  const snap = (await probe(page))?.snapshot;
  expect(snap?.player.health).toBeGreaterThan(0);
  expect(snap?.status).toBe('running');
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
