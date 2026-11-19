import { describe, expect, it } from 'vitest';
import {
  ENEMY_DAMAGE_MUST_BE_POSITIVE,
  ENEMY_HEALTH_MUST_BE_POSITIVE,
  ENEMY_SPEED_MUST_BE_POSITIVE,
} from '../../src/domain/enemy/EnemyType';
import { Run } from '../../src/domain/run/Run';
import {
  INVULNERABILITY_TICKS_MUST_BE_INTEGER,
  MAX_BUDGET_BELOW_MAX_COST,
  PLAYER_HEALTH_MUST_BE_POSITIVE,
  SPEED_MUST_BE_POSITIVE,
  buildRunRules,
} from '../../src/domain/run/RunConfig';
import {
  MAX_ALIVE_MUST_BE_INTEGER,
  MAX_BUDGET_MUST_BE_POSITIVE,
} from '../../src/domain/wave/SpawnRules';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { aRunConfig, rawContent, type RawContent } from '../support/builders';
import { StubRandom } from '../support/random';

function failure(raw: RawContent): { field: string; message: string } {
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

/** Quita un campo del contenido crudo (para los casos "ausente"). */
function without(raw: RawContent, pick: (r: RawContent) => object, key: string): RawContent {
  Reflect.deleteProperty(pick(raw), key);
  return raw;
}

describe('Contenido de vida e invulnerabilidad validado', () => {
  it('Contenido válido: el dominio recibe velocidad 200, radio 16 y vida máxima 100', () => {
    const r = parseRunConfig(rawContent());
    expect(r.ok && r.value.player).toEqual({
      speed: 200,
      radius: 16,
      maxHealth: 100,
      invulnerabilityTicks: 30,
    });
  });

  it.each([0, -10])('Vida máxima cero o negativa (%s)', (maxHealth) => {
    const raw = rawContent();
    raw.player.maxHealth = maxHealth;
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'player.maxHealth',
      message: PLAYER_HEALTH_MUST_BE_POSITIVE,
    });
  });

  it('Vida máxima ausente', () => {
    const raw = without(rawContent(), (r) => r.player, 'maxHealth');
    expect(failure(raw).field).toBe('player.maxHealth');
  });

  it('Vida máxima mínima válida: la partida empieza con vida 1', () => {
    const raw = rawContent();
    raw.player.maxHealth = 1;
    const config = parseRunConfig(raw);
    if (!config.ok) throw new Error(config.error.message);
    expect(config.value.player.maxHealth).toBe(1);
    expect(Run.start(config.value, new StubRandom(0.5)).ok).toBe(true);
  });

  it.each([
    ['Duración cero', 0],
    ['Duración negativa', -1],
    ['duración no entera', 1.5],
  ])('%s de invulnerabilidad', (_name, invulnerabilityTicks) => {
    const raw = rawContent();
    raw.player.invulnerabilityTicks = invulnerabilityTicks;
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'player.invulnerabilityTicks',
      message: INVULNERABILITY_TICKS_MUST_BE_INTEGER,
    });
  });

  it('duración de invulnerabilidad ausente', () => {
    const raw = without(rawContent(), (r) => r.player, 'invulnerabilityTicks');
    expect(failure(raw).field).toBe('player.invulnerabilityTicks');
  });
});

describe('Contenido de enemigos y oleadas validado · vida, daño y máximo de presupuesto', () => {
  it.each([0, -5])('Vida cero o negativa (health %s)', (health) => {
    const raw = rawContent();
    raw.enemies.types[0].health = health;
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'enemies.types.0.health',
      message: ENEMY_HEALTH_MUST_BE_POSITIVE,
    });
  });

  it('Daño cero', () => {
    const raw = rawContent();
    raw.enemies.types[0].damage = 0;
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'enemies.types.0.damage',
      message: ENEMY_DAMAGE_MUST_BE_POSITIVE,
    });
  });

  it.each(['damage', 'health'])('%s ausente', (key) => {
    const raw = without(rawContent(), (r) => r.enemies.types[0], key);
    expect(failure(raw).field).toBe(`enemies.types.0.${key}`);
  });

  it.each([0, -1])('Máximo de presupuesto no positivo (%s)', (maxBudget) => {
    const raw = rawContent();
    raw.waves.maxBudget = maxBudget;
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'waves.maxBudget',
      message: MAX_BUDGET_MUST_BE_POSITIVE,
    });
  });

  it('maxBudget ausente', () => {
    const raw = without(rawContent(), (r) => r.waves, 'maxBudget');
    expect(failure(raw).field).toBe('waves.maxBudget');
  });

  it('Máximo de presupuesto menor que el coste más caro (2,5 con coste 3)', () => {
    const raw = rawContent();
    raw.waves.maxBudget = 2.5;
    const e = failure(raw);
    expect(e.field).toBe('waves.maxBudget');
    expect(e.message).toContain(MAX_BUDGET_BELOW_MAX_COST);
  });

  it('Valores de cada tipo llegan al dominio', () => {
    const raw = rawContent();
    Object.assign(raw.enemies.types[0], { speed: 90, radius: 10, cost: 1, health: 5, damage: 10 });
    const config = parseRunConfig(raw);
    if (!config.ok) throw new Error(config.error.message);
    const rules = buildRunRules(config.value);
    const bug = rules.ok ? rules.value.catalog.get('bug') : undefined;
    expect(bug).toMatchObject({ speed: 90, radius: 10, cost: 1, health: 5, damage: 10 });
  });
});

describe('Contenido del jugador validado', () => {
  it('Contenido válido', () => {
    const r = parseRunConfig(rawContent());
    expect(r.ok && r.value).toEqual(aRunConfig());
  });

  it('Velocidad negativa', () => {
    const raw = rawContent();
    raw.player.speed = -5;
    expect(failure(raw).field).toBe('player.speed');
  });

  it('velocidad 0: zod y el dominio la rechazan con el mismo campo y mensaje', () => {
    const raw = rawContent();
    raw.player.speed = 0;
    const domain = buildRunRules(aRunConfig({ speed: 0 }));
    expect(domain.ok).toBe(false);
    if (!domain.ok) expect(failure(raw)).toEqual(domain.error);
    expect(failure(raw).message).toBe(SPEED_MUST_BE_POSITIVE);
  });

  it('Radio que no cabe en la arena (jugador)', () => {
    const raw = rawContent();
    raw.player.radius = 300;
    expect(failure(raw).field).toBe('player.radius');
  });

  it('rechaza campos desconocidos y tipos erróneos', () => {
    const wrongType = rawContent() as unknown as { player: { speed: unknown } };
    wrongType.player.speed = '200';
    expect(parseRunConfig(wrongType as RawContent).ok).toBe(false);
    const extra = rawContent();
    Object.assign(extra.player, { hp: 3 });
    expect(parseRunConfig(extra).ok).toBe(false);
    const fractional = rawContent();
    fractional.arena.width = 9.5;
    expect(parseRunConfig(fractional).ok).toBe(false);
  });
});

describe('Contenido de enemigos y oleadas validado · forma y rangos (zod)', () => {
  it('Velocidad cero', () => {
    const raw = rawContent();
    raw.enemies.types[0].speed = 0;
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'enemies.types.0.speed',
      message: ENEMY_SPEED_MUST_BE_POSITIVE,
    });
  });

  it.each([0, 12.5])('Tope de vivos no entero (maxAlive %s)', (maxAlive) => {
    const raw = rawContent();
    raw.waves.maxAlive = maxAlive;
    expect(failure(raw)).toMatchObject({
      field: 'waves.maxAlive',
      message: MAX_ALIVE_MUST_BE_INTEGER,
    });
  });

  it.each([
    ['enemies.types.0.radius', (r: RawContent) => (r.enemies.types[0].radius = 0)],
    ['enemies.types.0.cost', (r: RawContent) => (r.enemies.types[0].cost = -1)],
    ['arena.view.width', (r: RawContent) => (r.arena.view.width = 0)],
    ['arena.view.height', (r: RawContent) => (r.arena.view.height = -2)],
    ['waves.spawn.margin', (r: RawContent) => (r.waves.spawn.margin = -1)],
    ['waves.spawn.minDistance', (r: RawContent) => (r.waves.spawn.minDistance = -1)],
    ['waves.spawn.maxAttempts', (r: RawContent) => (r.waves.spawn.maxAttempts = 1.5)],
    [
      'waves.segments.1.budgetPerSecond',
      (r: RawContent) => (r.waves.segments[1].budgetPerSecond = -1),
    ],
    ['waves.segments.0.types', (r: RawContent) => (r.waves.segments[0].types = [])],
    ['enemies.types.0.id', (r: RawContent) => (r.enemies.types[0].id = 'Bug 1')],
  ])('rechaza un valor fuera de rango en %s', (field, mutate) => {
    const raw = rawContent();
    mutate(raw);
    expect(failure(raw).field).toBe(field);
  });

  it('rechaza un tramo vacío de la tabla', () => {
    const raw = rawContent();
    (raw.waves as { segments: unknown[] }).segments = [];
    expect(failure(raw).field).toBe('waves.segments');
  });

  it('rechaza campos desconocidos en enemigos, oleadas y vista', () => {
    const inType = rawContent();
    Object.assign(inType.enemies.types[0], { hp: 3 });
    const inSpawn = rawContent();
    Object.assign(inSpawn.waves.spawn, { jitter: 1 });
    const inView = rawContent();
    Object.assign(inView.arena.view, { zoom: 2 });
    expect([
      parseRunConfig(inType).ok,
      parseRunConfig(inSpawn).ok,
      parseRunConfig(inView).ok,
    ]).toEqual([false, false, false]);
  });
});

describe('Contenido de enemigos y oleadas validado · reglas cruzadas (dominio desde zod)', () => {
  it('Oleada con un tipo inexistente', () => {
    const raw = rawContent();
    raw.waves.segments[0].types = ['bug', 'segfault'];
    const e = failure(raw);
    expect(e.field).toBe('waves.segments.0.types.1');
    expect(e.message).toContain('segfault');
  });

  it('Radio que no cabe en la arena', () => {
    const raw = rawContent();
    raw.enemies.types[0].radius = 300;
    expect(failure(raw).field).toBe('enemies.types.0.radius');
  });

  it('Radio en el límite exacto', () => {
    const raw = rawContent();
    raw.enemies.types[0].radius = 270;
    expect(parseRunConfig(raw).ok).toBe(true);
  });

  it('Identificador duplicado', () => {
    const raw = rawContent();
    raw.enemies.types[1].id = 'bug';
    expect(failure(raw).field).toBe('enemies.types.1.id');
  });

  it('Primer tramo que no empieza en 0', () => {
    const raw = rawContent();
    raw.waves.segments[0].fromSecond = 5;
    expect(failure(raw).field).toBe('waves.segments.0.fromSecond');
  });

  it('Tramos desordenados o repetidos', () => {
    const raw = rawContent();
    raw.waves.segments = [
      { fromSecond: 0, budgetPerSecond: 1, types: ['bug'] },
      { fromSecond: 60, budgetPerSecond: 1, types: ['bug'] },
      { fromSecond: 60, budgetPerSecond: 1, types: ['bug'] },
    ];
    expect(failure(raw).field).toBe('waves.segments.2.fromSecond');
  });
});

describe('Contenido por defecto del repositorio', () => {
  const loaded = loadRunConfig();
  const config = loaded.ok ? loaded.value : null;

  it('el contenido versionado es válido', () => {
    expect(loaded.ok).toBe(true);
  });

  it('Contenido por defecto', () => {
    const types = config?.enemies.types ?? [];
    expect(types.map((t) => t.id)).toEqual(['bug', 'memory-leak', 'merge-conflict']);
    for (const t of types) {
      expect(Math.min(t.speed, t.radius, t.cost, t.health, t.damage)).toBeGreaterThan(0);
    }
  });

  it('Oleadas que crecen con el contenido por defecto', () => {
    const budgets = (config?.waves.segments ?? []).map((s) => s.budgetPerSecond);
    expect(budgets.length).toBeGreaterThan(1);
    expect(budgets).toEqual([...budgets].sort((a, b) => a - b));
  });

  it('coincide con el contenido de la spec que usan los tests (aRunConfig)', () => {
    expect(config).toEqual(aRunConfig());
  });
});
