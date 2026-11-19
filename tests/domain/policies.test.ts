import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { aDefaultConfig } from '../support/builders';
import { fleeInput } from '../support/policies';
import { startRun } from '../support/runs';

// Política de movimiento reproducible de la medición de ganabilidad (tarea 0.1 de 0006).
describe('fleeInput (política de huida, preparación de "Partida ganada con estrategia documentada")', () => {
  it('huye a la izquierda de un enemigo a su derecha', () => {
    const run = startRun(aDefaultConfig(), { enemies: [{ type: 'bug', x: 580, y: 270 }] });

    const input = fleeInput(run.snapshot());

    expect(input.direction.x).toBe(-1);
    expect(input.direction.y).toBe(0);
  });

  it('se aleja de la pared cuando no hay enemigos cerca', () => {
    const run = startRun(aDefaultConfig(), { player: { x: 20, y: 270 } });

    const input = fleeInput(run.snapshot());

    expect(input.direction.x).toBe(1);
    expect(input.direction.y).toBe(0);
  });

  it('se queda quieto sin enemigos cerca ni paredes', () => {
    const run = startRun(aDefaultConfig());

    expect(fleeInput(run.snapshot())).toBe(PlayerInput.NONE);
  });
});
