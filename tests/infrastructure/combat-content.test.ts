import { describe, expect, it } from 'vitest';
import guideJson from '../../content/guide.json';
import audioJson from '../../content/audio.json';
import weaponsJson from '../../content/weapons.json';
import { MAX_TICKS_PER_FRAME } from '../../src/application/FixedStepLoop';
import { bootContent } from '../../src/composition/contentBoot';
import { MAX_HITS_MUST_BE_INTEGER } from '../../src/domain/combat/CombatRules';
import { HIT_WINDOW_BELOW_FRAME } from '../../src/infrastructure/content/schemas';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { rawContent, type RawContent } from '../support/builders';
import { REGISTERED, rawAppearance } from '../support/appearance';
import { GENERATED_PATHS } from '../support/generated';

// Spec simulation-loop (0031), "Contenido de combate validado": content/combat.json con zod estricto.
type Combat = RawContent['combat'];

function failure(change: (c: Combat) => void): { field: string; message: string } {
  const raw = rawContent();
  change(raw.combat);
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

const loads = (change: (c: Combat) => void): boolean => {
  const raw = rawContent();
  change(raw.combat);
  return parseRunConfig(raw).ok;
};

describe('Contenido de combate validado (spec simulation-loop 0031, con zod)', () => {
  it('Scenario: Contenido de combate por defecto', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.combat).toEqual({ hitWindowTicks: 15, maxHitsPerTick: 48 });
    // weapons.json sin campos nuevos respecto a antes del change.
    expect(Object.keys(weaponsJson)).toEqual(['maxProjectiles', 'hitFlashTicks', 'weapons']);
    for (const w of weaponsJson.weapons) {
      expect(Object.keys(w)).toEqual(['id', 'cooldownTicks', 'damage', 'targeting', 'attack']);
    }
    expect(MAX_TICKS_PER_FRAME).toBe(15);
  });

  it.each([
    ['ventana 14', (c: Combat) => (c.hitWindowTicks = 14), 'combat.hitWindowTicks'],
    ['ventana 15,5', (c: Combat) => (c.hitWindowTicks = 15.5), 'combat.hitWindowTicks'],
    ['ventana 0', (c: Combat) => (c.hitWindowTicks = 0), 'combat.hitWindowTicks'],
    ['tope 0', (c: Combat) => (c.maxHitsPerTick = 0), 'combat.maxHitsPerTick'],
    ['tope −1', (c: Combat) => (c.maxHitsPerTick = -1), 'combat.maxHitsPerTick'],
    ['tope 2,5', (c: Combat) => (c.maxHitsPerTick = 2.5), 'combat.maxHitsPerTick'],
  ])('Scenario: Valores de combate fuera de rango (%s)', (_name, change, field) => {
    const e = failure(change);
    expect(e.field).toBe(field);
    const message = field.endsWith('hitWindowTicks')
      ? HIT_WINDOW_BELOW_FRAME
      : MAX_HITS_MUST_BE_INTEGER;
    expect(e.message).toBe(message);
  });

  it('Scenario: Valores de combate fuera de rango (no se muestra el menú: el arranque falla)', () => {
    const raw = rawContent();
    raw.combat.hitWindowTicks = 14;
    const errors: string[] = [];
    const booted = bootContent(
      { content: raw, appearance: rawAppearance(), guide: guideJson, audio: audioJson },
      (e) => errors.push(e.field),
      REGISTERED,
      GENERATED_PATHS,
    );
    expect(booted).toBeNull();
    expect(errors).toEqual(['combat.hitWindowTicks']);
  });

  it.each([
    ['ventana 15 y tope 1', 15, 1],
    ['ventana 600 y tope 1.000', 600, 1000],
  ])('Scenario: Límites válidos del combate (%s)', (_name, hitWindowTicks, maxHitsPerTick) => {
    expect(loads((c) => Object.assign(c, { hitWindowTicks, maxHitsPerTick }))).toBe(true);
  });

  it.each([
    [
      'sin ventana',
      (c: Combat) => delete (c as Partial<Combat>).hitWindowTicks,
      'combat.hitWindowTicks',
    ],
    [
      'sin tope',
      (c: Combat) => delete (c as Partial<Combat>).maxHitsPerTick,
      'combat.maxHitsPerTick',
    ],
    ['campo extra crit', (c: Combat) => (c.crit = 2), 'combat.crit'],
  ])('Scenario: Campos de combate ausentes o desconocidos (%s)', (_name, change, field) => {
    expect(failure(change).field).toBe(field);
  });
});
