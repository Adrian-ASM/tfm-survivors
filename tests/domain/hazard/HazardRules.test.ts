import { describe, expect, it } from 'vitest';
import {
  BLAST_TICKS_MUST_BE_INTEGER,
  DYNAMITE_RADIUS_MUST_BE_POSITIVE,
  HazardRules,
  MAX_DYNAMITES_MUST_BE_INTEGER,
} from '../../../src/domain/hazard/HazardRules';
import { buildRunRules } from '../../../src/domain/run/RunConfig';
import { aRunConfig } from '../../support/builders';

const VALID = { maxDynamites: 24, dynamiteRadius: 8, blastTicks: 30 };

describe('HazardRules', () => {
  it('crea los globales de los peligros', () => {
    const r = HazardRules.create(VALID);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject(VALID);
    expect(Object.isFrozen(r.value)).toBe(true);
  });

  it.each([0, -1, 2.5, Number.NaN])('Scenario: Tope inválido (%s, dominio)', (maxDynamites) => {
    const r = HazardRules.create({ ...VALID, maxDynamites });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('enemies.hazards.maxDynamites');
      expect(r.error.message).toBe(MAX_DYNAMITES_MUST_BE_INTEGER);
    }
  });

  it('Scenario: Tope mínimo (dominio)', () => {
    expect(HazardRules.create({ ...VALID, maxDynamites: 1 }).ok).toBe(true);
  });

  it.each([0, -2])('rechaza un radio de dinamita %s', (dynamiteRadius) => {
    const r = HazardRules.create({ ...VALID, dynamiteRadius });
    expect(!r.ok && r.error.field).toBe('enemies.hazards.dynamiteRadius');
    expect(!r.ok && r.error.message).toBe(DYNAMITE_RADIUS_MUST_BE_POSITIVE);
  });

  it.each([0, 1.5])('rechaza una duración visible de explosión %s', (blastTicks) => {
    const r = HazardRules.create({ ...VALID, blastTicks });
    expect(!r.ok && r.error.field).toBe('enemies.hazards.blastTicks');
    expect(!r.ok && r.error.message).toBe(BLAST_TICKS_MUST_BE_INTEGER);
  });

  it('buildRunRules expone las reglas de los peligros y las valida', () => {
    const config = aRunConfig();
    const ok = buildRunRules(config);
    expect(ok.ok && ok.value.hazards.maxDynamites).toBe(config.enemies.hazards.maxDynamites);
    const bad = buildRunRules({
      ...config,
      enemies: { ...config.enemies, hazards: { ...config.enemies.hazards, maxDynamites: 0 } },
    });
    expect(!bad.ok && bad.error.field).toBe('enemies.hazards.maxDynamites');
  });
});
