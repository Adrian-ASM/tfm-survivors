import { expect, type Page } from '@playwright/test';
import playerJson from '../../content/player.json' with { type: 'json' };

/**
 * Velocidad de simulación de los E2E que juegan hasta un evento lejano (design 0008): 8 avances
 * del bucle de paso fijo por frame, con el mismo resultado que a velocidad 1.
 */
export const E2E_SPEED = 8;

/**
 * URL del juego en modo E2E con la semilla, la velocidad (`speed` 1 ⇒ sin parámetro) y el modo
 * manual (`?e2e&manual`, change 0014) dados.
 */
export function gameUrl({
  seed,
  speed = 1,
  manual = false,
}: { seed?: number; speed?: number; manual?: boolean } = {}): string {
  const params = ['e2e'];
  if (manual) params.push('manual');
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

/**
 * Comprueba que el modo manual está activo: si alguien quita `manual` de la URL, la spec falla en
 * vez de pasar a tiempo real en silencio (change 0014).
 */
export async function expectManual(page: Page): Promise<void> {
  await expect.poll(async () => (await probe(page))?.manual ?? null).toBe(true);
}

/**
 * `window.__sprint.step(n)` (change 0014): avanza n ticks en modo manual y devuelve los ticks
 * ejecutados. `n` es `unknown` para poder probar los valores inválidos.
 */
export const step = (page: Page, n: unknown): Promise<number> =>
  page.evaluate(async (count) => {
    const p = (window as unknown as Probe).__sprint;
    if (!p?.step) throw new Error('La sonda no tiene step');
    return p.step(count);
  }, n);

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
  player: { x: number; y: number; health: number; maxHealth: number; invulnerable: boolean };
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

/** Rectángulo visible del último frame pintado, en coordenadas de mundo (change 0013). */
export interface CameraViewData {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tamaño del mundo (la `arena` del contenido). */
export interface WorldView {
  width: number;
  height: number;
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
    /** Sonda de cámara (change 0013): null en el menú. */
    camera?: CameraViewData | null;
    world?: WorldView;
    /** Modo de avance manual (`?e2e&manual`) y su avance exacto de ticks (change 0014). */
    manual?: boolean;
    step?: (n: unknown) => Promise<number>;
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
          camera: p.camera ?? null,
          world: p.world ?? null,
          manual: p.manual ?? null,
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

/** Resumen del muestreador de cámara (ver `startCameraSampler`). */
export interface CameraSample {
  /** Frames muestreados con partida (snapshot y cámara no nulos). */
  frames: number;
  /** Primeras discrepancias con la fórmula de seguimiento (error > 1 px) o con el tamaño. */
  mismatches: string[];
  /** Frames con el rectángulo visible fuera de (0, 0)–(W, H). */
  outsideWorld: number;
  /** Frames en que el suelo no era exactamente 1 sprite visible. */
  groundMisses: number;
  /** Frames con algún fondo de reserva. */
  groundPlaceholderFrames: number;
  /** Primera posición de cada id de enemigo y el rectángulo visible de ese frame. */
  firstSeen: { id: number; x: number; y: number; camera: CameraViewData }[];
  /** Esquinas del mundo tocadas por el jugador (a ≤ 1 px del recorte): tl, tr, bl, br. */
  corners: string[];
}

interface CameraSamplerWindow {
  __cameraSampler?: { stop: boolean; result: CameraSample };
}

/**
 * Instala un muestreador con `requestAnimationFrame` (design D5) que, en cada frame con partida,
 * comprueba la sonda de cámara contra el jugador del snapshot del mismo frame: tamaño de la vista,
 * esquina = (clamp(x − V_w / 2, 0, W − V_w), clamp(y − V_h / 2, 0, H − V_h)) con error ≤ 1 px,
 * rectángulo dentro del mundo y fondo visible. Guarda la primera posición de cada enemigo.
 */
export async function startCameraSampler(page: Page, view: WorldView): Promise<void> {
  await page.evaluate((v) => {
    const w = window as unknown as Probe & CameraSamplerWindow;
    const result: CameraSample = {
      frames: 0,
      mismatches: [],
      outsideWorld: 0,
      groundMisses: 0,
      groundPlaceholderFrames: 0,
      firstSeen: [],
      corners: [],
    };
    const state = { stop: false, result };
    w.__cameraSampler = state;
    const seen = new Set<number>();
    const miss = (text: string) => {
      if (result.mismatches.length < 10) result.mismatches.push(text);
    };
    const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);
    const tick = () => {
      if (state.stop) return;
      const p = w.__sprint;
      const snap = p?.snapshot;
      const cam = p?.camera;
      const world = p?.world;
      if (snap && cam && world) {
        result.frames += 1;
        const { x, y } = snap.player;
        const ex = clamp(x - v.width / 2, 0, world.width - v.width);
        const ey = clamp(y - v.height / 2, 0, world.height - v.height);
        const t = String(snap.tick);
        if (cam.width !== v.width || cam.height !== v.height) miss(`tick ${t}: tamaño`);
        if (Math.abs(cam.x - ex) > 1 || Math.abs(cam.y - ey) > 1) {
          miss(`tick ${t}: (${String(cam.x)}, ${String(cam.y)}) ≠ (${String(ex)}, ${String(ey)})`);
        }
        if (
          cam.x < 0 ||
          cam.y < 0 ||
          cam.x + cam.width > world.width ||
          cam.y + cam.height > world.height
        ) {
          result.outsideWorld += 1;
        }
        const ground = p.sprites?.ground;
        if (ground?.visible !== 1) result.groundMisses += 1;
        if ((ground?.placeholder ?? 0) > 0) result.groundPlaceholderFrames += 1;
        for (const e of snap.enemies) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          result.firstSeen.push({ id: e.id, x: e.x, y: e.y, camera: { ...cam } });
        }
        const left = cam.x <= 1;
        const top = cam.y <= 1;
        const right = cam.x >= world.width - v.width - 1;
        const bottom = cam.y >= world.height - v.height - 1;
        const corner = (top ? 't' : bottom ? 'b' : '') + (left ? 'l' : right ? 'r' : '');
        if (corner.length === 2 && !result.corners.includes(corner)) result.corners.push(corner);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, view);
}

/** Para el muestreador de cámara y devuelve su resumen. */
export const stopCameraSampler = (page: Page): Promise<CameraSample> =>
  page.evaluate(() => {
    const state = (window as unknown as CameraSamplerWindow).__cameraSampler;
    if (!state) throw new Error('No hay muestreador de cámara instalado');
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
  camera: CameraViewData | null;
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
            camera: p.camera ?? null,
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
 * Espera a que la partida de la carga exista: snapshot no nulo. Es una espera de evento (fin de
 * la carga), no del tick contra el reloj (change 0014).
 */
export async function waitForRun(page: Page): Promise<void> {
  await expect.poll(async () => (await snapshotOf(page)) !== null).toBe(true);
}

/** Avance máximo de `stepUntil` por llamada a `step`: el tope por frame del modo manual. */
const STEP_CHUNK = 600;

/**
 * POLÍTICA DE ELECCIÓN FIJA en modo manual (change 0014), sin reloj: si `until` se cumple,
 * devuelve el snapshot; si hay oferta, pulsa 1 (opción 0, se elige antes de avanzar en el mismo
 * frame); después `step(chunk)`, hasta `maxTicks` ticks en total. Devuelve null si se agotan, si
 * la partida termina sin cumplir `until` o si un `step` no avanza sin oferta (pausa, menú).
 */
export async function stepUntil(
  page: Page,
  until: (s: SnapshotView) => boolean,
  maxTicks: number,
  chunk = STEP_CHUNK,
): Promise<SnapshotView | null> {
  let left = maxTicks;
  for (;;) {
    const snap = await snapshotOf(page);
    if (!snap) return null;
    if (until(snap)) return snap;
    if (snap.status === 'over' || left <= 0) return null;
    const offered = snap.offer.length > 0;
    if (offered) await page.keyboard.press('1');
    const ticks = await step(page, Math.min(chunk, left));
    left -= ticks;
    if (ticks === 0 && !offered) return null;
  }
}

/** Juega hasta el fin con la política de elección fija (`stepUntil`), sin reloj. */
export const playToEnd = (page: Page, maxTicks = 36_000): Promise<SnapshotView | null> =>
  stepUntil(page, (s) => s.status === 'over', maxTicks);

/**
 * Mantiene `key` pulsada durante un `step(ticks)`: el input se lee al empezar el step (orden de la
 * spec: `keyboard.down → step → keyboard.up`). Devuelve los ticks ejecutados.
 */
export async function holdKey(page: Page, key: string, ticks: number): Promise<number> {
  await page.keyboard.down(key);
  try {
    return await step(page, ticks);
  } finally {
    await page.keyboard.up(key);
  }
}

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

/** Medida de `measureFrames`: ritmo real del navegador y de la simulación. */
export interface FrameMeasure {
  /** Frames por segundo de reloj real. */
  readonly fps: number;
  /** Percentil 95 del intervalo entre frames (ms). */
  readonly p95: number;
  /** Ticks de simulación por frame (media). */
  readonly ticksPerFrame: number;
}

/**
 * Mide `frames` frames de `requestAnimationFrame` en la página (sonda de calibración, design 0014
 * §4.3): fps y p95 con `performance.now` (código de test, no del núcleo) y ticks por frame.
 */
export const measureFrames = (page: Page, frames: number): Promise<FrameMeasure> =>
  page.evaluate(async (n) => {
    const read = () => (window as unknown as Probe).__sprint?.snapshot?.tick ?? 0;
    const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const intervals: number[] = [];
    let last = await nextFrame();
    const start = last;
    const startTick = read();
    for (let i = 0; i < n; i += 1) {
      const now = await nextFrame();
      intervals.push(now - last);
      last = now;
    }
    const sorted = [...intervals].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    const elapsed = last - start;
    return {
      fps: elapsed > 0 ? (n * 1000) / elapsed : 0,
      p95,
      ticksPerFrame: (read() - startTick) / n,
    };
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

/** Esquina del mundo: signo de cada eje (−1 hacia 0, +1 hacia el borde lejano). */
export interface Corner {
  name: string;
  dx: -1 | 1;
  dy: -1 | 1;
}

/** Las cuatro esquinas en el orden del recorrido: tl, tr, br, bl (un solo eje cambia cada vez). */
export const CORNERS: readonly Corner[] = [
  { name: 'tl', dx: -1, dy: -1 },
  { name: 'tr', dx: 1, dy: -1 },
  { name: 'br', dx: 1, dy: 1 },
  { name: 'bl', dx: -1, dy: 1 },
];

/** Radio del jugador del contenido por defecto (content/player.json). */
const PLAYER_RADIUS = playerJson.radius;

/** Margen de llegada a una esquina: el centro del jugador a ≤ 1 px de su recorte. */
const CORNER_SLACK = 1;

/**
 * Lleva al jugador con el teclado (flechas) a la esquina dada del mundo y devuelve el snapshot de
 * llegada, o null si pasa `timeoutMs` de reloj o la partida termina. Elige la opción 1 en cada
 * oferta (política de elección fija). Suelta las teclas al terminar.
 */
export async function walkToCorner(
  page: Page,
  corner: Corner,
  world: WorldView,
  timeoutMs: number,
): Promise<SnapshotView | null> {
  const keys = cornerKeys(corner);
  for (const key of keys) await page.keyboard.down(key);
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const snap = await snapshotOf(page);
      if (snap?.status === 'over') return null;
      if (snap && snap.offer.length > 0) await page.keyboard.press('1');
      else if (snap && cornerReached(snap, corner, world)) return snap;
      await page.waitForTimeout(50);
    }
    return null;
  } finally {
    for (const key of keys) await page.keyboard.up(key);
  }
}

/** Flechas que llevan hacia la esquina. */
const cornerKeys = (corner: Corner): string[] => [
  corner.dx < 0 ? 'ArrowLeft' : 'ArrowRight',
  corner.dy < 0 ? 'ArrowUp' : 'ArrowDown',
];

/** El jugador está en la esquina: su centro a ≤ 1 px del recorte por su radio. */
function cornerReached(s: SnapshotView, corner: Corner, world: WorldView): boolean {
  const r = PLAYER_RADIUS;
  const x = corner.dx < 0 ? s.player.x <= r + CORNER_SLACK : s.player.x >= world.width - r - 1;
  const y = corner.dy < 0 ? s.player.y <= r + CORNER_SLACK : s.player.y >= world.height - r - 1;
  return x && y;
}

/** Tope de ticks para llegar a una esquina desde el centro del mundo (20 s de juego). */
const CORNER_MAX_TICKS = 20 * 60;
/** Ticks por step al andar hacia una esquina: varios frames pintados por el camino. */
const CORNER_CHUNK = 60;

/**
 * Como `walkToCorner`, en modo manual (change 0014) y sin reloj: mantiene las flechas y avanza
 * con `stepUntil` (política de elección fija) hasta llegar a la esquina. null si la partida
 * termina antes o se agota el tope de ticks.
 */
export async function stepToCorner(
  page: Page,
  corner: Corner,
  world: WorldView,
): Promise<SnapshotView | null> {
  const keys = cornerKeys(corner);
  for (const key of keys) await page.keyboard.down(key);
  try {
    return await stepUntil(
      page,
      (s) => s.status === 'running' && cornerReached(s, corner, world),
      CORNER_MAX_TICKS,
      CORNER_CHUNK,
    );
  } finally {
    for (const key of keys) await page.keyboard.up(key);
  }
}

/**
 * Recorre las cuatro esquinas del mundo con el teclado (tl, tr, br, bl) y devuelve los nombres de
 * las esquinas alcanzadas, en orden. Para en la primera que no alcanza.
 */
export async function walkToCorners(
  page: Page,
  world: WorldView,
  timeoutMs = 20_000,
): Promise<string[]> {
  const done: string[] = [];
  for (const corner of CORNERS) {
    if (!(await walkToCorner(page, corner, world, timeoutMs))) break;
    done.push(corner.name);
  }
  return done;
}

/**
 * Recorrido de las cuatro esquinas con el muestreador de cámara activo en todos los frames
 * (`?e2e&seed=7` a `E2E_SPEED`): devuelve las esquinas alcanzadas y el resumen del muestreo.
 */
export async function cornerTour(
  page: Page,
  view: WorldView,
  world: WorldView,
): Promise<{ walked: string[]; sample: CameraSample }> {
  await page.goto(gameUrl({ seed: 7, speed: E2E_SPEED }));
  await expectSpeed(page, E2E_SPEED);
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);
  await startCameraSampler(page, view);
  const walked = await walkToCorners(page, world);
  return { walked, sample: await stopCameraSampler(page) };
}

/** Posición en pantalla de un punto del mundo con la cámara dada: (x − izquierda, y − arriba). */
export const toScreen = (
  point: { x: number; y: number },
  camera: CameraViewData,
): { x: number; y: number } => ({ x: point.x - camera.x, y: point.y - camera.y });
