import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { OfferSnapshot } from '../../src/domain/run/RunSnapshot';
import { DEFAULT_UPGRADE_LIST, aDefaultConfig } from '../support/builders';
import {
  REFERENCE_UPGRADE_PRIORITY,
  fleeInput,
  pickByPriority,
  referenceBot,
} from '../support/policies';
import { startRun } from '../support/runs';

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
    return referenceBot(config).input(startRun(config, setup).snapshot());
  };
  const torchAt = (x: number, y: number): RunSetup => ({
    enemies: [{ type: 'goblin-torch', x, y }],
  });

  it('Scenario: Huida sin amenazas (jugador en (960, 540))', () => {
    const config = aDefaultConfig();
    const snapshot = startRun(config).snapshot();

    expect([snapshot.player.x, snapshot.player.y]).toEqual([960, 540]);
    expect(referenceBot(config).input(snapshot)).toBe(PlayerInput.NONE);
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

    expect(directionOf(fleeInput(run.snapshot(), config.arena))).toEqual({ x: 1, y: 0 });
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

    expect(directionOf(referenceBot(config).input(run.snapshot()))).toEqual({ x: -1, y: 0 });
  });

  it('Scenario: El bot huye de las paredes del mundo real (lejos de toda pared, quieto)', () => {
    const config = bigWorld();
    const run = startRun(config, { player: { x: 1900, y: 2000 } });

    expect(referenceBot(config).input(run.snapshot())).toBe(PlayerInput.NONE);
  });

  it('el bot elige con la prioridad de referencia', () => {
    const bot = referenceBot(aDefaultConfig());

    expect(bot.pick(offerOf('watch-mode', 'fast-ci', 'coverage'))).toBe(1);
  });
});
