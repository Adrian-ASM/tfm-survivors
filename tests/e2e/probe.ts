import { expect, type Page } from '@playwright/test';

/**
 * Velocidad de simulación de los E2E que juegan hasta un evento lejano (design 0008): 8 avances
 * del bucle de paso fijo por frame, con el mismo resultado que a velocidad 1.
 */
export const E2E_SPEED = 8;

/** URL del juego en modo E2E con la semilla y la velocidad dadas (`speed` 1 ⇒ sin parámetro). */
export function gameUrl({ seed, speed = 1 }: { seed?: number; speed?: number } = {}): string {
  const params = ['e2e'];
  if (seed !== undefined) params.push(`seed=${String(seed)}`);
  if (speed !== 1) params.push(`speed=${String(speed)}`);
  return `./?${params.join('&')}`;
}

/**
 * Comprueba la velocidad resuelta por el juego: si alguien quita el parámetro, el test falla en
 * vez de volverse lento en silencio.
 */
export async function expectSpeed(page: Page, speed: number): Promise<void> {
  await expect.poll(async () => (await probe(page))?.speed ?? null).toBe(speed);
}

export interface EnemyView {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export interface SnapshotView {
  tick: number;
  status: 'running' | 'choosing' | 'over';
  outcome: 'won' | 'lost' | null;
  kills: number;
  durationTicks: number;
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

export interface ResultsViewData {
  title: string;
  time: string;
  level: number;
  kills: number;
  hint: string;
}

export interface HistoryEntryView {
  playedAt: number;
  seed: number;
  outcome: 'won' | 'lost';
  timeSeconds: number;
  level: number;
  kills: number;
}

/** Progreso en uso y lo que muestra el panel de resultados (null en ambos si está oculto). */
export interface ProgressView {
  records: { bestTimeSeconds: number; bestLevel: number; maxKills: number };
  history: HistoryEntryView[];
  shown: string[] | null;
  message: string | null;
  notices: string[];
}

interface Probe {
  __sprint?: {
    seed: number;
    /** Velocidad de simulación resuelta en la carga (1..15; 1 si falta o es inválida). */
    speed?: number;
    snapshot: SnapshotView | null;
    results: ResultsViewData | null;
    progress: ProgressView | null;
    /** Pantalla visible (change 0009) y partidas creadas en la carga. */
    screen?: 'menu' | 'playing' | 'paused';
    runs?: number;
  };
}

/** Lee el probe `window.__sprint` (solo existe con ?e2e). */
export const probe = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as Probe).__sprint;
    return p
      ? {
          seed: p.seed,
          speed: p.speed ?? null,
          snapshot: p.snapshot,
          results: p.results,
          progress: p.progress,
          screen: p.screen ?? null,
          runs: p.runs ?? null,
        }
      : null;
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

interface CspWindow {
  __cspViolations?: string[];
}

/**
 * Registra los eventos `securitypolicyviolation` de la página desde antes de cargarla (spec
 * progress-persistence, "Sin violaciones en el bucle completo"). Llamar antes de `goto`.
 */
export async function watchCsp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const list: string[] = [];
    (window as unknown as CspWindow).__cspViolations = list;
    document.addEventListener('securitypolicyviolation', (e) => {
      list.push(
        `${e.violatedDirective} ${e.blockedURI} @ ${e.sourceFile}:${String(e.lineNumber)}:${String(e.columnNumber)}`,
      );
    });
  });
}

/** Violaciones de CSP registradas por `watchCsp` y número de metas CSP de la página servida. */
export const cspState = (page: Page) =>
  page.evaluate(() => ({
    violations: (window as unknown as CspWindow).__cspViolations ?? null,
    metas: document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').length,
  }));

/** URL del juego sin `?e2e` (modo jugador: menú de inicio y sin sonda). */
export const playerUrl = (search = ''): string => `./${search}`;

/** Menú de inicio, overlay de pausa y diálogo de Borrar datos (por rol: sin sonda). */
export const menuPanel = (page: Page) => page.getByRole('region', { name: 'Menú de inicio' });
export const pauseOverlay = (page: Page) => page.getByRole('dialog', { name: 'Pausa' });
export const confirmDialog = (page: Page) => page.getByRole('alertdialog');
export const menuButton = (page: Page, name: string) =>
  menuPanel(page).getByRole('button', { name, exact: true });

/** Pulsa Esc, espera el overlay de pausa y pulsa Volver al menú (la partida se abandona). */
export async function backToMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await pauseOverlay(page).getByRole('button', { name: 'Volver al menú' }).click();
  await expect(menuPanel(page)).toBeVisible();
}
