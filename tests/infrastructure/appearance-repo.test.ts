import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_DIR, type Aspect } from '../../src/infrastructure/content/appearanceSchema';
import { framesUsed } from '../../src/infrastructure/phaser/art/looks';
import {
  aspectsOf,
  mapSheetsOf,
  structureAspectsOf,
  sheepSheetsOf,
  siteAspectsOf,
  veinAspectsOf,
  parseAppearance,
} from '../../src/infrastructure/content/loadAppearance';

// Spec sprite-rendering: "Datos del repositorio" y "Hoja de cada elemento" (change 0012, design D4 y D9).
// La rejilla se comprueba leyendo la cabecera IHDR de cada PNG (ancho y alto en los bytes 16-23).
const root = join(import.meta.dirname, '..', '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));

interface Entry {
  path: string;
  source: string;
}
const provenance = readJson('content/asset-provenance.json') as { files: Entry[] };
const registered = provenance.files.map((f) => f.path);
const enemyIds = (readJson('content/enemies.json') as { types: { id: string }[] }).types.map(
  (t) => t.id,
);
const parsed = parseAppearance(readJson('content/appearance.json'), registered);
if (!parsed.ok) throw new Error(`${parsed.error.field}: ${parsed.error.message}`);
const appearance = parsed.value;
const aspects = aspectsOf(appearance);

const framesOf = (aspect: Aspect): number[] => framesUsed(aspect);

function grid(file: string): { width: number; height: number } {
  const png = readFileSync(join(root, ASSET_DIR, file));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

const sourceOfFile = (file: string): string =>
  provenance.files.find((f) => f.path === ASSET_DIR + file)?.source ?? '';
const sourceOf = (aspect: Aspect): string => sourceOfFile(aspect.sheet.file);

describe('Datos de aspecto del repositorio', () => {
  it('Scenario: Datos del repositorio (válidos, tope 64, los tres goblins y el guardia)', () => {
    expect(appearance.maxCorpses).toBe(64);
    expect(Object.keys(appearance.enemies)).toEqual([
      'goblin-torch',
      'goblin-tnt',
      'goblin-barrel',
      'goblin-tnt-guard',
    ]);
    expect(Object.keys(appearance.enemies)).toEqual(enemyIds);
  });

  it.each(aspects.map(([path, aspect]) => [path.join('.'), aspect] as const))(
    'rejilla exacta e índices dentro de la hoja (%s)',
    (_name, aspect) => {
      const { width, height } = grid(aspect.sheet.file);
      const { frameWidth, frameHeight } = aspect.sheet;
      expect([width % frameWidth, height % frameHeight]).toEqual([0, 0]);
      const last = (width / frameWidth) * (height / frameHeight) - 1;
      expect(Math.max(...framesOf(aspect))).toBeLessThanOrEqual(last);
    },
  );

  it('Scenario: Solo las hojas usadas (cada hoja en la nota y cada entrada usada)', () => {
    const used = new Set([
      ...aspects.map(([, a]) => ASSET_DIR + a.sheet.file),
      ...mapSheetsOf(appearance).map(([, file]) => ASSET_DIR + file),
      ...structureAspectsOf(appearance).map(([, a]) => ASSET_DIR + a.sheet.file),
      ...veinAspectsOf(appearance).map(([, a]) => ASSET_DIR + a.sheet.file),
      ...sheepSheetsOf(appearance).map(([, sheet]) => ASSET_DIR + sheet.file),
      ...siteAspectsOf(appearance).map(([, a]) => ASSET_DIR + a.sheet.file),
    ]);
    expect([...used].every((p) => registered.includes(p))).toBe(true);
    expect([...registered].sort()).toEqual([...used].sort());
  });

  it('Scenario: Solo las hojas usadas (ningún otro castillo ni Rocks versionado)', () => {
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
    const forbidden = /Castle_(Red|Yellow|Purple|Black)|Rocks/;
    expect(files.filter((f) => forbidden.test(f) && !f.startsWith('openspec/'))).toEqual([]);
  });

  it('Scenario: Datos del repositorio (aspectos del mapa)', () => {
    const { map } = appearance;
    expect(Object.keys(map.shore.cases)).toHaveLength(15);
    expect(map.foam.idle).toMatchObject({ loop: true });
    expect(map.foam.idle.frames).toHaveLength(8);
    expect(map.trees.idle).toEqual({ frames: [0, 1, 2, 3], fps: 4, loop: true });
    expect(Object.keys(map.bridges.frames).sort()).toEqual(['eastWest', 'northSouth']);
    expect(map.castle.sheet.file.endsWith('Castle_Blue.png')).toBe(true);
  });

  it('hojas regulares del mapa: rejilla exacta y frames dentro; recortes del puente dentro', () => {
    const { map } = appearance;
    const sheets = [
      [map.water.sheet, [map.water.frame]],
      [map.shore.sheet, Object.values(map.shore.cases)],
      [map.foam.sheet, map.foam.idle.frames],
      [map.trees.sheet, map.trees.idle.frames],
      [map.castle.sheet, [map.castle.frame]],
    ] as const;
    for (const [sheet, frames] of sheets) {
      const { width, height } = grid(sheet.file);
      expect([width % sheet.frameWidth, height % sheet.frameHeight]).toEqual([0, 0]);
      const last = (width / sheet.frameWidth) * (height / sheet.frameHeight) - 1;
      expect(Math.max(...frames)).toBeLessThanOrEqual(last);
    }
    const image = grid(map.bridges.image);
    for (const r of Object.values(map.bridges.frames)) {
      expect(r.x + r.width <= image.width && r.y + r.height <= image.height).toBe(true);
    }
  });

  it('Scenario: Hoja de cada elemento', () => {
    const enemies = appearance.enemies;
    const torch = enemies['goblin-torch'];
    const tnt = enemies['goblin-tnt'];
    const barrel = enemies['goblin-barrel'];
    if (!torch || !tnt || !barrel) throw new Error('faltan aspectos de enemigo');
    expect(sourceOf(appearance.player)).toContain('Archer');
    expect(sourceOf(torch)).toContain('Torch');
    expect(sourceOf(tnt)).toContain('TNT');
    expect(sourceOf(barrel)).toContain('Barrel');
    expect(new Set([torch, tnt, barrel].map((a) => a.sheet.file)).size).toBe(3);
    expect(sourceOf(appearance.corpse).endsWith('Dead.png')).toBe(true);
    expect(sourceOf(appearance.projectile).endsWith('Arrow.png')).toBe(true);
    for (const [, aspect] of aspects) {
      expect(sourceOf(aspect).startsWith('Tiny Swords (Update 010)/')).toBe(true);
    }
  });

  it('Scenario: Hoja de cada elemento (mapa: agua, espuma, árbol, puente y castillo)', () => {
    const { map } = appearance;
    const ends = [
      [map.water.sheet.file, 'Water.png'],
      [map.foam.sheet.file, 'Foam.png'],
      [map.trees.sheet.file, 'Tree.png'],
      [map.bridges.image, 'Bridge_All.png'],
      [map.castle.sheet.file, 'Castle_Blue.png'],
    ] as const;
    for (const [file, name] of ends) {
      const source = sourceOfFile(file);
      expect(source.endsWith(`/${name}`), `${file} → ${source}`).toBe(true);
      expect(source.startsWith('Tiny Swords (Update 010)/')).toBe(true);
    }
    expect(sourceOfFile(map.shore.sheet.file).startsWith('Tiny Swords (Update 010)/Terrain/')).toBe(
      true,
    );
  });

  // 0021 (spec sprite-rendering y asset-provenance): casas, torres y ruinas.
  it('Scenario: Datos del repositorio (estructuras y colores de reserva)', () => {
    expect(Object.keys(appearance.structures)).toEqual(['goblin-house', 'goblin-tower']);
    for (const looks of Object.values(appearance.structures)) {
      expect(looks.intact.idle.frames.length).toBeGreaterThanOrEqual(1);
      expect(looks.ruin.idle.frames.length).toBeGreaterThanOrEqual(1);
    }
    expect(Object.keys(appearance.structureColors).sort()).toEqual([
      'goblin-house',
      'goblin-tower',
      'ruin',
    ]);
    const enemies = appearance.enemies;
    expect(enemies['goblin-tnt-guard']?.sheet.file).toBe(enemies['goblin-tnt']?.sheet.file);
    expect(enemies['goblin-tnt-guard']?.throw?.frames).toEqual([14, 15, 16, 17, 18, 19, 20]);
  });

  it.each(structureAspectsOf(appearance).map(([p, a]) => [p.join('.'), a] as const))(
    'rejilla exacta e índices dentro de la hoja (%s)',
    (_name, aspect) => {
      const { width, height } = grid(aspect.sheet.file);
      const { frameWidth, frameHeight } = aspect.sheet;
      expect([width % frameWidth, height % frameHeight]).toEqual([0, 0]);
      const last = (width / frameWidth) * (height / frameHeight) - 1;
      expect(Math.max(...aspect.idle.frames)).toBeLessThanOrEqual(last);
    },
  );

  it('Scenario: Hoja de cada elemento (casa, torre y sus ruinas)', () => {
    const house = appearance.structures['goblin-house'];
    const tower = appearance.structures['goblin-tower'];
    if (!house || !tower) throw new Error('faltan aspectos de estructura');
    expect(sourceOfFile(house.intact.sheet.file).endsWith('/Goblin_House.png')).toBe(true);
    expect(sourceOfFile(house.ruin.sheet.file).endsWith('/Goblin_House_Destroyed.png')).toBe(true);
    expect(sourceOfFile(tower.intact.sheet.file)).toMatch(
      /\/Wood_Tower_(Red|Blue|Purple|Yellow)\.png$/,
    );
    expect(sourceOfFile(tower.ruin.sheet.file).endsWith('/Wood_Tower_Destroyed.png')).toBe(true);
    for (const [, aspect] of structureAspectsOf(appearance)) {
      expect(sourceOfFile(aspect.sheet.file).startsWith('Tiny Swords (Update 010)/')).toBe(true);
    }
  });

  it('Scenario: Solo las hojas usadas (un único color de torre versionado)', () => {
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
    const towers = files.filter(
      (f) => /Wood_Tower_(Red|Blue|Purple|Yellow)\.png$/.test(f) && !f.startsWith('openspec/'),
    );
    expect(towers).toHaveLength(1);
    const forbidden = /Fire|Wood_Tower_InConstruction/;
    expect(files.filter((f) => forbidden.test(f) && !f.startsWith('openspec/'))).toEqual([]);
  });

  // 0029: torre intacta animada; el resto de estructuras, vetas y solares, de 1 frame.
  it('Scenario: Datos del repositorio (torre intacta 0–3 a 5 fps; el resto de 1 frame)', () => {
    expect(appearance.structures['goblin-tower']?.intact.idle).toEqual({
      frames: [0, 1, 2, 3],
      fps: 5,
      loop: true,
    });
    const still = [
      appearance.structures['goblin-house']?.intact,
      appearance.structures['goblin-house']?.ruin,
      appearance.structures['goblin-tower']?.ruin,
      appearance.veins.active,
      appearance.veins.depleted,
      appearance.sites.construction,
      appearance.sites.house,
      appearance.sites.tower,
    ];
    expect(still.map((a) => a?.idle.frames.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(appearance.map.castle.frame).toBe(0);
  });

  it('Scenario: Datos del repositorio (11 aspectos de decoración, altos 16–18, tope 120, densidad 25)', () => {
    const { decor } = appearance.map;
    const names = decor.items.map((i) => i.sheet.file);
    expect(names).toEqual(
      ['01', '02', '03', '07', '08', '09', '10', '11', '16', '17', '18'].map(
        (n) => `Deco/${n}.png`,
      ),
    );
    expect(decor.items.filter((i) => i.tall).map((i) => i.sheet.file)).toEqual([
      'Deco/16.png',
      'Deco/17.png',
      'Deco/18.png',
    ]);
    for (const item of decor.items) {
      const { width, height } = grid(item.sheet.file);
      const { frameWidth, frameHeight } = item.sheet;
      expect([width % frameWidth, height % frameHeight]).toEqual([0, 0]);
      expect(item.frame).toBeLessThan((width / frameWidth) * (height / frameHeight));
    }
    expect([decor.maxObjects, decor.density]).toEqual([120, 25]);
  });

  it('Scenario: Hoja de cada elemento (las 11 de decoración, ninguna roca)', () => {
    const rocks = Object.values(appearance.pickups.stone.rocks).map((r) => r.sheet.file);
    const sources = appearance.map.decor.items.map((i) => sourceOfFile(i.sheet.file));
    expect(sources).toEqual(
      ['01', '02', '03', '07', '08', '09', '10', '11', '16', '17', '18'].map(
        (n) => `Tiny Swords (Update 010)/Deco/${n}.png`,
      ),
    );
    expect(appearance.map.decor.items.some((i) => rocks.includes(i.sheet.file))).toBe(false);
  });

  it('Scenario: Solo las hojas usadas (Deco versionado: 01–11 y 16–18, ninguna de 12–15)', () => {
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
    const deco = files.filter((f) => f.startsWith(`${ASSET_DIR}Deco/`)).sort();
    expect(deco).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18].map(
        (n) => `${ASSET_DIR}Deco/${String(n).padStart(2, '0')}.png`,
      ),
    );
  });
});
