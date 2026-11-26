import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_DIR, ROCK_SIZES } from '../../src/infrastructure/content/appearanceSchema';
import {
  registeredPaths,
  type ProvenanceLists,
  parseAppearance,
  pickupAspectsOf,
} from '../../src/infrastructure/content/loadAppearance';
import { PLACEHOLDER_TEXTURE } from '../../src/infrastructure/phaser/art/looks';
import {
  REGISTERED,
  ROCK_LARGE_FILE,
  ROCK_MEDIUM_FILE,
  ROCK_SMALL_FILE,
  rawAppearance,
  type RawAppearance,
} from '../support/appearance';
import { someLooks } from '../support/looks';

// Spec sprite-rendering (0025), "Aspectos de los recogibles y de las vetas": la piedra con sus tres
// rocas de Deco, la roca de cada tipo de enemigo y la reserva por roca.
const root = join(import.meta.dirname, '..', '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));
const registered = registeredPaths(readJson('content/asset-provenance.json') as ProvenanceLists);
const enemyIds = (readJson('content/enemies.json') as { types: { id: string }[] }).types.map(
  (t) => t.id,
);

function repository() {
  const r = parseAppearance(readJson('content/appearance.json'), registered);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

/** Ancho y alto de un PNG leídos de su cabecera IHDR (bytes 16..23, big-endian). */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(join(root, ASSET_DIR, file));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function failure(change: (raw: RawAppearance) => void): string {
  const raw = rawAppearance();
  change(raw);
  const r = parseAppearance(raw, REGISTERED);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return r.error.field;
}

type Json = Record<string, unknown>;
const stoneOf = (r: RawAppearance): Json => r.pickups.stone as Json;
const rocksOf = (r: RawAppearance): Record<string, Json> =>
  stoneOf(r).rocks as Record<string, Json>;
const enemy = (r: RawAppearance, id: string): Json => r.enemies[id] as Json;

describe('Aspecto de la piedra (sprite-rendering, "Datos del repositorio")', () => {
  it('Scenario: Datos del repositorio (rocas small, medium y large en Deco/04–06)', () => {
    const { stone } = repository().pickups;

    expect(Object.keys(stone.rocks)).toEqual(['small', 'medium', 'large']);
    expect(ROCK_SIZES.map((s) => stone.rocks[s].sheet.file)).toEqual([
      'Deco/04.png',
      'Deco/05.png',
      'Deco/06.png',
    ]);
  });

  it('Scenario: Datos del repositorio (cada roca cabe en su hoja versionada)', () => {
    const { stone } = repository().pickups;
    for (const size of ROCK_SIZES) {
      const { sheet } = stone.rocks[size];
      const png = pngSize(sheet.file);

      expect(sheet.frameWidth, size).toBeLessThanOrEqual(png.width);
      expect(sheet.frameHeight, size).toBeLessThanOrEqual(png.height);
    }
  });

  it('Scenario: Datos del repositorio (rock de cada tipo de enemigo y hoja de xp distinta)', () => {
    const a = repository();

    expect(Object.keys(a.enemies).sort()).toEqual([...enemyIds].sort());
    for (const id of enemyIds) expect(ROCK_SIZES).toContain(a.enemies[id]?.rock);
    expect('sheet' in a.pickups.xp).toBe(false);
  });

  it('las tres rocas se cargan como aspectos de recogible con el color de la piedra', () => {
    const a = repository();
    const rocks = pickupAspectsOf(a).filter(([path]) => path[1] === 'stone');

    expect(rocks.map(([path]) => path.join('.'))).toEqual([
      'pickups.stone.rocks.small',
      'pickups.stone.rocks.medium',
      'pickups.stone.rocks.large',
    ]);
    for (const [, aspect] of rocks) {
      expect(aspect.placeholderColor).toBe(a.pickups.stone.placeholderColor);
    }
  });
});

describe('Datos de la piedra inválidos (sprite-rendering, "Datos inválidos")', () => {
  it.each([
    [
      'sin aspecto wood',
      (r: RawAppearance) => Reflect.deleteProperty(r.pickups, 'wood'),
      /^pickups\.wood$/,
    ],
    [
      'sin aspecto meat',
      (r: RawAppearance) => Reflect.deleteProperty(r.pickups, 'meat'),
      /^pickups\.meat$/,
    ],
    [
      'sin aspecto stone',
      (r: RawAppearance) => Reflect.deleteProperty(r.pickups, 'stone'),
      /^pickups\.stone$/,
    ],
    ['aspecto extra potion', (r: RawAppearance) => (r.pickups.potion = {}), /^pickups\.potion$/],
    [
      'sin veta agotada',
      (r: RawAppearance) => Reflect.deleteProperty(r.veins, 'depleted'),
      /^veins\.depleted$/,
    ],
    [
      'escala de gold 0',
      (r: RawAppearance) => ((r.pickups.gold as Json).scale = 0),
      /^pickups\.gold\.scale$/,
    ],
    [
      'color de wood igual al de gold',
      (r: RawAppearance) =>
        ((r.pickups.wood as Json).placeholderColor = (r.pickups.gold as Json).placeholderColor),
      /^pickups\.wood\.placeholderColor$/,
    ],
    [
      'color de meat igual al de la veta',
      (r: RawAppearance) => ((r.pickups.meat as Json).placeholderColor = r.veinColor),
      /^pickups\.meat\.placeholderColor$/,
    ],
    [
      'color de la veta "amarillo"',
      (r: RawAppearance) => (r.veinColor = 'amarillo'),
      /^veinColor$/,
    ],
    [
      'stone sin la roca medium',
      (r: RawAppearance) => Reflect.deleteProperty(rocksOf(r), 'medium'),
      /^pickups\.stone\.rocks\.medium$/,
    ],
    [
      'stone con una roca extra huge',
      (r: RawAppearance) => (rocksOf(r).huge = { ...rocksOf(r).small }),
      /^pickups\.stone\.rocks\.huge$/,
    ],
    [
      'escala de la roca large 0',
      (r: RawAppearance) => ((rocksOf(r).large as Json).scale = 0),
      /^pickups\.stone\.rocks\.large\.scale$/,
    ],
    [
      'color de stone igual al de la oveja',
      (r: RawAppearance) => (stoneOf(r).placeholderColor = r.sheep.placeholderColor),
      /^pickups\.stone\.placeholderColor$/,
    ],
    [
      'goblin-tnt sin rock',
      (r: RawAppearance) => Reflect.deleteProperty(enemy(r, 'goblin-tnt'), 'rock'),
      /^enemies\.goblin-tnt\.rock$/,
    ],
    [
      'goblin-torch con rock huge',
      (r: RawAppearance) => (enemy(r, 'goblin-torch').rock = 'huge'),
      /^enemies\.goblin-torch\.rock$/,
    ],
  ])('Scenario: Datos inválidos (%s)', (_name, change, field) => {
    expect(failure(change)).toMatch(field);
  });

  it('una gema con la hoja de una roca falla (XP_SHEET_MUST_DIFFER)', () => {
    expect(
      failure((r) => {
        r.pickups.xp = { ...rocksOf(r).medium, placeholderColor: '#123456' };
      }),
    ).toBe('pickups.xp.sheet.file');
  });

  it('una roca sin entrada en la nota de procedencia nombra su hoja', () => {
    const r = parseAppearance(
      rawAppearance(),
      REGISTERED.filter((p) => !p.endsWith(ROCK_LARGE_FILE)),
    );

    expect(r.ok ? null : r.error.field).toBe('pickups.stone.rocks.large.sheet.file');
  });
});

describe('Looks.stones (roca por origen y reserva por roca)', () => {
  it('cada origen con la roca de su tipo; sin origen o desconocido, medium', () => {
    const { stones } = someLooks();

    expect(stones.of('goblin-torch').texture).toBe(ROCK_SMALL_FILE);
    expect(stones.of('goblin-tnt').texture).toBe(ROCK_MEDIUM_FILE);
    expect(stones.of('goblin-barrel').texture).toBe(ROCK_SMALL_FILE);
    expect(stones.of(undefined).texture).toBe(ROCK_MEDIUM_FILE);
    expect(stones.of('goblin-ogre').texture).toBe(ROCK_MEDIUM_FILE);
  });

  it('Scenario: Cambiar la roca es solo de datos (goblin-torch large: Deco/06)', () => {
    const { stones } = someLooks((r) => (enemy(r, 'goblin-torch').rock = 'large'));

    expect(stones.of('goblin-torch').texture).toBe(ROCK_LARGE_FILE);
  });

  it('una roca sin cargar va a reserva con el color de stone; las demás, con su hoja', () => {
    const { stones } = someLooks(undefined, [ROCK_SMALL_FILE]);

    expect(stones.rocks.small).toMatchObject({
      texture: PLACEHOLDER_TEXTURE,
      placeholder: true,
      color: 0x9aa0a6,
      shape: false,
    });
    expect(stones.rocks.large.placeholder).toBe(false);
    expect(stones.rocks.medium.placeholder).toBe(false);
  });
});
