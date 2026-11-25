import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  CONTENT_SHEEP,
  aDefaultConfig,
  aStillType,
  withExtraTypes,
  withSheep,
} from '../support/builders';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { startSeededRun, ticks } from '../support/runs';
import {
  EXIT,
  SHEEP_AT,
  aSheepConfig,
  declaredSheep,
  firstAt,
  startWithSheep,
} from '../support/sheep';

const GRAZING = { radius: 20, health: 12, state: 'graze', damaged: false };

// Spec procedural-map (0023), "Mapa explícito y mapa vacío".
describe('Ovejas declaradas en un mapa explícito (spec procedural-map)', () => {
  it('Scenario: Mapa explícito con ovejas declaradas ((1.000, 1.000) y (1.500, 600))', () => {
    const run = startWithSheep(aDefaultConfig(), [SHEEP_AT, { x: 1500, y: 600 }]);
    const s = run.snapshot();
    expect(s.sheep).toEqual([
      {
        id: 0,
        x: 1000,
        y: 1000,
        radius: 18,
        health: 12,
        state: 'graze',
        damaged: false,
        origin: { x: 1000, y: 1000 },
      },
      {
        id: 1,
        x: 1500,
        y: 600,
        radius: 18,
        health: 12,
        state: 'graze',
        damaged: false,
        origin: { x: 1500, y: 600 },
      },
    ]);
    expect(run.map.cells.every((c) => c === 'grass')).toBe(true);
  });

  it('Scenario: Mapa explícito con ovejas declaradas (7, más que el tope por defecto)', () => {
    const at = Array.from({ length: 7 }, (_, i) => ({ x: 400 + 100 * i, y: 600 }));
    const s = startWithSheep(aDefaultConfig(), at).snapshot();
    expect(CONTENT_SHEEP.maxAlive).toBeLessThan(7);
    expect(s.sheep.map((o) => [o.id, o.x, o.y, o.state])).toEqual(
      at.map((p, i) => [i, p.x, p.y, 'graze']),
    );
  });

  describe('Scenario: Oveja declarada ilegal (radio 20, tronco en (10, 4))', () => {
    const config = { ...aDefaultConfig(), sheep: { ...CONTENT_SHEEP, radius: 20 } };
    const cells = cellsWith(mapRules(), { '10,4': 'trunk' });
    const start = (at: { x: number; y: number }) =>
      Run.start(config, new Mulberry32RandomGenerator(1), {}, declaredSheep([at], { cells }));

    it.each([
      [630, 270],
      [590, 270],
      [10, 540],
    ])('(%s, %s) no crea la partida y nombra la oveja', (x, y) => {
      const r = start({ x, y });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.field).toBe('map.sheep.0');
    });

    it('(580, 270), tangente al tronco, la crea', () => {
      expect(start({ x: 580, y: 270 }).ok).toBe(true);
    });
  });

  it('Scenario: Partida con mapa vacío (semilla 7: sin ovejas)', () => {
    const run = startSeededRun(aDefaultConfig(), 7, 'empty');
    expect(run.snapshot().sheep).toEqual([]);
  });
});

// Spec simulation-loop (0023), "Snapshot para el motor" y "Determinismo".
describe('Ovejas en el snapshot (spec simulation-loop)', () => {
  it('Scenario: Ovejas en el snapshot del motor (tick 0: id, (1.000, 1.000), radio 20, vida 12, graze)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], { player: { x: 1150, y: 1000 } });
    expect(run.snapshot().sheep).toEqual([{ id: 0, ...SHEEP_AT, ...GRAZING, origin: SHEEP_AT }]);
  });

  it('Scenario: Partida recién creada (mapa vacío: lista de ovejas vacía)', () => {
    const s = startSeededRun(aDefaultConfig(), 42, 'empty').snapshot();
    expect(s.sheep).toEqual([]);
    expect(Object.isFrozen(s.sheep)).toBe(true);
  });

  it('Scenario: Snapshot no mutable desde fuera (posición, vida y estado de una oveja y la lista)', () => {
    const run = startWithSheep(aSheepConfig());
    const snap = run.snapshot();
    const tryWrite = (f: () => void) => {
      try {
        f();
      } catch {
        // congelado: en modo estricto, escribir lanza
      }
    };
    tryWrite(() => Object.assign(snap.sheep[0] ?? {}, { x: 0, health: 1, state: 'flee' }));
    tryWrite(() => Object.assign(snap.sheep[0]?.origin ?? {}, { x: 0 }));
    tryWrite(() => (snap.sheep as unknown as unknown[]).pop());
    expect(run.snapshot().sheep).toEqual([{ id: 0, ...SHEEP_AT, ...GRAZING, origin: SHEEP_AT }]);
  });

  it('RunSetup.sheep fija la vida y el origen de una oveja declarada', () => {
    const run = startWithSheep(aSheepConfig(), [{ x: 1400, y: 1000 }], {
      sheep: [{ health: 6, origin: SHEEP_AT }],
    });
    expect(run.snapshot().sheep[0]).toMatchObject({ x: 1400, health: 6, origin: SHEEP_AT });
  });

  it.each([[0], [13], [Number.NaN]])('RunSetup.sheep rechaza la vida %s', (health) => {
    const r = Run.start(
      aSheepConfig(),
      new Mulberry32RandomGenerator(1),
      { sheep: [{ health }] },
      declaredSheep([SHEEP_AT]),
    );
    expect(r.ok ? null : r.error.field).toBe('setup.sheep.0.health');
  });

  it('RunSetup.sheep con más entradas que ovejas falla', () => {
    const r = Run.start(
      aSheepConfig(),
      new Mulberry32RandomGenerator(1),
      { sheep: [{}, {}] },
      declaredSheep([SHEEP_AT]),
    );
    expect(r.ok ? null : r.error.field).toBe('setup.sheep');
  });
});

// Spec sheep (0023), "Ovejas de la partida" y "Ovejas neutrales".
describe('Ovejas neutrales (spec sheep)', () => {
  it('Scenario: Mapa vacío sin ovejas (semilla 42, 3.600 ticks)', () => {
    const run = startSeededRun(aDefaultConfig(), 42, 'empty');
    let seen = 0;
    for (let t = 0; t < 3600 && run.status !== 'over'; t++) {
      if (run.status === 'choosing') run.chooseUpgrade(0);
      run.tick(PlayerInput.NONE);
      seen += run.snapshot().sheep.length;
    }
    expect(seen).toBe(0);
  });

  it('Scenario: Ovejas solapadas (dos en (1.000, 1.000) durante 120 ticks)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT, SHEEP_AT]);
    for (const s of ticks(run, 120)) {
      expect(s.sheep.map((o) => [o.x, o.y])).toEqual([
        [1000, 1000],
        [1000, 1000],
      ]);
    }
  });

  it('Scenario: El jugador atraviesa una oveja sin daño (1.115 tras 60 ticks, vida 100)', () => {
    const config = aSheepConfig({ flee: { radius: 200, speed: 1 } });
    const input = PlayerInput.of(1, 0);
    const setup = { player: { x: 900, y: 1000 } };
    const withOne = ticks(startWithSheep(config, [SHEEP_AT], setup), 60, input);
    const without = ticks(startWithSheep(config, [], setup), 60, input);
    expect(withOne.at(-1)?.player.x).toBeCloseTo(1115, 3);
    expect(withOne.map((s) => s.player)).toEqual(without.map((s) => s.player));
    expect(withOne.every((s) => s.player.health === 100 && !s.player.invulnerable)).toBe(true);
  });

  it('Scenario: Un enemigo cruza una oveja (goblin-torch en la misma posición que sin la oveja)', () => {
    const setup = {
      player: { x: 1300, y: 1000 },
      enemies: [{ type: 'goblin-torch', x: 700, y: 1000 }],
    };
    const a = ticks(startWithSheep(aSheepConfig(), [SHEEP_AT], setup), 60);
    const b = ticks(startWithSheep(aSheepConfig(), [], setup), 60);
    expect(a.map((s) => s.enemies)).toEqual(b.map((s) => s.enemies));
  });

  it('Scenario: El contacto de un enemigo no la daña (enemigo de daño 5 en su centro, 600 ticks)', () => {
    const base = aSheepConfig();
    const config = withSheep(withExtraTypes(base, aStillType({ damage: 5 })));
    const run = startWithSheep(config, [SHEEP_AT], { enemies: [{ type: 'still', ...SHEEP_AT }] });
    for (const s of ticks(run, 600)) {
      expect([s.sheep[0]?.health, s.sheep[0]?.damaged]).toEqual([12, false]);
    }
  });

  it('el jugador por defecto está quieto en la salida del mapa vacío', () => {
    const s = startWithSheep(aSheepConfig()).snapshot();
    expect([s.player.x, s.player.y]).toEqual([EXIT.x, EXIT.y]);
    expect(firstAt(s)).toEqual([1000, 1000]);
  });
});
