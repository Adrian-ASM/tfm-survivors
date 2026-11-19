import { describe, expect, it } from 'vitest';
import { Projectile, type ProjectileAttack } from '../../src/domain/weapon/Projectile';
import { PulseEcho } from '../../src/domain/weapon/PulseEcho';

const ATTACK: ProjectileAttack = { type: 'projectile', speed: 480, radius: 4, lifetimeTicks: 60 };

function launched(tx: number, ty: number, firedAt = 10): Projectile {
  const p = new Projectile();
  p.launch(7, 480, 270, tx, ty, 6, ATTACK, firedAt);
  return p;
}

describe('Projectile', () => {
  it('se lanza en la posición del jugador con el radio, el daño y el id dados', () => {
    const p = launched(580, 270);
    expect([p.id, p.x, p.y, p.radius, p.damage, p.spent]).toEqual([7, 480, 270, 4, 6, false]);
  });

  it('avanza speed / 60 por tick en dirección fija hacia el objetivo', () => {
    const p = launched(480 + 30, 270 + 40);
    p.advance();
    expect(p.x).toBeCloseTo(480 + 8 * 0.6, 9);
    expect(p.y).toBeCloseTo(270 + 8 * 0.8, 9);
  });

  it('con distancia 0 la dirección es (1, 0)', () => {
    const p = launched(480, 270);
    p.advance();
    expect([p.x, p.y]).toEqual([488, 270]);
  });

  it('Scenario: Agota su vida sin impactar (T + 59 en (952, 270); caduca en T + 60)', () => {
    const T = 10;
    const p = launched(1000, 270, T);
    for (let n = T + 1; n <= T + 59; n++) p.advance();
    expect([p.x, p.y]).toEqual([952, 270]);
    expect(p.expiredAt(T + 59)).toBe(false);
    expect(p.expiredAt(T + 60)).toBe(true);
  });

  it('un objeto reutilizado se relanza con estado nuevo', () => {
    const p = launched(580, 270);
    p.spent = true;
    const slow: ProjectileAttack = { type: 'projectile', speed: 60, radius: 2, lifetimeTicks: 5 };
    p.launch(8, 0, 0, 0, 10, 1, slow, 50);
    p.advance();
    expect([p.id, p.x, p.y, p.radius, p.damage, p.spent]).toEqual([8, 0, 1, 2, 1, false]);
  });
});

describe('PulseEcho', () => {
  it('guarda el pulso visible: arma, tick, centro, radio y visible hasta until − 1', () => {
    const e = new PulseEcho();
    e.set('tests', 40, 480, 270, 90, 48);
    expect([e.weaponId, e.firedAt, e.x, e.y, e.radius]).toEqual(['tests', 40, 480, 270, 90]);
    expect([e.expiredAt(47), e.expiredAt(48)]).toEqual([false, true]);
  });
});
