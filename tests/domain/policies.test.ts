import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { OfferSnapshot } from '../../src/domain/run/RunSnapshot';
import { DEFAULT_UPGRADE_LIST, aDefaultConfig, withPlayer } from '../support/builders';
import {
  REFERENCE_UPGRADE_PRIORITY,
  botWorld,
  isBlockedMove,
  pickByPriority,
  referenceBot,
} from '../support/policies';
import { startRun, startSeededRun } from '../support/runs';
import { Run } from '../../src/domain/run/Run';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { BALANCE_SEEDS } from '../support/balanceSeeds';
import { castleBlock, cellsWith, mapRules, type Layout } from '../support/mapLayouts';

/** Opción de oferta mínima con el id dado (el resto de campos no influye en la elección). */
const option = (id: string): OfferSnapshot => ({
  id,
  name: id,
  description: '',
  level: 0,
  nextLevel: 1,
});

const offerOf = (...ids: string[]): OfferSnapshot[] => ids.map(option);

// Spec run-outcome (0010), "Bot de referencia para el balance": elección priorizada.
describe('pickByPriority (elección del bot de referencia)', () => {
  it('Scenario: Elige por prioridad, no por posición', () => {
    expect(pickByPriority(offerOf('watch-mode', 'fast-ci', 'coverage'))).toBe(1);
  });

  it('Scenario: La prioridad más alta gana', () => {
    expect(pickByPriority(offerOf('strict-rules', 'hard-asserts', 'guardrail'))).toBe(2);
  });

  it('Scenario: Ningún id priorizado en la oferta', () => {
    expect(pickByPriority(offerOf('coverage', 'shortcuts', 'context-window'))).toBe(0);
  });

  it('Scenario: Oferta de una sola opción', () => {
    expect(pickByPriority(offerOf('wide-analysis'))).toBe(0);
  });

  it('cada id de la prioridad existe en el catálogo por defecto (una errata caería en la opción 0)', () => {
    const ids = DEFAULT_UPGRADE_LIST.map((u) => u.id);
    for (const id of REFERENCE_UPGRADE_PRIORITY) expect(ids).toContain(id);
  });
});

const directionOf = (input: PlayerInput) => ({ x: input.direction.x, y: input.direction.y });

// Política de movimiento del bot de referencia (medición de ganabilidad de 0006, spec de 0010).
// Desde 0013 el bot se construye con la configuración de la partida y huye de sus paredes.
describe('fleeInput (movimiento del bot de referencia, mundo 1.920 × 1.080)', () => {
  /** Input del bot por defecto con el jugador en `player` (o en el centro) y los enemigos dados. */
  const botInput = (setup: RunSetup = {}): PlayerInput => {
    const config = aDefaultConfig();
    const run = startRun(config, setup);
    return referenceBot(config, run.map).input(run.snapshot());
  };
  const torchAt = (x: number, y: number): RunSetup => ({
    enemies: [{ type: 'goblin-torch', x, y }],
  });

  it('Scenario: Huida sin amenazas (jugador en (960, 540))', () => {
    const config = aDefaultConfig();
    const run = startRun(config);
    const snapshot = run.snapshot();

    expect([snapshot.player.x, snapshot.player.y]).toEqual([960, 540]);
    expect(referenceBot(config, run.map).input(snapshot)).toBe(PlayerInput.NONE);
  });

  it('Scenario: Huida de un enemigo (a 100 px a la derecha)', () => {
    expect(directionOf(botInput(torchAt(1060, 540)))).toEqual({ x: -1, y: 0 });
  });

  it('Scenario: Enemigo fuera de rango (a 150 px exactos)', () => {
    expect(botInput(torchAt(1110, 540))).toBe(PlayerInput.NONE);
  });

  it('Scenario: Repulsión de la pared derecha del mundo (a 20 px)', () => {
    expect(directionOf(botInput({ player: { x: 1900, y: 540 } }))).toEqual({ x: -1, y: 0 });
  });

  it('Scenario: El borde de la vista no es una pared ((940, 270))', () => {
    expect(botInput({ player: { x: 940, y: 270 } })).toBe(PlayerInput.NONE);
  });

  it('Scenario: Pared a exactamente 64 px', () => {
    expect(botInput({ player: { x: 64, y: 540 } })).toBe(PlayerInput.NONE);
  });

  it('Scenario: Esquina del mundo ((1.904, 1.064), diagonal hacia −x y −y)', () => {
    const { x, y } = directionOf(botInput({ player: { x: 1904, y: 1064 } }));

    expect(x).toBeLessThan(0);
    expect(y).toBe(x);
  });

  it('se aleja de la pared izquierda cuando no hay enemigos cerca', () => {
    const config = aDefaultConfig();
    const run = startRun(config, { player: { x: 20, y: 540 } });

    expect(directionOf(referenceBot(config, run.map).input(run.snapshot()))).toEqual({
      x: 1,
      y: 0,
    });
  });
});

// Spec run-outcome (0013), "Una sola fuente del tamaño del mundo en los tests".
describe('Bot ligado a la configuración de la partida (0013)', () => {
  const bigWorld = (): RunConfig => ({
    ...aDefaultConfig(),
    arena: { width: 4000, height: 4000, view: aDefaultConfig().arena.view },
  });

  it('Scenario: El bot huye de las paredes del mundo real (pared derecha a 20 px)', () => {
    const config = bigWorld();
    const run = startRun(config, { player: { x: 3980, y: 2000 } });

    expect(directionOf(referenceBot(config, run.map).input(run.snapshot()))).toEqual({
      x: -1,
      y: 0,
    });
  });

  it('Scenario: El bot huye de las paredes del mundo real (lejos de toda pared, quieto)', () => {
    const config = bigWorld();
    const run = startRun(config, { player: { x: 1900, y: 2000 } });

    expect(referenceBot(config, run.map).input(run.snapshot())).toBe(PlayerInput.NONE);
  });

  it('el bot elige con la prioridad de referencia', () => {
    const config = aDefaultConfig();
    const bot = referenceBot(config, startRun(config).map);

    expect(bot.pick(offerOf('watch-mode', 'fast-ci', 'coverage'))).toBe(1);
  });
});

// Spec run-outcome (0015), "Bot de referencia para el balance": repulsión del mapa y giros.
describe('Bot de referencia v2 con el mapa', () => {
  const RULES = mapRules();

  /** Input del bot en una partida con el mapa explícito `layout` y el estado `setup`. */
  function inputWith(layout: Layout, setup: RunSetup, config = aDefaultConfig()): PlayerInput {
    const r = Run.start(config, new Mulberry32RandomGenerator(1), setup, {
      kind: 'cells',
      cells: cellsWith(RULES, layout),
    });
    if (!r.ok) throw new Error(r.error.message);
    return referenceBot(config, r.value.map).input(r.value.snapshot());
  }

  it.each(['trunk', 'water', 'castle'] as const)(
    'Scenario: Repulsión de un tronco, del agua y del castillo (%s a 40 px: input (−1, 0))',
    (type) => {
      const input = inputWith({ '10,4': type }, { player: { x: 560, y: 270 } });
      expect(directionOf(input)).toEqual({ x: -1, y: 0 });
    },
  );

  it('Scenario: Celda a exactamente 64 px (input (0, 0))', () => {
    expect(inputWith({ '10,4': 'trunk' }, { player: { x: 536, y: 270 } })).toBe(PlayerInput.NONE);
  });

  it('Scenario: Puente sin repulsión (input (0, 0))', () => {
    expect(inputWith({ '10,4': 'bridge' }, { player: { x: 560, y: 270 } })).toBe(PlayerInput.NONE);
  });

  it('Scenario: Dirección bloqueada por un tronco ((1, 0), +45° y −45° bloqueadas: (0, 1))', () => {
    const setup: RunSetup = {
      player: { x: 584, y: 270 },
      enemies: [{ type: 'goblin-torch', x: 574, y: 270 }],
    };
    const config = aDefaultConfig();
    const r = Run.start(config, new Mulberry32RandomGenerator(1), setup, {
      kind: 'cells',
      cells: cellsWith(RULES, { '10,4': 'trunk' }),
    });
    if (!r.ok) throw new Error(r.error.message);
    const snapshot = r.value.snapshot();
    const blocked = (dx: number, dy: number) =>
      isBlockedMove(snapshot, botWorld(config, r.value.map), dx, dy);
    expect([blocked(1, 0), blocked(1, 1), blocked(1, -1), blocked(0, 1)]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(directionOf(referenceBot(config, r.value.map).input(snapshot))).toEqual({ x: 0, y: 1 });
  });

  it('Scenario: Dirección bloqueada por el castillo ((0, −1), +45° y −45° bloqueadas: (1, 0))', () => {
    const config = withPlayer(aDefaultConfig(), { speed: 200 });
    const setup: RunSetup = {
      player: { x: 990, y: 616 },
      enemies: [{ type: 'goblin-torch', x: 990, y: 626 }],
    };
    const r = Run.start(config, new Mulberry32RandomGenerator(1), setup, {
      kind: 'cells',
      cells: cellsWith(RULES, castleBlock()),
    });
    if (!r.ok) throw new Error(r.error.message);
    const snapshot = r.value.snapshot();
    const blocked = (dx: number, dy: number) =>
      isBlockedMove(snapshot, botWorld(config, r.value.map), dx, dy);
    expect([blocked(0, -1), blocked(1, -1), blocked(-1, -1), blocked(1, 0)]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(directionOf(referenceBot(config, r.value.map).input(snapshot))).toEqual({ x: 1, y: 0 });
  });

  it('todas las direcciones bloqueadas: input (0, 0)', () => {
    // Celda (10, 4) rodeada de troncos y un jugador de radio 28 en su centro (a 30 px de cada
    // cara): cualquier paso de 3,33 px lo deja solapando. Un enemigo lo empuja hacia +x.
    const walls: Layout = {
      '9,3': 'trunk',
      '9,4': 'trunk',
      '9,5': 'trunk',
      '11,3': 'trunk',
      '11,4': 'trunk',
      '11,5': 'trunk',
      '10,3': 'trunk',
      '10,5': 'trunk',
    };
    const wide = withPlayer(aDefaultConfig(), { radius: 28 });
    const setup = {
      player: { x: 630, y: 270 },
      enemies: [{ type: 'goblin-torch', x: 620, y: 270 }],
    };
    expect(inputWith(walls, setup, wide)).toBe(PlayerInput.NONE);
  });

  it('la velocidad efectiva (shortcuts) decide el bloqueo: a 300 px/s el paso es de 5 px', () => {
    const config = aDefaultConfig();
    const r = Run.start(
      config,
      new Mulberry32RandomGenerator(1),
      { player: { x: 580, y: 270 }, upgrades: { shortcuts: 5 } },
      { kind: 'cells', cells: cellsWith(RULES, { '10,4': 'trunk' }) },
    );
    if (!r.ok) throw new Error(r.error.message);
    const world = botWorld(config, r.value.map);
    expect(isBlockedMove(r.value.snapshot(), world, 1, 0)).toBe(true);
    const slow = startRunWith(config, { player: { x: 580, y: 270 } });
    expect(isBlockedMove(slow.snapshot(), botWorld(config, slow.map), 1, 0)).toBe(false);
  });

  it('Scenario: Salida ante la puerta con el mapa generado (semillas 1..50, tick 0: (0, 1))', () => {
    const config = aDefaultConfig();
    const others = BALANCE_SEEDS.filter((seed) => {
      const run = startSeededRun(config, seed);
      const input = directionOf(referenceBot(config, run.map).input(run.snapshot()));
      return input.x !== 0 || input.y !== 1;
    });
    expect(others).toEqual([]);
  });

  /** Partida con el tronco (10, 4) y el estado dado. */
  function startRunWith(config: RunConfig, setup: RunSetup): Run {
    const r = Run.start(config, new Mulberry32RandomGenerator(1), setup, {
      kind: 'cells',
      cells: cellsWith(RULES, { '10,4': 'trunk' }),
    });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  }
});
