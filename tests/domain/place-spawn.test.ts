import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { View } from '../../src/domain/arena/View';
import { Vector2 } from '../../src/domain/shared/Vector2';
import { SpawnRules, type SpawnConfig } from '../../src/domain/wave/SpawnRules';
import { placeSpawn } from '../../src/domain/wave/placeSpawn';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig } from '../support/builders';
import { StubRandom } from '../support/random';

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

const DEFAULT_SPAWN: SpawnConfig = {
  maxAlive: 200,
  maxBudget: 10,
  margin: 32,
  minDistance: 200,
  maxAttempts: 8,
};
const rules = (overrides: Partial<SpawnConfig> = {}): SpawnRules =>
  unwrap(SpawnRules.create({ ...DEFAULT_SPAWN, ...overrides }, unwrap(View.create(960, 540))));
const arena = (w = 960, h = 540): Arena => unwrap(Arena.create(w, h));

const RADII = [10, 16, 22];

describe('placeSpawn', () => {
  it('Arena mayor que la vista: todos en el anillo y fuera de la vista', () => {
    const big = arena(4000, 4000);
    const player = Vector2.of(2000, 2000);
    const random = new Mulberry32RandomGenerator(3);
    for (let i = 0; i < 100; i++) {
      const p = placeSpawn(player, RADII[i % 3] ?? 10, rules(), big, random);
      if (!p) throw new Error('se esperaba una posición');
      expect(Math.abs(p.distanceTo(player) - 582.727)).toBeLessThanOrEqual(0.001);
      const insideView = Math.abs(p.x - 2000) <= 480 && Math.abs(p.y - 2000) <= 270;
      expect(insideView).toBe(false);
    }
  });

  it('Scenario: Jugador en el centro del mundo por defecto (fuera de la cámara)', () => {
    const { arena: world, waves } = aDefaultConfig();
    const defaultRules = unwrap(
      SpawnRules.create(
        { maxAlive: waves.maxAlive, maxBudget: waves.maxBudget, ...waves.spawn },
        unwrap(View.create(world.view.width, world.view.height)),
      ),
    );
    const a = arena(world.width, world.height);
    const player = Vector2.of(world.width / 2, world.height / 2);
    const random = new Mulberry32RandomGenerator(13);
    for (let i = 0; i < 200; i++) {
      const r = RADII[i % 3] ?? 10;
      const p = placeSpawn(player, r, defaultRules, a, random);
      if (!p) throw new Error('se esperaba una posición');
      expect([a.clampX(p.x, r), a.clampY(p.y, r)]).toEqual([p.x, p.y]);
      const insideCamera = p.x > 480 && p.x < 1440 && p.y > 270 && p.y < 810;
      expect(insideCamera).toBe(false);
      const touchesTopOrBottom = p.y === r || p.y === world.height - r;
      const ringError = touchesTopOrBottom ? 0 : Math.abs(p.distanceTo(player) - 582.727);
      expect(ringError).toBeLessThanOrEqual(0.001);
    }
    expect([player.x, player.y]).toEqual([960, 540]);
  });

  it('Arena igual a la vista: dentro, a ≥ 200 y tocando un borde', () => {
    const a = arena();
    const player = Vector2.of(480, 270);
    const random = new Mulberry32RandomGenerator(11);
    for (let i = 0; i < 200; i++) {
      const r = RADII[i % 3] ?? 10;
      const p = placeSpawn(player, r, rules(), a, random);
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
      const p = placeSpawn(player, 22, rules(), a, random);
      if (!p) continue;
      placed += 1;
      expect(p.distanceTo(player)).toBeGreaterThanOrEqual(200);
      expect([a.clampX(p.x, 22), a.clampY(p.y, 22)]).toEqual([p.x, p.y]);
    }
    expect(placed).toBeGreaterThan(0);
  });

  it('Ninguna posición válida: devuelve null tras exactamente maxAttempts valores', () => {
    const stub = new StubRandom(0.3);
    const p = placeSpawn(Vector2.of(480, 270), 10, rules({ minDistance: 2000 }), arena(), stub);
    expect(p).toBeNull();
    expect(stub.calls).toBe(8);
  });

  it('consume exactamente 1 valor por intento y para en el primero válido', () => {
    const stub = new StubRandom(0.125);
    const p = placeSpawn(Vector2.of(16, 16), 10, rules(), arena(), stub);
    expect(stub.calls).toBe(1);
    expect(p?.distanceTo(Vector2.of(16, 16))).toBeCloseTo(582.727, 3);
  });

  it('ángulo hacia la esquina: el recorte deja el punto demasiado cerca y se rechaza', () => {
    const stub = new StubRandom(0.625);
    expect(placeSpawn(Vector2.of(16, 16), 10, rules(), arena(), stub)).toBeNull();
    expect(stub.calls).toBe(8);
  });
});
