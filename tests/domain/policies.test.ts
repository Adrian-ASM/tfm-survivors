import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { OfferSnapshot } from '../../src/domain/run/RunSnapshot';
import { DEFAULT_UPGRADE_LIST, aDefaultConfig } from '../support/builders';
import { REFERENCE_UPGRADE_PRIORITY, fleeInput, pickByPriority } from '../support/policies';
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

// Política de movimiento del bot de referencia (medición de ganabilidad de 0006, spec de 0010).
describe('fleeInput (movimiento del bot de referencia)', () => {
  it('Scenario: Huida de un enemigo', () => {
    const run = startRun(aDefaultConfig(), { enemies: [{ type: 'goblin-torch', x: 580, y: 270 }] });

    const input = fleeInput(run.snapshot());

    expect(input.direction.x).toBe(-1);
    expect(input.direction.y).toBe(0);
  });

  it('Scenario: Enemigo fuera de rango', () => {
    const run = startRun(aDefaultConfig(), { enemies: [{ type: 'goblin-torch', x: 630, y: 270 }] });

    expect(fleeInput(run.snapshot())).toBe(PlayerInput.NONE);
  });

  it('se aleja de la pared cuando no hay enemigos cerca', () => {
    const run = startRun(aDefaultConfig(), { player: { x: 20, y: 270 } });

    const input = fleeInput(run.snapshot());

    expect(input.direction.x).toBe(1);
    expect(input.direction.y).toBe(0);
  });

  it('Scenario: Huida sin amenazas', () => {
    const run = startRun(aDefaultConfig());

    expect(fleeInput(run.snapshot())).toBe(PlayerInput.NONE);
  });
});
