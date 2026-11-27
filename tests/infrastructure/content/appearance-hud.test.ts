import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import guideJson from '../../../content/guide.json';
import audioJson from '../../../content/audio.json';
import { bootContent } from '../../../src/composition/contentBoot';
import {
  HUD_ICON_CROP_NOT_SQUARE,
  HUD_ICON_CROP_OUTSIDE,
  HUD_PITCH_BELOW_ICON,
  HUD_SIZE_MUST_BE_INTEGER,
} from '../../../src/infrastructure/content/appearanceSchema';
import {
  parseAppearance,
  registeredPaths,
} from '../../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance, type RawAppearance } from '../../support/appearance';
import { rawContent } from '../../support/builders';
import { GENERATED_PATHS, SOUND_PATHS } from '../../support/generated';

// Spec sprite-rendering (0036), "Datos de aspecto de los contadores del HUD".
const root = join(import.meta.dirname, '..', '..', '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));
const provenance = readJson('content/asset-provenance.json') as {
  files: { path: string }[];
  fonts: { path: string }[];
};

/** Entradas de la lista de arte de la nota antes de 0036 (45 de 0030 + 8 piezas de 0032). */
const PROVENANCE_FILES_BEFORE = 53;

function repository() {
  const raw = readJson('content/appearance.json');
  const r = parseAppearance(raw, registeredPaths(provenance), GENERATED_PATHS);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

type Hud = RawAppearance['hud'];

function failure(change: (h: Hud) => void): { field: string; message: string } {
  const raw = rawAppearance();
  change(raw.hud);
  const r = parseAppearance(raw, REGISTERED, GENERATED_PATHS);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return r.error;
}

const kills = (h: Hud) => h.icons.kills as Record<string, unknown>;

describe('Datos de aspecto de los contadores del HUD (sprite-rendering 0036)', () => {
  it('Scenario: Datos de los contadores del repositorio', () => {
    const { hud } = repository();
    expect(hud.iconSize).toBeGreaterThan(16);
    expect(hud.pitch).toBeGreaterThan(18);
    expect(hud.pitch).toBeGreaterThanOrEqual(hud.iconSize);
    expect(Number.isInteger(hud.icons.kills.frame)).toBe(true);
    // La nota de procedencia no gana entradas: la calavera es un frame de la hoja del cadáver.
    expect(provenance.files).toHaveLength(PROVENANCE_FILES_BEFORE);
    expect(JSON.stringify((readJson('content/appearance.json') as { hud: unknown }).hud)).not.toMatch(
      /\.png|sheet|file/,
    );
  });

  it.each([
    ['frame −1', (h: Hud) => (kills(h).frame = -1), 'hud.icons.kills.frame', null],
    ['frame 2,5', (h: Hud) => (kills(h).frame = 2.5), 'hud.icons.kills.frame', null],
    ['s 0', (h: Hud) => (h.iconSize = 0), 'hud.iconSize', HUD_SIZE_MUST_BE_INTEGER],
    ['p < s', (h: Hud) => (h.pitch = 20), 'hud.pitch', HUD_PITCH_BELOW_ICON],
    ['sin p', (h: Hud) => delete h.pitch, 'hud.pitch', null],
    ['campo extra glow', (h: Hud) => (kills(h).glow = true), 'hud.icons.kills.glow', null],
    [
      'recorte no cuadrado',
      (h: Hud) => ((h.icons.gold as { crop: Record<string, unknown> }).crop.height = 40),
      'hud.icons.gold.crop',
      HUD_ICON_CROP_NOT_SQUARE,
    ],
    [
      'recorte fuera del frame',
      (h: Hud) => ((h.icons.stone as { crop: Record<string, unknown> }).crop.x = 40),
      'hud.icons.stone.crop',
      HUD_ICON_CROP_OUTSIDE,
    ],
  ])('Scenario: Datos de los contadores inválidos (%s)', (_name, change, field, message) => {
    const e = failure(change);
    expect(e.field).toBe(field);
    if (message !== null) expect(e.message).toBe(message);
  });

  it('Scenario: Datos de los contadores inválidos (no se muestra el menú: el arranque falla)', () => {
    const appearance = rawAppearance();
    appearance.hud.pitch = 10;
    const errors: string[] = [];
    const booted = bootContent(
      { content: rawContent(), appearance, guide: guideJson, audio: audioJson },
      (e) => errors.push(e.field),
      REGISTERED,
      GENERATED_PATHS,
      SOUND_PATHS,
    );
    expect(booted).toBeNull();
    expect(errors).toEqual(['hud.pitch']);
  });
});
