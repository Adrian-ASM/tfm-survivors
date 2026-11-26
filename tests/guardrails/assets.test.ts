import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// Spec asset-provenance (change 0012, design D8): reglas puras de `.claude/hooks/guard-assets.mjs`
// sobre una lista de ficheros simulada, la nota de procedencia y un digest inyectado como mapa.
interface Entry {
  path?: string;
  source?: string;
  version?: string;
  sha256?: string;
  bytes?: number;
}
type Provenance = Record<string, unknown> & { files?: Entry[] };
interface Digest {
  sha256: string;
  bytes: number;
}
interface AssetsInput {
  files: string[];
  provenance: Provenance | undefined;
  digest: (path: string) => Digest;
  /** Texto de `CREDITS.md` (0035 rev. 4); ausente si no está versionado. */
  credits?: string;
}
type CheckAssets = (input: AssetsInput) => string[];

const root = join(import.meta.dirname, '..', '..');
const guard = (await import(
  pathToFileURL(join(root, '.claude', 'hooks', 'guard-assets.mjs')).href
)) as { checkAssets: CheckAssets; PROVENANCE_PATH: string };
const { checkAssets, PROVENANCE_PATH } = guard;

const BASE = 'public/assets/tiny-swords';
const ARCHER = `${BASE}/Factions/Knights/Troops/Archer/Blue/Archer_Blue.png`;
const ARROW = `${BASE}/Factions/Knights/Troops/Archer/Arrow/Arrow.png`;
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function entry(path: string, sha256: string, bytes: number): Entry {
  return {
    path,
    source: `Tiny Swords (Update 010)/${path.slice(BASE.length + 1)}`,
    version: 'Update 010',
    sha256,
    bytes,
  };
}

/** Nota válida con dos entradas (sustituye a la real mientras no hay assets). */
function aNote(): Provenance {
  return {
    pack: 'Tiny Swords',
    author: 'Pixel Frog',
    version: 'Update 010',
    license: 'CC0',
    confirmedOn: '2026-11-22',
    homepage: 'https://pixelfrog-assets.itch.io/tiny-swords',
    note: 'CC0 confirmado por el autor.',
    files: [entry(ARCHER, SHA_A, 100), entry(ARROW, SHA_B, 20)],
  };
}

const DIGESTS = new Map<string, Digest>([
  [ARCHER, { sha256: SHA_A, bytes: 100 }],
  [ARROW, { sha256: SHA_B, bytes: 20 }],
]);
const digest = (path: string): Digest => DIGESTS.get(path) ?? { sha256: 'f'.repeat(64), bytes: 1 };
const FILES = ['README.md', 'src/main.ts', PROVENANCE_PATH, ARCHER, ARROW];

function run(provenance: Provenance | undefined, files: string[] = FILES): string {
  return checkAssets({ files, provenance, digest }).join('\n');
}

describe('guard-assets · nota de procedencia (spec asset-provenance)', () => {
  it('una nota completa con sus ficheros pasa', () => {
    expect(checkAssets({ files: FILES, provenance: aNote(), digest })).toEqual([]);
  });

  it('la nota vive en content/ (design R6: Vite no importa JSON de public/)', () => {
    expect(PROVENANCE_PATH).toBe('content/asset-provenance.json');
  });

  it.each(['pack', 'author', 'version', 'license', 'confirmedOn'])(
    'Scenario: Nota incompleta (sin %s)',
    (field) => {
      const note = aNote();
      Reflect.deleteProperty(note, field);
      expect(run(note)).toContain(field);
    },
  );

  it.each([
    ['license', 'CC-BY'],
    ['version', 'Update 009'],
    ['pack', 'Tiny Swords (Free Pack)'],
    ['author', 'Otro'],
    ['confirmedOn', 'ayer'],
  ])('Scenario: Nota incompleta (%s con valor %s)', (field, value) => {
    expect(run({ ...aNote(), [field]: value })).toContain(field);
  });

  it('Scenario: Nota incompleta (entrada sin ruta de origen)', () => {
    const note = aNote();
    const files = note.files ?? [];
    Reflect.deleteProperty(files[1] ?? {}, 'source');
    expect(run(note)).toContain('files[1].source');
  });

  it.each(['path', 'version', 'sha256', 'bytes'])('entrada sin %s', (field) => {
    const note = aNote();
    Reflect.deleteProperty(note.files?.[0] ?? {}, field);
    expect(run(note)).toContain(`files[0].${field}`);
  });

  it('entrada con versión distinta de Update 010', () => {
    const note = aNote();
    const first = note.files?.[0] ?? {};
    first.version = 'Update 009';
    expect(run(note)).toContain('files[0].version');
  });

  it('nota sin entradas', () => {
    expect(run({ ...aNote(), files: [] }, ['README.md', PROVENANCE_PATH])).toContain('files');
  });

  it('Scenario: Entrada repetida', () => {
    const note = aNote();
    note.files = [...(note.files ?? []), entry(ARROW, SHA_B, 20)];
    const out = run(note);
    expect(out).toContain(ARROW);
    expect(out).toMatch(/repetid/i);
  });

  it('Scenario: Origen del Free Pack', () => {
    const warrior = 'public/assets/tinyswords/Warrior.png';
    const note = aNote();
    note.files = [
      ...(note.files ?? []),
      {
        path: warrior,
        source: 'Tiny Swords (Free Pack)/Units/Blue Units/Warrior/Warrior_Idle.png',
        version: 'Update 010',
        sha256: 'f'.repeat(64),
        bytes: 1,
      },
    ];
    const out = run(note, [...FILES, warrior]);
    expect(out).toContain(warrior);
    expect(out).toContain('Free Pack');
  });
});

describe('guard-assets · lista de ficheros versionados (spec asset-provenance)', () => {
  it.each([
    'public/assets/extra/Goblin_Red.png',
    'docs/captura.jpg',
    'public/assets/Tree.PNG',
    'src/icon.svg',
    'favicon.ico',
    'a/b.webp',
    'c.gif',
    'd.jpeg',
    'e.bmp',
  ])('Scenario: PNG sin registrar / fuera de la carpeta / mayúsculas (%s)', (extra) => {
    const out = run(aNote(), [...FILES, extra]);
    expect(out).toContain(extra);
  });

  it('Scenario: Entrada sin fichero', () => {
    const out = run(
      aNote(),
      FILES.filter((f) => f !== ARROW),
    );
    expect(out).toContain(ARROW);
  });

  it.each([
    'public/assets/.DS_Store',
    'assets/Thumbs.db',
    'x/desktop.ini',
    'art/Archer.aseprite',
    'tiny-swords.zip',
    'a.rar',
    'b.7z',
    'c.tar',
    'd.tar.gz',
  ])('Scenario: Ficheros prohibidos (%s)', (extra) => {
    expect(run(aNote(), [...FILES, extra])).toContain(extra);
  });

  it('Scenario: Ruta del Free Pack en el repositorio (con entrada en la nota)', () => {
    const free = 'public/assets/Tiny Swords (Free Pack)/Warrior_Blue.png';
    const note = aNote();
    note.files = [
      ...(note.files ?? []),
      {
        path: free,
        source: 'Tiny Swords (Update 010)/Warrior_Blue.png',
        version: 'Update 010',
        sha256: 'f'.repeat(64),
        bytes: 1,
      },
    ];
    const out = run(note, [...FILES, free]);
    expect(out).toContain(free);
    expect(out).toContain('Free Pack');
  });

  it.each(['free_pack/x.txt', 'FreePack.md', 'docs/FREE PACK/a.md'])(
    'variantes de Free Pack sin distinguir mayúsculas (%s)',
    (extra) => {
      expect(run(aNote(), [...FILES, extra])).toContain(extra);
    },
  );

  it('sha256 distinto del fichero', () => {
    const note = aNote();
    const first = note.files?.[0] ?? {};
    first.sha256 = 'c'.repeat(64);
    const out = run(note);
    expect(out).toContain(ARCHER);
    expect(out).toContain('sha256');
  });

  it('bytes distintos del fichero', () => {
    const note = aNote();
    const second = note.files?.[1] ?? {};
    second.bytes = 21;
    const out = run(note);
    expect(out).toContain(ARROW);
    expect(out).toContain('bytes');
  });

  it('assets sin nota de procedencia', () => {
    const out = run(undefined);
    expect(out).toContain(ARCHER);
    expect(out).toContain(PROVENANCE_PATH);
  });

  it('un repositorio sin assets ni nota pasa', () => {
    expect(run(undefined, ['README.md', 'src/main.ts'])).toBe('');
  });
});

describe('guard-assets · estado real del repositorio', () => {
  const versioned = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const notePath = join(root, PROVENANCE_PATH);
  const real = existsSync(notePath)
    ? (JSON.parse(readFileSync(notePath, 'utf8')) as Provenance)
    : undefined;
  const diskDigest = (path: string): Digest => {
    const blob = readFileSync(join(root, path));
    return { sha256: createHash('sha256').update(blob).digest('hex'), bytes: blob.length };
  };

  it('Scenario: Nota del repositorio', () => {
    expect(real).toMatchObject({
      pack: 'Tiny Swords',
      author: 'Pixel Frog',
      version: 'Update 010',
      license: 'CC0',
      confirmedOn: '2026-11-22',
    });
    const entries = real?.files ?? [];
    expect(entries.length).toBeGreaterThanOrEqual(1);
    for (const e of entries) {
      expect(e.path?.length ?? 0).toBeGreaterThan(0);
      expect(e.source?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('Scenario: Estado real del repositorio', () => {
    expect(checkAssets({ files: versioned, provenance: real, digest: diskDigest })).toEqual([]);
  });

  it('la nota del repositorio no enlaza capturas ni pruebas de la confirmación', () => {
    expect(JSON.stringify(real ?? {})).not.toMatch(/\.(png|jpe?g|pdf)"?\s*[,}]\s*$/m);
    // 0032: `fonts` es la lista aparte de las fuentes (OFL), fuera de la cabecera CC0; 0034:
    // `generated` (imágenes con IA) y `generatedPolicy` (su ADR); 0035: `sounds` (audio CC0).
    expect(Object.keys(real ?? {}).sort()).toEqual(
      [
        'sounds',
        'author',
        'confirmedOn',
        'files',
        'fonts',
        'generated',
        'generatedPolicy',
        'homepage',
        'license',
        'note',
        'pack',
        'version',
      ].sort(),
    );
  });

  it('Scenario: PNG sin registrar (lista real + public/assets/extra/Goblin_Red.png)', () => {
    const extra = 'public/assets/extra/Goblin_Red.png';
    const out = checkAssets({
      files: [...versioned, extra],
      provenance: real,
      digest: (p) => (p === extra ? { sha256: '', bytes: 0 } : diskDigest(p)),
    });
    expect(out.join('\n')).toContain(extra);
  });
});

// Spec asset-provenance (0034, design D8): lista `generated[]` de imágenes con IA. La nota real aún no
// tiene entradas IA (llegan en la tarea 6.1): se simula con una entrada de prueba para `armor`.
describe('guard-assets · imágenes con IA (spec asset-provenance 0034)', () => {
  const ICON = 'public/assets/icons/armor.png';
  const ADR = 'docs/adr/0030-imagenes-generadas-con-ia-solo-para-iconos.md';
  const SCRIPT = 'scripts/icons/remove-white-bg.ps1';
  const SHA_I = 'c'.repeat(64);
  const aiFiles = [...FILES, ADR, SCRIPT, ICON];
  const aiDigest = (path: string): Digest =>
    path === ICON ? { sha256: SHA_I, bytes: 300 } : digest(path);
  const anAiEntry = (): Record<string, unknown> => ({
    path: ICON,
    tool: 'Herramienta de prueba (modelo X)',
    createdOn: '2026-11-26',
    terms: 'https://ejemplo.com/terminos (leídos 2026-11-26)',
    prompt: 'Icono pixel art de un escudo de roble, fondo blanco.',
    postProcess: SCRIPT,
    sha256: SHA_I,
    bytes: 300,
  });
  const anAiNote = (generated: Record<string, unknown>[] = [anAiEntry()]): Provenance => ({
    ...aNote(),
    generatedPolicy: ADR,
    generated,
  });
  const aiRun = (
    note: Provenance = anAiNote(),
    files: string[] = aiFiles,
    digestOf: (path: string) => Digest = aiDigest,
  ): string => checkAssets({ files, provenance: note, digest: digestOf }).join('\n');

  it('Scenario: Imagen con IA sin versión del pack (nota con una entrada IA completa pasa)', () => {
    expect(aiRun()).toBe('');
  });

  it.each([
    ['tool', { tool: undefined }],
    ['createdOn', { createdOn: '26/11/2026' }],
    ['createdOn', { createdOn: '2026-02-30' }],
    ['terms', { terms: '' }],
    ['prompt', { prompt: '' }],
    ['sha256', { sha256: `d${SHA_I.slice(1)}` }],
    ['bytes', { bytes: 301 }],
    ['version', { version: 'Update 010' }],
    ['postProcess', { postProcess: 'scripts/no-existe.ps1' }],
  ])('Scenario: Registro de imagen con IA incompleto o incorrecto (%s: %j)', (field, change) => {
    const out = aiRun(anAiNote([{ ...anAiEntry(), ...change }]));
    expect(out).toContain(ICON);
    expect(out).toContain(field);
  });

  it('el sha distinto incluye el sha medido', () => {
    const out = aiRun(anAiNote([{ ...anAiEntry(), sha256: 'e'.repeat(64) }]));
    expect(out).toContain(SHA_I);
  });

  it('Scenario: Imagen con IA sin registro', () => {
    const extra = 'public/assets/icons/extra.png';
    expect(aiRun(anAiNote(), [...aiFiles, extra])).toContain(extra);
  });

  it('Scenario: Registro de imagen con IA sin fichero', () => {
    expect(
      aiRun(
        anAiNote(),
        aiFiles.filter((f) => f !== ICON),
      ),
    ).toContain(ICON);
  });

  it('Scenario: Imagen con IA fuera de los iconos', () => {
    const torch = `${BASE}/Factions/Goblins/Troops/Torch/Torch_IA.png`;
    const note = anAiNote([anAiEntry(), { ...anAiEntry(), path: torch }]);
    const out = aiRun(note, [...aiFiles, torch]);
    expect(out).toContain(torch);
    expect(out).toContain('public/assets/icons/');
  });

  it('Scenario: Política sin ADR', () => {
    const missing = 'docs/adr/0099-no-existe.md';
    expect(aiRun({ ...anAiNote(), generatedPolicy: missing })).toContain(missing);
  });

  it('la política es obligatoria con imágenes con IA', () => {
    const note = anAiNote();
    Reflect.deleteProperty(note, 'generatedPolicy');
    expect(aiRun(note)).toContain('generatedPolicy');
  });

  it('la política debe estar bajo docs/adr/', () => {
    expect(aiRun({ ...anAiNote(), generatedPolicy: 'README.md' })).toContain('README.md');
  });

  it('Scenario: Ruta en dos listas', () => {
    const note = anAiNote();
    note.files = [
      ...(note.files ?? []),
      {
        path: ICON,
        source: 'Tiny Swords (Update 010)/armor.png',
        version: 'Update 010',
        sha256: SHA_I,
        bytes: 300,
      },
    ];
    const out = aiRun(note);
    expect(out).toContain(ICON);
    expect(out).toMatch(/dos listas/);
  });

  it('un icono de la carpeta IA registrado solo en la lista de arte falla', () => {
    const artIcon: Entry = {
      path: ICON,
      source: 'Tiny Swords (Update 010)/x.png',
      version: 'Update 010',
      sha256: SHA_I,
      bytes: 300,
    };
    const note: Provenance = { ...aNote(), files: [...(aNote().files ?? []), artIcon] };
    expect(aiRun(note)).toContain('lista de arte');
  });

  it('entrada IA repetida', () => {
    const out = aiRun(anAiNote([anAiEntry(), anAiEntry()]));
    expect(out).toContain(ICON);
    expect(out).toMatch(/repetid/i);
  });

  it('en la carpeta de iconos solo .png', () => {
    const gif = 'public/assets/icons/armor.gif';
    expect(aiRun(anAiNote(), [...aiFiles, gif])).toContain(gif);
  });

  it('Scenario: Imágenes con IA sin red (checkAssets es síncrona y pura)', () => {
    const out = checkAssets({ files: aiFiles, provenance: anAiNote(), digest: aiDigest });
    expect(Array.isArray(out)).toBe(true);
    expect(out).toEqual([]);
  });
});

// Spec asset-provenance (0032), "Procedencia y licencia de la fuente": lista `fonts` aparte.
describe('guard-assets · fuentes (spec asset-provenance 0032)', () => {
  const FONT_PATH = 'public/assets/fonts/DepartureMono-Regular.woff2';
  const LICENSE_PATH = 'public/assets/fonts/OFL.txt';
  const versioned = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const real = JSON.parse(readFileSync(join(root, PROVENANCE_PATH), 'utf8')) as Provenance & {
    fonts: Record<string, unknown>[];
  };
  const diskDigest = (path: string): Digest => {
    const blob = readFileSync(join(root, path));
    return { sha256: createHash('sha256').update(blob).digest('hex'), bytes: blob.length };
  };
  /** Lista real más lo que la nota registra (antes del primer `git add`). */
  const list = [
    ...new Set([
      ...versioned,
      ...(real.files ?? []).flatMap((f) => (f.path ? [f.path] : [])),
      FONT_PATH,
      LICENSE_PATH,
    ]),
  ];
  const fontRun = (
    files: string[],
    fonts: Record<string, unknown>[] = real.fonts,
    digestOf: (path: string) => Digest = diskDigest,
  ): string => checkAssets({ files, provenance: { ...real, fonts }, digest: digestOf }).join('\n');
  const withFont = (change: Record<string, unknown>): Record<string, unknown>[] => [
    { ...real.fonts[0], ...change },
  ];

  it('Scenario: Fuente registrada', () => {
    expect(fontRun(list)).toBe('');
    expect(real.fonts).toHaveLength(1);
    expect(real.fonts[0]).toMatchObject({
      path: FONT_PATH,
      family: 'Departure Mono',
      license: 'OFL-1.1',
      licenseFile: LICENSE_PATH,
    });
    expect(list).toContain(LICENSE_PATH);
    expect(readFileSync(join(root, LICENSE_PATH), 'utf8')).toContain(
      'SIL OPEN FONT LICENSE Version 1.1',
    );
    expect(real).toMatchObject({
      license: 'CC0',
      version: 'Update 010',
      confirmedOn: '2026-11-22',
    });
    expect((real.files ?? []).some((f) => f.path === FONT_PATH)).toBe(false);
  });

  it.each(['public/assets/fonts/Otra.woff2', 'public/assets/fonts/Otra.TTF', 'x/y.otf', 'a.woff'])(
    'Scenario: Fuente sin registro (%s)',
    (extra) => {
      const out = fontRun([...list, extra], real.fonts, (p) =>
        p === extra ? { sha256: '', bytes: 0 } : diskDigest(p),
      );
      expect(out).toContain(extra);
    },
  );

  it.each([
    ['license', { license: 'CC0' }],
    ['author', { author: undefined }],
    ['licenseFile', { licenseFile: undefined }],
    ['sha256', { sha256: `0${String(real.fonts[0]?.sha256).slice(1)}` }],
  ])('Scenario: Registro de fuente incompleto (%s)', (field, change) => {
    const fonts = withFont(change);
    if (field === 'sha256' && fonts[0]?.sha256 === real.fonts[0]?.sha256) {
      fonts[0] = { ...fonts[0], sha256: `1${String(real.fonts[0]?.sha256).slice(1)}` };
    }
    const out = fontRun(list, fonts);
    expect(out).toContain(FONT_PATH);
    expect(out).toContain(field);
  });

  it('Scenario: Licencia de la fuente sin versionar', () => {
    expect(fontRun(list.filter((f) => f !== LICENSE_PATH))).toContain(LICENSE_PATH);
  });

  it('Scenario: Registro sin fichero', () => {
    expect(fontRun(list.filter((f) => f !== FONT_PATH))).toContain(FONT_PATH);
  });
});

// Spec asset-provenance (0034) con la nota real: `generated[]` de los 18 iconos (design D8).
describe('guard-assets · imágenes con IA del repositorio (asset-provenance 0034)', () => {
  type AiEntry = Record<string, unknown> & { path: string };
  const versioned = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const real = JSON.parse(readFileSync(join(root, PROVENANCE_PATH), 'utf8')) as Provenance & {
    generated: AiEntry[];
    generatedPolicy: string;
    fonts: unknown[];
  };
  const appearance = JSON.parse(readFileSync(join(root, 'content/appearance.json'), 'utf8')) as {
    icons: { fallback: Record<string, string>; byId: Record<string, string> };
  };
  const diskDigest = (path: string): Digest => {
    const blob = readFileSync(join(root, path));
    return { sha256: createHash('sha256').update(blob).digest('hex'), bytes: blob.length };
  };
  const ICON_DIR = 'public/assets/icons/';
  const ARMOR = `${ICON_DIR}armor.png`;
  const runReal = (generated: AiEntry[] = real.generated, files = versioned): string =>
    checkAssets({ files, provenance: { ...real, generated }, digest: diskDigest }).join('\n');
  const withArmor = (change: Record<string, unknown>): AiEntry[] =>
    real.generated.map((e) => (e.path === ARMOR ? { ...e, ...change } : e));

  it('Scenario: Lista del repositorio (una entrada por imagen de los datos de iconos)', () => {
    expect(runReal()).toBe('');
    const used = [
      ...Object.values(appearance.icons.byId),
      ...Object.values(appearance.icons.fallback),
    ].map((f) => ICON_DIR + f);
    expect(real.generated.map((e) => e.path).sort()).toEqual([...new Set(used)].sort());
    for (const e of real.generated) {
      for (const field of ['tool', 'terms', 'prompt']) {
        expect(String(e[field]).trim().length, `${e.path} ${field}`).toBeGreaterThan(0);
      }
      expect(e.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect([e.sha256, e.bytes]).toEqual(Object.values(diskDigest(e.path)));
    }
    expect(versioned).toContain(real.generatedPolicy);
    expect(real.generatedPolicy.startsWith('docs/adr/')).toBe(true);
    // Cabecera y listas de arte y fuentes iguales campo a campo a las de antes del change: huella
    // sha256 de su JSON en la nota de 630ce53 (0032; el CI clona sin historia, no vale `git show`).
    const fingerprint = (v: unknown) =>
      createHash('sha256').update(JSON.stringify(v)).digest('hex');
    expect(real).toMatchObject({
      license: 'CC0',
      version: 'Update 010',
      confirmedOn: '2026-11-22',
    });
    expect([real.files?.length, fingerprint(real.files)]).toEqual([
      53,
      'c9a6a7ad8ff2e3dbd97a4cc27827ad5eef9accf0ed10c15193116433fec3c07b',
    ]);
    expect(fingerprint(real.fonts)).toBe(
      'bcc7bdcc17f0cc4e18cb2b7b1936b7a7a9b037d0bac1bc06e9a368b3d3aef019',
    );
  });

  it('Scenario: Icono registrado solo como imagen con IA', () => {
    const art = new Set((real.files ?? []).map((f) => f.path));
    const ai = real.generated.map((e) => e.path);
    const icons = versioned.filter((f) => f.startsWith(ICON_DIR) && f.endsWith('.png'));
    expect(icons.length).toBe(18);
    for (const icon of icons) {
      expect(
        ai.filter((p) => p === icon),
        icon,
      ).toHaveLength(1);
      expect(art.has(icon), icon).toBe(false);
    }
  });

  it('Scenario: Imagen con IA sin versión del pack (nota real: sin version ni source)', () => {
    for (const e of real.generated) {
      expect('version' in e || 'source' in e, e.path).toBe(false);
    }
    expect(runReal()).not.toMatch(/version|Free Pack/);
  });

  it.each([
    ['tool', { tool: undefined }],
    ['createdOn', { createdOn: '26/11/2026' }],
    ['createdOn', { createdOn: '2026-02-30' }],
    ['terms', { terms: '' }],
    ['prompt', { prompt: '' }],
    ['sha256', { sha256: 'x' }],
    ['bytes', { bytes: -1 }],
    ['version', { version: 'Update 010' }],
    ['postProcess', { postProcess: 'scripts/no-existe.ps1' }],
  ])(
    'Scenario: Registro de imagen con IA incompleto o incorrecto (nota real, %s)',
    (field, change) => {
      const armor = real.generated.find((e) => e.path === ARMOR) as AiEntry;
      const value =
        field === 'sha256'
          ? `${String(armor.sha256).startsWith('0') ? '1' : '0'}${String(armor.sha256).slice(1)}`
          : field === 'bytes'
            ? Number(armor.bytes) + 1
            : undefined;
      const patch = value === undefined ? change : { [field]: value };
      const out = runReal(withArmor(patch));
      expect(out).toContain(ARMOR);
      expect(out).toContain(field);
    },
  );

  it('Scenario: Imagen con IA sin registro (lista real + extra.png)', () => {
    const extra = `${ICON_DIR}extra.png`;
    const out = checkAssets({
      files: [...versioned, extra],
      provenance: real,
      digest: (p) => (p === extra ? { sha256: '', bytes: 0 } : diskDigest(p)),
    });
    expect(out.join('\n')).toContain(extra);
  });

  it('Scenario: Registro de imagen con IA sin fichero (nota real)', () => {
    expect(
      runReal(
        real.generated,
        versioned.filter((f) => f !== ARMOR),
      ),
    ).toContain(ARMOR);
  });

  it('Scenario: Política sin ADR (nota real)', () => {
    const missing = 'docs/adr/0099-no-existe.md';
    const out = checkAssets({
      files: versioned,
      provenance: { ...real, generatedPolicy: missing },
      digest: diskDigest,
    });
    expect(out.join('\n')).toContain(missing);
  });

  it('Scenario: Imágenes con IA sin red (nota real: síncrono, sin red ni herramienta)', () => {
    expect(runReal()).toBe('');
  });
});

// Spec asset-provenance (0035, design D13): lista `sounds[]` de audio CC0. La nota real tiene la
// lista vacía hasta que lleguen los ficheros del autor (tarea 6.1): los casos simulan una entrada.
describe('guard-assets · audio (spec asset-provenance 0035)', () => {
  type SoundEntry = Record<string, unknown> & { path: string };
  const versioned = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const real = JSON.parse(readFileSync(join(root, PROVENANCE_PATH), 'utf8')) as Provenance & {
    sounds: SoundEntry[];
    generated: SoundEntry[];
  };
  const diskDigest = (path: string): Digest => {
    const blob = readFileSync(join(root, path));
    return { sha256: createHash('sha256').update(blob).digest('hex'), bytes: blob.length };
  };
  const MUSIC = 'public/assets/audio/music-loop.ogg';
  const HIT = 'public/assets/audio/hit.ogg';
  const SHA_S = 'c'.repeat(64);
  const SHA_M = 'd'.repeat(64);
  const SIMULATED = new Map<string, Digest>([
    [HIT, { sha256: SHA_S, bytes: 1200 }],
    [MUSIC, { sha256: SHA_M, bytes: 90_000 }],
  ]);
  const aSound = (path: string, sha256: string, bytes: number): SoundEntry => ({
    path,
    title: 'Impact Sounds',
    author: 'Kenney',
    url: 'https://kenney.nl/assets/impact-sounds',
    license: 'CC0',
    downloadedOn: '2026-11-25',
    sha256,
    bytes,
  });
  const SOUNDS = [aSound(MUSIC, SHA_M, 90_000), aSound(HIT, SHA_S, 1200)];
  const digest = (p: string): Digest => SIMULATED.get(p) ?? diskDigest(p);
  const runSounds = (
    sounds: SoundEntry[] = SOUNDS,
    files: string[] = [...versioned, MUSIC, HIT],
    note: Provenance = real,
  ): string => checkAssets({ files, provenance: { ...note, sounds }, digest }).join('\n');
  const withHit = (change: (e: SoundEntry) => void): SoundEntry[] =>
    SOUNDS.map((e) => {
      if (e.path !== HIT) return e;
      const copy = { ...e };
      change(copy);
      return copy;
    });

  it('la nota real con dos audios simulados y sus ficheros pasa', () => {
    expect(runSounds()).toBe('');
  });

  it('Scenario: Audio sin versión del pack (sin mensajes de versión ni Free Pack)', () => {
    expect(runSounds()).not.toMatch(/version|Free Pack/i);
  });

  it('Scenario: Audio sin red (las reglas no hacen peticiones: pasa con fetch roto)', () => {
    const saved = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('sin red'));
    try {
      expect(runSounds()).toBe('');
    } finally {
      globalThis.fetch = saved;
    }
  });

  it.each([
    'public/assets/extra/hit.ogg',
    'public/assets/extra/hit.MP3',
    'docs/demo.wav',
    'public/assets/extra/hit.FLAC',
  ])('Scenario: Audio sin registrar (%s)', (extra) => {
    expect(runSounds(SOUNDS, [...versioned, MUSIC, HIT, extra])).toContain(
      `${extra}: fichero de audio sin registro`,
    );
  });

  it.each([
    ['licencia CC-BY-NC-4.0', (e: SoundEntry) => (e['license'] = 'CC-BY-NC-4.0'), '"license"'],
    ['sin licencia', (e: SoundEntry) => delete e['license'], '"license"'],
    ['URL http', (e: SoundEntry) => (e['url'] = 'http://kenney.nl/assets/x'), '"url"'],
    ['URL de otro host', (e: SoundEntry) => (e['url'] = 'https://example.com/x.ogg'), '"url"'],
    ['sin autor', (e: SoundEntry) => delete e['author'], '"author"'],
    ['fecha 2026-13-01', (e: SoundEntry) => (e['downloadedOn'] = '2026-13-01'), '"downloadedOn"'],
    ['sha256 cambiado', (e: SoundEntry) => (e['sha256'] = `e${SHA_S.slice(1)}`), '"sha256"'],
    ['bytes + 1', (e: SoundEntry) => (e['bytes'] = 1201), '"bytes"'],
    ['campo extra attribution', (e: SoundEntry) => (e['attribution'] = 'x'), '"attribution"'],
  ])('Scenario: Registro de audio incompleto o incorrecto (%s)', (_name, change, field) => {
    const out = runSounds(withHit(change)).split('\n');
    expect(out.some((line) => line.includes(HIT) && line.includes(field))).toBe(true);
  });

  it('Scenario: Registro de audio incompleto o incorrecto (www. es válido)', () => {
    expect(runSounds(withHit((e) => (e['url'] = 'https://www.freesound.org/s/1/')))).toBe('');
  });

  it('Scenario: Registro de audio sin fichero', () => {
    expect(runSounds(SOUNDS, [...versioned, HIT])).toContain(
      `${MUSIC}: la nota lo registra como audio pero no está versionado`,
    );
  });

  it('Scenario: Audio en otra lista (también en la de imágenes con IA)', () => {
    const note = { ...real, generated: [...real.generated, { ...real.generated[0], path: HIT }] };
    expect(runSounds(SOUNDS, undefined, note)).toContain(HIT);
  });

  it('Scenario: Audio en otra lista (solo en la de arte)', () => {
    const note = { ...real, files: [...(real.files ?? []), entry(HIT, SHA_S, 1200)] };
    const out = runSounds([aSound(MUSIC, SHA_M, 90_000)], undefined, note);
    expect(out).toContain(`${HIT}: un fichero de audio solo puede registrarse en "sounds"`);
  });

  it('Scenario: Audio fuera de su carpeta', () => {
    const beep = 'public/assets/icons/beep.wav';
    SIMULATED.set(beep, { sha256: SHA_S, bytes: 1200 });
    const out = runSounds([...SOUNDS, aSound(beep, SHA_S, 1200)], [...versioned, MUSIC, HIT, beep]);
    expect(out).toContain(beep);
  });

  it('Scenario: Entrada repetida (lista de audio)', () => {
    expect(runSounds([...SOUNDS, aSound(HIT, SHA_S, 1200)])).toContain(
      `entrada repetida para ${HIT}`,
    );
  });

  it('Scenario: Ficheros prohibidos (comprimido de un pack de audio)', () => {
    const zip = 'public/assets/audio/kenney_rpg-audio.zip';
    expect(runSounds(SOUNDS, [...versioned, MUSIC, HIT, zip])).toContain(zip);
  });

  it.each(['public/assets/Hit.WAV', 'public/assets/Hit.FLAC'])(
    'Scenario: Mayúsculas en la extensión (%s)',
    (upper) => {
      expect(runSounds(SOUNDS, [...versioned, MUSIC, HIT, upper])).toContain(upper);
    },
  );

  it('Scenario: Audio sin registrar (un .flac en su carpeta, sin registro)', () => {
    const flac = 'public/assets/audio/receive-hit.flac';
    expect(runSounds(SOUNDS, [...versioned, MUSIC, HIT, flac])).toContain(
      `${flac}: fichero de audio sin registro`,
    );
  });

  it('la lista real de audio está vacía hasta que lleguen los ficheros del autor (tarea 6.1)', () => {
    expect(real.sounds).toEqual([]);
  });
});
