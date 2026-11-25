import { describe, expect, it } from 'vitest';
import { Experience } from '../../src/domain/progression/Experience';
import { XpCurve } from '../../src/domain/progression/XpCurve';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { aDefaultConfig, aSegment, aWavesConfig, withScenarioCurve } from '../support/builders';
import { advance, startRun, ticks } from '../support/runs';
import { withPlayerStat } from '../support/upgrades';

// Spec leveling (0024), "Subida de nivel con arrastre": cada gema de valor v suma
// ⌊(v × (100 + b) + r) / 100⌋ y deja como resto (v × (100 + b) + r) mod 100.

function curve(): XpCurve {
  const r = XpCurve.create({ baseXp: 5, xpGrowth: 5 });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Experience.gain con bonificación (unidad)', () => {
  it('con b = 0 suma exactamente el valor (sin resto)', () => {
    const e = new Experience(curve());
    e.gain(3, 0);
    e.gain(1, 0);
    expect([e.level, e.xp]).toEqual([1, 4]);
  });

  it('Scenario: Bonificación con gemas de valor 1 (b = 50: 1 y luego 3)', () => {
    const e = new Experience(curve());
    e.gain(1, 50);
    const first = [e.xp, e.bonusRemainder];
    e.gain(1, 50);
    expect([first, [e.xp, e.bonusRemainder]]).toEqual([
      [1, 50],
      [3, 0],
    ]);
  });

  it('Scenario: Bonificación con gema grande (b = 25, valor 4: XP 5 y resto 0)', () => {
    const e = new Experience(curve());
    e.gain(4, 25);
    // XP 5 es el umbral del nivel 1 con la curva 5/5: sube a nivel 2 con 0 de sobrante.
    expect([e.level, e.xp, e.pendingLevelUps, e.bonusRemainder]).toEqual([2, 0, 1, 0]);
  });
});

/**
 * Contenido por defecto (curva 5/5) sin oleadas cuya única mejora de personaje es scholar (+b, nivel
 * máximo 1): con scholar en nivel 1, b queda fijo y las subidas no abren oferta.
 */
const scholarConfig = (b: number): RunConfig =>
  withPlayerStat(
    {
      ...withScenarioCurve(aDefaultConfig()),
      waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
    },
    'scholar',
    b,
  );

const CENTER = { x: 480, y: 270 };
/** Gema atraída de valor 1 que se recoge en el tick n con el jugador quieto en el centro. */
const gemOnTick = (n: number) => ({
  x: CENTER.x + 21 + 6 * (n - 1) + 3,
  y: CENTER.y,
  value: 1,
  attracted: true,
});

describe('Bonificación de XP en la partida', () => {
  it('Scenario: Bonificación con gemas de valor 1 (b = 50, ticks seguidos: XP 1 y 3)', () => {
    const run = startRun(scholarConfig(50), {
      player: CENTER,
      upgrades: { scholar: 1 },
      gems: [gemOnTick(1), gemOnTick(2)],
    });

    const [a, b] = ticks(run, 2);

    expect([a?.progression.xp, b?.progression.xp]).toEqual([1, 3]);
  });

  it('Scenario: Bonificación acumulada (b = 10, 10 gemas de valor 1: nivel 2 con XP 6)', () => {
    const gems = Array.from({ length: 10 }, (_, i) => gemOnTick(1 + 5 * i));
    const run = startRun(scholarConfig(10), { player: CENTER, upgrades: { scholar: 1 }, gems });

    const snaps = advance(run, 50);
    const s = snaps.at(-1);

    expect(snaps.filter((x) => x.pickups.length === 0)).not.toHaveLength(0);
    expect([s?.progression.level, s?.progression.xp]).toEqual([2, 6]);
  });
});
