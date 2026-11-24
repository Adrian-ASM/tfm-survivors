import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import provenanceJson from '../../content/asset-provenance.json';
import {
  APPEARANCE_FUSE_REQUIRED,
  APPEARANCE_THROW_REQUIRED,
  bootContent,
} from '../../src/composition/contentBoot';
import type { DomainError } from '../../src/domain/shared/Result';
import {
  ALPHA_OUT_OF_RANGE,
  ASSET_DIR,
  EXPLODE_MUST_NOT_LOOP,
  SHEET_NOT_REGISTERED,
} from '../../src/infrastructure/content/appearanceSchema';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { rawContent } from '../support/builders';

// Datos de aspecto de los peligros y de los comportamientos (change 0020, spec sprite-rendering y
// asset-provenance), con los datos del repositorio.
const REGISTERED = provenanceJson.files.map((f) => f.path);
type Json = Record<string, unknown>;

const appearance = (): Json => structuredClone(appearanceJson);
const enemies = (a: Json) => a['enemies'] as Record<string, Json>;

function parsed(a: Json) {
  const r = parseAppearance(a, REGISTERED);
  if (r.ok) throw new Error('se esperaba un error de aspecto');
  return r.error;
}

function boot(a: Json): { ok: boolean; errors: DomainError[] } {
  const errors: DomainError[] = [];
  const booted = bootContent(
    { content: rawContent(), appearance: a },
    (e) => errors.push(e),
    REGISTERED,
  );
  return { ok: booted !== null, errors };
}

describe('Datos de aspecto validados (peligros y comportamiento)', () => {
  it('Scenario: Datos del repositorio (mecha, lanzamiento, dinamita, explosión y avisos)', () => {
    const r = parseAppearance(appearanceJson, REGISTERED);
    if (!r.ok) throw new Error(r.error.message);
    const a = r.value;
    expect(a.enemies['goblin-barrel']?.fuse).toMatchObject({ frames: [30, 31, 32], loop: true });
    expect(a.enemies['goblin-tnt']?.throw?.frames).toEqual([14, 15, 16, 17, 18, 19, 20]);
    expect(a.dynamite.idle).toMatchObject({ loop: true });
    expect(a.dynamite.idle.frames).toHaveLength(6);
    expect(a.explosion.explode).toMatchObject({ loop: false });
    expect(a.explosion.explode.frames).toHaveLength(9);
    expect(a.maxBlastSprites).toBe(64);
  });

  it('Scenario: El aviso deja ver lo que cubre', () => {
    const { warnings } = appearanceJson;
    for (const w of [warnings.fuse, warnings.dynamite]) {
      expect(w.alpha).toBeGreaterThan(0);
      expect(w.alpha).toBeLessThan(1);
    }
  });

  it.each([0, 1, 1.2])(
    'Scenario: Valores fuera de rango (opacidad del aviso de dinamita %s)',
    (alpha) => {
      const a = appearance();
      ((a['warnings'] as Record<string, Json>)['dynamite'] as Json)['alpha'] = alpha;
      expect(parsed(a)).toMatchObject({
        field: 'warnings.dynamite.alpha',
        message: ALPHA_OUT_OF_RANGE,
      });
    },
  );

  it.each([0, 2.5])('el tope de explosiones pintadas es un entero ≥ 1 (%s)', (value) => {
    const a = appearance();
    a['maxBlastSprites'] = value;
    expect(parsed(a).field).toBe('maxBlastSprites');
  });

  it('Scenario: Animaciones obligatorias y campos desconocidos (dinamita sin idle)', () => {
    const a = appearance();
    Reflect.deleteProperty(a['dynamite'] as Json, 'idle');
    expect(parsed(a).field).toBe('dynamite.idle');
  });

  it('Scenario: Animaciones obligatorias y campos desconocidos (explosión sin explode o en bucle)', () => {
    const missing = appearance();
    Reflect.deleteProperty(missing['explosion'] as Json, 'explode');
    expect(parsed(missing).field).toBe('explosion.explode');
    const looping = appearance();
    ((looping['explosion'] as Json)['explode'] as Json)['loop'] = true;
    expect(parsed(looping)).toMatchObject({
      field: 'explosion.explode.loop',
      message: EXPLODE_MUST_NOT_LOOP,
    });
  });

  it('Scenario: Animaciones obligatorias y campos desconocidos (goblin-barrel sin fuse)', () => {
    const a = appearance();
    Reflect.deleteProperty(enemies(a)['goblin-barrel'] ?? {}, 'fuse');
    const { ok, errors } = boot(a);
    expect(ok).toBe(false);
    expect(errors[0]?.field).toBe('enemies.goblin-barrel.fuse');
    expect(errors[0]?.message).toContain(APPEARANCE_FUSE_REQUIRED);
    expect(errors[0]?.message).toContain('goblin-barrel');
  });

  it('Scenario: Animaciones obligatorias y campos desconocidos (goblin-tnt sin throw)', () => {
    const a = appearance();
    Reflect.deleteProperty(enemies(a)['goblin-tnt'] ?? {}, 'throw');
    const { ok, errors } = boot(a);
    expect(ok).toBe(false);
    expect(errors[0]?.field).toBe('enemies.goblin-tnt.throw');
    expect(errors[0]?.message).toContain(APPEARANCE_THROW_REQUIRED);
  });

  it('Scenario: Animación de comportamiento no exigida', () => {
    const a = appearance();
    const torch = enemies(a)['goblin-torch'] ?? {};
    expect('fuse' in torch || 'throw' in torch).toBe(false);
    expect(boot(a)).toEqual({ ok: true, errors: [] });
  });

  it('Scenario: Rutas de hoja no admitidas (explosión fuera de la nota)', () => {
    const a = appearance();
    ((a['explosion'] as Json)['sheet'] as Json)['file'] = 'Effects/Explosion/Other.png';
    expect(parsed(a)).toMatchObject({
      field: 'explosion.sheet.file',
      message: SHEET_NOT_REGISTERED,
    });
  });
});

const root = join(import.meta.dirname, '..', '..');
const DYNAMITE_SOURCE =
  'Tiny Swords (Update 010)/Factions/Goblins/Troops/TNT/Dynamite/Dynamite.png';
const EXPLOSION_SOURCE = 'Tiny Swords (Update 010)/Effects/Explosion/Explosions.png';

/** Entradas de `main` antes del change (0012), fijadas aquí para "no cambian". */
const BEFORE = {
  'Barrel_Red.png': {
    sha256: 'cca36684f2c8f81afc4d3f58bca01f0993f1297d737caafdad486d3de579e4d4',
    bytes: 28807,
  },
  'TNT_Red.png': {
    sha256: 'fcf80953138170e9ea3ea9b93e6007869c7f1dd05ee51034429d92c54e0b0f66',
    bytes: 30377,
  },
} as const;

interface Entry {
  path: string;
  source: string;
  version: string;
  sha256: string;
  bytes: number;
}
type CheckAssets = (input: {
  files: string[];
  provenance: unknown;
  digest: (path: string) => { sha256: string; bytes: number };
}) => string[];

describe('Procedencia de las hojas de los peligros (asset-provenance)', () => {
  const files: Entry[] = provenanceJson.files;
  const bySource = (source: string) => files.find((f) => f.source === source);

  it('Scenario: Hojas nuevas registradas', () => {
    expect(files).toHaveLength(15);
    expect(bySource(DYNAMITE_SOURCE)?.path).toBe(
      `${ASSET_DIR}Factions/Goblins/Troops/TNT/Dynamite/Dynamite.png`,
    );
    expect(bySource(EXPLOSION_SOURCE)?.path).toBe(`${ASSET_DIR}Effects/Explosion/Explosions.png`);
    for (const [name, digest] of Object.entries(BEFORE)) {
      const e = files.find((f) => f.path.endsWith(`/${name}`));
      expect(e).toMatchObject({ ...digest, version: 'Update 010' });
    }
  });

  it('Scenario: Hoja nueva sin entrada', async () => {
    const guard = (await import(
      pathToFileURL(join(root, '.claude', 'hooks', 'guard-assets.mjs')).href
    )) as { checkAssets: CheckAssets; PROVENANCE_PATH: string };
    const versioned = files.map((f) => f.path);
    const note = { ...provenanceJson, files: files.filter((f) => f.source !== EXPLOSION_SOURCE) };
    const digest = (path: string) => {
      const e = files.find((f) => f.path === path);
      return { sha256: e?.sha256 ?? '', bytes: e?.bytes ?? 0 };
    };
    const problems = guard.checkAssets({
      files: [...versioned, guard.PROVENANCE_PATH],
      provenance: note,
      digest,
    });
    expect(problems.join('\n')).toContain(`${ASSET_DIR}Effects/Explosion/Explosions.png`);
  });

  it('Scenario: Ninguna hoja de más', () => {
    const versioned = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(
      '\n',
    );
    const forbidden = /Fire\.png|Goblin_House|Wood_Tower|W_Idle\.png/;
    expect(versioned.filter((f) => forbidden.test(f) && !f.startsWith('openspec/'))).toEqual([]);
  });

  it('Scenario: Hoja de cada elemento (dinamita y explosión)', () => {
    const source = (file: string) => files.find((f) => f.path === ASSET_DIR + file)?.source ?? '';
    const dynamite = source(appearanceJson.dynamite.sheet.file);
    expect(dynamite).toContain('TNT');
    expect(dynamite.endsWith('Dynamite.png')).toBe(true);
    expect(source(appearanceJson.explosion.sheet.file).endsWith('Explosions.png')).toBe(true);
  });
});
