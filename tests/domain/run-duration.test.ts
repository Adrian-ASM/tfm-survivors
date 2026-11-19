import { describe, expect, it } from 'vitest';
import {
  RUN_DURATION_MUST_BE_INTEGER,
  RunDuration,
} from '../../src/domain/run/RunDuration';

function durationOf(seconds: number): RunDuration {
  const r = RunDuration.create(seconds);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('RunDuration (spec run-outcome: Duración objetivo validada)', () => {
  it('Scenario: Contenido por defecto (600 s ⇒ 36.000 ticks)', () => {
    expect(durationOf(600).ticks).toBe(36_000);
  });

  it('Scenario: Duración mínima válida (1 s ⇒ 60 ticks)', () => {
    expect(durationOf(1).ticks).toBe(60);
  });

  it.each([0, -60])('Scenario: Duración cero o negativa (%d)', (seconds) => {
    const r = RunDuration.create(seconds);

    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.field).toContain('durationSeconds');
    expect(!r.ok && r.error.message).toBe(RUN_DURATION_MUST_BE_INTEGER);
  });

  it.each([600.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'Scenario: Duración no entera o ausente (%d)',
    (seconds) => {
      const r = RunDuration.create(seconds);

      expect(!r.ok && r.error.field).toContain('durationSeconds');
    },
  );

  it('endsAt solo es cierto en el tick de la duración objetivo', () => {
    const d = durationOf(2);

    expect([d.endsAt(119), d.endsAt(120), d.endsAt(121)]).toEqual([false, true, false]);
  });
});
