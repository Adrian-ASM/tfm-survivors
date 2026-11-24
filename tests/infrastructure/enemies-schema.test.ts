import { describe, expect, it } from 'vitest';
import {
  BEHAVIOR_INITIAL_UNKNOWN,
  BEHAVIOR_KIND_UNKNOWN,
  BEHAVIOR_STATE_REPEATED,
  BEHAVIOR_TARGET_UNKNOWN,
  BEHAVIOR_TICKS_MUST_BE_INTEGER,
  BEHAVIOR_VALUE_MUST_BE_POSITIVE,
} from '../../src/domain/enemy/behavior/Behavior';
import {
  BLAST_TICKS_MUST_BE_INTEGER,
  DYNAMITE_RADIUS_MUST_BE_POSITIVE,
  MAX_DYNAMITES_MUST_BE_INTEGER,
} from '../../src/domain/hazard/HazardRules';
import { ENEMY_DAMAGE_MUST_BE_POSITIVE } from '../../src/domain/enemy/EnemyType';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { BEHAVIOR_REQUIRED } from '../../src/infrastructure/content/schemas';
import { rawContent, type RawContent } from '../support/builders';

// Validación del comportamiento y de los peligros en content/enemies.json (0020, spec
// enemy-behavior, enemy-spawning y enemy-hazards). Tipos por defecto: 0 torch, 1 tnt, 2 barrel.

type State = Record<string, unknown>;
const TORCH = 0;
const TNT = 1;
const BARREL = 2;

function failure(raw: RawContent): { field: string; message: string } {
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

/** Estado `name` del tipo `i` del contenido crudo (mutable). */
function state(raw: RawContent, i: 0 | 1 | 2, name: string): State {
  const s = raw.enemies.types[i].behavior.states.find((x) => x['name'] === name);
  if (!s) throw new Error(`sin estado ${name}`);
  return s;
}

/** Cambia (o quita, con `undefined`) el campo con ruta `a.b` de un estado. */
function setField(s: State, field: string, value: unknown): void {
  const parts = field.split('.');
  const leaf = parts.pop() ?? '';
  const holder = parts.reduce<State>((o, k) => o[k] as State, s);
  if (value === undefined) Reflect.deleteProperty(holder, leaf);
  else holder[leaf] = value;
}

const edited = (edit: (raw: RawContent) => void): RawContent => {
  const raw = rawContent();
  edit(raw);
  return raw;
};

describe('Comportamiento por tipo en contenido (zod + buildRunRules)', () => {
  it('Scenario: Clase desconocida', () => {
    const e = failure(edited((r) => (state(r, BARREL, 'fuse')['kind'] = 'teleport')));
    expect(e.field).toBe('enemies.types.2.behavior.states.1.kind');
    expect(e.message).toContain(BEHAVIOR_KIND_UNKNOWN);
    expect(e.message).toContain('teleport');
    expect(e.message).toContain('goblin-barrel');
  });

  it('Scenario: Destino inexistente', () => {
    const e = failure(
      edited((r) => {
        const chase = state(r, TNT, 'approach');
        chase['exit'] = { distance: 140, to: 'hide' };
      }),
    );
    expect(e.field).toBe('enemies.types.1.behavior.states.0.exit.to');
    expect(e.message).toContain(BEHAVIOR_TARGET_UNKNOWN);
    expect(e.message).toContain('goblin-tnt');
    expect(e.message).toContain('hide');
  });

  it('Scenario: Estado inicial ausente o inexistente (ausente)', () => {
    const e = failure(
      edited((r) => Reflect.deleteProperty(r.enemies.types[TORCH].behavior, 'initial')),
    );
    expect(e.field).toBe('enemies.types.0.behavior.initial');
    expect(e.message).toContain(BEHAVIOR_INITIAL_UNKNOWN);
    expect(e.message).toContain('goblin-torch');
  });

  it('Scenario: Estado inicial ausente o inexistente (inexistente)', () => {
    const e = failure(edited((r) => (r.enemies.types[TORCH].behavior.initial = 'sleep')));
    expect(e.field).toBe('enemies.types.0.behavior.initial');
    expect(e.message).toContain('goblin-torch');
    expect(e.message).toContain('sleep');
  });

  it('Scenario: Nombre de estado repetido', () => {
    const e = failure(edited((r) => (state(r, TNT, 'reload')['name'] = 'aim')));
    expect(e.message).toContain(BEHAVIOR_STATE_REPEATED);
    expect(e.message).toContain('goblin-tnt');
    expect(e.message).toContain('aim');
  });

  it.each([
    ['distancia de salida 0', BARREL, 'approach', 'exit.distance', 0],
    ['distancia de salida −1', BARREL, 'approach', 'exit.distance', -1],
    ['radio de la mecha 0', BARREL, 'fuse', 'radius', 0],
    ['daño de la mecha −5', BARREL, 'fuse', 'damage', -5],
    ['radio de la dinamita 0', TNT, 'aim', 'dynamite.radius', 0],
    ['daño de la dinamita ausente', TNT, 'aim', 'dynamite.damage', undefined],
  ] as const)('Scenario: Parámetros no positivos (%s)', (_label, type, name, field, value) => {
    const e = failure(
      edited((r) => {
        setField(state(r, type, name), field, value);
      }),
    );
    const index = name === 'approach' ? 0 : 1;
    expect(e.field).toBe(`enemies.types.${String(type)}.behavior.states.${String(index)}.${field}`);
    expect(e.message).toContain(BEHAVIOR_VALUE_MUST_BE_POSITIVE);
    expect(e.message).toContain(type === BARREL ? 'goblin-barrel' : 'goblin-tnt');
  });

  it.each([
    ['mecha 0', BARREL, 'fuse', 'ticks', 0, 1],
    ['mecha negativa', BARREL, 'fuse', 'ticks', -3, 1],
    ['carga de 2,5 ticks', TNT, 'aim', 'ticks', 2.5, 1],
    ['vuelo 0', TNT, 'aim', 'dynamite.flightTicks', 0, 1],
    ['espera ausente', TNT, 'reload', 'ticks', undefined, 2],
  ] as const)('Scenario: Duraciones inválidas (%s)', (_l, type, name, field, value, index) => {
    const e = failure(
      edited((r) => {
        setField(state(r, type, name), field, value);
      }),
    );
    expect(e.field).toBe(`enemies.types.${String(type)}.behavior.states.${String(index)}.${field}`);
    expect(e.message).toContain(BEHAVIOR_TICKS_MUST_BE_INTEGER);
    expect(e.message).toContain(type === BARREL ? 'goblin-barrel' : 'goblin-tnt');
  });

  it('Scenario: Duración mínima válida', () => {
    const raw = edited((r) => {
      state(r, BARREL, 'fuse')['ticks'] = 1;
      const aim = state(r, TNT, 'aim');
      aim['ticks'] = 1;
      (aim['dynamite'] as State)['flightTicks'] = 1;
      state(r, TNT, 'reload')['ticks'] = 1;
    });
    expect(parseRunConfig(raw).ok).toBe(true);
  });

  it('un campo desconocido en un estado falla y se nombra', () => {
    const e = failure(edited((r) => (state(r, TNT, 'reload')['speed'] = 3)));
    expect(e.field).toBe('enemies.types.1.behavior.states.2.speed');
  });

  it('Scenario: Tipo sin comportamiento', () => {
    const e = failure(edited((r) => Reflect.deleteProperty(r.enemies.types[TORCH], 'behavior')));
    expect(e.field).toBe('enemies.types.0.behavior');
    expect(e.message).toContain(BEHAVIOR_REQUIRED);
    expect(e.message).toContain('goblin-torch');
  });

  it.each([0, -3])('Scenario: Daño cero o negativo (%s, zod)', (damage) => {
    const e = failure(edited((r) => (r.enemies.types[TORCH].damage = damage)));
    expect(e.field).toBe('enemies.types.0.damage');
    expect(e.message).toContain(ENEMY_DAMAGE_MUST_BE_POSITIVE);
    expect(e.message).toContain('goblin-torch');
  });
});

describe('Contenido de peligros validado', () => {
  it('Scenario: Contenido por defecto (forma)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const { maxDynamites, dynamiteRadius, blastTicks } = r.value.enemies.hazards;
    expect(Number.isInteger(maxDynamites) && maxDynamites >= 1).toBe(true);
    expect(dynamiteRadius).toBeGreaterThan(0);
    expect(Number.isInteger(blastTicks) && blastTicks >= 1).toBe(true);
  });

  it.each([0, -1, 2.5, undefined])('Scenario: Tope inválido (%s)', (value) => {
    const e = failure(
      edited((r) => {
        if (value === undefined) Reflect.deleteProperty(r.enemies.hazards, 'maxDynamites');
        else r.enemies.hazards.maxDynamites = value;
      }),
    );
    expect(e.field).toBe('enemies.hazards.maxDynamites');
    expect(e.message).toBe(MAX_DYNAMITES_MUST_BE_INTEGER);
  });

  it('Scenario: Tope mínimo', () => {
    expect(parseRunConfig(edited((r) => (r.enemies.hazards.maxDynamites = 1))).ok).toBe(true);
  });

  it.each([
    ['dynamiteRadius', 0, DYNAMITE_RADIUS_MUST_BE_POSITIVE],
    ['blastTicks', 0, BLAST_TICKS_MUST_BE_INTEGER],
    ['blastTicks', 1.5, BLAST_TICKS_MUST_BE_INTEGER],
  ] as const)('Scenario: Otros parámetros inválidos (%s %s)', (field, value, message) => {
    const e = failure(edited((r) => (r.enemies.hazards[field] = value)));
    expect(e).toMatchObject({ field: `enemies.hazards.${field}`, message });
  });

  it('Scenario: Otros parámetros inválidos (campo extra chainReaction)', () => {
    const e = failure(
      edited((r) => ((r.enemies.hazards as Record<string, unknown>)['chainReaction'] = true)),
    );
    expect(e.field).toBe('enemies.hazards.chainReaction');
  });
});
