import { type Page } from '@playwright/test';
import arena from '../../content/arena.json' with { type: 'json' };
import player from '../../content/player.json' with { type: 'json' };
import structures from '../../content/structures.json' with { type: 'json' };
import sheepContent from '../../content/sheep.json' with { type: 'json' };
import combat from '../../content/combat.json' with { type: 'json' };
import { MAP_GOLDEN, signatureOf } from '../support/mapGolden';
import { expect, test } from './fixtures';
import {
  collect,
  cspState,
  DESKTOP_VIEWPORT_EXTRA,
  expectManual,
  focusGame,
  gameUrl,
  holdKey,
  playToEnd,
  probe,
  snapshotOf,
  startSpriteSampler,
  step,
  stepUntil,
  stepUntilHit,
  sampleNumbers,
  backToMenu,
  stopSpriteSampler,
  waitForRun,
  watchCsp,
  pauseOverlay,
  type MapView,
  type SnapshotView,
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

// Spec sprite-rendering (0031), "Números de daño en el navegador [E2E]": antes de la oferta, el
// primer golpe a un enemigo crea sus números; en pausa no cambian; tras `step(60)` (1.000 ms > L)
// solo se ven los de los golpes nuevos; en el menú, 0 números y 0 barras.
test('Subida de nivel y Números de daño en el navegador: con ?seed=7 golpes, pausa, oferta de 3 y menú', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await openGame(page, gameUrl({ seed: 7, manual: true }));

  const first = await stepUntilHit(page, 'enemy', FIRST_OFFER_LIMIT, combat.hitWindowTicks);
  if (!first) throw new Error('sin golpes a enemigos antes de la oferta');
  const enemyHits = first.hits.filter((h) => h.kind === 'enemy').length;
  expect(first.hits.every((h) => h.kind === 'enemy')).toBe(true);
  expect([first.numbers.enemy, first.numbers.created]).toEqual([enemyHits, first.hits.length]);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page))?.screen).toBe('paused');
  const paused = await sampleNumbers(page, 30);
  expect(paused).toHaveLength(30);
  expect(paused.every((d) => d.created === first.numbers.created)).toBe(true);
  expect(paused.every((d) => d.enemy === first.numbers.enemy)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page))?.screen).toBe('playing');
  expect(await step(page, 60)).toBe(60);
  const later = await probe(page);
  const lastId = Math.max(...first.hits.map((h) => h.id));
  const fresh = (later?.snapshot?.hits ?? []).filter((h) => h.id > lastId).length;
  const numbers = later?.sprites?.damageNumbers;
  if (!numbers) throw new Error('sin sonda de números');
  expect(numbers.created - first.numbers.created).toBe(fresh);
  // Los del primer frame ya no se ven: todos los visibles son de los golpes nuevos.
  expect(numbers.enemy + numbers.structure + numbers.sheep + numbers.player).toBe(fresh);

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
  await backToMenu(page);
  const menu = (await probe(page))?.sprites;
  expect([menu?.damageNumbers, menu?.healthBars]).toEqual([
    { enemy: 0, structure: 0, sheep: 0, player: 0, created: 0 },
    0,
  ]);
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
  expect(p.viewport).toEqual({ width: 1000, height: 600, uiScale: 1, ...DESKTOP_VIEWPORT_EXTRA });
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
  expect(first?.viewport).toEqual({ ...VIEW, uiScale: 1, ...DESKTOP_VIEWPORT_EXTRA });
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
/**
 * Hojas del mapa (0016) que también se bloquean: agua, espuma, árbol, puente y castillo; 0029: y la
 * del espantapájaros de la decoración.
 */
const MAP_SHEETS = [
  'Water.png',
  'Foam.png',
  'Tree.png',
  'Bridge_All.png',
  'Castle_Blue.png',
  'Deco/18.png',
];
/** Espantapájaros del plan de la semilla 42 (lo fija también `plan-decor.test.ts`, sin navegador). */
const SCARECROWS_42 = 3;
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
  // 0029: sin pintar, exactamente las del espantapájaros; el resto de la decoración, con su arte.
  expect(art.decor.unpainted).toBe(SCARECROWS_42);
  expect(art.decor.painted).toBe(art.decor.planned - SCARECROWS_42);
  expect(art.decor.painted).toBeGreaterThan(0);

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
 * visibles = recogibles de su tipo menos los que están en su retardo de aparición (0030, `delayed`),
 * vetas activas y agotadas = las del snapshot, y sin reserva.
 */
function resourceMisses(p: ProbeRead, delayed: { wood?: number } = {}): string[] {
  const s = p?.sprites;
  const snap = p?.snapshot;
  if (!s || !snap) return ['sin sonda'];
  const of = (kind: 'gold' | 'wood') => snap.pickups.filter((x) => x.kind === kind).length;
  const pairs: [string, number, number][] = [
    ['wood', s.pickups.wood.visible, of('wood') - (delayed.wood ?? 0)],
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
  expect(art && { ...art, decor: undefined, objects: undefined, drawn: undefined }).toEqual({
    water: ok(m.counts.water),
    shore: ok(shores),
    foam: ok(shores),
    tree: ok(m.counts.trunk),
    canopy: ok(m.counts.trunk),
    bridge: ok(m.counts.bridge),
    castle: ok(1),
    decor: undefined,
    objects: undefined,
    drawn: undefined,
  });
  expect(shores).toBeGreaterThan(0);
  // 0029: decoración del plan ≥ 1, toda pintada con su hoja.
  const decor = art?.decor;
  expect(decor?.planned).toBeGreaterThanOrEqual(1);
  expect(decor).toEqual({ planned: decor?.planned, painted: decor?.planned, unpainted: 0 });

  // 0021, "Estructuras y guardias en el navegador": sin input, al arrancar y tras el intervalo de
  // nacimiento de la casa + 1 tick, pintadas intactas/ruina por tipo = snapshot y sin reserva.
  expect(m.structures.length).toBeGreaterThan(0);
  expect(structureMisses(first)).toEqual([]);
  // 0022: montones (`wood`) y vetas activas pintados = los del snapshot, sin reserva.
  expect(m.woodPiles.length).toBeGreaterThan(0);
  expect(m.veins.length).toBeGreaterThan(0);
  expect(first.sprites?.veins.active).toBe(m.veins.length);
  // 0030: al arrancar (primer pintado, sin step) los montones están en su retardo (ocultos) o en su
  // aparición, con las hojas *_Spawn cargadas de verdad; ningún otro tipo aparece. Visibles: los
  // montones menos los que siguen en su retardo, ≥ 1 (el de id 0 ya ha empezado).
  const woodShown = first.sprites?.pickups.wood.visible ?? 0;
  expect(woodShown).toBeGreaterThanOrEqual(1);
  expect(woodShown).toBeLessThanOrEqual(m.woodPiles.length);
  expect(resourceMisses(first, { wood: m.woodPiles.length - woodShown })).toEqual([]);
  expect(first.sprites?.pickupSpawns).toEqual({
    xp: 0,
    gold: 0,
    wood: m.woodPiles.length,
    meat: 0,
    stone: 0,
  });
  // 0023: ovejas pintadas = las del snapshot (al arrancar, el tope del contenido) y carne, sin reserva.
  expect(first.snapshot?.sheep).toHaveLength(sheepContent.maxAlive);
  expect(sheepMisses(first)).toEqual([]);
  await step(page, structures.types['goblin-house'].guards.everyTicks + 1);
  const later = await probe(page);
  expect(later?.snapshot?.status).toBe('running');
  expect(structureMisses(later)).toEqual([]);
  expect(resourceMisses(later)).toEqual([]);
  // 0030: tras `everyTicks + 1` ticks (≫ 1.540 ms de reloj), los montones ya están en idle.
  expect(later?.sprites?.pickupSpawns.wood).toBe(0);
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

/** ¿Es (c, r) una celda de la huella de algún solar? (0027: no caminable desde el tick 0). */
const inSite = (m: MapView, c: number, r: number): boolean =>
  m.sites.some((x) => c >= x.col && c < x.col + x.cols && r >= x.row && r < x.row + x.rows);

/**
 * Recorrido de la salida al montón (0022): BFS de 4 vecinos por celdas caminables (`grass` y
 * `bridge` fuera de las huellas de los solares, 0027) desde la celda de la salida hasta la del
 * montón, comprimido en tramos rectos entre centros de celda (el radio del jugador, 16, cabe en
 * media celda: ningún tramo roza un bloqueo ni toca un solar). `null` si no hay camino. El primer
 * punto es el centro de la celda de la salida.
 */
function routeTo(m: MapView, pile: { x: number; y: number }): Waypoint[] | null {
  const s = m.cellSize;
  const walkable = (c: number, r: number) =>
    c >= 0 &&
    r >= 0 &&
    c < m.cols &&
    r < m.rows &&
    ['grass', 'bridge'].includes(m.cells[r * m.cols + c] ?? '') &&
    !inSite(m, c, r);
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
test('Recursos: el HUD muestra el oro, la madera y la piedra del snapshot mientras se va al montón más cercano', async ({
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
    // 0025, "Piedra en el navegador": también la piedra del HUD y los sprites de piedra.
    const want = {
      gold: String(snap.resources.gold),
      wood: String(snap.resources.wood),
      stone: String(snap.resources.stone),
    };
    if (shown.gold !== want.gold || shown.wood !== want.wood || shown.stone !== want.stone) {
      mismatches.push(
        `tick ${String(snap.tick)}: ${JSON.stringify(shown)}≠${JSON.stringify(want)}`,
      );
    }
    const stones = snap.pickups.filter((x) => x.kind === 'stone').length;
    const painted = p.sprites?.pickups.stone.visible;
    if (painted !== stones) {
      mismatches.push(`tick ${String(snap.tick)}: piedras ${String(painted)}≠${String(stones)}`);
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

// Spec castle-shop (0024), "Abrir, intentar comprar y salir [E2E]": recorrido determinista con
// ?seed=42 y el mapa real (design §7). ↓ hasta que la tienda se arma y ↑ hasta que se abre; el oro
// es 0 a esa altura (precondición comprobada), así que el clic en el producto más barato no compra.
// 0034, sprite-rendering "Iconos en la oferta y en la tienda [E2E]": las 7 filas y, tras salir, las cartas de
// la primera oferta con su icono (painted), y 0 violaciones de CSP.
test('Tienda: se abre al volver a la puerta, un clic sin oro no compra y Esc sale sin pausa', async ({
  page,
}) => {
  slowMapRealOnCi();
  const problems = collect(page, ['pageerror', 'error']);
  await watchCsp(page);
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  const read = async () => {
    const s = await snapshotOf(page);
    if (!s) throw new Error('sin snapshot');
    return s;
  };
  let snap = await read();
  for (let i = 0; i < 20 && !snap.shop.armed; i++) {
    await holdKey(page, 'ArrowDown', 5);
    snap = await read();
  }
  expect([snap.shop.armed, snap.status]).toEqual([true, 'running']);
  let last = 5;
  for (let i = 0; i < 20 && snap.status === 'running'; i++) {
    last = await holdKey(page, 'ArrowUp', 5);
    snap = await read();
  }
  expect([snap.status, last < 5]).toEqual(['shopping', true]);

  const open = (await probe(page))?.shop;
  expect(open?.visible).toBe(true);
  expect(open?.gold).toBe(snap.resources.gold);
  expect(snap.resources.gold).toBe(0);
  const priced = (open?.products ?? []).filter((p) => p.price !== null);
  const cheapest = [...priced].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0];
  if (!cheapest) throw new Error('sin productos con precio');
  expect(cheapest.buyable).toBe(false);
  // 0034: las 7 filas (6 mejoras de arma y la curación) con su propio icono.
  expect(open?.products.map((p) => p.icon)).toEqual(Array.from({ length: 7 }, () => 'painted'));

  // La fila no comprable lleva aria-disabled (Playwright no la pulsa sin force); el clic llega al
  // caso de uso, que rechaza la compra sin cambios (spec "Clic sin oro").
  await page.locator(`[data-product="${cheapest.id}"]`).click({ force: true });
  await step(page, 1);
  const after = await probe(page);
  const same = after?.shop?.products.find((p) => p.id === cheapest.id);
  expect([after?.snapshot?.resources.gold, same?.level, same?.buyable]).toEqual([
    0,
    cheapest.level,
    false,
  ]);

  await focusGame(page);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page))?.shop?.visible).toBe(false);
  const tick = (await read()).tick;
  expect(await step(page, 1)).toBe(1);
  expect((await read()).tick).toBe(tick + 1);
  const seen = (await probe(page))?.screens ?? [];
  expect(seen).toContain('shop');
  expect(seen).not.toContain('paused');

  // 0034: tras salir, hasta la primera oferta; cada carta con su icono (painted) y su id.
  const offered = await stepUntil(page, (s) => s.offer.length > 0, FIRST_OFFER_LIMIT);
  if (!offered) throw new Error('sin oferta de mejora');
  const cards = (await probe(page))?.offerIcons ?? [];
  expect(cards.map((c) => c.id)).toEqual(offered.offer.map((o) => o.id));
  expect(cards.map((c) => c.icon)).toEqual(offered.offer.map(() => 'painted'));
  expect(cards.length).toBe(3);
  expect((await cspState(page)).violations).toEqual([]);
  expect(problems).toEqual([]);
});

/** Como `routeTo`, desde un punto cualquiera (la posición actual del jugador). */
function routeFrom(m: MapView, from: Waypoint, to: Waypoint): Waypoint[] | null {
  return routeTo({ ...m, start: { x: from.x, y: from.y, radius: 0 } }, to);
}

/** Lo justo del snapshot para recorrer el mapa: una lectura ligera (sin sprites, mapa ni HUD). */
interface WalkView {
  readonly status: string;
  readonly player: Waypoint;
  readonly wood: number;
}

const walkViewOf = (page: Page): Promise<WalkView | null> =>
  page.evaluate(() => {
    const s = (window as unknown as { __sprint?: { snapshot?: SnapshotView | null } }).__sprint
      ?.snapshot;
    return s
      ? { status: s.status, player: { x: s.player.x, y: s.player.y }, wood: s.resources.wood }
      : null;
  });

// Spec build-sites (0027), "Construir una casa en el juego real [E2E]" y parte E2E de
// sprite-rendering "Solar en obra y casa construida": ?seed=42 con el mapa real en modo manual. El
// test recoge montones de madera (3 cada uno) por recorridos BFS (las huellas de los solares no son
// caminables) hasta tener ≥ 15, va a la celda bajo la huella del solar más cercano y empuja hacia
// arriba hasta tocarla (un holdKey por tramo recto y una lectura ligera por tramo: ~20 lecturas);
// con la obra abierta comprueba la torre desactivada, iconos y separación, hace clic en la casa y
// llama a step(1).
test('Solares: recoger madera, tocar el solar más cercano y construir una casa', async ({
  page,
}) => {
  slowMapRealOnCi();
  const problems = collect(page, ['pageerror', 'error']);
  await openGame(page, gameUrl({ seed: 42, manual: true, map: 'real' }));
  const m = (await probe(page))?.map;
  if (!m) throw new Error('sin mapa');
  expect(m.sites).toHaveLength(6);
  const first = await probe(page);
  expect(first?.sites?.empty).toBe(6);
  expect(first?.sprites?.sites).toEqual({ empty: 6, house: 0, tower: 0, fallback: 0 });

  let walker = await walkViewOf(page);
  let reads = 0;
  /**
   * Recorre la ruta con un `holdKey` por tramo recto entero (el input se congela para todo el step
   * y el step se corta solo si se abre una oferta, la tienda o la obra) y una lectura ligera tras
   * cada tramo; atiende ofertas y tienda y repite el tramo desde la posición real. Para si `done`
   * o en obra.
   */
  const walk = async (to: Waypoint, done: (s: WalkView) => boolean) => {
    const at = walker?.player;
    const route = at ? routeFrom(m, at, to) : null;
    for (const w of route ?? []) {
      for (let guard = 0; guard < 10; guard++) {
        if (!walker || done(walker) || ['building', 'over'].includes(walker.status)) return;
        if (walker.status === 'choosing') await page.keyboard.press('1');
        if (walker.status === 'shopping') await page.keyboard.press('Escape');
        const leg = legTo(walker.player, w);
        if (!leg) break;
        await holdKey(page, leg.key, leg.ticks);
        walker = await walkViewOf(page);
        reads++;
      }
    }
  };
  const piles = [...m.woodPiles];
  while ((walker?.wood ?? 0) < 15 && piles.length > 0 && walker?.status !== 'over') {
    const here = walker?.player ?? m.start;
    piles.sort(
      (a, b) => Math.hypot(a.x - here.x, a.y - here.y) - Math.hypot(b.x - here.x, b.y - here.y),
    );
    const pile = piles.shift();
    if (!pile) break;
    const before = walker?.wood ?? 0;
    await walk(pile, (v) => v.wood > before);
  }
  let snap = await snapshotOf(page);
  expect(snap?.resources.wood ?? 0).toBeGreaterThanOrEqual(15);
  const here = snap?.player ?? m.start;
  expect(snap?.resources.stone ?? 0).toBeLessThan(15);
  const s = m.cellSize;
  /** Centro de la celda bajo la huella (columna del centro, fila r + rows): vecina caminable. */
  const below = (x: { col: number; row: number; cols: number; rows: number }): Waypoint => ({
    x: (x.col + Math.floor(x.cols / 2)) * s + s / 2,
    y: (x.row + x.rows) * s + s / 2,
  });
  const sites = [...(snap?.sites ?? [])]
    .filter((x) => x.state === 'free' && x.armed)
    .sort((a, b) => {
      const [pa, pb] = [below(a.house), below(b.house)];
      return Math.hypot(pa.x - here.x, pa.y - here.y) - Math.hypot(pb.x - here.x, pb.y - here.y);
    });
  for (const site of sites) {
    if (walker?.status === 'building') break;
    await walk(below(site.house), () => false);
    // Empuja hacia arriba contra la cara inferior hasta tocarla (g ≤ ε): el step se corta al abrir
    // la obra. Media celda de sobra (el centro de la celda está a 32 px de la cara).
    for (let guard = 0; guard < 3 && walker?.status === 'running'; guard++) {
      await holdKey(page, 'ArrowUp', 20);
      walker = await walkViewOf(page);
      reads++;
    }
  }
  // Pocas idas y vueltas al navegador: un tramo recto por lectura, no trozos de 20 ticks.
  expect(reads).toBeLessThan(60);
  snap = await snapshotOf(page);
  expect(snap?.status).toBe('building');
  const open = (await probe(page))?.sites;
  expect(open?.panel.visible).toBe(true);
  expect(open?.panel.siteId).toBe(snap?.build.siteId);
  expect(open?.panel.options.map((o) => [o.kind, o.affordable])).toEqual([
    ['house', true],
    ['tower', false],
  ]);
  expect(open?.list.some((x) => 'access' in x)).toBe(false);
  expect(m.sites.some((x) => 'access' in x)).toBe(false);
  const tower = page.locator('[data-building="tower"]');
  await expect(tower).toBeDisabled();
  await expect(tower).toContainText('faltan');
  const icons = page.locator('.build-panel .resource-icon');
  expect(await icons.count()).toBeGreaterThan(0);
  for (const box of await icons.evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().toJSON() as { width: number; height: number }),
  )) {
    expect(box.width).toBeGreaterThanOrEqual(20);
    expect(box.height).toBeGreaterThanOrEqual(20);
  }
  const gaps = await page.locator('.build-panel__option').evaluateAll((rows) =>
    rows.map((r) => {
      const name = r.querySelector('.build-panel__name')?.getBoundingClientRect();
      const cost = r.querySelector('.build-panel__amount')?.getBoundingClientRect();
      return name && cost ? cost.left - name.right : -1;
    }),
  );
  expect(gaps).toHaveLength(2);
  for (const g of gaps) expect(g).toBeGreaterThanOrEqual(8);
  const wood = snap?.resources.wood ?? 0;

  await page.locator('[data-building="house"]').click();
  expect(await step(page, 1)).toBe(1);
  const after = await probe(page);
  const built = after?.sites?.list.find((s) => s.id === snap?.build.siteId);
  expect(built?.state).toBe('house');
  expect(after?.sites?.panel.visible).toBe(false);
  expect(after?.snapshot?.resources.wood).toBe(wood - 15);
  expect(after?.sprites?.sites).toMatchObject({ empty: 5, house: 1, tower: 0 });
  expect(problems).toEqual([]);
});

// Spec mobile-display y touch-controls (0033): modo móvil forzado con `?mobile=1`, pantalla táctil y
// ventana de 844 × 390 (lienzo EXPAND 1.385 × 640). El arrastre va por CDP
// (`Input.dispatchTouchEvent`): `page.touchscreen` solo tiene `tap`. Sin reloj: `step(n)` y
// `expect.poll` sobre la cámara, el aviso o la indicación, nunca sobre el tick.
const PHONE = { width: 844, height: 390 };
const mobileUrl = (): string => `${gameUrl({ seed: 42, manual: true })}&mobile=1`;
const near = (a: number, b: number, tol = 1): boolean => Math.abs(a - b) <= tol;

/**
 * "Sin estilos inline" (spec mobile-display 0033) en la pantalla `screen`: ningún elemento tiene
 * atributo `style` salvo el lienzo del motor y `#game`, y este solo con variables CSS (`--*`).
 */
async function expectNoInlineStyles(page: Page, screen: string): Promise<void> {
  const styled = await page.evaluate(() =>
    [...document.querySelectorAll('[style]')]
      .filter((e) => e.tagName !== 'CANVAS')
      .map((e) => ({
        id: e.id,
        vars: [...(e as HTMLElement).style].every((prop) => prop.startsWith('--')),
      })),
  );
  expect(styled, screen).toEqual([{ id: 'game', vars: true }]);
}

/** Juega hasta el fin, con los resultados a la vista, y vuelve al menú con R y Volver al menú. */
async function resultsThenMenu(page: Page, check: (screen: string) => Promise<void>) {
  expect((await playToEnd(page))?.status).toBe('over');
  await expect(page.locator('.results-panel')).toBeVisible();
  await check('resultados');
  await page.keyboard.press('r');
  await expect(page.locator('.results-panel')).toBeHidden();
  await backToMenu(page);
  await check('menú');
}

test.describe('Modo móvil (0033)', () => {
  test.use({ hasTouch: true, viewport: PHONE });

  test('Móvil táctil: sonda, arrastre que mueve, ⏸, aviso que detiene step y tamaños de vista', async ({
    page,
  }) => {
    const problems = collect(page, ['error', 'warning']);
    await watchCsp(page);
    await page.goto(mobileUrl());
    await expectManual(page);
    await waitForRun(page);

    // "Sonda en móvil", "Móvil en horizontal" e "Indicación al empezar".
    await expect.poll(async () => (await probe(page))?.viewport?.hint ?? null).toBe(true);
    await expectNoInlineStyles(page, 'partida con la barra táctil');
    const start = await probe(page);
    const v = start?.viewport;
    const cam = start?.camera;
    if (!v || !cam) throw new Error('sin sonda');
    expect([v.mobile, v.width, v.height, v.domScale]).toEqual([true, 844, 390, 1]);
    expect(Math.abs(v.uiScale - 1.4066)).toBeLessThanOrEqual(0.001);
    expect(14 * v.uiScale * v.displayScale).toBeGreaterThanOrEqual(12 - 0.1);
    expect([near(cam.width, 1385.03), near(cam.height, 640)]).toEqual([true, true]);
    // 640 unidades de mundo miden 390 px CSS y el documento no tiene barras de desplazamiento.
    expect(near(640 * v.displayScale, 390)).toBe(true);
    expect(
      await page.evaluate(() => [
        document.documentElement.scrollWidth <= window.innerWidth,
        document.documentElement.scrollHeight <= window.innerHeight,
      ]),
    ).toEqual([true, true]);

    // "Arrastre que mueve al jugador [E2E]" y "Arrastre sin desplazar la página".
    const p0 = start.snapshot?.player ?? { x: 0, y: 0 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 200, y: 250 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 300, y: 250 }],
    });
    expect(await step(page, 60)).toBe(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const moved = await probe(page);
    const p1 = moved?.snapshot?.player ?? { x: 0, y: 0 };
    expect(p1.x).toBeGreaterThan(p0.x);
    expect(Math.abs(p1.y - p0.y)).toBeLessThanOrEqual(0.001);
    expect(moved?.viewport?.hint).toBe(false);
    expect(
      await page.evaluate(() => [window.scrollX, window.scrollY, window.visualViewport?.scale]),
    ).toEqual([0, 0, 1]);

    // ⏸ con un toque: pausa visible, zonas pulsables de ≥ 44 × 44 px CSS y Reanudar operativo.
    await page.locator('.touch-bar [aria-label="Pausa"]').tap();
    await expect(pauseOverlay(page)).toBeVisible();
    await expectNoInlineStyles(page, 'pausa');
    const buttons = page.locator('.pause-panel button:visible, .touch-bar button:visible');
    expect(await buttons.count()).toBeGreaterThanOrEqual(3);
    for (const box of await buttons.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().toJSON() as { width: number; height: number }),
    )) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await pauseOverlay(page).getByRole('button', { name: 'Reanudar' }).tap();
    await expect(pauseOverlay(page)).toBeHidden();

    // "Aviso que detiene step [E2E]" y "Step con el aviso de orientación".
    const n = (await snapshotOf(page))?.tick ?? -1;
    await page.setViewportSize({ width: PHONE.height, height: PHONE.width });
    await expect(page.locator('.rotate-notice')).toBeVisible();
    await expect(page.locator('.rotate-notice')).toHaveText('Gira el móvil');
    await expectNoInlineStyles(page, 'aviso de orientación');
    expect(await step(page, 60)).toBe(0);
    expect((await snapshotOf(page))?.tick).toBe(n);
    await page.setViewportSize(PHONE);
    await expect(page.locator('.rotate-notice')).toBeHidden();
    expect(await step(page, 60)).toBe(60);
    expect((await snapshotOf(page))?.tick).toBe(n + 60);

    // Tamaños de vista: "Redimensionado en móvil", "Tablet 4:3", "Aspecto 1,5 exacto",
    // "Nunca menos mundo que el mínimo de escritorio" y "Aspecto muy alargado con tope".
    const viewOf = async () => {
      const c = (await probe(page))?.camera;
      return c ? [Math.floor(c.width), Math.floor(c.height)] : null;
    };
    const table: [number, number, number, number][] = [
      [915, 412, 1421, 640],
      [1024, 768, 960, 720],
      [800, 600, 960, 720],
      [960, 640, 960, 640],
      [640, 360, 1137, 640],
      [3200, 640, arena.maxView.width, 640],
    ];
    for (const [w, h, vw, vh] of table) {
      await page.setViewportSize({ width: w, height: h });
      await expect.poll(viewOf).toEqual([vw, vh]);
    }
    expect(table.every(([, , vw, vh]) => vw >= 960 && vh >= 540)).toBe(true);
    // Con el tope, el lienzo queda centrado y la ventana fuera de él no muestra mundo.
    const canvas = await page.locator('#game canvas').boundingBox();
    expect(canvas && near(canvas.x + canvas.width / 2, 1600)).toBe(true);
    expect(canvas && canvas.width < 3200).toBe(true);
    // "Redimensionado en móvil": la cámara sigue la fórmula con la posición del jugador.
    await page.setViewportSize({ width: 915, height: 412 });
    await expect.poll(viewOf).toEqual([1421, 640]);
    const after = await probe(page);
    const pl = after?.snapshot?.player ?? { x: 0, y: 0 };
    const c = after?.camera ?? { x: -1, y: -1, width: 0, height: 0 };
    expect(near(c.x, clamp(pl.x - c.width / 2, 0, WORLD.width - c.width))).toBe(true);
    expect(near(c.y, clamp(pl.y - c.height / 2, 0, WORLD.height - c.height))).toBe(true);

    // "Sin estilos inline" tras redimensionar, en los resultados y en el menú.
    await expectNoInlineStyles(page, 'partida redimensionada');
    await resultsThenMenu(page, (screen) => expectNoInlineStyles(page, screen));
    expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
    expect(problems).toEqual([]);
  });
});

// Spec mobile-display (0033), "Sin controles táctiles en escritorio": puntero fino, sin `mobile`,
// ventana más alta que ancha.
test('Escritorio sin controles táctiles: 600 × 900 sin barra, aviso ni indicación y step avanza', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await watchCsp(page);
  await page.setViewportSize({ width: 600, height: 900 });
  await openGame(page, gameUrl({ seed: 42, manual: true }));
  await expectNoInlineStyles(page, 'partida');

  const p = await probe(page);
  expect([p?.viewport?.mobile, p?.viewport?.hint]).toEqual([false, false]);
  expect(await page.locator('.touch-bar, .rotate-notice').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains('is-mobile'))).toBe(
    false,
  );
  expect(await step(page, 60)).toBe(60);
  // "Sin estilos inline" en escritorio: pausa, resultados y menú.
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeVisible();
  await expectNoInlineStyles(page, 'pausa');
  await page.keyboard.press('Escape');
  await expect(pauseOverlay(page)).toBeHidden();
  await resultsThenMenu(page, (screen) => expectNoInlineStyles(page, screen));
  expect(await page.locator('.touch-bar, .rotate-notice').count()).toBe(0);
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(problems).toEqual([]);
});
