import { describe, expect, it } from 'vitest';
import enemiesJson from '../../content/enemies.json';
import { MAX_STONE_MUST_BE_INTEGER } from '../../src/domain/pickup/PickupRules';
import { STONE_CHANCE_INVALID } from '../../src/domain/resource/ResourceRules';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { rawContent, type RawContent } from '../support/builders';

// Spec resources (0025), "Piedra por enemigo abatido" y "Contenido de recursos validado" (carga), y
// xp-gems, "Contenido de gemas validado" (`maxStone`), con el cargador real (zod + dominio).
type Raw = RawContent;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function failure(change: (raw: Raw) => void): { field: string; message: string } {
  const raw = rawContent();
  change(raw);
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}
function loads(change: (raw: Raw) => void): boolean {
  const raw = rawContent();
  change(raw);
  return parseRunConfig(raw).ok;
}
const table = (r: Raw): Mutable<Record<string, number>> =>
  (r.resources.drops as unknown as { stoneChance: Record<string, number> }).stoneChance;
const progression = (r: Raw): Record<string, unknown> => r.progression;
const enemyIds = enemiesJson.types.map((t) => t.id);

describe('Tabla de piedra en el contenido (resources 0025)', () => {
  it('Scenario: Contenido por defecto (cada tipo con probabilidad entera 0..100 y ≥ 1 con ≥ 1)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const chance = r.value.resources.drops.stoneChance ?? {};

    expect(Object.keys(chance).sort()).toEqual([...enemyIds].sort());
    expect(Object.values(chance).every((p) => Number.isInteger(p) && p >= 0 && p <= 100)).toBe(
      true,
    );
    expect(Object.values(chance).some((p) => p >= 1)).toBe(true);
    expect(chance).toEqual({
      'goblin-torch': 10,
      'goblin-tnt': 15,
      'goblin-barrel': 5,
      'goblin-tnt-guard': 25,
    });
  });

  it.each([
    [
      'sin goblin-tnt-guard',
      (r: Raw) => Reflect.deleteProperty(table(r), 'goblin-tnt-guard'),
      'goblin-tnt-guard',
    ],
    ['con goblin-ogre', (r: Raw) => (table(r)['goblin-ogre'] = 3), 'goblin-ogre'],
    ['goblin-torch −1', (r: Raw) => (table(r)['goblin-torch'] = -1), 'goblin-torch'],
    ['goblin-torch 101', (r: Raw) => (table(r)['goblin-torch'] = 101), 'goblin-torch'],
    ['goblin-torch 12,5', (r: Raw) => (table(r)['goblin-torch'] = 12.5), 'goblin-torch'],
  ])('Scenario: Tabla de piedra inválida (%s)', (_name, change, id) => {
    const e = failure(change);

    expect(e.field).toBe(`resources.drops.stoneChance.${id}`);
    expect(e.message).toContain(STONE_CHANCE_INVALID);
  });

  it('sin tabla de piedra en el fichero, la carga falla nombrando stoneChance', () => {
    const e = failure((r) => Reflect.deleteProperty(r.resources.drops, 'stoneChance'));

    expect(e.field).toBe('resources.drops.stoneChance');
  });

  it.each([
    ['0 en todos', 0],
    ['100 en todos', 100],
  ])('Scenario: Límites válidos de la tabla (%s)', (_name, p) => {
    expect(
      loads((r) => {
        enemyIds.forEach((id) => (table(r)[id] = p));
      }),
    ).toBe(true);
  });

  it('Scenario: Valor de piedra no configurable (stonePerDrop 3 falla nombrándolo)', () => {
    const e = failure((r) => Object.assign(r.resources, { stonePerDrop: 3 }));

    expect(e.field).toBe('resources.stonePerDrop');
  });
});

describe('Tope de piedra en el contenido (xp-gems 0025)', () => {
  it('Scenario: Contenido por defecto (maxStone entero ≥ 1)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const { maxStone } = r.value.progression;

    expect(Number.isInteger(maxStone) && maxStone >= 1).toBe(true);
    expect(maxStone).toBe(32);
  });

  it.each([
    ['maxStone 0', 0],
    ['maxStone −1', -1],
    ['maxStone 2,5', 2.5],
  ])('Scenario: Valores no positivos y tope no entero (%s)', (_name, value) => {
    expect(failure((r) => (progression(r).maxStone = value))).toMatchObject({
      field: 'progression.maxStone',
      message: MAX_STONE_MUST_BE_INTEGER,
    });
  });

  it('Scenario: Campo desconocido o ausente (sin maxStone)', () => {
    expect(failure((r) => Reflect.deleteProperty(r.progression, 'maxStone')).field).toBe(
      'progression.maxStone',
    );
  });

  it('Scenario: Tope mínimo válido (maxGems 1, oro 1, carne 1 y maxStone 1)', () => {
    expect(
      loads((r) => {
        Object.assign(r.progression, { maxGems: 1, maxGold: 1, maxMeat: 1, maxStone: 1 });
      }),
    ).toBe(true);
  });
});
