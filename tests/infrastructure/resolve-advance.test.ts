import { describe, expect, it } from 'vitest';
import { resolveAdvance } from '../../src/infrastructure/url/resolveAdvance';
import { resolveSpeed } from '../../src/infrastructure/url/resolveSpeed';

const mentioning = (warnings: readonly string[], word: string): string[] =>
  warnings.filter((w) => w.includes(word));

describe('resolveAdvance · precedencia manual > speed (spec simulation-loop, MODIFIED)', () => {
  it('Scenario: Manual gana a speed (?e2e&manual&speed=8)', () => {
    expect(resolveAdvance('?e2e&manual&speed=8')).toEqual({
      manual: true,
      speed: 1,
      warnings: [],
    });
  });

  it.each(['abc', '16'])('Scenario: Manual con speed inválida (speed=%s: sin aviso)', (raw) => {
    expect(resolveAdvance(`?e2e&manual&speed=${raw}`)).toEqual({
      manual: true,
      speed: 1,
      warnings: [],
    });
  });

  it('Scenario: Manual inválido no anula speed (?e2e&manual=abc&speed=8)', () => {
    const r = resolveAdvance('?e2e&manual=abc&speed=8');

    expect([r.manual, r.speed]).toEqual([false, 8]);
    expect(r.warnings).toHaveLength(1);
    expect(mentioning(r.warnings, 'manual')).toHaveLength(1);
    expect(mentioning(r.warnings, 'speed')).toHaveLength(0);
  });

  it('Scenario: Avisos independientes de seed, speed y manual (1 de manual y 1 de speed)', () => {
    const r = resolveAdvance('?e2e&seed=abc&manual=abc&speed=abc');

    expect([r.manual, r.speed]).toEqual([false, 1]);
    expect(r.warnings).toHaveLength(2);
    expect(mentioning(r.warnings, 'manual')).toHaveLength(1);
    expect(mentioning(r.warnings, 'speed')).toHaveLength(1);
  });

  // Los casos de speed.test.ts (change 0008): sin `manual`, el resultado es el de resolveSpeed.
  it.each([
    '?e2e&speed=8',
    '?e2e&speed=1',
    '?e2e&speed=15',
    ...['0', '16', '-1', '2.5', 'abc', ''].map((raw) => `?e2e&speed=${encodeURIComponent(raw)}`),
    '?e2e&seed=42',
    '?e2e',
    '?speed=8',
    '?seed=42&speed=8',
    '?speed=abc',
    '?speed=16',
    `?e2e&speed=${'x'.repeat(500)}`,
  ])('sin manual coincide con resolveSpeed (%s)', (search) => {
    const { speed, warning } = resolveSpeed(search);

    expect(resolveAdvance(search)).toEqual({
      manual: false,
      speed,
      warnings: warning === undefined ? [] : [warning],
    });
  });

  it.each(['?manual&speed=8', '?manual=abc&speed=abc'])(
    'Scenario: Manual ignorado fuera de E2E (%s: igual que sin manual)',
    (search) => {
      expect(resolveAdvance(search)).toEqual({ manual: false, speed: 1, warnings: [] });
    },
  );
});
