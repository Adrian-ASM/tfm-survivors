import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { Player } from '../../src/domain/player/Player';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { TICK_SECONDS } from '../../src/domain/run/Run';
import { Vector2 } from '../../src/domain/shared/Vector2';

const EPS = 3; // toBeCloseTo(…, 3) ⇒ error < 0,0005 px (la spec pide ≤ 0,001)

function arena(): Arena {
  const r = Arena.create(960, 540);
  if (!r.ok) throw new Error('arena de test inválida');
  return r.value;
}

function simulate(start: [number, number], input: PlayerInput, ticks: number): Player {
  let p = Player.spawn(Vector2.of(...start), 16, 200);
  for (let i = 0; i < ticks; i++) p = p.move(input, TICK_SECONDS, arena());
  return p;
}

describe('PlayerInput · normalización diagonal', () => {
  it('Diagonal a la misma velocidad que un eje', () => {
    const p = simulate([480, 270], PlayerInput.of(1, 1), 60);
    const travelled = Math.hypot(p.position.x - 480, p.position.y - 270);
    expect(travelled).toBeCloseTo(200, EPS);
    expect(p.position.x).toBeCloseTo(480 + 141.421, 2);
    expect(p.position.y).toBeCloseTo(270 + 141.421, 2);
  });

  it('Input fuera de rango', () => {
    const p = simulate([480, 270], PlayerInput.of(5, 0), 60);
    expect(p.position.x).toBeCloseTo(680, EPS);
    expect(p.position.y).toBe(270);
  });

  it('Input analógico menor que 1 no se amplifica', () => {
    const p = simulate([480, 270], PlayerInput.of(0.5, 0), 60);
    expect(p.position.x).toBeCloseTo(580, EPS);
  });

  it('trata NaN como 0', () => {
    expect(PlayerInput.of(Number.NaN, 1).direction).toEqual(Vector2.of(0, 1));
  });
});

describe('Player · movimiento', () => {
  it('Movimiento horizontal durante un segundo', () => {
    const p = simulate([480, 270], PlayerInput.of(1, 0), 60);
    expect(p.position.x).toBeCloseTo(680, EPS);
    expect(p.position.y).toBe(270);
  });

  it('Sin input no hay movimiento', () => {
    const p = simulate([480, 270], PlayerInput.NONE, 60);
    expect([p.position.x, p.position.y]).toEqual([480, 270]);
  });

  it('Movimiento vertical hacia arriba', () => {
    const p = simulate([480, 270], PlayerInput.of(0, -1), 30);
    expect(p.position.x).toBe(480);
    expect(p.position.y).toBeCloseTo(170, EPS);
  });
});

describe('Arena · límites', () => {
  it('Choque con el borde derecho', () => {
    const p = simulate([940, 270], PlayerInput.of(1, 0), 60);
    expect([p.position.x, p.position.y]).toEqual([944, 270]);
  });

  it('Esquina superior izquierda', () => {
    const p = simulate([20, 20], PlayerInput.of(-1, -1), 60);
    expect([p.position.x, p.position.y]).toEqual([16, 16]);
  });

  it('Deslizar por la pared', () => {
    const p = simulate([944, 270], PlayerInput.of(1, 1), 30);
    expect(p.position.x).toBe(944);
    expect(p.position.y - 270).toBeCloseTo(70.711, 2);
  });

  it('rechaza dimensiones no positivas', () => {
    expect(Arena.create(0, 540).ok).toBe(false);
    expect(Arena.create(960, -1).ok).toBe(false);
  });

  it('sabe si un radio cabe', () => {
    expect(arena().fits(16)).toBe(true);
    expect(arena().fits(300)).toBe(false);
  });
});
