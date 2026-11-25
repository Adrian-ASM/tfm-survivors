import { describe, expect, it } from 'vitest';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance, type RawAppearance } from '../support/appearance';

// Spec sprite-rendering (0016), "Datos de aspecto validados": aspectos del mapa (design §12.2 B2).
function failure(raw: RawAppearance): string {
  const r = parseAppearance(raw, REGISTERED);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return r.error.field;
}

type Json = Record<string, unknown>;
const at = (raw: RawAppearance, key: string): Json => raw.map[key] as Json;
const sub = (o: Json, key: string): Json => o[key] as Json;

describe('Datos de aspecto del mapa validados', () => {
  it('el fixture con la sección map es válido', () => {
    const r = parseAppearance(rawAppearance(), REGISTERED);
    if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
    expect(Object.keys(r.value.map.shore.cases)).toHaveLength(15);
    expect(r.value.map.bridges.frames.northSouth.height).toBe(160);
    expect(r.value.map.foam.idle.loop).toBe(true);
  });

  it('Scenario: Datos del mapa inválidos (orilla sin el caso { norte })', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(sub(at(raw, 'shore'), 'cases'), 'N');
    expect(failure(raw)).toBe('map.shore.cases.N');
  });

  it('caso de orilla con otra grafía (EN) es un campo desconocido', () => {
    const raw = rawAppearance();
    sub(at(raw, 'shore'), 'cases').EN = 3;
    expect(failure(raw)).toBe('map.shore.cases.EN');
  });

  // 0029: el árbol tiene `idle` en bucle en vez de modelos fijos.
  it('Scenario: Datos del mapa inválidos (árbol sin idle)', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(at(raw, 'trees'), 'idle');
    expect(failure(raw)).toBe('map.trees.idle');
  });

  it('Scenario: Datos del mapa inválidos (árbol con idle sin bucle)', () => {
    const raw = rawAppearance();
    sub(at(raw, 'trees'), 'idle').loop = false;
    expect(failure(raw)).toBe('map.trees.idle.loop');
  });

  it('Scenario: Datos del mapa inválidos (árbol con frames de idle [])', () => {
    const raw = rawAppearance();
    sub(at(raw, 'trees'), 'idle').frames = [];
    expect(failure(raw)).toBe('map.trees.idle.frames');
  });

  it('Scenario: Datos del mapa inválidos (campo extra models en el árbol)', () => {
    const raw = rawAppearance();
    at(raw, 'trees').models = [{ frame: 0 }];
    expect(failure(raw)).toBe('map.trees.models');
  });

  it.each([
    ['width', 0],
    ['x', -1],
    ['y', 2.5],
  ])('Scenario: Datos del mapa inválidos (recorte norte-sur del puente con %s %d)', (key, v) => {
    const raw = rawAppearance();
    sub(sub(at(raw, 'bridges'), 'frames'), 'northSouth')[key] = v;
    expect(failure(raw)).toBe(`map.bridges.frames.northSouth.${key}`);
  });

  it('Scenario: Datos del mapa inválidos (espuma sin idle)', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(at(raw, 'foam'), 'idle');
    expect(failure(raw)).toBe('map.foam.idle');
  });

  it('Scenario: Datos del mapa inválidos (espuma con idle sin bucle)', () => {
    const raw = rawAppearance();
    sub(at(raw, 'foam'), 'idle').loop = false;
    expect(failure(raw)).toBe('map.foam.idle.loop');
  });

  it('Scenario: Datos del mapa inválidos (castillo sin hoja)', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(at(raw, 'castle'), 'sheet');
    expect(failure(raw)).toBe('map.castle.sheet');
  });

  it('Scenario: Datos del mapa inválidos (campo extra rocks)', () => {
    const raw = rawAppearance();
    raw.map.rocks = {};
    expect(failure(raw)).toBe('map.rocks');
  });

  it('Scenario: Datos inválidos en el arranque (sin el aspecto del agua)', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(raw.map, 'water');
    expect(failure(raw)).toBe('map.water');
  });

  it('Scenario: Rutas de hoja no admitidas (hoja del castillo fuera de la nota)', () => {
    const raw = rawAppearance();
    sub(at(raw, 'castle'), 'sheet').file = 'Factions/Knights/Buildings/Castle/Castle_Red.png';
    expect(failure(raw)).toBe('map.castle.sheet.file');
  });

  it('la imagen del puente también debe figurar en la nota', () => {
    const raw = rawAppearance();
    at(raw, 'bridges').image = 'Terrain/Bridge/Otro.png';
    expect(failure(raw)).toBe('map.bridges.image');
  });

  it.each([
    ['water', 'scale', 0],
    ['trees', 'origin', { x: 1.2, y: 0.5 }],
  ])('rangos comunes del mapa (%s.%s)', (key, field, value) => {
    const raw = rawAppearance();
    at(raw, key)[field] = value;
    expect(failure(raw)).toContain(`map.${key}.${field}`);
  });
});
