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
  type: string;
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

/** Sprites visibles y con aspecto de reserva de un tipo (change 0012, design D7). */
export interface SpriteCountView {
  visible: number;
  placeholder: number;
}

/** Sonda de render: recuentos del último frame pintado (a 0 en el menú). */
export interface SpritesView {
  ground: SpriteCountView;
  player: SpriteCountView;
  enemies: SpriteCountView;
  corpses: SpriteCountView;
  projectiles: SpriteCountView;
  pulses: SpriteCountView;
  gems: SpriteCountView;
  enemyPlaceholders: Record<string, number>;
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
    /** Sonda de sprites (change 0012). */
    sprites?: SpritesView;
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
          sprites: p.sprites ?? null,
        }
      : null;
  });

/** Resumen del muestreador de sprites (ver `startSpriteSampler`). */
export interface SpriteSample {
  /** Frames muestreados con partida (snapshot no nulo) y en el menú. */
  frames: number;
  menuFrames: number;
  /** Primeras discrepancias entre la sonda de sprites y el snapshot del mismo frame. */
  mismatches: string[];
  maxCorpses: number;
  /** Frames con algún sprite de reserva (de cualquier tipo). */
  placeholderFrames: number;
  /** Frames con ≥ 1 enemigo, proyectil y gema visibles a la vez. */
  fullFrames: number;
  /** Frames en que el suelo no era exactamente 1 sprite visible. */
  groundMisses: number;
  /** Frames en que reserva por tipo de enemigo ≠ enemigos de ese tipo en el snapshot (`placeholderType`). */
  typeMismatches: number;
}

interface SamplerWindow {
  __spriteSampler?: { stop: boolean; result: SpriteSample };
}

/**
 * Instala en la página un muestreador con `requestAnimationFrame` (design D7) que, en cada frame,
 * compara la sonda de sprites con el snapshot pintado en la misma llamada: enemigos, proyectiles,
 * pulsos y gemas visibles = elementos del snapshot; jugador según el parpadeo (periodo 4); cadáveres
 * ≤ 64; en el menú, todo a 0. Si `placeholderType` se da, exige que todos los enemigos de ese tipo
 * usen reserva y ningún otro sprite. Sin `page.evaluate` por frame: el resultado se lee al final.
 */
export async function startSpriteSampler(page: Page, placeholderType?: string): Promise<void> {
  await page.evaluate((only) => {
    const w = window as unknown as Probe & SamplerWindow;
    const result: SpriteSample = {
      frames: 0,
      menuFrames: 0,
      mismatches: [],
      maxCorpses: 0,
      placeholderFrames: 0,
      fullFrames: 0,
      groundMisses: 0,
      typeMismatches: 0,
    };
    const state = { stop: false, result };
    w.__spriteSampler = state;
    const miss = (text: string) => {
      if (result.mismatches.length < 10) result.mismatches.push(text);
    };
    const tick = () => {
      if (state.stop) return;
      const p = w.__sprint;
      const s = p?.sprites;
      const snap = p?.snapshot;
      if (s) {
        result.maxCorpses = Math.max(result.maxCorpses, s.corpses.visible);
        if (s.corpses.visible > 64) miss(`cadáveres ${String(s.corpses.visible)}`);
        const kinds = [s.player, s.enemies, s.corpses, s.projectiles, s.pulses, s.gems];
        if (!snap) {
          result.menuFrames += 1;
          if (kinds.some((k) => k.visible !== 0)) miss('menú con sprites visibles');
        } else {
          result.frames += 1;
          const t = snap.tick;
          const pairs: [string, number, number][] = [
            ['enemigos', s.enemies.visible, snap.enemies.length],
            ['proyectiles', s.projectiles.visible, snap.projectiles.length],
            ['pulsos', s.pulses.visible, snap.pulses.length],
            ['gemas', s.gems.visible, snap.gems.length],
          ];
          for (const [name, got, want] of pairs) {
            if (got !== want) miss(`tick ${String(t)}: ${name} ${String(got)} ≠ ${String(want)}`);
          }
          const blinkVisible =
            snap.status === 'over' || !snap.player.invulnerable || Math.floor(t / 4) % 2 === 0;
          if (s.player.visible !== (blinkVisible ? 1 : 0)) miss(`tick ${String(t)}: jugador`);
          if (s.ground.visible !== 1) result.groundMisses += 1;
          const reserve = [s.ground, ...kinds].reduce((n, k) => n + k.placeholder, 0);
          if (reserve > 0) result.placeholderFrames += 1;
          if (s.enemies.visible > 0 && s.projectiles.visible > 0 && s.gems.visible > 0) {
            result.fullFrames += 1;
          }
          if (only !== undefined) {
            const ofType = snap.enemies.filter((e) => e.type === only).length;
            const others = Object.entries(s.enemyPlaceholders).filter(([k]) => k !== only);
            const otherKinds = [s.ground, s.player, s.corpses, s.projectiles, s.gems];
            if (
              s.enemyPlaceholders[only] !== ofType ||
              s.enemies.placeholder !== ofType ||
              others.some(([, n]) => n !== 0) ||
              otherKinds.some((k) => k.placeholder !== 0)
            ) {
              result.typeMismatches += 1;
            }
          }
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, placeholderType);
}

/** Para el muestreador y devuelve su resumen. */
export const stopSpriteSampler = (page: Page): Promise<SpriteSample> =>
  page.evaluate(() => {
    const state = (window as unknown as SamplerWindow).__spriteSampler;
    if (!state) throw new Error('No hay muestreador instalado');
    state.stop = true;
    return state.result;
  });

/** Lo que la sonda tenía en el primer frame pintado de una partida nueva. */
export interface FirstFrameView {
  runs: number;
  speed: number | null;
  snapshot: SnapshotView | null;
  results: ResultsViewData | null;
  sprites: SpritesView | null;
}

interface FirstFrameWindow {
  __firstFrame?: { stop: boolean; frame: FirstFrameView | null };
}

/**
 * Vigila con `requestAnimationFrame` la siguiente partida creada (`runs` sube) y guarda la sonda
 * del primer frame en que aparece. La sonda se escribe en `onRender` (snapshot, resultados y
 * sprites en la misma llamada, design D7): corra este callback antes o después del de Phaser en
 * el frame, lo primero que ve con `runs` mayor es el primer render de la partida nueva. Lo guarda
 * aunque la prueba lea mucho después: el
 * resultado no depende de cuándo llega la lectura (en CI, tras R podían pasar > 100 ticks y la
 * partida nueva ya tenía su primera baja). Llamar antes de pulsar R; leer con `firstFrameOfNextRun`.
 */
export async function watchNextRun(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Probe & FirstFrameWindow;
    const before = w.__sprint?.runs ?? 0;
    const state: { stop: boolean; frame: FirstFrameView | null } = { stop: false, frame: null };
    w.__firstFrame = state;
    const tick = () => {
      if (state.stop) return;
      const p = w.__sprint;
      if (p && (p.runs ?? 0) > before && p.snapshot) {
        // Copia profunda: la sonda se reescribe en cada frame.
        state.frame = JSON.parse(
          JSON.stringify({
            runs: p.runs ?? 0,
            speed: p.speed ?? null,
            snapshot: p.snapshot,
            results: p.results,
            sprites: p.sprites ?? null,
          }),
        ) as FirstFrameView;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Espera a que `watchNextRun` capture el primer frame de la partida nueva y lo devuelve. */
export async function firstFrameOfNextRun(page: Page): Promise<FirstFrameView> {
  const read = () =>
    page.evaluate(() => (window as unknown as FirstFrameWindow).__firstFrame?.frame ?? null);
  await expect.poll(read).not.toBeNull();
  const frame = await read();
  if (!frame) throw new Error('Sin primer frame de la partida nueva');
  await page.evaluate(() => {
    const state = (window as unknown as FirstFrameWindow).__firstFrame;
    if (state) state.stop = true;
  });
  return frame;
}

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

/**
 * Ticks por frame del navegador, medidos sobre `frames` frames de `requestAnimationFrame` (el
 * mismo reloj que usa Phaser). No depende del reloj de pared: en una máquina lenta hay menos
 * frames, no menos ticks por frame. Velocidad 1 ⇒ ~1; velocidad 8 ⇒ ~8.
 */
export const ticksPerFrame = (page: Page, frames = 30): Promise<number> =>
  page.evaluate(async (n) => {
    const read = () => (window as unknown as Probe).__sprint?.snapshot?.tick ?? 0;
    const start = read();
    for (let i = 0; i < n; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return (read() - start) / n;
  }, frames);

/** Espera `n` frames del navegador (`requestAnimationFrame`), no un tiempo de reloj. */
export const waitFrames = (page: Page, n: number): Promise<void> =>
  page.evaluate(async (count) => {
    for (let i = 0; i < count; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, n);

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
