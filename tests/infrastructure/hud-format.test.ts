import { describe, expect, it } from 'vitest';
import {
  formatClock,
  healthFill,
  healthLabel,
  killsLabel,
  remainingSeconds,
} from '../../src/infrastructure/phaser/hudFormat';

const clockAt = (tick: number, durationTicks = 36_000): string =>
  formatClock(remainingSeconds(tick, durationTicks));

describe('Tiempo restante en el HUD (spec hud)', () => {
  it('Scenario: Valores en torno al inicio (ticks 0, 1, 59, 60 y 61)', () => {
    expect([0, 1, 59, 60, 61].map((t) => clockAt(t))).toEqual([
      '10:00',
      '10:00',
      '10:00',
      '09:59',
      '09:59',
    ]);
  });

  it('Scenario: Valores en torno al final (ticks 35.940, 35.941, 35.999 y 36.000)', () => {
    expect([35_940, 35_941, 35_999, 36_000].map((t) => clockAt(t))).toEqual([
      '00:01',
      '00:01',
      '00:01',
      '00:00',
    ]);
  });

  it('Scenario: Valor intermedio (tick 3.570, 540,5 s restantes ⇒ 09:01)', () => {
    expect(clockAt(3570)).toBe('09:01');
  });

  it('Scenario: Otras duraciones (90, 3.600 y 6.000 s en el tick 0)', () => {
    expect([90, 3600, 6000].map((s) => clockAt(0, s * 60))).toEqual(['01:30', '60:00', '100:00']);
  });

  it('nunca baja de 00:00 más allá de la duración', () => {
    expect(clockAt(40_000)).toBe('00:00');
  });
});

describe('Vida en el HUD (spec hud)', () => {
  it('Scenario: Vida llena (100/100 ⇒ relleno 1)', () => {
    expect([healthFill(100, 100), healthLabel(100, 100)]).toEqual([1, '100/100']);
  });

  it('Scenario: Vida parcial con la vida máxima mejorada (75/120 ⇒ 0,625)', () => {
    expect(healthFill(75, 120)).toBeCloseTo(0.625, 3);
    expect(healthLabel(75, 120)).toBe('75/120');
  });

  it('Scenario: Vida 0 (relleno 0 y 0/100)', () => {
    expect([healthFill(0, 100), healthLabel(0, 100)]).toEqual([0, '0/100']);
  });

  it('Scenario: Vida fraccionaria (0,5 ⇒ 1/100 y relleno 0,005)', () => {
    expect(healthLabel(0.5, 100)).toBe('1/100');
    expect(healthFill(0.5, 100)).toBeCloseTo(0.005, 3);
  });

  it('acota el relleno a [0, 1] y no divide por 0', () => {
    expect([healthFill(150, 100), healthFill(-1, 100), healthFill(10, 0)]).toEqual([1, 0, 0]);
  });
});

describe('Bajas en el HUD (spec hud)', () => {
  it('Scenario: Muchas bajas (12.345 completo, sin abreviar)', () => {
    expect(killsLabel(12_345)).toBe('Bajas: 12345');
  });

  it('Scenario: Sin bajas', () => {
    expect(killsLabel(0)).toBe('Bajas: 0');
  });
});
