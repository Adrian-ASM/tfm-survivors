import { describe, expect, it } from 'vitest';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance, type RawAppearance } from '../support/appearance';

// Spec sprite-rendering, "Datos de aspecto validados" (change 0012, design D9).
function failure(raw: RawAppearance): string {
  const r = parseAppearance(raw, REGISTERED);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return r.error.field;
}

type Torch = Record<string, Record<string, unknown>>;
const torch = (raw: RawAppearance): Torch => raw.enemies['goblin-torch'] as Torch;

describe('Datos de aspecto validados · forma y rangos', () => {
  it('el fixture mínimo es válido y convierte el color de reserva a número', () => {
    const r = parseAppearance(rawAppearance(), REGISTERED);
    if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
    expect(r.value.maxCorpses).toBe(64);
    expect(r.value.enemies['goblin-torch']?.placeholderColor).toBe(0xe5484d);
    expect(r.value.corpse.death.loop).toBe(false);
  });

  it.each([
    ['sheet', 'frameWidth', 0],
    ['sheet', 'frameHeight', 1.5],
    ['origin', 'x', 1.1],
    ['origin', 'y', -0.1],
    ['walk', 'fps', 0],
    ['walk', 'frames', []],
    ['walk', 'frames', [-1]],
    ['walk', 'frames', [1.5]],
  ])('Scenario: Valores fuera de rango (goblin-torch %s.%s = %j)', (group, field, value) => {
    const raw = rawAppearance();
    const target = torch(raw)[group] ?? {};
    target[field] = value;
    expect(failure(raw)).toMatch(new RegExp(`^enemies\\.goblin-torch\\.${group}\\.${field}`));
  });

  it.each([0, -1])('Scenario: Valores fuera de rango (goblin-torch scale = %s)', (scale) => {
    const raw = rawAppearance();
    (raw.enemies['goblin-torch'] ?? {}).scale = scale;
    expect(failure(raw)).toBe('enemies.goblin-torch.scale');
  });

  it.each([0, 2.5])('Scenario: Valores fuera de rango (tope de cadáveres %s)', (maxCorpses) => {
    const raw = rawAppearance();
    raw.maxCorpses = maxCorpses;
    expect(failure(raw)).toBe('maxCorpses');
  });

  it('color de reserva que no es #rrggbb', () => {
    const raw = rawAppearance();
    raw.gem.placeholderColor = 'azul';
    expect(failure(raw)).toBe('gem.placeholderColor');
  });

  it('orientación desconocida', () => {
    const raw = rawAppearance();
    raw.player.facing = 'up';
    expect(failure(raw)).toBe('player.facing');
  });
});

describe('Datos de aspecto validados · rutas de hoja (design D2)', () => {
  it.each([
    '',
    '../secreto.png',
    '/torch.png',
    'https://ejemplo.com/torch.png',
    'data:image/png;base64,AAAA',
    'torch.gif',
    'Factions/Goblins/Troops/Torch/Red/Otro.png',
    'Factions/../Torch_Red.png',
    'Factions\\Torch_Red.png',
  ])('Scenario: Rutas de hoja no admitidas (%j)', (file) => {
    const raw = rawAppearance();
    const sheet = torch(raw).sheet ?? {};
    sheet.file = file;
    expect(failure(raw)).toBe('enemies.goblin-torch.sheet.file');
  });

  it('una hoja registrada en la nota de procedencia es válida', () => {
    expect(parseAppearance(rawAppearance(), REGISTERED).ok).toBe(true);
  });

  it('sin nota de procedencia ninguna hoja es válida (nombra la primera)', () => {
    const r = parseAppearance(rawAppearance(), []);
    expect(r.ok ? '' : r.error.field).toBe('player.sheet.file');
  });
});

describe('Datos de aspecto validados · animaciones obligatorias y campos desconocidos', () => {
  it('Scenario: Animaciones obligatorias (jugador sin walk)', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(raw.player, 'walk');
    expect(failure(raw)).toBe('player.walk');
  });

  it('Scenario: Animaciones obligatorias (goblin-tnt sin idle)', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(raw.enemies['goblin-tnt'] ?? {}, 'idle');
    expect(failure(raw)).toBe('enemies.goblin-tnt.idle');
  });

  it('Scenario: Animaciones obligatorias (cadáver sin death)', () => {
    const raw = rawAppearance();
    Reflect.deleteProperty(raw.corpse, 'death');
    expect(failure(raw)).toBe('corpse.death');
  });

  it('Scenario: Animaciones obligatorias (death del cadáver en bucle)', () => {
    const raw = rawAppearance();
    (raw.corpse.death as Record<string, unknown>).loop = true;
    expect(failure(raw)).toBe('corpse.death.loop');
  });

  it('Scenario: Campos desconocidos (rotation: 90 en la gema)', () => {
    const raw = rawAppearance();
    raw.gem.rotation = 90;
    expect(failure(raw)).toMatch(/^gem/);
  });

  it.each(['projectile', 'gem', 'ground'] as const)('%s sin idle', (key) => {
    const raw = rawAppearance();
    Reflect.deleteProperty(raw[key], 'idle');
    expect(failure(raw)).toBe(`${key}.idle`);
  });

  it('campo desconocido en la raíz (el error lo nombra, desde 0015)', () => {
    const raw = rawAppearance();
    raw.sheets = {};
    expect(failure(raw)).toBe('sheets');
  });

  it('el aspecto del jugador ausente se nombra', () => {
    const raw = rawAppearance() as Partial<RawAppearance>;
    Reflect.deleteProperty(raw, 'player');
    expect(failure(raw as RawAppearance)).toBe('player');
  });
});
