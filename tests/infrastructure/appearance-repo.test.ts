import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_DIR, type Aspect } from '../../src/infrastructure/content/appearanceSchema';
import { aspectsOf, parseAppearance } from '../../src/infrastructure/content/loadAppearance';

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

function framesOf(aspect: Aspect): number[] {
  const anims = 'death' in aspect ? [aspect.death] : [aspect.idle, 'walk' in aspect && aspect.walk];
  return anims.flatMap((a) => (a ? a.frames : []));
}

function grid(file: string): { width: number; height: number } {
  const png = readFileSync(join(root, ASSET_DIR, file));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

const sourceOf = (aspect: Aspect): string =>
  provenance.files.find((f) => f.path === ASSET_DIR + aspect.sheet.file)?.source ?? '';

describe('Datos de aspecto del repositorio', () => {
  it('Scenario: Datos del repositorio (válidos, tope 64 y los tres goblins)', () => {
    expect(appearance.maxCorpses).toBe(64);
    expect(Object.keys(appearance.enemies)).toEqual([
      'goblin-torch',
      'goblin-tnt',
      'goblin-barrel',
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

  it('cada hoja figura en la nota y cada entrada de la nota la usa algún aspecto', () => {
    const used = new Set(aspects.map(([, a]) => ASSET_DIR + a.sheet.file));
    expect([...used].every((p) => registered.includes(p))).toBe(true);
    expect([...registered].sort()).toEqual([...used].sort());
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
});
