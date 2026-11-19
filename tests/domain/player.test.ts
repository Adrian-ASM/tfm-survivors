import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { Player } from '../../src/domain/player/Player';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { TICK_SECONDS } from '../../src/domain/run/Run';
import { Vector2 } from '../../src/domain/shared/Vector2';

const EPS = 3; // toBeCloseTo(…, 3) ⇒ error < 0,0005 px (la spec pide ≤ 0,001)

const RULES = {
  speed: 200,
  radius: 16,
  maxHealth: 100,
  invulnerabilityTicks: 30,
  pickupRadius: 64,
};

/** Error ≤ 0,001 px respecto al valor que da la spec (tolerancia literal de la spec). */
function expectWithinSpec(actual: number, expected: number): void {
  expect(
    Math.abs(actual - expected),
    `${String(actual)} vs ${String(expected)}`,
  ).toBeLessThanOrEqual(0.001);
}

function arena(): Arena {
  const r = Arena.create(960, 540);
  if (!r.ok) throw new Error('arena de test inválida');
  return r.value;
}

function simulate(start: [number, number], input: PlayerInput, ticks: number): Player {
  let p = Player.spawn(Vector2.of(...start), RULES);
  for (let i = 0; i < ticks; i++) p = p.move(input, TICK_SECONDS, arena());
  return p;
}

describe('PlayerInput · normalización diagonal', () => {
  it('Diagonal a la misma velocidad que un eje', () => {
    const p = simulate([480, 270], PlayerInput.of(1, 1), 60);
    const travelled = Math.hypot(p.position.x - 480, p.position.y - 270);
    expectWithinSpec(travelled, 200);
    expectWithinSpec(p.position.x, 480 + 141.421);
    expectWithinSpec(p.position.y, 270 + 141.421);
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
    expectWithinSpec(p.position.y - 270, 70.711);
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

describe('Player · vida e invulnerabilidad', () => {
  const fresh = (): Player => Player.spawn(Vector2.of(480, 270), RULES);

  it('empieza con la vida llena y sin invulnerabilidad (invulnerableUntil 0)', () => {
    const p = fresh();
    expect([p.health.current, p.health.max, p.invulnerableUntil]).toEqual([100, 100, 0]);
    expect(p.isInvulnerableAfter(0)).toBe(false);
    expect(p.canBeHitAt(1)).toBe(true);
  });

  it('Fin de la invulnerabilidad justo en el tick N (fronteras t, t + N − 1, t + N, t + N + 1)', () => {
    const t = 1;
    const p = fresh().hit(10, t);
    expect(p.health.current).toBe(90);
    expect(p.invulnerableUntil).toBe(31);
    expect([p.canBeHitAt(t + 1), p.canBeHitAt(t + 29), p.canBeHitAt(t + 30)]).toEqual([
      false,
      false,
      false,
    ]);
    expect(p.canBeHitAt(t + 31)).toBe(true);
    expect([p.isInvulnerableAfter(t), p.isInvulnerableAfter(t + 29)]).toEqual([true, true]);
    expect([p.isInvulnerableAfter(t + 30), p.isInvulnerableAfter(t + 31)]).toEqual([false, false]);
  });

  it('move conserva la vida y la invulnerabilidad', () => {
    const p = fresh().hit(10, 5).move(PlayerInput.of(1, 0), TICK_SECONDS, arena());
    expect([p.health.current, p.invulnerableUntil]).toEqual([90, 35]);
  });

  it('hit devuelve un jugador nuevo y no cambia el original', () => {
    const p = fresh();
    p.hit(10, 1);
    expect([p.health.current, p.invulnerableUntil]).toEqual([100, 0]);
  });
});

describe('Player.withRules', () => {
  it('conserva posición, vida restante e invulnerabilidad, y aplica las reglas nuevas', () => {
    const hit = Player.spawn(Vector2.of(100, 200), RULES).hit(10, 10);
    const p = hit.withRules({ ...RULES, speed: 220, maxHealth: 120 }, 20);
    expect([p.position.x, p.position.y]).toEqual([100, 200]);
    expect([p.health.current, p.health.max]).toEqual([110, 120]);
    expect(p.invulnerableUntil).toBe(40);
    expect(p.speed).toBe(220);
    expect([hit.speed, hit.health.max]).toEqual([200, 100]);
  });

  it('expone el radio de recogida efectivo', () => {
    const p = Player.spawn(Vector2.of(0, 0), RULES).withRules({ ...RULES, pickupRadius: 96 }, 0);
    expect(p.pickupRadius).toBe(96);
  });
});
