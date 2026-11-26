import { describe, expect, it } from 'vitest';
import guideJson from '../../content/guide.json';
import { bootContent } from '../../src/composition/contentBoot';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { rawContent, type RawContent } from '../support/builders';
import { REGISTERED, rawAppearance } from '../support/appearance';
import { GENERATED_PATHS } from '../support/generated';

// Spec sheep (0023), "Contenido de las ovejas validado": content/sheep.json con zod estricto y las
// invariantes de `SheepRules` desde el superRefine.
type Raw = RawContent;
type Sheep = Raw['sheep'];

function failure(change: (s: Sheep) => void): { field: string; message: string } {
  const raw = rawContent();
  change(raw.sheep);
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

function loads(change: (s: Sheep) => void): boolean {
  const raw = rawContent();
  change(raw.sheep);
  return parseRunConfig(raw).ok;
}

describe('Contenido de las ovejas validado (spec sheep, con zod)', () => {
  it('Scenario: Contenido por defecto (tope 4 o 5; vida, duraciones e intervalo enteros ≥ 1; resto > 0)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const s = r.value.sheep;
    expect([4, 5]).toContain(s.maxAlive);
    const ints = [s.health, s.graze.ticks, s.wander.ticks, s.respawn.everyTicks];
    expect(ints.every((v) => Number.isInteger(v) && v >= 1)).toBe(true);
    const positive = [s.radius, s.wander.speed, s.flee.speed, s.flee.radius, s.graze.radius];
    expect(positive.every((v) => v > 0)).toBe(true);
  });

  it.each([
    ['tope −1', (s: Sheep) => (s.maxAlive = -1), 'sheep.maxAlive'],
    ['tope 2,5', (s: Sheep) => (s.maxAlive = 2.5), 'sheep.maxAlive'],
    ['radio 0', (s: Sheep) => (s.radius = 0), 'sheep.radius'],
    ['vida 0', (s: Sheep) => (s.health = 0), 'sheep.health'],
    ['vida 7,5', (s: Sheep) => (s.health = 7.5), 'sheep.health'],
    ['velocidad de paseo 0', (s: Sheep) => (s.wander.speed = 0), 'sheep.wander.speed'],
    ['velocidad de huida −30', (s: Sheep) => (s.flee.speed = -30), 'sheep.flee.speed'],
    ['radio de huida 0', (s: Sheep) => (s.flee.radius = 0), 'sheep.flee.radius'],
    ['duración de paseo 0', (s: Sheep) => (s.wander.ticks = 0), 'sheep.wander.ticks'],
    ['duración de pasto 12,5', (s: Sheep) => (s.graze.ticks = 12.5), 'sheep.graze.ticks'],
    ['radio de pasto 0', (s: Sheep) => (s.graze.radius = 0), 'sheep.graze.radius'],
    ['intervalo 0', (s: Sheep) => (s.respawn.everyTicks = 0), 'sheep.respawn.everyTicks'],
    [
      'distancia de reaparición −1',
      (s: Sheep) => (s.respawn.minPlayerDistance = -1),
      'sheep.respawn.minPlayerDistance',
    ],
    ['separación −1', (s: Sheep) => (s.placement.minGapCells = -1), 'sheep.placement.minGapCells'],
  ])('Scenario: Valores fuera de rango (%s)', (_name, change, field) => {
    expect(failure(change).field).toBe(field);
  });

  it('Scenario: Valores fuera de rango (no se muestra el menú: el arranque falla)', () => {
    const raw = rawContent();
    raw.sheep.health = 0;
    const errors: string[] = [];
    const booted = bootContent(
      { content: raw, appearance: rawAppearance(), guide: guideJson },
      (e) => errors.push(e.field),
      REGISTERED,
      GENERATED_PATHS,
    );
    expect(booted).toBeNull();
    expect(errors).toEqual(['sheep.health']);
  });

  it.each([
    ['tope 0', (s: Sheep) => (s.maxAlive = 0)],
    ['vida 1', (s: Sheep) => (s.health = 1)],
    [
      'duraciones e intervalo 1',
      (s: Sheep) => {
        s.wander.ticks = 1;
        s.graze.ticks = 1;
        s.respawn.everyTicks = 1;
      },
    ],
    ['distancia de reaparición 0', (s: Sheep) => (s.respawn.minPlayerDistance = 0)],
    [
      'distancias de colocación 0',
      (s: Sheep) => (s.placement = { minStartCells: 0, minCastleCells: 0, minGapCells: 0 }),
    ],
  ])('Scenario: Límites válidos (%s)', (_name, change) => {
    expect(loads(change)).toBe(true);
  });

  it('Scenario: Campos ausentes o desconocidos (radio de huida, intervalo, contactDamage)', () => {
    const noFlee = failure((s) => {
      delete (s.flee as Partial<Sheep['flee']>).radius;
    });
    expect(noFlee.field).toBe('sheep.flee.radius');
    const noEvery = failure((s) => {
      delete (s.respawn as Partial<Sheep['respawn']>).everyTicks;
    });
    expect(noEvery.field).toBe('sheep.respawn.everyTicks');
    expect(failure((s) => (s.contactDamage = 5)).field).toBe('sheep.contactDamage');
  });
});
