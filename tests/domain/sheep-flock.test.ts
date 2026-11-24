import { describe, expect, it } from 'vitest';
import { Flock } from '../../src/domain/sheep/Flock';
import { SheepRules } from '../../src/domain/sheep/SheepRules';
import { TEST_SHEEP } from '../support/builders';

const rules = (patch = {}) => {
  const r = SheepRules.create({ ...TEST_SHEEP, ...patch });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('SheepRules (spec sheep, invariantes del dominio)', () => {
  it('pasos por tick de paseo y de huida (velocidad / 60)', () => {
    const r = rules();
    expect([r.wanderStep, r.fleeStep]).toEqual([1, 3]);
  });

  it('sin cruce con el mapa: un radio de más de media celda es válido (lo filtran las candidatas)', () => {
    expect(SheepRules.create({ ...TEST_SHEEP, radius: 31 }).ok).toBe(true);
  });

  it.each([
    ['maxAlive', -1],
    ['maxAlive', 2.5],
    ['radius', 0],
    ['health', 0],
    ['health', 7.5],
  ])('rechaza %s = %s nombrando el campo', (key, value) => {
    const r = SheepRules.create({ ...TEST_SHEEP, [key]: value });
    expect(r.ok ? null : r.error.field).toBe(`sheep.${key}`);
  });

  it.each([
    ['wander', 'speed', { speed: 0, ticks: 60 }],
    ['flee', 'speed', { radius: 200, speed: -30 }],
    ['flee', 'radius', { radius: 0, speed: 180 }],
    ['wander', 'ticks', { speed: 60, ticks: 0 }],
    ['graze', 'ticks', { ticks: 12.5, radius: 300 }],
    ['graze', 'radius', { ticks: 120, radius: 0 }],
    ['respawn', 'everyTicks', { everyTicks: 0, minPlayerDistance: 500 }],
    ['respawn', 'minPlayerDistance', { everyTicks: 600, minPlayerDistance: -1 }],
    ['placement', 'minGapCells', { minStartCells: 9, minCastleCells: 3, minGapCells: -1 }],
  ])('rechaza %s.%s fuera de rango', (group, key, value) => {
    const r = SheepRules.create({ ...TEST_SHEEP, [group]: value });
    expect(r.ok ? null : r.error.field).toBe(`sheep.${group}.${key}`);
  });

  it('acepta los límites (tope 0, vida 1, duraciones 1, distancia 0, colocación 0)', () => {
    const r = SheepRules.create(
      {
        ...TEST_SHEEP,
        maxAlive: 0,
        health: 1,
        graze: { ticks: 1, radius: 300 },
        wander: { speed: 60, ticks: 1 },
        respawn: { everyTicks: 1, minPlayerDistance: 0 },
        placement: { minStartCells: 0, minCastleCells: 0, minGapCells: 0 },
      },
    );
    expect(r.ok).toBe(true);
  });
});

describe('Flock (lista de ovejas de la partida)', () => {
  it('crea las ovejas en orden con ids desde 0, la vida del contenido, en pasto y con su origen', () => {
    const flock = new Flock(rules(), [
      { x: 100, y: 200 },
      { x: 300, y: 400 },
    ]);
    expect(flock.all.map((o) => [o.id, o.x, o.y, o.hp, o.mode, o.originX, o.originY])).toEqual([
      [0, 100, 200, 12, 'graze', 100, 200],
      [1, 300, 400, 12, 'graze', 300, 400],
    ]);
    expect(flock.all.every((o) => o.alive && o.radius === 20)).toBe(true);
    expect(flock.capacity).toBe(2);
  });

  it('sin ovejas, la lista está vacía y no reserva nada', () => {
    const flock = new Flock(rules(), []);
    expect([flock.all.length, flock.capacity]).toEqual([0, 0]);
  });
});
