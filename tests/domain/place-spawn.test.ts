import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { Vector2 } from '../../src/domain/shared/Vector2';
import { SpawnRules, type SpawnConfig } from '../../src/domain/wave/SpawnRules';
import { placeSpawn } from '../../src/domain/wave/placeSpawn';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig } from '../support/builders';
import { StubRandom } from '../support/random';
import { resolveTerrain } from '../../src/domain/map/TerrainSource';
import { seededRun } from '../../src/composition/seedSource';
import { mapRules, mapWith, openMap } from '../support/mapLayouts';
import { startSeededRun } from '../support/runs';

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

const DEFAULT_SPAWN: SpawnConfig = {
  maxAlive: 200,
  maxBudget: 10,
  ringRadius: 1500,
  minDistance: 200,
  maxAttempts: 8,
};
const rules = (overrides: Partial<SpawnConfig> = {}): SpawnRules =>
  unwrap(SpawnRules.create({ ...DEFAULT_SPAWN, ...overrides }));
const arena = (w = 960, h = 540): Arena => unwrap(Arena.create(w, h));

const RADII = [10, 16, 22];

describe('placeSpawn', () => {
  it('Scenario: Arena mayor que el anillo (4.000 × 4.000, ringRadius 1.500 explícito)', () => {
    const big = arena(4000, 4000);
    const player = Vector2.of(2000, 2000);
    const random = new Mulberry32RandomGenerator(3);
    for (let i = 0; i < 100; i++) {
      const p = placeSpawn(player, RADII[i % 3] ?? 10, rules(), big, openMap(big), random);
      if (!p) throw new Error('se esperaba una posición');
      expect(Math.abs(p.distanceTo(player) - 1500)).toBeLessThanOrEqual(0.001);
      const insideView = Math.abs(p.x - 2000) <= 1280 && Math.abs(p.y - 2000) <= 720;
      expect(insideView).toBe(false);
    }
  });

  it('Scenario: Jugador en el centro del mundo por defecto (fuera del tope de vista)', () => {
    const { arena: world, waves } = aDefaultConfig();
    const defaultRules = unwrap(
      SpawnRules.create({ maxAlive: waves.maxAlive, maxBudget: waves.maxBudget, ...waves.spawn }),
    );
    const a = arena(world.width, world.height);
    const player = Vector2.of(world.width / 2, world.height / 2);
    const random = new Mulberry32RandomGenerator(13);
    for (let i = 0; i < 200; i++) {
      const r = RADII[i % 3] ?? 10;
      const p = placeSpawn(player, r, defaultRules, a, openMap(a), random);
      if (!p) throw new Error('se esperaba una posición');
      expect([a.clampX(p.x, r), a.clampY(p.y, r)]).toEqual([p.x, p.y]);
      const insideCamera = p.x > 640 && p.x < 3200 && p.y > 360 && p.y < 1800;
      expect(insideCamera).toBe(false);
      const touchesTopOrBottom = p.y === r || p.y === world.height - r;
      const ringError = touchesTopOrBottom
        ? 0
        : Math.abs(p.distanceTo(player) - waves.spawn.ringRadius);
      expect(ringError).toBeLessThanOrEqual(0.001);
    }
    expect([player.x, player.y]).toEqual([1920, 1080]);
  });

  // Spec enemy-spawning (0017, 0019): el jugador nace ante la puerta; los no recolocados, fuera del
  // tope; todos, fuera de las vistas de 1.280 × 720 y 960 × 540 y en una celda caminable.
  it('Scenario: Jugador ante la puerta del castillo (semilla 42, mapa generado)', () => {
    const config = aDefaultConfig();
    const { arena: world, waves } = config;
    const defaultRules = unwrap(
      SpawnRules.create({ maxAlive: waves.maxAlive, maxBudget: waves.maxBudget, ...waves.spawn }),
    );
    const a = arena(world.width, world.height);
    const { x, y } = startSeededRun(config, 42).snapshot().player;
    expect([x, y]).toEqual([1950, 1170]);
    const map = unwrap(resolveTerrain(seededRun(42).terrain, mapRules()));
    const open = openMap(a);
    const player = Vector2.of(x, y);
    const random = new Mulberry32RandomGenerator(42);
    const reference = new Mulberry32RandomGenerator(42);
    let relocated = 0;
    for (let i = 0; i < 200; i++) {
      const r = RADII[i % 3] ?? 10;
      const p = placeSpawn(player, r, defaultRules, a, map, random);
      const q = placeSpawn(player, r, defaultRules, a, open, reference);
      if (!p || !q) throw new Error('se esperaba una posición');
      expect([a.clampX(p.x, r), a.clampY(p.y, r)]).toEqual([p.x, p.y]);
      expect(p.distanceTo(player)).toBeGreaterThanOrEqual(200);
      expect(map.isWalkable(map.colAt(p.x), map.rowAt(p.y))).toBe(true);
      const moved = p.x !== q.x || p.y !== q.y;
      if (moved) relocated += 1;
      const insideCap = p.x > 670 && p.x < 3230 && p.y > 450 && p.y < 1890;
      expect(insideCap && !moved).toBe(false);
      expect(p.x > 1310 && p.x < 2590 && p.y > 810 && p.y < 1530).toBe(false);
      expect(p.x > 1470 && p.x < 2430 && p.y > 900 && p.y < 1440).toBe(false);
    }
    expect(relocated).toBeGreaterThan(0);
  });

  it('Scenario: Aparición sobre agua recolocada ((310, 250) → (330, 210), 1 valor)', () => {
    const map = mapWith(mapRules(), { '5,4': 'water' });
    const stub = new StubRandom(0);
    const near = rules({ ringRadius: 300 });
    const p = placeSpawn(Vector2.of(10, 250), 10, near, arena(3840, 2160), map, stub);
    expect(p && [p.x, p.y]).toEqual([330, 210]);
    expect(stub.calls).toBe(1);
  });

  it('Scenario: 1 valor de azar por intento con y sin recolocación (tronco frente a hierba)', () => {
    const world = arena(3840, 2160);
    const trunk = mapWith(mapRules(), { '5,4': 'trunk' });
    const near = rules({ ringRadius: 300 });
    const onTrunk = new StubRandom(0);
    const onGrass = new StubRandom(0);
    const p = placeSpawn(Vector2.of(10, 250), 10, near, world, trunk, onTrunk);
    const q = placeSpawn(Vector2.of(10, 250), 10, near, world, openMap(world), onGrass);
    expect(p && [p.x, p.y]).toEqual([330, 210]);
    expect(q && [q.x, Math.round(q.y)]).toEqual([310, 250]);
    expect([onTrunk.calls, onGrass.calls]).toEqual([1, 1]);
  });

  it('recolocación por debajo de minDistance: el intento no vale y el siguiente gasta otro valor', () => {
    // Todo tronco salvo la celda (10, 4): cualquier punto del anillo va a su centro (630, 270).
    const rules64 = mapRules();
    const layout: Record<string, 'trunk'> = {};
    for (let r = 0; r < rules64.rows; r++)
      for (let c = 0; c < rules64.cols; c++)
        if (c !== 10 || r !== 4) layout[`${String(c)},${String(r)}`] = 'trunk';
    const stub = new StubRandom(0.5);
    const p = placeSpawn(
      Vector2.of(610, 250),
      10,
      rules({ ringRadius: 300 }),
      arena(3840, 2160),
      mapWith(rules64, layout),
      stub,
    );
    expect(p).toBeNull();
    expect(stub.calls).toBe(8);
  });

  it('Scenario: Mapa sin celdas caminables (ningún intento vale)', () => {
    const rules64 = mapRules();
    const all: Record<string, 'trunk'> = {};
    for (let r = 0; r < rules64.rows; r++)
      for (let c = 0; c < rules64.cols; c++) all[`${String(c)},${String(r)}`] = 'trunk';
    const stub = new StubRandom(0.5);
    const p = placeSpawn(
      Vector2.of(1920, 1080),
      10,
      rules(),
      arena(3840, 2160),
      mapWith(rules64, all),
      stub,
    );
    expect(p).toBeNull();
    expect(stub.calls).toBe(8);
  });

  it('Scenario: Arena menor que el anillo: dentro, a ≥ 200 y tocando un borde', () => {
    const a = arena();
    const player = Vector2.of(480, 270);
    const random = new Mulberry32RandomGenerator(11);
    for (let i = 0; i < 200; i++) {
      const r = RADII[i % 3] ?? 10;
      const p = placeSpawn(player, r, rules(), a, openMap(a), random);
      if (!p) throw new Error('se esperaba una posición');
      expect(p.x).toBeGreaterThanOrEqual(r);
      expect(p.x).toBeLessThanOrEqual(960 - r);
      expect(p.y).toBeGreaterThanOrEqual(r);
      expect(p.y).toBeLessThanOrEqual(540 - r);
      expect(p.distanceTo(player)).toBeGreaterThanOrEqual(200);
      const touches = p.x === r || p.x === 960 - r || p.y === r || p.y === 540 - r;
      expect(touches).toBe(true);
    }
  });

  it('Jugador en una esquina: o no hay posición o es legal', () => {
    const a = arena();
    const player = Vector2.of(16, 16);
    const random = new Mulberry32RandomGenerator(5);
    let placed = 0;
    for (let i = 0; i < 500; i++) {
      const p = placeSpawn(player, 22, rules(), a, openMap(a), random);
      if (!p) continue;
      placed += 1;
      expect(p.distanceTo(player)).toBeGreaterThanOrEqual(200);
      expect([a.clampX(p.x, 22), a.clampY(p.y, 22)]).toEqual([p.x, p.y]);
    }
    expect(placed).toBeGreaterThan(0);
  });

  it('Ninguna posición válida: devuelve null tras exactamente maxAttempts valores', () => {
    const stub = new StubRandom(0.3);
    const p = placeSpawn(
      Vector2.of(480, 270),
      10,
      rules({ minDistance: 2000 }),
      arena(),
      openMap(arena()),
      stub,
    );
    expect(p).toBeNull();
    expect(stub.calls).toBe(8);
  });

  it('consume exactamente 1 valor por intento y para en el primero válido', () => {
    const stub = new StubRandom(0.125);
    const p = placeSpawn(Vector2.of(16, 16), 10, rules(), arena(), openMap(arena()), stub);
    expect(stub.calls).toBe(1);
    expect(p && [p.x, p.y]).toEqual([950, 530]);
  });

  it('ángulo hacia la esquina: el recorte deja el punto demasiado cerca y se rechaza', () => {
    const stub = new StubRandom(0.625);
    expect(placeSpawn(Vector2.of(16, 16), 10, rules(), arena(), openMap(arena()), stub)).toBeNull();
    expect(stub.calls).toBe(8);
  });
});
