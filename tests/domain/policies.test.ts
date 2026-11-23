import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
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
describe('fleeInput (movimiento del bot de referencia)', () => {
  it('Scenario: Huida de un enemigo', () => {
    const config = aDefaultConfig();
    const run = startRun(config, { enemies: [{ type: 'goblin-torch', x: 580, y: 270 }] });

    const input = referenceBot(config).input(run.snapshot());

    expect(directionOf(input)).toEqual({ x: -1, y: 0 });
  });

  it('Scenario: Enemigo fuera de rango', () => {
    const config = aDefaultConfig();
    const run = startRun(config, { enemies: [{ type: 'goblin-torch', x: 630, y: 270 }] });

    expect(referenceBot(config).input(run.snapshot())).toBe(PlayerInput.NONE);
  });

  it('se aleja de la pared cuando no hay enemigos cerca', () => {
    const config = aDefaultConfig();
    const run = startRun(config, { player: { x: 20, y: 270 } });

    expect(directionOf(fleeInput(run.snapshot(), config.arena))).toEqual({ x: 1, y: 0 });
  });

  it('Scenario: Huida sin amenazas', () => {
    const config = aDefaultConfig();
    const run = startRun(config);

    expect(referenceBot(config).input(run.snapshot())).toBe(PlayerInput.NONE);
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
