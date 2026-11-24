import { describe, expect, it } from 'vitest';
import {
  STRUCTURE_COUNT_MUST_BE_INTEGER,
  STRUCTURE_FOOTPRINT_MUST_FIT,
  STRUCTURE_GUARD_NOT_PATROL,
  STRUCTURE_GUARD_UNKNOWN,
  STRUCTURE_GUARDS_MUST_BE_INTEGER,
  STRUCTURE_PLACEMENT_MUST_BE_INTEGER,
  STRUCTURE_VALUE_MUST_BE_POSITIVE,
} from '../../src/domain/structure/StructureType';
import { buildRunRules } from '../../src/domain/run/RunConfig';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { rawContent, type RawContent } from '../support/builders';

// Spec goblin-structures (0021), "Contenido de estructuras validado", con el cargador: forma con zod
// (objeto estricto por id) y las invariantes del dominio desde el superRefine.
type Raw = RawContent;
const house = (raw: Raw) => raw.structures.types['goblin-house'];
const tower = (raw: Raw) => raw.structures.types['goblin-tower'];

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

const guardsOf = (raw: Raw) => {
  const g = house(raw).guards;
  if (!g) throw new Error('la casa por defecto tiene guardias');
  return g;
};

describe('Contenido de estructuras validado (goblin-structures)', () => {
  it('Scenario: Contenido por defecto', () => {
    const loaded = loadRunConfig();
    if (!loaded.ok) throw new Error(loaded.error.message);
    const { types } = loaded.value.structures;
    expect(Object.keys(types)).toEqual(['goblin-house', 'goblin-tower']);
    for (const t of Object.values(types)) {
      expect(Math.min(t.footprint.cols, t.footprint.rows)).toBeGreaterThanOrEqual(1);
      expect(Math.min(t.health, t.radius)).toBeGreaterThan(0);
      expect(t.count).toBeGreaterThanOrEqual(1);
    }
    expect(types['goblin-house']?.guards?.type).toBe('goblin-tnt-guard');
    expect(types['goblin-house']?.guards?.max).toBeGreaterThanOrEqual(1);
    expect(types['goblin-house']?.guards?.everyTicks).toBeGreaterThanOrEqual(1);
    expect(types['goblin-tower']?.guards).toBeUndefined();
    const rules = buildRunRules(loaded.value);
    expect(rules.ok && rules.value.structures.types.map((t) => t.kind)).toEqual(['house', 'tower']);
  });

  const H = 'structures.types.goblin-house';
  const T = 'structures.types.goblin-tower';
  it.each<[string, (raw: Raw) => void, string, string]>([
    [
      'vida de la casa 0',
      (r) => (house(r).health = 0),
      `${H}.health`,
      STRUCTURE_VALUE_MUST_BE_POSITIVE,
    ],
    [
      'vida de la casa −1',
      (r) => (house(r).health = -1),
      `${H}.health`,
      STRUCTURE_VALUE_MUST_BE_POSITIVE,
    ],
    [
      'radio de la torre 0',
      (r) => (tower(r).radius = 0),
      `${T}.radius`,
      STRUCTURE_VALUE_MUST_BE_POSITIVE,
    ],
    [
      'huella con 0 columnas',
      (r) => (house(r).footprint.cols = 0),
      `${H}.footprint.cols`,
      STRUCTURE_FOOTPRINT_MUST_FIT,
    ],
    [
      'huella con 2,5 filas',
      (r) => (house(r).footprint.rows = 2.5),
      `${H}.footprint.rows`,
      STRUCTURE_FOOTPRINT_MUST_FIT,
    ],
    [
      'huella con 65 columnas (rejilla 64 × 36)',
      (r) => (house(r).footprint.cols = 65),
      `${H}.footprint.cols`,
      STRUCTURE_FOOTPRINT_MUST_FIT,
    ],
    ['torres −1', (r) => (tower(r).count = -1), `${T}.count`, STRUCTURE_COUNT_MUST_BE_INTEGER],
    ['torres 1,5', (r) => (tower(r).count = 1.5), `${T}.count`, STRUCTURE_COUNT_MUST_BE_INTEGER],
    ['tope 0', (r) => (guardsOf(r).max = 0), `${H}.guards.max`, STRUCTURE_GUARDS_MUST_BE_INTEGER],
    [
      'tope 1,5',
      (r) => (guardsOf(r).max = 1.5),
      `${H}.guards.max`,
      STRUCTURE_GUARDS_MUST_BE_INTEGER,
    ],
    [
      'intervalo 0',
      (r) => (guardsOf(r).everyTicks = 0),
      `${H}.guards.everyTicks`,
      STRUCTURE_GUARDS_MUST_BE_INTEGER,
    ],
    [
      'intervalo de 2,5 ticks',
      (r) => (guardsOf(r).everyTicks = 2.5),
      `${H}.guards.everyTicks`,
      STRUCTURE_GUARDS_MUST_BE_INTEGER,
    ],
  ])('Scenario: Valores fuera de rango (%s)', (_name, change, field, base) => {
    const e = failure(change);
    expect(e.field).toBe(field);
    const id = field.split('.')[2] ?? '';
    expect(e.message).toBe(`${base} (${id})`);
  });

  it('Scenario: Valores fuera de rango (separación mínima −1)', () => {
    expect(failure((r) => (r.structures.placement.minGapCells = -1))).toMatchObject({
      field: 'structures.placement.minGapCells',
      message: STRUCTURE_PLACEMENT_MUST_BE_INTEGER,
    });
  });

  it.each<[string, (raw: Raw) => void]>([
    ['0 casas', (r) => (house(r).count = 0)],
    ['tope 1', (r) => (guardsOf(r).max = 1)],
    ['intervalo 1 tick', (r) => (guardsOf(r).everyTicks = 1)],
    [
      'las cuatro distancias 0',
      (r) => {
        const p = r.structures.placement;
        p.minStartCells = p.minCastleCells = p.minWaterCells = p.minGapCells = 0;
      },
    ],
  ])('Scenario: Límites válidos (%s)', (_name, change) => {
    expect(loads(change)).toBe(true);
  });

  it('Scenario: Guardia inválido (goblin-ogre no está en el catálogo)', () => {
    const e = failure((r) => (guardsOf(r).type = 'goblin-ogre'));
    expect(e.field).toBe(`${H}.guards.type`);
    expect(e.message).toContain(STRUCTURE_GUARD_UNKNOWN);
    expect(e.message).toContain('goblin-ogre');
  });

  it('Scenario: Guardia inválido (goblin-torch empieza en persecución)', () => {
    const e = failure((r) => (guardsOf(r).type = 'goblin-torch'));
    expect(e.field).toBe(`${H}.guards.type`);
    expect(e.message).toContain(STRUCTURE_GUARD_NOT_PATROL);
    expect(e.message).toContain('goblin-torch');
  });

  it('Scenario: Guardia inválido (goblin-tower con un tipo de guardia)', () => {
    const e = failure((r) => {
      tower(r).guards = { type: 'goblin-tnt-guard', max: 1, everyTicks: 60 };
    });
    expect(e.field).toBe(`${T}.guards`);
    expect(e.message).toContain('goblin-tower');
  });

  it('Scenario: Campos ausentes o desconocidos (goblin-house sin vida)', () => {
    const e = failure((r) => Reflect.deleteProperty(house(r), 'health'));
    expect(e).toMatchObject({ field: `${H}.health` });
    expect(e.message).toContain('goblin-house');
  });

  it('Scenario: Campos ausentes o desconocidos (goblin-house sin tope de guardias)', () => {
    const e = failure((r) => Reflect.deleteProperty(guardsOf(r), 'max'));
    expect(e.field).toBe(`${H}.guards.max`);
    expect(e.message).toBe(`${STRUCTURE_GUARDS_MUST_BE_INTEGER} (goblin-house)`);
  });

  it('Scenario: Campos ausentes o desconocidos (fireRate en goblin-tower)', () => {
    const e = failure((r) => (tower(r).fireRate = 30));
    expect(e.field).toBe(`${T}.fireRate`);
    expect(e.message).toContain('goblin-tower');
  });

  it('un tipo de estructura de más (objeto estricto por id) falla nombrándolo', () => {
    const e = failure((r) => {
      Object.assign(r.structures.types, { 'goblin-mine': { ...tower(r) } });
    });
    expect(e.field).toBe('structures.types.goblin-mine');
  });

  it('sin la torre la carga falla nombrando goblin-tower', () => {
    const e = failure((r) => Reflect.deleteProperty(r.structures.types, 'goblin-tower'));
    expect(e.field).toBe(T);
  });
});
