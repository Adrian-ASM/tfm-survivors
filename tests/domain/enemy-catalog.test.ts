import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { EnemyCatalog } from '../../src/domain/enemy/EnemyCatalog';
import {
  ENEMY_COST_MUST_BE_POSITIVE,
  ENEMY_DAMAGE_MUST_BE_POSITIVE,
  ENEMY_HEALTH_MUST_BE_POSITIVE,
  ENEMY_ID_MUST_BE_UNIQUE,
  ENEMY_RADIUS_MUST_FIT,
  ENEMY_SPEED_MUST_BE_POSITIVE,
  type EnemyTypeConfig,
} from '../../src/domain/enemy/EnemyType';
import { DEFAULT_ENEMY_TYPES } from '../support/builders';

function arena(): Arena {
  const r = Arena.create(960, 540);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const bug: EnemyTypeConfig = { id: 'bug', speed: 90, radius: 10, cost: 1, damage: 5, health: 10 };
const leak: EnemyTypeConfig = {
  id: 'memory-leak',
  speed: 45,
  radius: 22,
  cost: 3,
  damage: 15,
  health: 45,
};

describe('EnemyCatalog', () => {
  it('crea los tipos con sus valores y los busca por id', () => {
    const r = EnemyCatalog.create([bug, leak], arena());
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.get('memory-leak')).toMatchObject(leak);
    expect(r.value.get('segfault')).toBeUndefined();
    expect(r.value.ids).toEqual(['bug', 'memory-leak']);
  });

  it('los tipos son inmutables', () => {
    const r = EnemyCatalog.create([bug], arena());
    const type = r.ok ? r.value.get('bug') : undefined;
    expect(() => {
      (type as unknown as { speed: number }).speed = 1;
    }).toThrow(TypeError);
  });

  it.each([0, -1, Number.NaN])('Velocidad cero (o no positiva: %s)', (speed) => {
    const r = EnemyCatalog.create([leak, { ...bug, speed }], arena());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('enemies.types.1.speed');
      expect(r.error.message).toBe(ENEMY_SPEED_MUST_BE_POSITIVE);
    }
  });

  it('rechaza un coste no positivo', () => {
    const r = EnemyCatalog.create([{ ...bug, cost: 0 }], arena());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('enemies.types.0.cost');
      expect(r.error.message).toBe(ENEMY_COST_MUST_BE_POSITIVE);
    }
  });

  it.each([300, 0, -4])('Radio que no cabe en la arena (%d)', (radius) => {
    const r = EnemyCatalog.create([{ ...bug, radius }], arena());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('enemies.types.0.radius');
      expect(r.error.message).toBe(ENEMY_RADIUS_MUST_FIT);
    }
  });

  it('Radio en el límite exacto (270 en 960 × 540)', () => {
    expect(EnemyCatalog.create([{ ...bug, radius: 270 }], arena()).ok).toBe(true);
  });

  it('Identificador duplicado', () => {
    const r = EnemyCatalog.create([bug, leak, { ...bug, speed: 10 }], arena());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('enemies.types.2.id');
      expect(r.error.message).toContain(ENEMY_ID_MUST_BE_UNIQUE);
      expect(r.error.message).toContain('bug');
    }
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('Vida cero o negativa (%s)', (health) => {
    const r = EnemyCatalog.create([leak, { ...bug, health }], arena());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('enemies.types.1.health');
      expect(r.error.message).toBe(ENEMY_HEALTH_MUST_BE_POSITIVE);
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('Daño cero (%s)', (damage) => {
    const r = EnemyCatalog.create([{ ...bug, damage }], arena());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('enemies.types.0.damage');
      expect(r.error.message).toBe(ENEMY_DAMAGE_MUST_BE_POSITIVE);
    }
  });

  it('Contenido por defecto: vida y daño > 0 en los 3 tipos', () => {
    const r = EnemyCatalog.create(DEFAULT_ENEMY_TYPES, arena());
    if (!r.ok) throw new Error(r.error.message);
    const catalog = r.value;
    const values = catalog.ids.map((id) => [id, catalog.get(id)?.damage, catalog.get(id)?.health]);
    expect(values).toEqual([
      ['bug', 5, 10],
      ['memory-leak', 15, 45],
      ['merge-conflict', 8, 20],
    ]);
  });
});

describe('EnemyCatalog · maxCost', () => {
  it('es el coste del tipo más caro, sin depender del orden', () => {
    const merge = { ...bug, id: 'merge-conflict', cost: 2 };
    const a = EnemyCatalog.create([bug, leak, merge], arena());
    const b = EnemyCatalog.create([merge, bug, leak], arena());
    if (!a.ok || !b.ok) throw new Error('catálogo inválido');
    expect([a.value.maxCost, b.value.maxCost]).toEqual([3, 3]);
    expect(a.value.mostExpensive?.id).toBe('memory-leak');
  });

  it('vale 0 en un catálogo vacío', () => {
    const r = EnemyCatalog.create([], arena());
    expect(r.ok && r.value.maxCost).toBe(0);
  });
});
