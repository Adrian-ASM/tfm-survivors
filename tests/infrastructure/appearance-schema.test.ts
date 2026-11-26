import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';
import { parseAppearance, veinAspectsOf } from '../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance, type RawAppearance } from '../support/appearance';

// Spec sprite-rendering (0022), "Aspectos de los recogibles y de las vetas" y "Arte de Tiny Swords
// Update 010 por elemento" (recogibles y vetas).
const root = join(import.meta.dirname, '..', '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));
const provenance = readJson('content/asset-provenance.json') as {
  files: { path: string; source: string }[];
};
const registered = provenance.files.map((f) => f.path);
const sourceOfFile = (file: string): string =>
  provenance.files.find((f) => f.path === ASSET_DIR + file)?.source ?? '';

function repository() {
  const r = parseAppearance(readJson('content/appearance.json'), registered);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

function failure(change: (raw: RawAppearance) => void): string {
  const raw = rawAppearance();
  change(raw);
  const r = parseAppearance(raw, REGISTERED);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return r.error.field;
}

describe('Aspectos de los recogibles y de las vetas (sprite-rendering)', () => {
  it('Scenario: Datos del repositorio (xp, gold, wood, meat, stone, vetas; colores distintos)', () => {
    const a = repository();
    expect(Object.keys(a.pickups)).toEqual(['xp', 'gold', 'wood', 'meat', 'stone']);
    expect(Object.keys(a.veins)).toEqual(['active', 'depleted']);
    const colors = [
      a.pickups.xp.placeholderColor,
      a.pickups.gold.placeholderColor,
      a.pickups.wood.placeholderColor,
      a.pickups.meat.placeholderColor,
      a.pickups.stone.placeholderColor,
      a.veinColor,
    ];
    expect(new Set(colors).size).toBe(6);
    const elsewhere = new Set([...Object.values(a.terrain), ...Object.values(a.structureColors)]);
    expect(colors.some((c) => elsewhere.has(c))).toBe(false);
    expect(a.pickups.gold.sheet.file.endsWith('G_Idle.png')).toBe(true);
    expect(a.pickups.wood.sheet.file.endsWith('W_Idle.png')).toBe(true);
    expect(a.pickups.meat.sheet.file.endsWith('M_Idle.png')).toBe(true);
    // La gema no tiene hoja en el repositorio: forma de color (design §5).
    expect('sheet' in a.pickups.xp).toBe(false);
  });

  it.each([
    [
      'sin aspecto wood',
      (r: RawAppearance) => Reflect.deleteProperty(r.pickups, 'wood'),
      /^pickups\.wood/,
    ],
    [
      'sin aspecto meat',
      (r: RawAppearance) => Reflect.deleteProperty(r.pickups, 'meat'),
      /^pickups\.meat/,
    ],
    ['aspecto extra potion', (r: RawAppearance) => (r.pickups.potion = {}), /^pickups\.potion$/],
    [
      'sin veta agotada',
      (r: RawAppearance) => Reflect.deleteProperty(r.veins, 'depleted'),
      /^veins\.depleted/,
    ],
    [
      'escala de gold 0',
      (r: RawAppearance) => {
        const gold = r.pickups.gold;
        if (gold) gold.scale = 0;
      },
      /^pickups\.gold\.scale$/,
    ],
    [
      'color de wood igual al de gold',
      (r: RawAppearance) => {
        const [gold, wood] = [r.pickups.gold, r.pickups.wood];
        if (gold && wood) wood.placeholderColor = gold.placeholderColor;
      },
      /^pickups\.wood\.placeholderColor$/,
    ],
    [
      'color de meat igual al de la veta',
      (r: RawAppearance) => {
        const meat = r.pickups.meat;
        if (meat) meat.placeholderColor = r.veinColor;
      },
      /^pickups\.meat\.placeholderColor$/,
    ],
    [
      'color de la veta "amarillo"',
      (r: RawAppearance) => (r.veinColor = 'amarillo'),
      /^veinColor$/,
    ],
  ])('Scenario: Datos inválidos (%s)', (_name, change, field) => {
    expect(failure(change)).toMatch(field);
  });

  it('un color de recogible igual a uno del mapa o de las estructuras falla', () => {
    expect(
      failure((r) => {
        const gold = r.pickups.gold;
        if (gold) gold.placeholderColor = r.terrain.trunk;
      }),
    ).toBe('pickups.gold.placeholderColor');
    expect(failure((r) => (r.veinColor = r.structureColors.ruin))).toBe('veinColor');
  });

  it('una gema con hoja debe ser distinta de la del oro y la madera', () => {
    expect(
      failure((r) => {
        r.pickups.xp = { ...r.pickups.gold, placeholderColor: '#123456' };
      }),
    ).toBe('pickups.xp.sheet.file');
  });
});

describe('Arte de Update 010 de los recursos (sprite-rendering)', () => {
  it('Scenario: Hoja de cada elemento (oro, madera y vetas)', () => {
    const a = repository();
    expect(sourceOfFile(a.pickups.gold.sheet.file).endsWith('G_Idle.png')).toBe(true);
    expect(sourceOfFile(a.pickups.wood.sheet.file).endsWith('W_Idle.png')).toBe(true);
    const [active, depleted] = veinAspectsOf(a).map(([, v]) => sourceOfFile(v.sheet.file));
    expect(active?.endsWith('GoldMine_Active.png')).toBe(true);
    expect(depleted?.endsWith('GoldMine_Inactive.png')).toBe(true);
    for (const s of [active, depleted]) {
      expect(s?.startsWith('Tiny Swords (Update 010)/')).toBe(true);
    }
  });

  it('Scenario: Solo las hojas usadas (sin GoldMine_Destroyed, NoShadow ni HappySheep_All; _Spawn 3)', () => {
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
    const outside = files.filter((f) => !f.startsWith('openspec/'));
    const forbidden = /GoldMine_Destroyed|NoShadow|HappySheep_All|Fire|Rocks/;
    expect(outside.filter((f) => forbidden.test(f))).toEqual([]);
    // 0030: las únicas `_Spawn` son las 3 hojas de aparición, cada una 1 vez.
    expect(outside.filter((f) => f.includes('_Spawn')).sort()).toEqual(
      ['G_Spawn.png', 'M_Spawn.png', 'W_Spawn.png'].map(
        (f) => `${ASSET_DIR}Resources/Resources/${f}`,
      ),
    );
  });
});
