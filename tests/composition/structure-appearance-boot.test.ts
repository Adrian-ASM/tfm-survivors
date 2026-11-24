import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import provenanceJson from '../../content/asset-provenance.json';
import { APPEARANCE_THROW_REQUIRED, bootContent } from '../../src/composition/contentBoot';
import type { DomainError } from '../../src/domain/shared/Result';
import {
  RUIN_COLOR_REQUIRED,
  SCALE_MUST_BE_POSITIVE,
  SHEET_NOT_REGISTERED,
  STRUCTURE_COLORS_MUST_DIFFER,
} from '../../src/infrastructure/content/appearanceSchema';
import { rawContent } from '../support/builders';

// Spec sprite-rendering (0021), "Datos de aspecto validados" y "Pintado de las estructuras": aspectos
// de casas, torres y ruinas, colores de reserva y aspecto del guardia, en el arranque.
const REGISTERED = provenanceJson.files.map((f) => f.path);

type Json = Record<string, unknown>;
type Raw = { content: ReturnType<typeof rawContent>; appearance: Json };
const raw = (): Raw => ({ content: rawContent(), appearance: structuredClone(appearanceJson) });

function failure(change: (a: Json) => void): DomainError {
  const r = raw();
  change(r.appearance);
  const errors: DomainError[] = [];
  const booted = bootContent(r, (e) => errors.push(e), REGISTERED);
  expect(booted).toBeNull();
  const [first] = errors;
  if (!first) throw new Error('se esperaba un error de arranque');
  return first;
}

const structures = (a: Json) => a['structures'] as Record<string, Record<string, Json>>;
const colors = (a: Json) => a['structureColors'] as Record<string, string>;
const look = (a: Json, id: string, which: 'intact' | 'ruin'): Json => {
  const l = structures(a)[id]?.[which];
  if (!l) throw new Error(`sin aspecto ${id}.${which}`);
  return l;
};

describe('Aspectos de las estructuras en el arranque', () => {
  it('Scenario: Datos del repositorio (estructuras alineadas con el contenido)', () => {
    const errors: DomainError[] = [];
    const booted = bootContent(raw(), (e) => errors.push(e), REGISTERED);
    expect(errors).toEqual([]);
    expect(Object.keys(booted?.appearance.structures ?? {})).toEqual(
      Object.keys(booted?.config.structures.types ?? {}),
    );
  });

  it('Scenario: Colores de estructuras inválidos (goblin-tower "#12345")', () => {
    expect(failure((a) => (colors(a)['goblin-tower'] = '#12345')).field).toBe(
      'structureColors.goblin-tower',
    );
  });

  it('Scenario: Colores de estructuras inválidos (sin el color de ruina)', () => {
    const e = failure((a) => Reflect.deleteProperty(colors(a), 'ruin'));
    expect(e).toMatchObject({ field: 'structureColors.ruin', message: RUIN_COLOR_REQUIRED });
  });

  it('Scenario: Colores de estructuras inválidos (goblin-house igual al de ruina)', () => {
    const e = failure((a) => (colors(a)['goblin-house'] = colors(a)['ruin'] ?? ''));
    expect(e).toMatchObject({
      field: 'structureColors.goblin-house',
      message: STRUCTURE_COLORS_MUST_DIFFER,
    });
  });

  it('Scenario: Colores de estructuras inválidos (goblin-house igual al de trunk)', () => {
    const e = failure((a) => {
      colors(a)['goblin-house'] = (a['terrain'] as Record<string, string>)['trunk'] ?? '';
    });
    expect(e).toMatchObject({
      field: 'structureColors.goblin-house',
      message: STRUCTURE_COLORS_MUST_DIFFER,
    });
  });

  it('Scenario: Tipos de estructura y aspectos desalineados (sin la ruina de goblin-tower)', () => {
    const e = failure((a) => Reflect.deleteProperty(structures(a)['goblin-tower'] ?? {}, 'ruin'));
    expect(e.field).toBe('structures.goblin-tower.ruin');
  });

  it('Scenario: Tipos de estructura y aspectos desalineados (aspecto extra goblin-mine)', () => {
    const e = failure((a) => {
      structures(a)['goblin-mine'] = structuredClone(structures(a)['goblin-tower'] ?? {});
    });
    expect(e.field).toBe('structures.goblin-mine');
    expect(e.message).toContain('goblin-mine');
  });

  it('sin el color de reserva de goblin-tower el arranque falla nombrándolo', () => {
    expect(failure((a) => Reflect.deleteProperty(colors(a), 'goblin-tower')).field).toBe(
      'structureColors.goblin-tower',
    );
  });

  it('Scenario: Valores fuera de rango (escala de la ruina de goblin-house 0)', () => {
    const e = failure((a) => (look(a, 'goblin-house', 'ruin')['scale'] = 0));
    expect(e).toMatchObject({
      field: 'structures.goblin-house.ruin.scale',
      message: SCALE_MUST_BE_POSITIVE,
    });
  });

  it('Scenario: Animaciones obligatorias y campos desconocidos (ruina de goblin-tower sin idle)', () => {
    const e = failure((a) => Reflect.deleteProperty(look(a, 'goblin-tower', 'ruin'), 'idle'));
    expect(e.field).toBe('structures.goblin-tower.ruin.idle');
  });

  it('Scenario: Animaciones obligatorias y campos desconocidos (goblin-tnt-guard sin throw)', () => {
    const e = failure((a) => {
      const enemies = a['enemies'] as Record<string, Json>;
      Reflect.deleteProperty(enemies['goblin-tnt-guard'] ?? {}, 'throw');
    });
    expect(e.field).toBe('enemies.goblin-tnt-guard.throw');
    expect(e.message).toBe(`${APPEARANCE_THROW_REQUIRED} (goblin-tnt-guard)`);
  });

  it('Scenario: Tipos de enemigo y aspectos desalineados (sin goblin-tnt-guard)', () => {
    const e = failure((a) => {
      Reflect.deleteProperty(a['enemies'] as Json, 'goblin-tnt-guard');
    });
    expect(e.field).toBe('enemies.goblin-tnt-guard');
  });

  it('Scenario: Rutas de hoja no admitidas (torre intacta fuera de la nota)', () => {
    const e = failure((a) => {
      const sheet = look(a, 'goblin-tower', 'intact')['sheet'] as Json;
      sheet['file'] = 'Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Blue.png';
    });
    expect(e).toMatchObject({
      field: 'structures.goblin-tower.intact.sheet.file',
      message: SHEET_NOT_REGISTERED,
    });
  });

  it('un campo extra en un aspecto de estructura falla y se nombra', () => {
    const e = failure((a) => (look(a, 'goblin-house', 'intact')['placeholderColor'] = '#ffffff'));
    expect(e.field).toBe('structures.goblin-house.intact.placeholderColor');
  });
});
