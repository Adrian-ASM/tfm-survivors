import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Stockpile } from '../../src/domain/resource/Stockpile';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { aDefaultConfig, aSegment, aWavesConfig, withResources } from '../support/builders';
import { startOn } from '../support/camps';
import { ticks } from '../support/runs';
import { withPlayerStat } from '../support/upgrades';

// Spec resources (0024), "Contadores de oro y madera de la partida": cada ingreso de v suma
// ⌊(v × (100 + g) + r) / 100⌋ con un resto propio del oro; el oro solo baja al comprar.

describe('Stockpile (unidad)', () => {
  it('con g = 0 suma exactamente el oro y la madera', () => {
    const s = new Stockpile();
    s.add(10, 3, 0);
    s.add(1, 0, 0);
    expect([s.gold, s.wood]).toEqual([11, 3]);
  });

  it('Scenario: Resto arrastrado del oro (g = 10, 10 ingresos de 1: 11)', () => {
    const s = new Stockpile();
    for (let i = 0; i < 10; i++) s.add(1, 0, 10);
    expect(s.gold).toBe(11);
  });

  it('la madera no lleva bonificación (g = 50 sobre 4 de madera: 4)', () => {
    const s = new Stockpile();
    s.add(0, 4, 50);
    expect([s.gold, s.wood]).toEqual([0, 4]);
  });

  it('spend: con oro suficiente resta el precio; si no, no cambia nada', () => {
    const s = new Stockpile(30, 0);
    expect(s.spend(30)).toBe(true);
    expect(s.gold).toBe(0);
    expect(s.spend(1)).toBe(false);
    expect(s.gold).toBe(0);
    const t = new Stockpile(29, 0);
    expect([t.spend(30), t.gold]).toEqual([false, 29]);
  });
});

// Spec resources (0025), "Contador de piedra de la partida": solo sube, sin bonificación ni resto.
describe('Stockpile: piedra (unidad)', () => {
  it('empieza en 0 y en el valor dado', () => {
    expect(new Stockpile().stone).toBe(0);
    expect(new Stockpile(0, 0, 7).stone).toBe(7);
  });

  it('Scenario: Sin bonificación (10 piedras de 1 con g = 20: 10)', () => {
    const s = new Stockpile();
    for (let i = 0; i < 10; i++) {
      s.add(0, 0, 20);
      s.addStone(1);
    }
    expect([s.stone, s.gold, s.wood]).toEqual([10, 0, 0]);
  });

  it('Scenario: Valores grandes (99.999 + 1 = 100.000)', () => {
    const s = new Stockpile(0, 0, 99_999);
    s.addStone(1);
    expect(s.stone).toBe(100_000);
  });

  it('Scenario: No baja al comprar (piedra 5, compra de 30)', () => {
    const s = new Stockpile(30, 0, 5);
    expect(s.spend(30)).toBe(true);
    expect([s.gold, s.stone]).toEqual([0, 5]);
  });

  it('el oro y la madera no tocan la piedra', () => {
    const s = new Stockpile(0, 0, 2);
    s.add(10, 3, 0);
    expect(s.stone).toBe(2);
  });
});

/** Contenido por defecto sin oleadas, veta de 15 y radio 24, con `prospector` +g en nivel 1. */
const prospecting = (g: number): RunConfig => {
  const base = aDefaultConfig();
  return withPlayerStat(
    {
      ...withResources(base, {
        ...base.resources,
        goldVeins: { ...base.resources.goldVeins, gold: 15, radius: 24 },
      }),
      waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
    },
    'prospector',
    g,
  );
};

describe('Bonificación de oro en la partida (resources 0024)', () => {
  it('Scenario: Bonificación de oro (g = 20: 12 tras el gold de 10 y 30 tras la veta de 15)', () => {
    const P = { x: 1000, y: 1000 };
    // La veta está a 45 px: el jugador la toca en el tick 2 al avanzar 3,58 px por tick hacia ella.
    const run = startOn(
      prospecting(20),
      { kind: 'open', resources: { veins: [{ x: 1000 + 45, y: 1000 }] } },
      {
        player: P,
        upgrades: { prospector: 1 },
        gems: [{ kind: 'gold', ...P, value: 10 }],
      },
    );
    const [n] = ticks(run, 1);
    const right = PlayerInput.of(1, 0);
    const later = ticks(run, 3, right);

    expect(n?.resources.gold).toBe(12);
    expect(later.map((s) => s.resources.gold)).toContain(30);
    expect(later.at(-1)?.resources.gold).toBe(30);
  });

  it('Scenario: Resto arrastrado del oro (g = 10, 10 gold de 1 en ticks distintos: 11)', () => {
    const P = { x: 1000, y: 1000 };
    const gemOnTick = (k: number) => ({
      kind: 'gold' as const,
      x: P.x + 21 + 6 * (k - 1) + 3,
      y: P.y,
      value: 1,
      attracted: true,
    });
    const run = startOn(
      prospecting(10),
      { kind: 'open' },
      {
        player: P,
        upgrades: { prospector: 1 },
        gems: Array.from({ length: 10 }, (_, i) => gemOnTick(1 + 3 * i)),
      },
    );

    expect(ticks(run, 30).at(-1)?.resources.gold).toBe(11);
  });
});
