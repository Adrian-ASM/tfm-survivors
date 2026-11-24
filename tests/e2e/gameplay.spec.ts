import { type Page } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import player from '../../content/player.json' with { type: 'json' };
import structures from '../../content/structures.json' with { type: 'json' };
import sheepContent from '../../content/sheep.json' with { type: 'json' };
import { MAP_GOLDEN, signatureOf } from '../support/mapGolden';
import { expect, test } from './fixtures';
import {
  collect,
  expectManual,
  focusGame,
  gameUrl,
  holdKey,
  probe,
  snapshotOf,
  startSpriteSampler,
  step,
  stepUntil,
  stopSpriteSampler,
  waitForRun,
  type MapView,
} from './probe';

// Suite de humo (chore e2e-lite): lo que solo se ve en el navegador durante la partida (overlay de
// mejoras, cámara, sprites y mapa pintado), en modo manual y sin esperas de reloj.
const WORLD = { width: arena.width, height: arena.height };
/** Ventana de `playwright.config.ts`: por debajo del tope, la vista mide lo mismo (0017). */
const VIEW = { width: 1280, height: 720 };

async function openGame(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);
}

// Spec upgrades, "Recorrido en el navegador". Semilla 7 sin input: primera oferta en el tick 1.527
// con el mundo de 0017 (plazo de 80 s de juego).
const FIRST_OFFER_LIMIT = 80 * 60;

test('Subida de nivel: con ?seed=7 aparece la oferta de 3, se pulsa 1 y la partida sigue', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await openGame(page, gameUrl({ seed: 7, manual: true }));

  const offered = await stepUntil(page, (s) => s.offer.length > 0, FIRST_OFFER_LIMIT);

  expect(offered?.status).toBe('choosing');
  expect(offered?.offer).toHaveLength(3);
  // Con la oferta abierta la partida no avanza aunque se pida.
  expect(await step(page, 30)).toBe(0);
  await page.keyboard.press('1');
  expect(await step(page, 1)).toBe(1);
  const after = await snapshotOf(page);
  expect(after?.offer).toHaveLength(0);
  expect(after?.progression.level).toBe(2);
  expect(after?.upgrades).toEqual([{ id: offered?.offer[0]?.id, level: 1 }]);
  expect(problems).toEqual([]);
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Spec world-camera (0017), "Redimensionado con la oferta abierta [E2E]": vista nueva desde el primer
// frame, sin ticks, y el clic en el centro de la ventana elige la carta central (índice 1).
test('Redimensionado con la oferta abierta: vista 1.000 × 600, mismo tick y clic central → offer[1]', async ({
  page,
}) => {
  const problems = collect(page, ['error']);
  await openGame(page, gameUrl({ seed: 7, manual: true }));
  const offered = await stepUntil(page, (s) => s.offer.length > 0, FIRST_OFFER_LIMIT);
  if (!offered) throw new Error('sin oferta');

  await page.setViewportSize({ width: 1000, height: 600 });
  await expect.poll(async () => (await probe(page))?.camera?.width ?? null).toBe(1000);

  const p = await probe(page);
  const s = p?.snapshot;
  const cam = p?.camera;
  if (!s || !cam) throw new Error('sin sonda');
  expect(p.viewport).toEqual({ width: 1000, height: 600, uiScale: 1 });
  expect([cam.width, cam.height]).toEqual([1000, 600]);
  expect(Math.abs(cam.x - clamp(s.player.x - 500, 0, WORLD.width - 1000))).toBeLessThanOrEqual(1);
  expect(Math.abs(cam.y - clamp(s.player.y - 300, 0, WORLD.height - 600))).toBeLessThanOrEqual(1);
  expect(s.tick).toBe(offered.tick);
  expect(s.offer.map((o) => o.id)).toEqual(offered.offer.map((o) => o.id));

  await page.mouse.click(500, 300);
  expect(await step(page, 1)).toBe(1);
  const after = await snapshotOf(page);
  expect(after?.upgrades).toEqual([{ id: offered.offer[1]?.id, level: 1 }]);
  expect(problems).toEqual([]);
});

// Spec world-camera, "Nada fuera del mundo con el mapa real": la cámara sigue al jugador sin
// suavizado y recortada al mundo.
/**
 * 0017: con el mapa real de 64 × 36 (~700 objetos) a 1.280 × 720, el runner de CI sin GPU pinta
 * cada frame ~2,5 veces más lento que en 0016 y estos bucles esperan un frame por step. Triple de
 * plazo con `test.slow()`; sin umbrales de fps ni de tiempo (regla e2e-lite).
 */
function slowMapRealOnCi(): void {
  test.slow();
}

test('Cámara: centrada al empezar y sigue al jugador hacia la derecha sin salir del mundo', async ({
  page,
}) => {
  slowMapRealOnCi();
  await openGame(page, gameUrl({ seed: 7, manual: true, map: 'real' }));
  const first = await probe(page);
  expect(first?.world).toEqual(WORLD);
  // 0017: ventana 1.280 × 720 a ×1; la vista mide lo mismo y sigue la fórmula de la cámara.
  expect(first?.viewport).toEqual({ ...VIEW, uiScale: 1 });
  const p0 = first?.snapshot?.player ?? { x: 0, y: 0 };
  expect(first?.camera).toEqual({
    x: clamp(p0.x - VIEW.width / 2, 0, WORLD.width - VIEW.width),
    y: clamp(p0.y - VIEW.height / 2, 0, WORLD.height - VIEW.height),
    ...VIEW,
  });
  expect([first?.camera?.x, first?.camera?.y]).toEqual([1310, 810]);

  // Spec sprite-rendering (0018), "Objetos dibujados con la cámara": 0 < drawn < objetos del mapa en
  // cada lectura, objetos constantes y drawn que cambia al moverse.
  const art0 = first?.sprites?.mapArt;
  const drawnReads = [`${String(art0?.drawn)}/${String(art0?.objects)}`];
  const problems: string[] = [];
  for (let i = 0; i < 20; i++) {
    if ((await snapshotOf(page))?.offer.length) await page.keyboard.press('1');
    await holdKey(page, 'ArrowRight', 60);
    const p = await probe(page);
    const cam = p?.camera;
    const s = p?.snapshot;
    const art = p?.sprites?.mapArt;
    drawnReads.push(`${String(art?.drawn)}/${String(art?.objects)}`);
    if (!cam || !s) {
      problems.push(`lectura ${String(i)} sin cámara`);
      continue;
    }
    const inside =
      cam.x >= 0 &&
      cam.y >= 0 &&
      cam.x + cam.width <= WORLD.width &&
      cam.y + cam.height <= WORLD.height;
    const ex = clamp(s.player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const ey = clamp(s.player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    if (!inside || Math.abs(cam.x - ex) > 1 || Math.abs(cam.y - ey) > 1) {
      problems.push(`tick ${String(s.tick)}: (${String(cam.x)}, ${String(cam.y)})`);
    }
  }
  expect(problems).toEqual([]);
  const objects = art0?.objects ?? 0;
  const badDrawn = drawnReads.filter((r) => {
    const [drawn = NaN, total = NaN] = r.split('/').map(Number);
    return !(drawn > 0 && drawn < total && total === objects);
  });
  expect(badDrawn).toEqual([]);
  expect(new Set(drawnReads.map((r) => r.split('/')[0])).size).toBeGreaterThan(1);
});

// Spec sprite-rendering: sonda de sprites coherente con el snapshot en cada frame pintado y
// aspecto de reserva solo para el tipo cuya hoja no carga.
const TORCH_SHEET = '**/Factions/Goblins/Troops/Torch/Red/Torch_Red.png';
/** Hojas del mapa (0016) que también se bloquean: agua, espuma, árbol, puente y castillo. */
const MAP_SHEETS = ['Water.png', 'Foam.png', 'Tree.png', 'Bridge_All.png', 'Castle_Blue.png'];
const BLOCKED = ['Torch_Red.png', ...MAP_SHEETS];
/** Ticks por step mientras se muestrea: varios frames pintados. */
const SAMPLED_CHUNK = 10;
const SAMPLED_TICKS = 600;

test('Sprites: recuentos de la sonda iguales al snapshot y reserva si fallan Torch y las hojas del mapa', async ({
  page,
}) => {
  slowMapRealOnCi();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Solo se ignora el "Failed to load resource" de las hojas abortadas.
    const blocked = BLOCKED.some((f) => m.location().url.includes(f));
    if (!(blocked && m.text().startsWith('Failed to load resource'))) problems.push(m.text());
  });
  await page.route(TORCH_SHEET, (route) => route.abort());
  for (const sheet of MAP_SHEETS) await page.route(`**/${sheet}`, (route) => route.abort());
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));

  // Spec sprite-rendering (0016), "Hojas del mapa bloqueadas": reserva por elemento del mapa.
  expect(await step(page, 60)).toBe(60);
  const blockedMap = await probe(page);
  const counts = blockedMap?.map?.counts;
  const art = blockedMap?.sprites?.mapArt;
  if (!counts || !art) throw new Error('sin sonda del mapa');
  expect(blockedMap.snapshot?.tick).toBe(60);
  expect([art.water, art.tree, art.bridge]).toEqual([
    { painted: counts.water, fallback: counts.water },
    { painted: counts.trunk, fallback: counts.trunk },
    { painted: counts.bridge, fallback: counts.bridge },
  ]);
  expect(art.castle).toEqual({ painted: 1, fallback: 1 });
  expect([art.foam.painted, art.canopy.painted]).toEqual([0, 0]);

  await startSpriteSampler(page, 'goblin-torch');
  const reached = await stepUntil(
    page,
    (s) => s.tick >= SAMPLED_TICKS,
    2 * SAMPLED_TICKS,
    SAMPLED_CHUNK,
  );
  const sample = await stopSpriteSampler(page);

  expect(reached).not.toBeNull();
  expect(sample.frames).toBeGreaterThan(0);
  expect(sample.mismatches).toEqual([]);
  expect(sample.typeMismatches).toBe(0);
  expect(sample.placeholderFrames).toBeGreaterThan(0);
  expect([sample.groundMisses, sample.cellMisses]).toEqual([0, 0]);
  expect(problems).toEqual([]);
});

/** ¿Solapa el círculo (x, y, r) una celda `trunk`, `water` o `castle`? (tangencia no es solape). */
function overlapsBlocked(m: MapView, x: number, y: number, r: number): boolean {
  const s = m.cellSize;
  for (let row = 0; row < m.rows; row++) {
    for (let col = 0; col < m.cols; col++) {
      const t = m.cells[row * m.cols + col];
      if (t !== 'trunk' && t !== 'water' && t !== 'castle') continue;
      const nx = Math.max(col * s, Math.min(x, (col + 1) * s));
      const ny = Math.max(row * s, Math.min(y, (row + 1) * s));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r - 1e-6) return true;
    }
  }
  return false;
}

/** Celdas `grass`, `trunk` o `castle` con ≥ 1 vecina 4-conexa `water` o `bridge` en la rejilla. */
function shoreCount(m: MapView): number {
  const at = (c: number, r: number) =>
    c < 0 || r < 0 || c >= m.cols || r >= m.rows ? undefined : m.cells[r * m.cols + c];
  const wet = (t: string | undefined) => t === 'water' || t === 'bridge';
  let n = 0;
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      const t = at(c, r);
      if (t !== 'grass' && t !== 'trunk' && t !== 'castle') continue;
      if (wet(at(c, r - 1)) || wet(at(c + 1, r)) || wet(at(c, r + 1)) || wet(at(c - 1, r))) n++;
    }
  }
  return n;
}

type ProbeRead = Awaited<ReturnType<typeof probe>>;

/** Tipos de estructura en los que la sonda de render no casa con el snapshot (0021). */
function structureMisses(p: ProbeRead): string[] {
  const counts = p?.sprites?.structures ?? {};
  const list = p?.snapshot?.structures ?? [];
  const types = new Set([...Object.keys(counts), ...list.map((s) => s.type)]);
  return [...types].flatMap((type) => {
    const got = counts[type] ?? { intact: -1, ruin: -1, fallback: -1 };
    const mine = list.filter((s) => s.type === type);
    const want = { intact: mine.filter((s) => !s.destroyed).length, ruin: 0, fallback: 0 };
    want.ruin = mine.length - want.intact;
    const same = got.intact === want.intact && got.ruin === want.ruin && got.fallback === 0;
    return same ? [] : [`${type}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`];
  });
}

/**
 * Recursos en los que la sonda de render no casa con el snapshot (0022): sprites `wood` y `gold`
 * visibles = recogibles de su tipo, vetas activas y agotadas = las del snapshot, y sin reserva.
 */
function resourceMisses(p: ProbeRead): string[] {
  const s = p?.sprites;
  const snap = p?.snapshot;
  if (!s || !snap) return ['sin sonda'];
  const of = (kind: 'gold' | 'wood') => snap.pickups.filter((x) => x.kind === kind).length;
  const pairs: [string, number, number][] = [
    ['wood', s.pickups.wood.visible, of('wood')],
    ['gold', s.pickups.gold.visible, of('gold')],
    ['vetas activas', s.veins.active, snap.veins.filter((v) => !v.depleted).length],
    ['vetas agotadas', s.veins.depleted, snap.veins.filter((v) => v.depleted).length],
    ['reserva', s.pickups.wood.placeholder + s.pickups.gold.placeholder + s.veins.fallback, 0],
  ];
  return pairs.flatMap(([k, got, want]) =>
    got === want ? [] : [`${k}: ${String(got)}≠${String(want)}`],
  );
}

/** Ovejas pintadas (número y por estado) y carne frente al snapshot, sin reserva (0023). */
function sheepMisses(p: ProbeRead): string[] {
  const s = p?.sprites;
  const snap = p?.snapshot;
  if (!s || !snap) return ['sin sonda'];
  const by = (state: 'graze' | 'wander' | 'flee') => snap.sheep.filter((o) => o.state === state);
  const pairs: [string, number, number][] = [
    ['ovejas', s.sheep.visible, snap.sheep.length],
    ['graze', s.sheep.byState.graze, by('graze').length],
    ['wander', s.sheep.byState.wander, by('wander').length],
    ['flee', s.sheep.byState.flee, by('flee').length],
    ['meat', s.pickups.meat.visible, snap.pickups.filter((x) => x.kind === 'meat').length],
    ['reserva', s.sheep.placeholder + s.pickups.meat.placeholder, 0],
  ];
  return pairs.flatMap(([k, got, want]) =>
    got === want ? [] : [`${k}: ${String(got)}≠${String(want)}`],
  );
}

// Spec procedural-map, "Sonda coherente con el núcleo", y player-movement, "Sin solapes en la
// build con el mapa real". Los E2E no importan `src/`: la firma dorada se fija en un unitario.
// 0021, sprite-rendering "Estructuras y guardias en el navegador" (ampliación, sin input).
test('Mapa real: sonda igual a la firma de la semilla 42, castillo y salida, y sin atravesar troncos, agua ni castillo', async ({
  page,
}) => {
  slowMapRealOnCi();
  const problems = collect(page, ['pageerror', 'error']);
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  const first = await probe(page);
  const m = first?.map;
  if (!m) throw new Error('sin mapa');
  expect(signatureOf(m.cells)).toBe(MAP_GOLDEN[42]);
  expect(m.emptyForced).toBe(false);
  expect(m.counts.trunk).toBeGreaterThan(0);
  // 0017, "Sonda con castillo y salida": 64 × 36, huella 30–34 × 15–18 y salida (1.950, 1.170).
  expect([m.cols, m.rows]).toEqual([64, 36]);
  expect(m.counts.castle).toBe(20);
  expect(m.castle).toEqual({ firstCol: 30, lastCol: 34, firstRow: 15, lastRow: 18 });
  expect([m.start.x, m.start.y]).toEqual([1950, 1170]);
  expect([first.snapshot?.player.x, first.snapshot?.player.y]).toEqual([1950, 1170]);
  expect(first.sprites?.cells).toEqual({
    trunk: m.counts.trunk,
    water: m.counts.water,
    bridge: m.counts.bridge,
    castle: 20,
  });
  // "Recuentos del mapa pintado": orillas calculadas aquí sobre la lista de celdas de la sonda.
  const shores = shoreCount(m);
  const art = first.sprites?.mapArt;
  const ok = (painted: number) => ({ painted, fallback: 0 });
  expect(art && { ...art, objects: undefined, drawn: undefined }).toEqual({
    water: ok(m.counts.water),
    shore: ok(shores),
    foam: ok(shores),
    tree: ok(m.counts.trunk),
    canopy: ok(m.counts.trunk),
    bridge: ok(m.counts.bridge),
    castle: ok(1),
    objects: undefined,
    drawn: undefined,
  });
  expect(shores).toBeGreaterThan(0);

  // 0021, "Estructuras y guardias en el navegador": sin input, al arrancar y tras el intervalo de
  // nacimiento de la casa + 1 tick, pintadas intactas/ruina por tipo = snapshot y sin reserva.
  expect(m.structures.length).toBeGreaterThan(0);
  expect(structureMisses(first)).toEqual([]);
  // 0022: montones (`wood`) y vetas activas pintados = los del snapshot, sin reserva.
  expect(m.woodPiles.length).toBeGreaterThan(0);
  expect(m.veins.length).toBeGreaterThan(0);
  expect(first.sprites?.pickups.wood.visible).toBe(m.woodPiles.length);
  expect(first.sprites?.veins.active).toBe(m.veins.length);
  expect(resourceMisses(first)).toEqual([]);
  // 0023: ovejas pintadas = las del snapshot (al arrancar, el tope del contenido) y carne, sin reserva.
  expect(first.snapshot?.sheep).toHaveLength(sheepContent.maxAlive);
  expect(sheepMisses(first)).toEqual([]);
  await step(page, structures.types['goblin-house'].guards.everyTicks + 1);
  const later = await probe(page);
  expect(later?.snapshot?.status).toBe('running');
  expect(structureMisses(later)).toEqual([]);
  expect(resourceMisses(later)).toEqual([]);
  expect(sheepMisses(later)).toEqual([]);
  expect(later?.sprites?.enemyStates.patrol ?? 0).toBeGreaterThanOrEqual(1);
  expect(later?.sprites?.enemies.placeholder).toBe(0);
  expect(problems).toEqual([]);

  const overlaps: string[] = [];
  for (const key of [
    ...Array<string>(10).fill('ArrowRight'),
    ...Array<string>(10).fill('ArrowDown'),
  ]) {
    if ((await snapshotOf(page))?.offer.length) await page.keyboard.press('1');
    await holdKey(page, key, 60);
    const s = await snapshotOf(page);
    if (s && overlapsBlocked(m, s.player.x, s.player.y, player.radius)) {
      overlaps.push(String(s.tick));
    }
  }
  expect(overlaps).toEqual([]);
});

// Spec sprite-rendering (0020), "Barril en mecha y su explosión en el navegador" y "Recuento
// coherente con el snapshot" (parte de peligros): semilla 7 con el mapa vacío, jugador quieto,
// step(120) hasta que la partida termina (antes del tick 10.800) y política de elección fija.
const HAZARD_SEED = 7;
const HAZARD_STEP = 120;

test('Peligros: barril en mecha con su aviso y después su explosión, sin reserva y como el snapshot', async ({
  page,
}) => {
  const problems = collect(page, ['pageerror', 'error']);
  await openGame(page, gameUrl({ seed: HAZARD_SEED, manual: true }));
  const misses: string[] = [];
  let fuseRead = -1;
  let blastRead = -1;
  for (let read = 0; read < 10_800 / HAZARD_STEP; read++) {
    const p = await probe(page);
    const s = p?.snapshot;
    const sprites = p?.sprites;
    if (!s || !sprites) throw new Error('sin sonda');
    const pairs: [string, number, number][] = [
      ['avisos', sprites.warnings.visible, s.warnings.length],
      ['dinamitas', sprites.dynamites.visible, s.dynamites.length],
      ['explosiones', sprites.explosions.visible, s.blasts.length],
    ];
    for (const [name, got, want] of pairs) {
      if (got !== want)
        misses.push(`tick ${String(s.tick)}: ${name} ${String(got)} ≠ ${String(want)}`);
    }
    const clean =
      sprites.enemies.placeholder +
        sprites.dynamites.placeholder +
        sprites.explosions.placeholder ===
      0;
    if (fuseRead < 0 && clean && sprites.warnings.visible > 0 && sprites.enemyStates.fuse > 0) {
      fuseRead = read;
    }
    if (fuseRead >= 0 && read > fuseRead && clean && sprites.explosions.visible > 0) {
      blastRead = read;
    }
    if (s.status === 'over') break;
    if (s.offer.length > 0) await page.keyboard.press('1');
    await step(page, HAZARD_STEP);
  }
  const end = await snapshotOf(page);
  expect(end?.status).toBe('over');
  expect(end?.tick ?? 10_800).toBeLessThan(10_800);
  expect(fuseRead).toBeGreaterThanOrEqual(0);
  expect(blastRead).toBeGreaterThan(fuseRead);
  expect(misses).toEqual([]);
  expect(problems).toEqual([]);
});

/** Punto de paso del recorrido (centro de una celda), en px de mundo. */
interface Waypoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Recorrido de la salida al montón (0022): BFS de 4 vecinos por celdas caminables (`grass` y
 * `bridge`) desde la celda de la salida hasta la del montón, comprimido en tramos rectos entre
 * centros de celda (el radio del jugador, 16, cabe en media celda: ningún tramo roza un bloqueo).
 * `null` si no hay camino. El primer punto es el centro de la celda de la salida.
 */
function routeTo(m: MapView, pile: { x: number; y: number }): Waypoint[] | null {
  const s = m.cellSize;
  const walkable = (c: number, r: number) =>
    c >= 0 &&
    r >= 0 &&
    c < m.cols &&
    r < m.rows &&
    ['grass', 'bridge'].includes(m.cells[r * m.cols + c] ?? '');
  const from = Math.floor(m.start.y / s) * m.cols + Math.floor(m.start.x / s);
  const to = Math.floor(pile.y / s) * m.cols + Math.floor(pile.x / s);
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  for (let head = 0; head < queue.length && !prev.has(to); head++) {
    const i = queue[head] ?? 0;
    const c = i % m.cols;
    const r = (i - c) / m.cols;
    for (const [dc, dr] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const j = (r + dr) * m.cols + c + dc;
      if (!walkable(c + dc, r + dr) || prev.has(j)) continue;
      prev.set(j, i);
      queue.push(j);
    }
  }
  if (!prev.has(to)) return null;
  const cells: number[] = [];
  for (let i = to; i !== -1; i = prev.get(i) ?? -1) cells.unshift(i);
  const center = (i: number): Waypoint => ({
    x: (i % m.cols) * s + s / 2,
    y: Math.floor(i / m.cols) * s + s / 2,
  });
  // Solo los giros (y el final): tramos rectos entre ellos.
  const turns = cells.filter((i, k) => {
    const a = cells[k - 1];
    const b = cells[k + 1];
    return a === undefined || b === undefined || i - a !== b - i;
  });
  return turns.map(center);
}

/** Tecla y ticks para ir en línea recta (un eje) desde `at` hasta `to`. */
function legTo(at: Waypoint, to: Waypoint): { key: string; ticks: number } | null {
  const dx = to.x - at.x;
  const dy = to.y - at.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const d = horizontal ? dx : dy;
  const ticks = Math.round(Math.abs(d) / (player.speed / 60));
  if (ticks === 0) return null;
  const key = horizontal ? (d > 0 ? 'ArrowRight' : 'ArrowLeft') : d > 0 ? 'ArrowDown' : 'ArrowUp';
  return { key, ticks };
}

// Spec hud (0022), "Contadores en el navegador": semilla 42 con el mapa real, el jugador va al
// montón más cercano a la salida por un recorrido sin bloqueos y, en cada lectura, el oro y la
// madera del HUD son los del snapshot pintado. Modo manual, sin esperas de reloj.
test('Recursos: el HUD muestra el oro y la madera del snapshot mientras se va al montón más cercano', async ({
  page,
}) => {
  slowMapRealOnCi();
  const problems = collect(page, ['pageerror', 'error']);
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  const m = (await probe(page))?.map;
  if (!m) throw new Error('sin mapa');
  const exit = m.start;
  const nearest = [...m.woodPiles].sort(
    (a, b) => Math.hypot(a.x - exit.x, a.y - exit.y) - Math.hypot(b.x - exit.x, b.y - exit.y),
  )[0];
  if (!nearest) throw new Error('sin montones');
  const route = routeTo(m, nearest);
  // Precondición: un recorrido sin bloqueos (celdas caminables) de la salida al montón.
  expect(route).not.toBeNull();
  for (const w of route ?? []) expect(overlapsBlocked(m, w.x, w.y, player.radius)).toBe(false);

  const mismatches: string[] = [];
  const read = async () => {
    const p = await probe(page);
    const snap = p?.snapshot;
    const shown = p?.hud;
    if (!snap || !shown) {
      mismatches.push('sin lectura');
      return null;
    }
    const want = { gold: String(snap.resources.gold), wood: String(snap.resources.wood) };
    if (shown.gold !== want.gold || shown.wood !== want.wood) {
      mismatches.push(
        `tick ${String(snap.tick)}: ${JSON.stringify(shown)}≠${JSON.stringify(want)}`,
      );
    }
    return snap;
  };
  let last = await read();
  // Cada tramo se apunta desde la posición real del jugador (sin deriva acumulada); para en cuanto
  // la madera sube (el imán atrae el montón a < 128 px).
  for (const w of route ?? []) {
    for (let guard = 0; guard < 40 && (last?.resources.wood ?? 0) === 0; guard++) {
      const at = last?.player;
      const leg = at ? legTo(at, w) : null;
      if (!leg) break;
      if (last?.offer.length) await page.keyboard.press('1');
      await holdKey(page, leg.key, Math.min(30, leg.ticks));
      last = await read();
    }
  }
  for (let i = 0; i < 20 && (last?.resources.wood ?? 0) === 0; i++) {
    if (last?.offer.length) await page.keyboard.press('1');
    await step(page, 10);
    last = await read();
  }
  expect(mismatches).toEqual([]);
  expect(last?.resources.wood ?? 0).toBeGreaterThan(0);
  expect((await probe(page))?.hud?.wood).toBe(String(last?.resources.wood));
  expect(problems).toEqual([]);
});
