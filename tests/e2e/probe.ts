import type { Page } from '@playwright/test';

export interface EnemyView {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export interface SnapshotView {
  tick: number;
  status: 'running' | 'choosing' | 'over';
  player: { health: number; maxHealth: number; invulnerable: boolean };
  enemies: EnemyView[];
  projectiles: { id: number; x: number; y: number }[];
  pulses: { weapon: string; firedAt: number }[];
  weapons: { id: string; ready: boolean }[];
  gems: { id: number; x: number; y: number }[];
  progression: { level: number; xp: number; xpToNext: number; pendingLevelUps: number };
  offer: { id: string; name: string; level: number; nextLevel: number }[];
  upgrades: { id: string; level: number }[];
}

interface Probe {
  __sprint?: { seed: number; snapshot: SnapshotView | null };
}

/** Lee el probe `window.__sprint` (solo existe con ?e2e). */
export const probe = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as Probe).__sprint;
    return p ? { seed: p.seed, snapshot: p.snapshot } : null;
  });

/**
 * Da el foco al canvas para que el teclado llegue al juego, con un clic en una esquina (lejos de
 * las cartas del overlay).
 */
export async function focusGame(page: Page): Promise<void> {
  await page.locator('#game canvas').click({ position: { x: 5, y: 5 } });
}

/** Último snapshot del probe (null si aún no hay). */
export const snapshotOf = async (page: Page): Promise<SnapshotView | null> =>
  (await probe(page))?.snapshot ?? null;

/**
 * POLÍTICA DE ELECCIÓN FIJA en el navegador (spec simulation-loop): lee el snapshot cada
 * `intervalMs`; si hay oferta, pulsa la tecla 1 (opción 0). Devuelve el primer snapshot que cumple
 * `until` o null si pasa `timeoutMs` de reloj.
 */
export async function playChoosingFirst(
  page: Page,
  until: (s: SnapshotView) => boolean,
  timeoutMs: number,
  intervalMs = 100,
): Promise<SnapshotView | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snap = await snapshotOf(page);
    if (snap && until(snap)) return snap;
    if (snap && snap.offer.length > 0) await page.keyboard.press('1');
    await page.waitForTimeout(intervalMs);
  }
  return null;
}

// Chromium headless (WebGL por software) emite avisos propios del driver, p. ej.
// "[.WebGL-0x…]GL Driver Message (…): GPU stall due to ReadPixels". No salen del juego: se ignoran.
const BROWSER_GPU_NOISE = /^\[\.WebGL-[0-9a-fx]+\]GL Driver Message/i;

/** Recoge errores de página y mensajes de consola de los tipos dados (sin el ruido del driver). */
export function collect(page: Page, types: string[]): string[] {
  const messages: string[] = [];
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (types.includes(m.type()) && !BROWSER_GPU_NOISE.test(m.text())) {
      messages.push(`${m.type()}: ${m.text()}`);
    }
  });
  return messages;
}
