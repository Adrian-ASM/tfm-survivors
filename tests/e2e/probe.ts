import { expect, type Page } from '@playwright/test';

/**
 * Velocidad de simulación de los E2E que juegan hasta un evento lejano (design 0008): 8 avances
 * del bucle de paso fijo por frame, con el mismo resultado que a velocidad 1.
 */
export const E2E_SPEED = 8;

/**
 * URL del juego en modo E2E con la semilla, la velocidad (`speed` 1 ⇒ sin parámetro) y el modo
 * manual (`?e2e&manual`, change 0014) dados. Mapa (0015): `map=empty` por defecto, porque los E2E
 * anteriores asumen posiciones libres (spec procedural-map); los del mapa piden `map: 'real'`.
 */
export function gameUrl({
  seed,
  speed = 1,
  manual = false,
  map = 'empty',
}: { seed?: number; speed?: number; manual?: boolean; map?: 'empty' | 'real' } = {}): string {
  const params = ['e2e'];
  if (map === 'empty') params.push('map=empty');
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
  /** Clase del estado de comportamiento (0020). */
  stateKind: 'chase' | 'fuse' | 'charge' | 'wait' | 'patrol' | 'alert' | 'return';
}

/** Clase de un golpe de combate (0031). */
export type HitKindView = 'enemy' | 'structure' | 'sheep' | 'player';

/** Golpe de combate del snapshot (0031). */
export interface HitView {
  id: number;
  tick: number;
  kind: HitKindView;
  targetId?: number;
  x: number;
  y: number;
  amount: number;
}

export interface SnapshotView {
  tick: number;
  status: 'running' | 'choosing' | 'shopping' | 'building' | 'over';
  /** Tienda del castillo (0024): puerta, si está armada y oro. */
  shop: { armed: boolean; open: boolean; gold: number; door: { x: number; y: number } | null };
  outcome: 'won' | 'lost' | null;
  kills: number;
  durationTicks: number;
  player: { x: number; y: number; health: number; maxHealth: number; invulnerable: boolean };
  enemies: EnemyView[];
  projectiles: { id: number; x: number; y: number }[];
  pulses: { weapon: string; firedAt: number }[];
  weapons: { id: string; ready: boolean }[];
  gems: { id: number; x: number; y: number }[];
  /** Recogibles de los cuatro tipos (0022, `meat` desde 0023), contadores y vetas. */
  pickups: {
    id: number;
    kind: 'xp' | 'gold' | 'wood' | 'meat' | 'stone';
    source?: string;
    value: number;
    x: number;
    y: number;
  }[];
  /** Ovejas vivas (0023). */
  sheep: { id: number; x: number; y: number; state: 'graze' | 'wander' | 'flee' }[];
  resources: { gold: number; wood: number; stone: number };
  veins: { id: number; x: number; y: number; radius: number; gold: number; depleted: boolean }[];
  /** Peligros (0020): dinamitas en vuelo, avisos y explosiones visibles. */
  dynamites: { id: number; x: number; y: number }[];
  warnings: { x: number; y: number; radius: number; source: 'fuse' | 'dynamite' }[];
  blasts: { id: number; x: number; y: number; radius: number }[];
  /** Casas y torres (0021), ruinas incluidas, en su orden fijo. */
  structures: { id: number; type: string; health: number; destroyed: boolean }[];
  progression: { level: number; xp: number; xpToNext: number; pendingLevelUps: number };
  offer: { id: string; name: string; level: number; nextLevel: number }[];
  upgrades: { id: string; level: number }[];
  /** Solares (0026) y oferta de obra. */
  sites: SiteView[];
  build: { open: boolean; siteId: number | null; options: BuildOptionView[] };
  towerProjectiles: { id: number; x: number; y: number }[];
  /** Golpes de combate de la ventana (0031), en orden de id; sin `targetId` los de `player`. */
  hits: HitView[];
}

/** Huella de un edificio en un solar (0026). */
export interface FootprintView {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

/** Solar del snapshot (0026; sin acceso desde 0027). */
export interface SiteView {
  id: number;
  state: 'free' | 'house' | 'tower';
  armed: boolean;
  house: FootprintView;
  tower: FootprintView;
}

export interface BuildOptionView {
  kind: 'house' | 'tower';
  wood: number;
  stone: number;
  /** 0027: asequible con la madera y la piedra al abrirse, y lo que falta de cada una. */
  affordable: boolean;
  missing: { wood: number; stone: number };
}

/** Sonda de los solares (0026): null en el menú. */
export interface SitesProbeView {
  list: SiteView[];
  total: number;
  empty: number;
  house: number;
  tower: number;
  armed: number;
  panel: {
    visible: boolean;
    siteId: number | null;
    wood: number;
    stone: number;
    options: BuildOptionView[];
  };
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
  /** Recogibles por tipo (0022, `meat` desde 0023); `gems` es el mismo objeto que `pickups.xp`. */
  pickups: Record<'xp' | 'gold' | 'wood' | 'meat' | 'stone', SpriteCountView>;
  /** Recogibles en su aparición o su retardo, por tipo (0030; `xp` y `stone` siempre 0). */
  pickupSpawns: Record<'xp' | 'gold' | 'wood' | 'meat' | 'stone', number>;
  /** Ovejas pintadas, con reserva y por estado (0023). */
  sheep: SpriteCountView & { byState: Record<'graze' | 'wander' | 'flee', number> };
  /** Vetas pintadas (0022): activas, agotadas y con reserva. */
  veins: { active: number; depleted: number; fallback: number };
  enemyPlaceholders: Record<string, number>;
  /** Peligros pintados (0020): avisos (nunca reserva), dinamitas y explosiones. */
  warnings: SpriteCountView;
  dynamites: SpriteCountView;
  explosions: SpriteCountView;
  /** Sprites de enemigo vivo por clase de estado (0020; patrulla, alerta y vuelta desde 0021). */
  enemyStates: Record<'chase' | 'fuse' | 'charge' | 'wait' | 'patrol' | 'alert' | 'return', number>;
  /** Por tipo de estructura (0021): intactas, ruinas y cuántas con reserva; a 0 en el menú. */
  structures: Record<string, { intact: number; ruin: number; fallback: number }>;
  /** Celdas del mapa pintadas por tipo (change 0015, castle desde 0016); a 0 en el menú. */
  cells: { trunk: number; water: number; bridge: number; castle: number };
  /** Elementos del mapa pintados y cuántos con reserva, y objetos del mapa (change 0016). */
  mapArt: MapArtView;
  /** Solares pintados (0026): en obra, casas, torres y con reserva. */
  sites: { empty: number; house: number; tower: number; fallback: number };
  /** Números de daño visibles por clase y creados en la partida, y barras de vida (0031). */
  damageNumbers: Record<HitKindView, number> & { created: number };
  healthBars: number;
  /** Flechas de torre pintadas (0026). */
  towerArrows: SpriteCountView;
}

/** Elementos del mapa pintados (con reserva incluida) y con reserva. */
export interface ElementCountView {
  painted: number;
  fallback: number;
}

export type MapArtView = Record<
  'water' | 'shore' | 'foam' | 'tree' | 'canopy' | 'bridge' | 'castle',
  ElementCountView
> & {
  /** Decoración (0029): del plan, pintadas con su hoja y sin pintar por fallo de su hoja. */
  decor: { planned: number; painted: number; unpainted: number };
  objects: number;
  /** Objetos del mapa dibujados en el último frame tras el recorte por cámara (0018). */
  drawn: number;
};

/** Rectángulo visible del último frame pintado, en coordenadas de mundo (change 0013). */
export interface CameraViewData {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tamaño del mundo (la `arena` del contenido). */
/** Ventana usada en el frame y escala de UI del lienzo (sonda `viewport`, change 0017). */
export interface ViewportViewData {
  width: number;
  height: number;
  uiScale: number;
}

export interface WorldView {
  width: number;
  height: number;
}

export type CellTypeView = 'grass' | 'trunk' | 'water' | 'bridge' | 'castle';

/** Estructura del mapa en la sonda (0021), como `MapSnapshot.structures`. */
export interface MapStructureView {
  id: number;
  type: string;
  col: number;
  row: number;
  cols: number;
  rows: number;
  x: number;
  y: number;
  radius: number;
  door: { col: number; row: number; x: number; y: number } | null;
}

/** Sonda del mapa (change 0015): null en el menú. */
export interface MapView {
  cols: number;
  rows: number;
  cellSize: number;
  cells: CellTypeView[];
  counts: Record<CellTypeView, number>;
  /** Salida del jugador y centro de la zona de inicio. */
  start: { x: number; y: number; radius: number };
  /** Huella del castillo (change 0016); null con el mapa vacío. */
  castle: { firstCol: number; lastCol: number; firstRow: number; lastRow: number } | null;
  /** Casas y torres del mapa (0021): huella, centro, radio y puerta (null en la torre). */
  structures: MapStructureView[];
  /** Vetas y montones iniciales (0022), en el orden de colocación. */
  veins: { id: number; x: number; y: number; col: number; row: number; radius: number }[];
  woodPiles: { x: number; y: number }[];
  /** Solares del mapa (0026): huella y centro (sin acceso desde 0027). */
  sites: {
    id: number;
    col: number;
    row: number;
    cols: number;
    rows: number;
    x: number;
    y: number;
  }[];
  emptyForced: boolean;
}

/** Sonda de la tienda (0024): overlay visible, oro y, por producto, lo que muestra el panel. */
export interface ShopProbeView {
  visible: boolean;
  gold: number;
  products: { id: string; level: number | null; price: number | null; buyable: boolean }[];
}

interface Probe {
  __sprint?: {
    /** Mapa de la partida en curso (change 0015). */
    map?: MapView | null;
    seed: number;
    /** Velocidad de simulación resuelta en la carga (1..15; 1 si falta o es inválida). */
    speed?: number;
    snapshot: SnapshotView | null;
    results: ResultsViewData | null;
    progress: ProgressView | null;
    /** Pantalla visible (change 0009) y partidas creadas en la carga. */
    screen?: 'menu' | 'playing' | 'paused' | 'shop' | 'build';
    /** Pantallas vistas desde la carga (0024). */
    screens?: string[];
    /** Overlay de la tienda (0024). */
    shop?: ShopProbeView;
    /** Solares y panel de obra (0026): null en el menú. */
    sites?: SitesProbeView | null;
    runs?: number;
    /** Sonda de sprites (change 0012). */
    sprites?: SpritesView;
    /** Sonda de cámara (change 0013): null en el menú. */
    camera?: CameraViewData | null;
    world?: WorldView;
    /** Ventana y escala de UI (change 0017); también en el menú. */
    viewport?: ViewportViewData | null;
    /** Modo de avance manual (`?e2e&manual`) y su avance exacto de ticks (change 0014). */
    manual?: boolean;
    step?: (n: unknown) => Promise<number>;
    /** Oro y madera que muestra el HUD (0022); null en el menú. */
    hud?: { gold: string; wood: string; stone: string } | null;
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
          viewport: p.viewport ?? null,
          manual: p.manual ?? null,
          map: p.map ?? null,
          hud: p.hud ?? null,
          shop: p.shop ?? null,
          sites: p.sites ?? null,
          screens: p.screens ?? [],
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
  /** Frames en que las celdas pintadas ≠ recuentos del mapa de la sonda (o ≠ 0 en el menú). */
  cellMisses: number;
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
      cellMisses: 0,
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
        const { xp, gold, wood, stone } = s.pickups;
        const kinds = [s.player, s.enemies, s.corpses, s.projectiles, s.pulses, xp, gold, wood];
        kinds.push(stone);
        if (!snap) {
          result.menuFrames += 1;
          if (kinds.some((k) => k.visible !== 0)) miss('menú con sprites visibles');
          if (s.cells.trunk + s.cells.water + s.cells.bridge + s.cells.castle !== 0) {
            result.cellMisses += 1;
          }
          if (s.mapArt.objects !== 0 || s.mapArt.drawn !== 0) result.cellMisses += 1;
          if (s.mapArt.decor.planned !== 0) miss('menú con decoración');
          if (s.veins.active + s.veins.depleted !== 0) miss('menú con vetas');
        } else {
          result.frames += 1;
          const t = snap.tick;
          const pairs: [string, number, number][] = [
            ['enemigos', s.enemies.visible, snap.enemies.length],
            ['proyectiles', s.projectiles.visible, snap.projectiles.length],
            ['pulsos', s.pulses.visible, snap.pulses.length],
            ['gemas', s.gems.visible, snap.gems.length],
            // 0022: recogibles por tipo y vetas por estado, iguales a los del snapshot.
            ['oro', gold.visible, snap.pickups.filter((x) => x.kind === 'gold').length],
            ['madera', wood.visible, snap.pickups.filter((x) => x.kind === 'wood').length],
            // 0025: la piedra, sumando sus tres rocas.
            ['piedra', stone.visible, snap.pickups.filter((x) => x.kind === 'stone').length],
            ['vetas activas', s.veins.active, snap.veins.filter((v) => !v.depleted).length],
            ['vetas agotadas', s.veins.depleted, snap.veins.filter((v) => v.depleted).length],
          ];
          for (const [name, got, want] of pairs) {
            if (got !== want) miss(`tick ${String(t)}: ${name} ${String(got)} ≠ ${String(want)}`);
          }
          const blinkVisible =
            snap.status === 'over' || !snap.player.invulnerable || Math.floor(t / 4) % 2 === 0;
          if (s.player.visible !== (blinkVisible ? 1 : 0)) miss(`tick ${String(t)}: jugador`);
          if (s.ground.visible !== 1) result.groundMisses += 1;
          const m = p.map;
          const c = s.cells;
          const sameCells =
            m !== null &&
            m !== undefined &&
            c.trunk === m.counts.trunk &&
            c.water === m.counts.water &&
            c.bridge === m.counts.bridge &&
            c.castle === m.counts.castle;
          if (!sameCells) result.cellMisses += 1;
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

/** Golpes y números de daño de un frame pintado (0031), copiados en el mismo instante. */
export interface HitFrame {
  tick: number;
  hits: HitView[];
  numbers: SpritesView['damageNumbers'];
  healthBars: number;
}

/**
 * `step(1)` hasta el primer frame cuyo snapshot tiene un golpe de clase `kind` (0031), dentro de la
 * página (una sola llamada, sin reloj). Devuelve ese frame o null si no llega en `maxTicks`.
 */
export const stepUntilHit = (
  page: Page,
  kind: HitKindView,
  maxTicks: number,
): Promise<HitFrame | null> =>
  page.evaluate(
    async ({ kind, maxTicks }) => {
      const p = (window as unknown as Probe).__sprint;
      if (!p?.step) throw new Error('La sonda no tiene step');
      for (let i = 0; i < maxTicks; i += 1) {
        if ((await p.step(1)) !== 1) return null;
        const s = p.snapshot;
        if (s?.hits.some((h) => h.kind === kind) && p.sprites) {
          const { damageNumbers, healthBars } = p.sprites;
          return { tick: s.tick, hits: s.hits, numbers: { ...damageNumbers }, healthBars };
        }
      }
      return null;
    },
    { kind, maxTicks },
  );

/** Números de daño de la sonda en cada uno de los próximos `n` frames del navegador (0031). */
export const sampleNumbers = (page: Page, n: number): Promise<SpritesView['damageNumbers'][]> =>
  page.evaluate(async (count) => {
    const out: SpritesView['damageNumbers'][] = [];
    for (let i = 0; i < count; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const d = (window as unknown as Probe).__sprint?.sprites?.damageNumbers;
      if (d) out.push({ ...d });
    }
    return out;
  }, n);
