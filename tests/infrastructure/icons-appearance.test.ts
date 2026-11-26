import { describe, expect, it } from 'vitest';
import {
  ASSET_DIR,
  ICON_DIR,
  ICON_NOT_REGISTERED,
  SHEET_NOT_REGISTERED,
} from '../../src/infrastructure/content/appearanceSchema';
import {
  generatedPaths,
  iconFilesOf,
  parseAppearance,
  registeredPaths,
} from '../../src/infrastructure/content/loadAppearance';
import { ARROW_FILE, REGISTERED, rawAppearance, type RawAppearance } from '../support/appearance';

// Spec sprite-rendering (0034), "Datos de los iconos de mejora" e "Imágenes con IA solo en los
// iconos" (design D1/D8). Datos de prueba: la sección `icons` del repositorio llega en la tarea 6.1.
const ICON_FILES = ['fallback-character.png', 'fallback-weapon.png', 'armor.png', 'guardrail.png'];
const GENERATED = ICON_FILES.map((f) => ICON_DIR + f);

type RawIcons = {
  fallback: Record<string, unknown>;
  byId: Record<string, unknown>;
  [extra: string]: unknown;
};

function anIcons(): RawIcons {
  return {
    fallback: { character: 'fallback-character.png', weapon: 'fallback-weapon.png' },
    byId: { armor: 'armor.png', guardrail: 'guardrail.png' },
  };
}

function withIcons(change: (icons: RawIcons) => void = () => undefined): RawAppearance {
  const raw = rawAppearance();
  const icons = anIcons();
  change(icons);
  raw.icons = icons;
  return raw;
}

function failure(raw: RawAppearance): { field: string; message: string } {
  const r = parseAppearance(raw, REGISTERED, GENERATED);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return r.error;
}

describe('datos de los iconos de mejora (spec sprite-rendering 0034)', () => {
  it('una sección de iconos válida con sus ficheros en la lista IA pasa', () => {
    const r = parseAppearance(withIcons(), REGISTERED, GENERATED);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.icons?.byId).toEqual({ armor: 'armor.png', guardrail: 'guardrail.png' });
    expect(iconFilesOf(r.value).map(([path]) => path.join('.'))).toEqual([
      'icons.fallback.character',
      'icons.fallback.weapon',
      'icons.byId.armor',
      'icons.byId.guardrail',
    ]);
  });

  it('un mapa por id vacío es válido ("Mejora sin entrada")', () => {
    const r = parseAppearance(
      withIcons((i) => (i.byId = {})),
      REGISTERED,
      GENERATED,
    );
    expect(r.ok).toBe(true);
  });

  it('sin sección de iconos (transitorio, design D9) la carga pasa y no hay ficheros', () => {
    const r = parseAppearance(rawAppearance(), REGISTERED);
    expect(r.ok).toBe(true);
    if (r.ok) expect(iconFilesOf(r.value)).toEqual([]);
  });

  it('Scenario: Datos de iconos inválidos (sin la reserva de arma)', () => {
    const e = failure(withIcons((i) => Reflect.deleteProperty(i.fallback, 'weapon')));
    expect(e.field).toBe('icons.fallback.weapon');
  });

  it('Scenario: Datos de iconos inválidos (campo extra size)', () => {
    const e = failure(withIcons((i) => (i.size = 64)));
    expect(e.field).toBe('icons.size');
  });

  it.each([
    ['""', ''],
    ['"../armor.png"', '../armor.png'],
    ['"/armor.png"', '/armor.png'],
    ['URL https', 'https://ejemplo.com/armor.png'],
    ['data:', 'data:image/png;base64,AAAA'],
    ['"armor.gif"', 'armor.gif'],
    ['.png fuera de la nota', 'otro-armor.png'],
    ['hoja de Arrow.png (lista de arte)', ARROW_FILE],
  ])('Scenario: Datos de iconos inválidos (armor = %s)', (_label, file) => {
    const e = failure(withIcons((i) => (i.byId.armor = file)));
    expect(e.field).toBe('icons.byId.armor');
  });

  it('Scenario: Datos de iconos inválidos (reserva de personaje = la fuente)', () => {
    const e = failure(withIcons((i) => (i.fallback.character = 'DepartureMono-Regular.woff2')));
    expect(e.field).toBe('icons.fallback.character');
  });

  it('un icono cuyo nombre está en la lista de arte y no en la IA falla con ICON_NOT_REGISTERED', () => {
    const art = [...REGISTERED, `${ASSET_DIR}arrow.png`];
    const r = parseAppearance(
      withIcons((i) => (i.byId.armor = 'arrow.png')),
      art,
      GENERATED,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.field).toBe('icons.byId.armor');
    expect(r.error.message).toContain(ICON_NOT_REGISTERED);
  });
});

describe('imágenes con IA solo en los iconos (spec sprite-rendering 0034)', () => {
  // La hoja apunta al icono de `armor`; aunque su ruta figure en la lista IA, no vale como hoja.
  const ICON = 'armor.png';

  it('Scenario: Aspecto con una imagen con IA (hoja de goblin-torch)', () => {
    const raw = withIcons();
    const sheet = raw.enemies['goblin-torch']?.sheet as Record<string, unknown>;
    sheet.file = ICON;
    const e = failure(raw);
    expect(e.field).toBe('enemies.goblin-torch.sheet.file');
    expect(e.message).toBe(SHEET_NOT_REGISTERED);
  });

  it('Scenario: Aspecto con una imagen con IA (hoja de la oveja en pasto)', () => {
    const raw = withIcons();
    const idle = raw.sheep.idle as Record<string, Record<string, unknown>>;
    if (idle.sheet) idle.sheet.file = ICON;
    const e = failure(raw);
    expect(e.field).toBe('sheep.idle.sheet.file');
  });

  it('Scenario: Aspecto con una imagen con IA (pieza panel)', () => {
    const raw = withIcons();
    const panel = raw.ui.pieces.panel;
    if (panel) panel.image = ICON;
    const e = failure(raw);
    expect(e.field).toBe('ui.pieces.panel.image');
  });

  it('las listas de la nota se separan: generatedPaths no entra en registeredPaths', () => {
    const note = {
      files: [{ path: `${ASSET_DIR}${ARROW_FILE}` }],
      fonts: [{ path: 'public/assets/fonts/F.woff2' }],
      generated: [{ path: `${ICON_DIR}armor.png` }],
    };
    expect(registeredPaths(note)).toEqual([
      `${ASSET_DIR}${ARROW_FILE}`,
      'public/assets/fonts/F.woff2',
    ]);
    expect(generatedPaths(note)).toEqual([`${ICON_DIR}armor.png`]);
    expect(generatedPaths({ files: [] })).toEqual([]);
  });
});
