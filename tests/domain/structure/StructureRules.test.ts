import { describe, expect, it } from 'vitest';
import { buildRunRules } from '../../../src/domain/run/RunConfig';
import {
  STRUCTURE_COUNT_MUST_BE_INTEGER,
  STRUCTURE_FOOTPRINT_MUST_FIT,
  STRUCTURE_GUARD_NOT_PATROL,
  STRUCTURE_GUARD_UNKNOWN,
  STRUCTURE_GUARDS_MUST_BE_INTEGER,
  STRUCTURE_PLACEMENT_MUST_BE_INTEGER,
  STRUCTURE_VALUE_MUST_BE_POSITIVE,
} from '../../../src/domain/structure/StructureType';
import type { StructuresConfig } from '../../../src/domain/structure/StructureType';
import { aCampsConfig, aStructuresConfig } from '../../support/camps';
import { NO_STRUCTURES } from '../../support/builders';

const rulesOf = (structures: StructuresConfig) => buildRunRules(aCampsConfig(structures));

function failure(structures: StructuresConfig) {
  const r = rulesOf(structures);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

const guards = (patch: object) => ({
  guards: { type: 'goblin-tnt-guard', max: 2, everyTicks: 900, ...patch },
});

describe('StructureRules (goblin-structures, invariantes del dominio)', () => {
  it('compila los tipos en el orden del contenido: casa (con puerta y guardia) y torre', () => {
    const r = rulesOf(aStructuresConfig());
    if (!r.ok) throw new Error(r.error.message);
    const s = r.value.structures;
    expect(s.types.map((t) => [t.id, t.kind, t.count])).toEqual([
      ['goblin-house', 'house', 4],
      ['goblin-tower', 'tower', 3],
    ]);
    const house = s.byId('goblin-house');
    expect(house?.guards?.type.id).toBe('goblin-tnt-guard');
    expect([house?.guards?.max, house?.guards?.everyTicks]).toEqual([2, 900]);
    expect([house?.cols, house?.rows, house?.radius, house?.health]).toEqual([2, 3, 48, 60]);
    expect(s.byId('goblin-tower')?.guards).toBeNull();
    expect(s.placement.minStartCells).toBe(6);
    expect(Object.isFrozen(s)).toBe(true);
  });

  it('sin tipos de estructura, las reglas no tienen ninguno (mapas sin estructuras)', () => {
    const r = buildRunRules({ ...aCampsConfig(), structures: NO_STRUCTURES });
    expect(r.ok && r.value.structures.types).toEqual([]);
  });

  it.each([
    ['vida de la casa 0', { house: { health: 0 } }, 'goblin-house.health', 'pos'],
    ['vida de la casa −1', { house: { health: -1 } }, 'goblin-house.health', 'pos'],
    ['radio de la torre 0', { tower: { radius: 0 } }, 'goblin-tower.radius', 'pos'],
    [
      'huella con 0 columnas',
      { house: { footprint: { cols: 0, rows: 3 } } },
      'goblin-house.footprint.cols',
      'fit',
    ],
    [
      'huella con 2,5 filas',
      { house: { footprint: { cols: 2, rows: 2.5 } } },
      'goblin-house.footprint.rows',
      'fit',
    ],
    [
      'huella con 65 columnas',
      { house: { footprint: { cols: 65, rows: 3 } } },
      'goblin-house.footprint.cols',
      'fit',
    ],
    ['torres −1', { tower: { count: -1 } }, 'goblin-tower.count', 'count'],
    ['torres 1,5', { tower: { count: 1.5 } }, 'goblin-tower.count', 'count'],
    ['tope de guardias 0', { house: guards({ max: 0 }) }, 'goblin-house.guards.max', 'guards'],
    ['tope 1,5', { house: guards({ max: 1.5 }) }, 'goblin-house.guards.max', 'guards'],
    [
      'intervalo 0',
      { house: guards({ everyTicks: 0 }) },
      'goblin-house.guards.everyTicks',
      'guards',
    ],
    [
      'intervalo de 2,5 ticks',
      { house: guards({ everyTicks: 2.5 }) },
      'goblin-house.guards.everyTicks',
      'guards',
    ],
  ] as const)('Scenario: Valores fuera de rango (%s)', (_label, patch, field, kind) => {
    const e = failure(aStructuresConfig(patch));
    const message = {
      pos: STRUCTURE_VALUE_MUST_BE_POSITIVE,
      fit: STRUCTURE_FOOTPRINT_MUST_FIT,
      count: STRUCTURE_COUNT_MUST_BE_INTEGER,
      guards: STRUCTURE_GUARDS_MUST_BE_INTEGER,
    }[kind];
    expect(e.field).toBe(`structures.types.${field}`);
    expect(e.message).toContain(message);
    expect(e.message).toContain(field.split('.')[0]);
  });

  it('la puerta de una casa también tiene que caber: 36 filas no caben en una rejilla de 36', () => {
    const e = failure(aStructuresConfig({ house: { footprint: { cols: 2, rows: 36 } } }));
    expect(e.field).toBe('structures.types.goblin-house.footprint.rows');
    const tower = rulesOf(aStructuresConfig({ tower: { footprint: { cols: 2, rows: 36 } } }));
    expect(tower.ok).toBe(true);
  });

  it.each([
    ['separación mínima −1', { minGapCells: -1 }, 'minGapCells'],
    ['distancia al castillo 1,5', { minCastleCells: 1.5 }, 'minCastleCells'],
    ['intentos 0', { maxAttempts: 0 }, 'maxAttempts'],
  ] as const)('Scenario: Valores fuera de rango (%s)', (_label, placement, field) => {
    const e = failure(aStructuresConfig({ placement }));
    expect(e.field).toBe(`structures.placement.${field}`);
    expect(e.message).toContain(STRUCTURE_PLACEMENT_MUST_BE_INTEGER);
  });

  it.each([
    ['0 casas', { house: { count: 0 } }],
    ['tope de guardias 1', { house: guards({ max: 1 }) }],
    ['intervalo de 1 tick', { house: guards({ everyTicks: 1 }) }],
    [
      'distancias de colocación 0',
      { placement: { minStartCells: 0, minCastleCells: 0, minWaterCells: 0, minGapCells: 0 } },
    ],
  ] as const)('Scenario: Límites válidos (%s)', (_label, patch) => {
    expect(rulesOf(aStructuresConfig(patch)).ok).toBe(true);
  });

  it('Scenario: Guardia inválido (goblin-ogre no está en el catálogo)', () => {
    const e = failure(aStructuresConfig({ house: guards({ type: 'goblin-ogre' }) }));
    expect(e.field).toBe('structures.types.goblin-house.guards.type');
    expect(e.message).toContain(STRUCTURE_GUARD_UNKNOWN);
    expect(e.message).toContain('goblin-ogre');
  });

  it('Scenario: Guardia inválido (goblin-torch empieza en persecución)', () => {
    const e = failure(aStructuresConfig({ house: guards({ type: 'goblin-torch' }) }));
    expect(e.field).toBe('structures.types.goblin-house.guards.type');
    expect(e.message).toContain(STRUCTURE_GUARD_NOT_PATROL);
    expect(e.message).toContain('goblin-torch');
  });
});
