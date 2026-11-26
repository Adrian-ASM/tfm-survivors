import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';
import {
  registeredPaths,
  parseAppearance,
  pickupSpawnSheetsOf,
} from '../../src/infrastructure/content/loadAppearance';
import {
  REGISTERED,
  ROCK_MEDIUM_FILE,
  rawAppearance,
  withPickupMotion,
  type RawAppearance,
} from '../support/appearance';
import { GENERATED_PATHS } from '../support/generated';

// Spec sprite-rendering (0030), "Aspectos de los recogibles y de las vetas": escalas, diámetro de la
// gema, aparición `spawn` de oro, madera y carne, flote y desfase; y "Arte de Tiny Swords Update 010
// por elemento" (hojas de aparición).
const root = join(import.meta.dirname, '..', '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));
const provenance = readJson('content/asset-provenance.json') as {
  files: { path: string; source: string }[];
  fonts: { path: string }[];
};
const registered = registeredPaths(provenance);
const sourceOfFile = (file: string): string =>
  provenance.files.find((f) => f.path === ASSET_DIR + file)?.source ?? '';

function repository() {
  const r = parseAppearance(readJson('content/appearance.json'), registered, GENERATED_PATHS);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

/** PNG versionado: ancho y alto de su cabecera IHDR. */
function grid(file: string): { width: number; height: number } {
  const png = readFileSync(join(root, ASSET_DIR, file));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** Datos del fixture con el flote y las apariciones de 0030, cambiados por `change`. */
function failure(change: (raw: RawAppearance) => void): { field: string; message: string } {
  const raw = rawAppearance();
  withPickupMotion(raw);
  change(raw);
  const r = parseAppearance(raw, REGISTERED, GENERATED_PATHS);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return { field: r.error.field, message: r.error.message };
}

const KINDS = ['gold', 'wood', 'meat'] as const;
type Kind = (typeof KINDS)[number];
const spawnOf = (raw: RawAppearance, kind: Kind) =>
  raw.pickups[kind]?.spawn as Record<string, unknown>;

describe('Aspectos de los recogibles: aparición, diámetro y flote (sprite-rendering 0030)', () => {
  it('Scenario: Datos del repositorio (escalas 0,5 / 0,75 y gema de 20 px)', () => {
    const a = repository();
    expect([a.pickups.gold.scale, a.pickups.wood.scale, a.pickups.meat.scale]).toEqual([
      0.5, 0.5, 0.5,
    ]);
    expect(Object.values(a.pickups.stone.rocks).map((r) => r.scale)).toEqual([0.75, 0.75, 0.75]);
    expect('sheet' in a.pickups.xp).toBe(false);
    expect('diameter' in a.pickups.xp ? a.pickups.xp.diameter : null).toBe(20);
  });

  it('Scenario: Datos del repositorio (spawn de oro, madera y carne; 7 frames de 128 px que caben)', () => {
    const a = repository();
    const files = ['G_Spawn.png', 'W_Spawn.png', 'M_Spawn.png'];
    KINDS.forEach((kind, i) => {
      const spawn = a.pickups[kind].spawn;
      expect(spawn?.sheet).toEqual({
        file: `Resources/Resources/${files[i] ?? ''}`,
        frameWidth: 128,
        frameHeight: 128,
      });
      expect([spawn?.frames, spawn?.fps, spawn?.loop]).toEqual([[0, 1, 2, 3, 4, 5, 6], 10, false]);
      const { width, height } = grid(spawn?.sheet.file ?? '');
      expect([width % 128, height % 128]).toEqual([0, 0]);
      expect((width / 128) * (height / 128)).toBe(7);
      expect(Math.max(...(spawn?.frames ?? []))).toBeLessThan((width / 128) * (height / 128));
    });
    expect('spawn' in a.pickups.xp).toBe(false);
    expect(Object.values(a.pickups.stone.rocks).some((r) => 'spawn' in r)).toBe(false);
  });

  it('Scenario: Datos del repositorio (flote A 4 y T 1.600; fases (id · s) mod T distintas en 0..7)', () => {
    const { float, spawnStaggerMs } = repository().pickupMotion;
    expect([float.amplitude, float.periodMs]).toEqual([4, 1600]);
    const phases = Array.from({ length: 8 }, (_, id) => (id * float.phaseStepMs) % float.periodMs);
    expect(new Set(phases).size).toBe(8);
    expect(spawnStaggerMs).toBeGreaterThanOrEqual(0);
  });

  it('Scenario: Hoja de cada elemento (aparición: G_Spawn, W_Spawn y M_Spawn de Update 010)', () => {
    const a = repository();
    const sheets = pickupSpawnSheetsOf(a);
    expect(sheets.map(([path]) => path.join('.'))).toEqual([
      'pickups.gold.spawn.sheet',
      'pickups.wood.spawn.sheet',
      'pickups.meat.spawn.sheet',
    ]);
    const sources = sheets.map(([, s]) => sourceOfFile(s.file));
    expect(sources).toEqual(
      ['G_Spawn.png', 'W_Spawn.png', 'M_Spawn.png'].map(
        (n) => `Tiny Swords (Update 010)/Resources/Resources/${n}`,
      ),
    );
    expect(sourceOfFile(a.pickups.meat.sheet.file).endsWith('/M_Idle.png')).toBe(true);
  });

  it.each<[string, (r: RawAppearance) => void, RegExp]>([
    [
      'spawn en stone',
      (r) => {
        (r.pickups.stone as Record<string, unknown>).spawn = spawnOf(r, 'gold');
      },
      /^pickups\.stone\.spawn$/,
    ],
    [
      'spawn en xp',
      (r) => {
        (r.pickups.xp as Record<string, unknown>).spawn = spawnOf(r, 'gold');
      },
      /^pickups\.xp\.spawn$/,
    ],
    [
      'spawn de gold en bucle',
      (r) => (spawnOf(r, 'gold').loop = true),
      /^pickups\.gold\.spawn\.loop$/,
    ],
    [
      'frames del spawn de wood []',
      (r) => (spawnOf(r, 'wood').frames = []),
      /^pickups\.wood\.spawn\.frames$/,
    ],
    ['fps del spawn de meat 0', (r) => (spawnOf(r, 'meat').fps = 0), /^pickups\.meat\.spawn\.fps$/],
    [
      'hoja del spawn de wood sin entrada en la nota',
      (r) => {
        (spawnOf(r, 'wood').sheet as Record<string, unknown>).file = 'Resources/Resources/X.png';
      },
      /^pickups\.wood\.spawn\.sheet\.file$/,
    ],
    [
      'diámetro de xp 0',
      (r) => ((r.pickups.xp as Record<string, unknown>).diameter = 0),
      /^pickups\.xp\.diameter$/,
    ],
    [
      'xp sin hoja y sin diámetro',
      (r) => Reflect.deleteProperty(r.pickups.xp as object, 'diameter'),
      /^pickups\.xp\.diameter$/,
    ],
    [
      'amplitud −1',
      (r) => (r.pickupMotion.float.amplitude = -1),
      /^pickupMotion\.float\.amplitude$/,
    ],
    ['periodo 0', (r) => (r.pickupMotion.float.periodMs = 0), /^pickupMotion\.float\.periodMs$/],
    [
      'paso de fase −1',
      (r) => (r.pickupMotion.float.phaseStepMs = -1),
      /^pickupMotion\.float\.phaseStepMs$/,
    ],
    ['desfase −1', (r) => (r.pickupMotion.spawnStaggerMs = -1), /^pickupMotion\.spawnStaggerMs$/],
    ['sin parámetros de flote', (r) => Reflect.deleteProperty(r, 'pickupMotion'), /^pickupMotion$/],
  ])('Scenario: Aparición, diámetro y flote inválidos (%s)', (_name, change, field) => {
    expect(failure(change).field).toMatch(field);
  });

  it('una gema con hoja no puede usar una hoja de aparición', () => {
    const { field } = failure((r) => {
      r.pickups.xp = {
        sheet: { file: 'Resources/Resources/G_Spawn.png', frameWidth: 128, frameHeight: 128 },
        scale: 0.5,
        origin: { x: 0.5, y: 0.5 },
        facing: 'right',
        placeholderColor: '#123456',
        idle: { frames: [0], fps: 1, loop: true },
      };
    });
    expect(field).toBe('pickups.xp.sheet.file');
  });

  it('Scenario: Aparición opcional (sin spawn en oro, madera ni carne; y con A 0, s 0 y e 0)', () => {
    const noSpawn = rawAppearance();
    withPickupMotion(noSpawn, 120, false);
    expect(parseAppearance(noSpawn, REGISTERED, GENERATED_PATHS).ok).toBe(true);

    const still = rawAppearance();
    withPickupMotion(still);
    still.pickupMotion = {
      float: { amplitude: 0, periodMs: 1600, phaseStepMs: 0 },
      spawnStaggerMs: 0,
    };
    expect(parseAppearance(still, REGISTERED, GENERATED_PATHS).ok).toBe(true);
  });

  it('Scenario: Datos inválidos (sin regresión: la roca de stone sigue sin poder declarar spawn)', () => {
    const { field } = failure((r) => {
      const rocks = (r.pickups.stone as { rocks: Record<string, Record<string, unknown>> }).rocks;
      const medium = rocks.medium;
      if (medium) medium.spawn = spawnOf(r, 'gold');
    });
    expect(field).toBe('pickups.stone.rocks.medium.spawn');
    expect(ROCK_MEDIUM_FILE).toBe('Deco/05.png');
  });
});
