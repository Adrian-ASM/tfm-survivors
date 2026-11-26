import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TERRAIN_COLORS_MUST_DIFFER } from '../../src/infrastructure/content/appearanceSchema';
import {
  registeredPaths,
  type ProvenanceLists,
  parseAppearance,
} from '../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance, type RawAppearance } from '../support/appearance';
import { GENERATED_PATHS } from '../support/generated';

// Spec sprite-rendering (0015), "Pintado del mapa": colores de las celdas en los datos de aspecto.
const root = join(import.meta.dirname, '..', '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));

function failure(raw: RawAppearance): { field: string; message: string } {
  const r = parseAppearance(raw, REGISTERED, GENERATED_PATHS);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return r.error;
}

describe('Colores del mapa en los datos de aspecto', () => {
  it('Scenario: Colores del repositorio (trunk, water, bridge y castle #RRGGBB y distintos)', () => {
    const raw = readJson('content/appearance.json') as { terrain: Record<string, string> };
    const registered = registeredPaths(
      readJson('content/asset-provenance.json') as ProvenanceLists,
    );
    const r = parseAppearance(raw, registered, GENERATED_PATHS);
    if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
    expect(Object.keys(raw.terrain)).toEqual(['trunk', 'water', 'bridge', 'castle']);
    for (const c of Object.values(raw.terrain)) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    const { trunk, water, bridge, castle } = r.value.terrain;
    expect(new Set([trunk, water, bridge, castle]).size).toBe(4);
  });

  it('Scenario: Colores inválidos (sin el color de castle)', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(raw.terrain, 'castle');
    expect(failure(raw).field).toBe('terrain.castle');
  });

  it('Scenario: Colores inválidos (castle igual a water)', () => {
    const raw = rawAppearance();
    raw.terrain.castle = raw.terrain.water;
    expect(failure(raw).field).toBe('terrain.castle');
  });

  it.each(['#12345', 'blue', '#GGGGGG'])('Scenario: Colores inválidos (water = %j)', (color) => {
    const raw = rawAppearance();
    raw.terrain.water = color;
    expect(failure(raw).field).toBe('terrain.water');
  });

  it('Scenario: Colores inválidos (sin el color de bridge)', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(raw.terrain, 'bridge');
    expect(failure(raw).field).toBe('terrain.bridge');
  });

  it('Scenario: Colores inválidos (bridge igual a trunk, también en otra caja)', () => {
    const raw = rawAppearance();
    raw.terrain.bridge = String(raw.terrain.trunk).toUpperCase();
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'terrain.bridge',
      message: TERRAIN_COLORS_MUST_DIFFER,
    });
  });

  it('Scenario: Colores inválidos (color extra para lava)', () => {
    const raw = rawAppearance();
    raw.terrain.lava = '#ff0000';
    expect(failure(raw).field).toBe('terrain.lava');
  });
});
