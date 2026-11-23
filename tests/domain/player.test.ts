import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { Player } from '../../src/domain/player/Player';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { TICK_SECONDS } from '../../src/domain/run/Run';
import { Vector2 } from '../../src/domain/shared/Vector2';
import { aDefaultConfig, withPlayer } from '../support/builders';
import { startRun, ticks } from '../support/runs';
import { openMap } from '../support/mapLayouts';

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

function arena(width = 960, height = 540): Arena {
  const r = Arena.create(width, height);
  if (!r.ok) throw new Error('arena de test inválida');
  return r.value;
}

/** Mundo explícito de los escenarios de límites de 0017 (3.840 × 2.160). */
const WORLD = arena(3840, 2160);

function simulate(
  start: [number, number],
  input: PlayerInput,
  ticks: number,
  bounds: Arena = arena(),
): Player {
  let p = Player.spawn(Vector2.of(...start), RULES);
  for (let i = 0; i < ticks; i++) p = p.move(input, TICK_SECONDS, bounds, openMap(bounds));
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
  it('Scenario: Choque con el borde derecho (mundo 3.840 × 2.160)', () => {
    const p = simulate([3820, 1080], PlayerInput.of(1, 0), 60, WORLD);
    expect([p.position.x, p.position.y]).toEqual([3824, 1080]);
  });

  it('Scenario: Choque con el borde inferior (mundo 3.840 × 2.160)', () => {
    const p = simulate([1920, 2140], PlayerInput.of(0, 1), 60, WORLD);
    expect([p.position.x, p.position.y]).toEqual([1920, 2144]);
  });

  it('Scenario: Esquina superior izquierda', () => {
    const p = simulate([20, 20], PlayerInput.of(-1, -1), 60, WORLD);
    expect([p.position.x, p.position.y]).toEqual([16, 16]);
  });

  it('Scenario: Esquina inferior derecha (mundo 3.840 × 2.160)', () => {
    const p = simulate([3820, 2140], PlayerInput.of(1, 1), 60, WORLD);
    expect([p.position.x, p.position.y]).toEqual([3824, 2144]);
  });

  it('Scenario: Deslizar por la pared (mundo 3.840 × 2.160)', () => {
    const p = simulate([3824, 1080], PlayerInput.of(1, 1), 30, WORLD);
    expect(p.position.x).toBe(3824);
    expectWithinSpec(p.position.y - 1080, 70.711);
  });

  it('choque con el borde derecho de una arena de escenario de 960 × 540', () => {
    const p = simulate([940, 270], PlayerInput.of(1, 0), 60);
    expect([p.position.x, p.position.y]).toEqual([944, 270]);
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
    const p = fresh()
      .hit(10, 5)
      .move(PlayerInput.of(1, 0), TICK_SECONDS, arena(), openMap(arena()));
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

// Spec player-movement (0017): el mundo por defecto (3.840 × 2.160) es mayor que cualquier vista.
describe('Player · mundo por defecto (0013)', () => {
  it('Scenario: Partida nueva con el mundo por defecto (jugador en (1.920, 1.080))', () => {
    const run = startRun(aDefaultConfig());

    const { x, y } = run.snapshot().player;

    expect([x, y]).toEqual([1920, 1080]);
  });

  it('Scenario: El borde de la vista no es una pared ((1.270, 270) → (1.470, 270))', () => {
    const config = withPlayer(aDefaultConfig(), { speed: 200 }); // velocidad de la spec
    const run = startRun(config, { player: { x: 1270, y: 270 } });

    const last = ticks(run, 60, PlayerInput.of(1, 0)).at(-1)?.player;

    expectWithinSpec(last?.x ?? 0, 1470);
    expect(last?.y).toBe(270);
  });
});
