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

function enemy(speed: number, x: number, y: number, radius = 10, id = 'bug'): Enemy {
  const type = EnemyType.create(
    { id, speed, radius, cost: 1, damage: 5, health: 10 },
    ARENA,
    'enemies.types.0',
  );
  if (!type.ok) throw new Error(type.error.message);
  return Enemy.spawn(0, type.value, x, y, ARENA);
}

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
    const leak = enemy(45, 100, 440, 22, 'memory-leak');
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
    expect([e.id, e.type.id, e.radius]).toEqual([0, 'bug', 10]);
  });

  it('nace recortado a la arena', () => {
    const e = enemy(90, -50, 9999, 10);
    expect([e.x, e.y]).toEqual([10, 530]);
  });
});
