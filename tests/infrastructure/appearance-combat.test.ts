import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import guideJson from '../../content/guide.json';
import { bootContent } from '../../src/composition/contentBoot';
import {
  BAR_FILL_MUST_DIFFER,
  BAR_SIZE_MUST_BE_INTEGER,
  HIT_COLORS_MUST_DIFFER,
  NUMBER_DURATION_MUST_BE_INTEGER,
  NUMBER_FONT_MUST_BE_INTEGER,
  NUMBER_POOL_MUST_BE_INTEGER,
  PLAYER_HIT_MUST_BE_RED,
} from '../../src/infrastructure/content/appearanceSchema';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance, type RawAppearance } from '../support/appearance';
import { rawContent } from '../support/builders';

// Spec sprite-rendering (0031), "Datos de aspecto del combate".
const root = join(import.meta.dirname, '..', '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));
const provenance = readJson('content/asset-provenance.json') as { files: { path: string }[] };
const registered = provenance.files.map((f) => f.path);

/** Entradas de la nota de procedencia antes de este change (0030). */
const PROVENANCE_ENTRIES_BEFORE = 45;

function repository() {
  const r = parseAppearance(readJson('content/appearance.json'), registered);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

type Combat = RawAppearance['combat'];

function failure(change: (c: Combat) => void): { field: string; message: string } {
  const raw = rawAppearance();
  change(raw.combat);
  const r = parseAppearance(raw, REGISTERED);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return r.error;
}

describe('Datos de aspecto del combate (sprite-rendering 0031)', () => {
  it('Scenario: Datos de combate del repositorio', () => {
    const { colors, numbers, bar } = repository().combat;
    const values = [colors.enemy, colors.structure, colors.sheep, colors.player];
    expect(new Set(values).size).toBe(4);
    expect(colors.player >> 16).toBeGreaterThanOrEqual(192);
    expect((colors.player >> 8) & 0xff).toBeLessThanOrEqual(80);
    expect(colors.player & 0xff).toBeLessThanOrEqual(80);
    expect(numbers).toEqual({ durationMs: 800, risePx: 32, liftPx: 20, fontPx: 16, pool: 48 });
    expect([bar.width, bar.height, bar.gap]).toEqual([48, 6, 8]);
    expect(bar.fill).not.toBe(bar.back);
  });

  it.each([
    ['sin color de sheep', (c: Combat) => delete c.colors.sheep, 'combat.colors.sheep', null],
    [
      'structure igual a enemy',
      (c: Combat) => (c.colors.structure = c.colors.enemy),
      'combat.colors.structure',
      HIT_COLORS_MUST_DIFFER,
    ],
    [
      'player #3080FF',
      (c: Combat) => (c.colors.player = '#3080FF'),
      'combat.colors.player',
      PLAYER_HIT_MUST_BE_RED,
    ],
    [
      'L 0',
      (c: Combat) => (c.numbers.durationMs = 0),
      'combat.numbers.durationMs',
      NUMBER_DURATION_MUST_BE_INTEGER,
    ],
    [
      'L 2,5',
      (c: Combat) => (c.numbers.durationMs = 2.5),
      'combat.numbers.durationMs',
      NUMBER_DURATION_MUST_BE_INTEGER,
    ],
    [
      'P 0',
      (c: Combat) => (c.numbers.pool = 0),
      'combat.numbers.pool',
      NUMBER_POOL_MUST_BE_INTEGER,
    ],
    [
      'letra 4',
      (c: Combat) => (c.numbers.fontPx = 4),
      'combat.numbers.fontPx',
      NUMBER_FONT_MUST_BE_INTEGER,
    ],
    ['ancho 0', (c: Combat) => (c.bar.width = 0), 'combat.bar.width', BAR_SIZE_MUST_BE_INTEGER],
    [
      'relleno igual al fondo',
      (c: Combat) => (c.bar.fill = c.bar.back),
      'combat.bar.fill',
      BAR_FILL_MUST_DIFFER,
    ],
    ['campo extra font', (c: Combat) => (c.font = 'serif'), 'combat.font', null],
  ])('Scenario: Datos de combate inválidos (%s)', (_name, change, field, message) => {
    const e = failure(change);
    expect(e.field).toBe(field);
    if (message !== null) expect(e.message).toBe(message);
  });

  it('Scenario: Datos de combate inválidos (no se muestra el menú: el arranque falla)', () => {
    const appearance = rawAppearance();
    appearance.combat.colors.player = '#3080FF';
    const errors: string[] = [];
    const booted = bootContent(
      { content: rawContent(), appearance, guide: guideJson },
      (e) => errors.push(e.field),
      REGISTERED,
    );
    expect(booted).toBeNull();
    expect(errors).toEqual(['combat.colors.player']);
  });

  it('Scenario: Sin assets nuevos', () => {
    // `npm run guard:all` (en `verify`) comprueba la procedencia; aquí, que el bloque no tiene hojas
    // y que la nota sigue con las mismas entradas.
    const block = JSON.stringify(
      (readJson('content/appearance.json') as { combat: unknown }).combat,
    );
    expect(block).not.toMatch(/\.png|sheet|file/);
    expect(provenance.files).toHaveLength(PROVENANCE_ENTRIES_BEFORE);
    expect(new Set(registered).size).toBe(PROVENANCE_ENTRIES_BEFORE);
  });
});
