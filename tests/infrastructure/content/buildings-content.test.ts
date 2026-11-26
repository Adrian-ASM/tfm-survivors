import { describe, expect, it } from 'vitest';
import guideJson from '../../../content/guide.json';
import { bootContent } from '../../../src/composition/contentBoot';
import { CONTACT_EPS } from '../../../src/domain/site/BuildingRules';
import { loadRunConfig, parseRunConfig } from '../../../src/infrastructure/content/loadRunConfig';
import appearanceJson from '../../../content/appearance.json';
import provenanceJson from '../../../content/asset-provenance.json';
import {
  registeredPaths,
  parseAppearance,
} from '../../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance, type RawAppearance } from '../../support/appearance';
import { rawContent, type RawContent } from '../../support/builders';
import { GENERATED_PATHS } from '../../support/generated';

// Spec build-sites 0026 y 0027, "Contenido de los edificios validado" (content/buildings.json con zod
// estricto y las reglas de `BuildingRules` desde el superRefine), y sprite-rendering, "Pintado de
// los solares y de los edificios" (colores de reserva de los solares).
type Buildings = RawContent['buildings'];

function failure(change: (b: Buildings) => void): { field: string; message: string } {
  const raw = rawContent();
  change(raw.buildings);
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

function loads(change: (b: Buildings) => void): boolean {
  const raw = rawContent();
  change(raw.buildings);
  return parseRunConfig(raw).ok;
}

/** Arranque con el contenido y el aspecto dados: los campos de los errores informados. */
function bootErrors(
  changeContent: (b: Buildings) => void,
  changeAppearance: (a: RawAppearance) => void = () => undefined,
): { booted: boolean; errors: string[] } {
  const raw = rawContent();
  changeContent(raw.buildings);
  const appearance = rawAppearance();
  changeAppearance(appearance);
  const errors: string[] = [];
  const booted = bootContent(
    { content: raw, appearance, guide: guideJson },
    (e) => errors.push(e.field),
    REGISTERED,
    GENERATED_PATHS,
  );
  return { booted: booted !== null, errors };
}

describe('Contenido de los edificios validado (spec build-sites 0026, con zod)', () => {
  it('Scenario: Contenido por defecto', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const b = r.value.buildings;
    expect([b.house.cost, b.tower.cost]).toEqual([
      { wood: 15, stone: 0 },
      { wood: 30, stone: 15 },
    ]);
    expect(b.house.income).toEqual({ gold: 1, everyTicks: 1800 });
    expect(b.tower.weapon.targeting).toEqual({ mode: 'nearest-in-range', range: 350 });
    expect(b.tower.weapon.attack.type).toBe('projectile');
    const torch = r.value.enemies.types.find((t) => t.id === 'goblin-torch');
    expect(Number.isInteger(b.tower.weapon.damage) && b.tower.weapon.damage >= 1).toBe(true);
    expect(b.tower.weapon.damage).toBeLessThan(torch?.health ?? 0);
    expect(torch?.health).toBe(10);
    expect(Number.isInteger(b.tower.maxProjectiles) && b.tower.maxProjectiles >= 1).toBe(true);
    expect(b.contact).toEqual({ rearmDistance: 64 });
    expect('access' in b).toBe(false);
  });

  it.each([
    ['madera de la casa 0', (b: Buildings) => (b.house.cost.wood = 0), 'buildings.house.cost.wood'],
    [
      'madera de la casa 2,5',
      (b: Buildings) => (b.house.cost.wood = 2.5),
      'buildings.house.cost.wood',
    ],
    [
      'piedra de la torre −1',
      (b: Buildings) => (b.tower.cost.stone = -1),
      'buildings.tower.cost.stone',
    ],
    [
      'piedra de la torre 1,5',
      (b: Buildings) => (b.tower.cost.stone = 1.5),
      'buildings.tower.cost.stone',
    ],
    ['oro por pago 0', (b: Buildings) => (b.house.income.gold = 0), 'buildings.house.income.gold'],
    [
      'periodo 0',
      (b: Buildings) => (b.house.income.everyTicks = 0),
      'buildings.house.income.everyTicks',
    ],
    [
      'periodo 1,5',
      (b: Buildings) => (b.house.income.everyTicks = 1.5),
      'buildings.house.income.everyTicks',
    ],
    [
      'range de la torre 0',
      (b: Buildings) => (b.tower.weapon.targeting = { mode: 'nearest-in-range', range: 0 }),
      'buildings.tower.weapon.targeting.range',
    ],
    [
      'pulse con any-in-radius',
      (b: Buildings) => {
        b.tower.weapon.targeting = { mode: 'any-in-radius', radius: 90 };
        b.tower.weapon.attack = { type: 'pulse', visualTicks: 8 };
      },
      'buildings.tower.weapon.attack.type',
    ],
    [
      'tope de flechas 0',
      (b: Buildings) => (b.tower.maxProjectiles = 0),
      'buildings.tower.maxProjectiles',
    ],
    [
      'separación de re-armado 0',
      (b: Buildings) => (b.contact.rearmDistance = 0),
      'buildings.contact.rearmDistance',
    ],
    [
      'separación de re-armado −5',
      (b: Buildings) => (b.contact.rearmDistance = -5),
      'buildings.contact.rearmDistance',
    ],
    [
      'separación de re-armado = ε',
      (b: Buildings) => (b.contact.rearmDistance = CONTACT_EPS),
      'buildings.contact.rearmDistance',
    ],
    [
      'bloque access de 0026 sobrante',
      (b: Buildings) =>
        ((b as Record<string, unknown>)['access'] = { radius: 40, rearmDistance: 160 }),
      'buildings.access',
    ],
    ['campo extra hp: 100', (b: Buildings) => (b.house['hp'] = 100), 'buildings.house.hp'],
  ])('Scenario: Valores inválidos (%s)', (_name, change, field) => {
    expect(failure(change).field).toBe(field);
  });

  it('Scenario: Valores inválidos (no se muestra el menú: el arranque falla)', () => {
    const { booted, errors } = bootErrors((b) => (b.contact.rearmDistance = 0));
    expect(booted).toBe(false);
    expect(errors).toEqual(['buildings.contact.rearmDistance']);
  });

  it.each([
    ['piedra 0 en las dos', (b: Buildings) => ((b.house.cost.stone = 0), (b.tower.cost.stone = 0))],
    ['madera 1 en las dos', (b: Buildings) => ((b.house.cost.wood = 1), (b.tower.cost.wood = 1))],
    ['periodo 1', (b: Buildings) => (b.house.income.everyTicks = 1)],
    ['tope de flechas 1', (b: Buildings) => (b.tower.maxProjectiles = 1)],
    ['re-armado = ε + 0,001', (b: Buildings) => (b.contact.rearmDistance = CONTACT_EPS + 0.001)],
  ])('Scenario: Límites válidos (%s)', (_name, change) => {
    expect(loads(change)).toBe(true);
  });

  it.each([
    [
      'sin el coste de la torre',
      'buildings.tower.cost',
      (b: Buildings) => delete (b.tower as Partial<Buildings['tower']>).cost,
    ],
    [
      'sin el tope de flechas',
      'buildings.tower.maxProjectiles',
      (b: Buildings) => delete (b.tower as Partial<Buildings['tower']>).maxProjectiles,
    ],
    [
      'sin la separación de re-armado',
      'buildings.contact.rearmDistance',
      (b: Buildings) => delete (b.contact as Partial<Buildings['contact']>).rearmDistance,
    ],
  ])('Scenario: Campo ausente (%s)', (_name, field, change) => {
    expect(failure(change).field).toBe(field);
  });
});

describe('Colores de los solares (spec sprite-rendering 0026)', () => {
  it('el aspecto del repositorio carga, con tres colores de solar distintos', () => {
    const registered = registeredPaths(provenanceJson);
    const r = parseAppearance(appearanceJson, registered, GENERATED_PATHS);
    if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
    expect(new Set(Object.values(r.value.siteColors)).size).toBe(3);
  });

  it.each([
    [
      'torre "#12345"',
      (a: RawAppearance) => (a.siteColors['tower'] = '#12345'),
      'siteColors.tower',
    ],
    [
      'sin el color en obra',
      (a: RawAppearance) => delete a.siteColors['construction'],
      'siteColors.construction',
    ],
    [
      'casa igual a goblin-house',
      (a: RawAppearance) => (a.siteColors['house'] = a.structureColors['goblin-house']),
      'siteColors.house',
    ],
  ])('Scenario: Colores de los solares inválidos (%s)', (_name, change, field) => {
    const { booted, errors } = bootErrors(() => undefined, change);
    expect(booted).toBe(false);
    expect(errors).toEqual([field]);
  });
});
