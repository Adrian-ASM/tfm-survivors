import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { Enemy } from '../../src/domain/enemy/Enemy';
import { EnemyType } from '../../src/domain/enemy/EnemyType';
import { TICK_SECONDS } from '../../src/domain/shared/Tick';

const ARENA = ((): Arena => {
  const r = Arena.create(960, 540);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
})();

function enemy(speed: number, x: number, y: number, radius = 10, id = 'goblin-torch', health = 10): Enemy {
  const type = EnemyType.create(
    { id, speed, radius, cost: 1, damage: 7, health, xp: 1 },
    ARENA,
    'enemies.types.0',
  );
  if (!type.ok) throw new Error(type.error.message);
  return Enemy.spawn(0, type.value, x, y, ARENA);
}

describe('Enemy · vida y baja', () => {
  const withHealth = (health: number): Enemy => enemy(90, 100, 100, 10, 'goblin-torch', health);

  it('Vida inicial del tipo', () => {
    const e = withHealth(5);
    expect([e.hp, e.alive, e.damage]).toEqual([5, true, 7]);
  });

  it('Scenario: Daño que no mata (vida 5, damage 3 → vida 2, vivo)', () => {
    const e = withHealth(5);
    expect(e.takeDamage(3, 1)).toBe(false);
    expect([e.hp, e.alive]).toEqual([2, true]);
  });

  it.each([
    ['Daño exactamente igual a la vida', 5],
    ['Daño mayor que la vida', 7],
  ])('Scenario: %s (%d): baja con vida 0', (_name, amount) => {
    const e = withHealth(5);
    expect(e.takeDamage(amount, 1)).toBe(true);
    expect([e.hp, e.alive]).toEqual([0, false]);
  });

  it('Scenario: Daño a un enemigo ya dado de baja: no hace nada', () => {
    const e = withHealth(5);
    e.takeDamage(5, 1);
    expect(e.takeDamage(5, 2)).toBe(false);
    expect([e.hp, e.alive]).toEqual([0, false]);
  });

  it('vida inicial opcional al aparecer (RunSetup); por defecto la del tipo', () => {
    const type = EnemyType.create(
      { id: 'goblin-torch', speed: 90, radius: 10, cost: 1, damage: 5, health: 10, xp: 1 },
      ARENA,
      'enemies.types.0',
    );
    if (!type.ok) throw new Error(type.error.message);
    expect(Enemy.spawn(0, type.value, 0, 0, ARENA, 4).hp).toBe(4);
    expect(Enemy.spawn(1, type.value, 0, 0, ARENA).hp).toBe(10);
  });
});

describe('Enemy · indicación de daño reciente', () => {
  const FLASH = 4;
  const flags = (e: Enemy, from: number, to: number): boolean[] =>
    Array.from({ length: to - from + 1 }, (_, i) => e.damagedAt(from + i, FLASH));

  it('un enemigo que nunca ha recibido daño no lo indica', () => {
    expect(flags(enemy(90, 100, 100), 0, 5)).toEqual([false, false, false, false, false, false]);
  });

  it('Scenario: Duración del destello (dañado en T = 10: de T a T + 3, no en T + 4)', () => {
    const e = enemy(90, 100, 100);
    e.takeDamage(1, 10);
    expect(flags(e, 10, 14)).toEqual([true, true, true, true, false]);
  });

  it('Scenario: Destello renovado (dañado en T y T + 2: de T a T + 5, no en T + 6)', () => {
    const e = enemy(90, 100, 100);
    e.takeDamage(1, 10);
    e.takeDamage(1, 12);
    expect(flags(e, 10, 16)).toEqual([true, true, true, true, true, true, false]);
  });

  it('un golpe sobre un enemigo ya dado de baja no renueva el destello', () => {
    const e = enemy(90, 100, 100, 10, 'goblin-torch', 5);
    e.takeDamage(5, 10);
    e.takeDamage(5, 20);
    expect(e.damagedAt(20, FLASH)).toBe(false);
  });
});

function chaseFor(e: Enemy, ticks: number, tx: number, ty: number): void {
  for (let i = 0; i < ticks; i++) e.chase(tx, ty, TICK_SECONDS, ARENA);
}

describe('Enemy · persecución en línea recta', () => {
  it('Persecución horizontal durante un segundo', () => {
    const e = enemy(60, 100, 270);
    chaseFor(e, 60, 480, 270);
    expect(e.x).toBeCloseTo(160, 3);
    expect(e.y).toBeCloseTo(270, 3);
  });

  it('Persecución en diagonal', () => {
    const e = enemy(50, 180, 70);
    chaseFor(e, 60, 480, 470);
    expect(e.x).toBeCloseTo(210, 3);
    expect(e.y).toBeCloseTo(110, 3);
  });

  it('Llegada sin sobrepasar', () => {
    const e = enemy(120, 470, 270);
    chaseFor(e, 5, 480, 270);
    expect([e.x, e.y]).toEqual([480, 270]);
    chaseFor(e, 55, 480, 270);
    expect([e.x, e.y]).toEqual([480, 270]);
  });

  it('un enemigo ya en el centro del jugador no se mueve (sin dividir por 0)', () => {
    const e = enemy(90, 480, 270);
    e.chase(480, 270, TICK_SECONDS, ARENA);
    expect([e.x, e.y]).toEqual([480, 270]);
  });

  it('Dos tipos, dos velocidades', () => {
    const bug = enemy(90, 100, 100);
    const leak = enemy(45, 100, 440, 22, 'goblin-tnt');
    chaseFor(bug, 60, 900, 270);
    chaseFor(leak, 60, 900, 270);
    expect(Math.hypot(bug.x - 100, bug.y - 100)).toBeCloseTo(90, 3);
    expect(Math.hypot(leak.x - 100, leak.y - 440)).toBeCloseTo(45, 3);
  });

  it('Enemigo más grande que el jugador junto a un borde', () => {
    const e = enemy(120, 900, 270, 22);
    chaseFor(e, 60, 944, 270);
    expect([e.x, e.y]).toEqual([938, 270]);
  });
});

describe('Enemy · identidad y aparición', () => {
  it('conserva id, tipo y radio del tipo', () => {
    const e = enemy(90, 100, 100, 10);
    expect([e.id, e.type.id, e.radius]).toEqual([0, 'goblin-torch', 10]);
  });

  it('nace recortado a la arena', () => {
    const e = enemy(90, -50, 9999, 10);
    expect([e.x, e.y]).toEqual([10, 530]);
  });
});
