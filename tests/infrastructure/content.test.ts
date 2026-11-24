import { describe, expect, it } from 'vitest';
import {
  ENEMY_DAMAGE_MUST_BE_POSITIVE,
  ENEMY_HEALTH_MUST_BE_POSITIVE,
  ENEMY_SPEED_MUST_BE_POSITIVE,
  ENEMY_XP_MUST_BE_INTEGER,
} from '../../src/domain/enemy/EnemyType';
import { Run } from '../../src/domain/run/Run';
import {
  INVULNERABILITY_TICKS_MUST_BE_INTEGER,
  MAX_BUDGET_BELOW_MAX_COST,
  PICKUP_RADIUS_MUST_BE_POSITIVE,
  PLAYER_HEALTH_MUST_BE_POSITIVE,
  SPEED_MUST_BE_POSITIVE,
  buildRunRules,
} from '../../src/domain/run/RunConfig';
import {
  MAX_ALIVE_MUST_BE_INTEGER,
  MAX_BUDGET_MUST_BE_POSITIVE,
} from '../../src/domain/wave/SpawnRules';
import { RUN_DURATION_MUST_BE_INTEGER } from '../../src/domain/run/RunDuration';
import { CELL_SIZE_BELOW_PLAYER } from '../../src/domain/map/MapRules';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import {
  SPAWN_RING_INSIDE_MAX_VIEW,
  WORLD_LOWER_THAN_VIEW,
  WORLD_NARROWER_THAN_VIEW,
} from '../../src/infrastructure/content/schemas';
import { aDefaultConfig, aRunConfig, rawContent, type RawContent } from '../support/builders';

type RawMap = RawContent['map'];
import { StubRandom } from '../support/random';

function failure(raw: RawContent): { field: string; message: string } {
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

/** Contenido crudo con un mundo explícito, tope 2.560 × 1.440 y anillo 1.500 explícitos (0017). */
function withArena(width: number, height: number): RawContent {
  const raw = rawContent();
  raw.arena = { width, height, maxView: { width: 2560, height: 1440 } };
  raw.waves.spawn.ringRadius = 1500;
  return raw;
}

/** Quita un campo del contenido crudo (para los casos "ausente"). */
function without(raw: RawContent, pick: (r: RawContent) => object, key: string): RawContent {
  Reflect.deleteProperty(pick(raw), key);
  return raw;
}

describe('Contenido de vida e invulnerabilidad validado', () => {
  it('Scenario: Radio de recogida por defecto (128, medido en apply)', () => {
    const r = loadRunConfig();
    expect(r.ok && r.value.player.pickupRadius).toBe(128);
  });

  // 0016 (gate): el usuario fija 215 con el castillo (28/50 en el prototipo; 24/50 con 210).
  it('Scenario: Velocidad del jugador por defecto (215 px/s, decidida en el gate de 0016)', () => {
    const r = loadRunConfig();
    expect(r.ok && r.value.player.speed).toBe(215);
  });

  // Spec enemy-spawning (0019): el tope por defecto pasa de 200 a 300 (GDD).
  it('Scenario: Tope por defecto (el dominio recibe maxAlive 300)', () => {
    const r = loadRunConfig();
    expect(r.ok && r.value.waves.maxAlive).toBe(300);
    const rules = r.ok ? buildRunRules(r.value) : null;
    expect(rules?.ok && rules.value.spawn.maxAlive).toBe(300);
  });

  // Spec run-outcome y enemy-spawning (0019): el presupuesto de oleadas, el anillo y la velocidad del
  // jugador son literalmente los de antes del change (main, c537a3f); solo cambia `maxAlive`.
  it('Scenario: Presupuesto de oleadas intacto (tramos, maxBudget, ringRadius y player.speed)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const { waves, player } = r.value;
    expect(waves.segments).toEqual([
      { fromSecond: 0, budgetPerSecond: 1.2, types: ['goblin-torch'] },
      { fromSecond: 60, budgetPerSecond: 2.4, types: ['goblin-torch', 'goblin-barrel'] },
      {
        fromSecond: 180,
        budgetPerSecond: 2.4,
        types: ['goblin-torch', 'goblin-barrel', 'goblin-tnt'],
      },
      {
        fromSecond: 300,
        budgetPerSecond: 3,
        types: ['goblin-torch', 'goblin-barrel', 'goblin-tnt'],
      },
      {
        fromSecond: 480,
        budgetPerSecond: 4.2,
        types: ['goblin-torch', 'goblin-barrel', 'goblin-tnt'],
      },
    ]);
    expect([waves.maxBudget, waves.spawn.ringRadius, player.speed]).toEqual([10, 1500, 215]);
  });

  it('Contenido válido: velocidad 215, radio 16, vida máxima 100 y radio de recogida 64', () => {
    const raw = rawContent();
    raw.player.pickupRadius = 64;
    const r = parseRunConfig(raw);
    expect(r.ok && r.value.player).toEqual({
      speed: 215,
      radius: 16,
      maxHealth: 100,
      invulnerabilityTicks: 30,
      pickupRadius: 64,
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
    const values = { speed: 90, radius: 10, cost: 1, health: 5, damage: 10, xp: 3 };
    Object.assign(raw.enemies.types[0], values);
    const config = parseRunConfig(raw);
    if (!config.ok) throw new Error(config.error.message);
    const rules = buildRunRules(config.value);
    const bug = rules.ok ? rules.value.catalog.get('goblin-torch') : undefined;
    expect(bug).toMatchObject(values);
  });
});

describe('XP de los enemigos y radio de recogida validados (0005)', () => {
  it('Scenario: XP por defecto de cada tipo (torch 1, barrel 2, tnt 4)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const xp = Object.fromEntries(r.value.enemies.types.map((t) => [t.id, t.xp]));
    expect(xp).toEqual({ 'goblin-torch': 1, 'goblin-barrel': 2, 'goblin-tnt': 4 });
  });

  it.each([0, -1, 1.5])('Scenario: XP inválida o ausente (xp %s)', (xp) => {
    const raw = rawContent();
    raw.enemies.types[0].xp = xp;
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'enemies.types.0.xp',
      message: ENEMY_XP_MUST_BE_INTEGER,
    });
  });

  it('Scenario: XP inválida o ausente (sin el campo xp)', () => {
    const raw = without(rawContent(), (r) => r.enemies.types[1], 'xp');
    expect(failure(raw).field).toBe('enemies.types.1.xp');
  });

  it.each([0, -1])('Scenario: Radio de recogida inválido o ausente (pickupRadius %s)', (v) => {
    const raw = rawContent();
    raw.player.pickupRadius = v;
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'player.pickupRadius',
      message: PICKUP_RADIUS_MUST_BE_POSITIVE,
    });
  });

  it('Scenario: Radio de recogida inválido o ausente (sin pickupRadius)', () => {
    const raw = without(rawContent(), (r) => r.player, 'pickupRadius');
    expect(failure(raw).field).toBe('player.pickupRadius');
  });
});

describe('Contenido del jugador validado', () => {
  it('Contenido válido', () => {
    const r = parseRunConfig(rawContent());
    expect(r.ok && r.value).toEqual(aDefaultConfig());
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

  it('Scenario: Radio que no cabe en la arena (jugador, 1.081 en 3.840 × 2.160)', () => {
    const raw = rawContent();
    raw.player.radius = 1081;
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
    ['arena.maxView.width', (r: RawContent) => (r.arena.maxView.width = 0)],
    ['arena.maxView.height', (r: RawContent) => (r.arena.maxView.height = -2)],
    ['waves.spawn.ringRadius', (r: RawContent) => (r.waves.spawn.ringRadius = 0)],
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

  // Spec world-camera (0017), "Tamaño del mundo y de la vista validados": tope de vista explícito.
  it('Scenario: Mundo más estrecho que el tope (2.559 × 2.160, tope 2.560 × 1.440)', () => {
    expect(failure(withArena(2559, 2160))).toMatchObject({
      field: 'arena.width',
      message: WORLD_NARROWER_THAN_VIEW,
    });
  });

  it('Scenario: Mundo más bajo que el tope (3.840 × 1.439, tope 2.560 × 1.440)', () => {
    expect(failure(withArena(3840, 1439))).toMatchObject({
      field: 'arena.height',
      message: WORLD_LOWER_THAN_VIEW,
    });
  });

  it('Scenario: Mundo igual al tope (2.560 × 1.440)', () => {
    expect(parseRunConfig(withArena(2560, 1440)).ok).toBe(true);
  });

  it.each([
    ['arena.width', (r: RawContent) => (r.arena.width = 0)],
    ['arena.height', (r: RawContent) => (r.arena.height = -1)],
    ['arena.maxView.width', (r: RawContent) => (r.arena.maxView.width = 0)],
  ])('Scenario: Dimensiones no positivas (%s)', (field, mutate) => {
    const raw = withArena(3840, 2160);
    mutate(raw);
    expect(failure(raw).field).toBe(field);
  });

  it('Scenario: Vista fija heredada (view extra → clave desconocida en arena.view)', () => {
    const raw = rawContent();
    Object.assign(raw.arena, { view: { width: 960, height: 540 } });
    expect(failure(raw).field).toBe('arena.view');
  });

  // Spec enemy-spawning (0017): el anillo queda fuera de cualquier vista (> media diagonal del tope).
  it.each([0, -1, 1468, 1468.6])(
    'Scenario: Radio del anillo fuera de rango (ringRadius %s, tope 2.560 × 1.440)',
    (ringRadius) => {
      const raw = withArena(3840, 2160);
      raw.waves.spawn.ringRadius = ringRadius;
      expect(failure(raw).field).toBe('waves.spawn.ringRadius');
    },
  );

  it('Scenario: Radio del anillo fuera de rango (sin ringRadius)', () => {
    const raw = without(withArena(3840, 2160), (r) => r.waves.spawn, 'ringRadius');
    expect(failure(raw).field).toBe('waves.spawn.ringRadius');
  });

  it('el anillo dentro del tope da SPAWN_RING_INSIDE_MAX_VIEW', () => {
    const raw = withArena(3840, 2160);
    raw.waves.spawn.ringRadius = 1468.6;
    expect(failure(raw).message).toBe(SPAWN_RING_INSIDE_MAX_VIEW);
  });

  it('Scenario: Radio del anillo en el límite (1.468,61)', () => {
    const raw = withArena(3840, 2160);
    raw.waves.spawn.ringRadius = 1468.61;
    expect(parseRunConfig(raw).ok).toBe(true);
  });

  it('Scenario: Margen heredado ("margin": 32 en spawn)', () => {
    const raw = withArena(3840, 2160);
    Object.assign(raw.waves.spawn, { margin: 32 });
    expect(failure(raw).field).toBe('waves.spawn.margin');
  });

  it('rechaza un tramo vacío de la tabla', () => {
    const raw = rawContent();
    (raw.waves as { segments: unknown[] }).segments = [];
    expect(failure(raw).field).toBe('waves.segments');
  });

  it('rechaza campos desconocidos en enemigos, oleadas y tope de vista', () => {
    const inType = rawContent();
    Object.assign(inType.enemies.types[0], { hp: 3 });
    const inSpawn = rawContent();
    Object.assign(inSpawn.waves.spawn, { jitter: 1 });
    const inView = rawContent();
    Object.assign(inView.arena.maxView, { zoom: 2 });
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
    raw.waves.segments[0].types = ['goblin-torch', 'segfault'];
    const e = failure(raw);
    expect(e.field).toBe('waves.segments.0.types.1');
    expect(e.message).toContain('segfault');
  });

  // Ids anteriores al change 0012, compuestos para no chocar con tests/guardrails/legacy-enemy-ids.
  it.each(
    [
      ['b', 'ug'],
      ['memory', '-leak'],
      ['merge', '-conflict'],
    ].map((p) => p.join('')),
  )('Scenario: Oleada con un id antiguo (%s)', (legacy) => {
    const raw = rawContent();
    raw.waves.segments[0].types = [legacy];
    const e = failure(raw);
    expect(e.field).toBe('waves.segments.0.types.0');
    expect(e.message).toContain(legacy);
  });

  it('Scenario: Radio que no cabe en la arena (1.081 en 3.840 × 2.160)', () => {
    const raw = rawContent();
    raw.enemies.types[0].radius = 1081;
    expect(failure(raw).field).toBe('enemies.types.0.radius');
  });

  it('Scenario: Radio en el límite exacto (1.080 en 3.840 × 2.160)', () => {
    const raw = rawContent();
    raw.enemies.types[0].radius = 1080;
    expect(parseRunConfig(raw).ok).toBe(true);
  });

  it('Identificador duplicado', () => {
    const raw = rawContent();
    raw.enemies.types[1].id = 'goblin-torch';
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
      { fromSecond: 0, budgetPerSecond: 1, types: ['goblin-torch'] },
      { fromSecond: 60, budgetPerSecond: 1, types: ['goblin-torch'] },
      { fromSecond: 60, budgetPerSecond: 1, types: ['goblin-torch'] },
    ];
    expect(failure(raw).field).toBe('waves.segments.2.fromSecond');
  });
});

describe('Duración objetivo validada (spec run-outcome)', () => {
  const durationTicks = (raw: RawContent): number | false => {
    const r = parseRunConfig(raw);
    if (!r.ok) return false;
    const rules = buildRunRules(r.value);
    return rules.ok && rules.value.duration.ticks;
  };

  it('Scenario: Contenido por defecto (600 s ⇒ 36.000 ticks)', () => {
    const r = loadRunConfig();
    expect(r.ok && r.value.run.durationSeconds).toBe(600);
    expect(r.ok && buildRunRules(r.value).ok).toBe(true);
    expect(durationTicks(rawContent())).toBe(36_000);
  });

  it('Scenario: Duración mínima válida (1 s ⇒ 60 ticks)', () => {
    const raw = rawContent();
    raw.run.durationSeconds = 1;
    expect(durationTicks(raw)).toBe(60);
  });

  it.each([0, -60])('Scenario: Duración cero o negativa (%s)', (seconds) => {
    const raw = rawContent();
    raw.run.durationSeconds = seconds;
    expect(failure(raw)).toEqual({
      code: 'invalid-config',
      field: 'run.durationSeconds',
      message: RUN_DURATION_MUST_BE_INTEGER,
    });
  });

  it.each<[string, (r: RawContent) => void]>([
    ['600,5', (r) => (r.run.durationSeconds = 600.5)],
    ['"600"', (r) => Reflect.set(r.run, 'durationSeconds', '600')],
    ['ausente', (r) => Reflect.deleteProperty(r.run, 'durationSeconds')],
  ])('Scenario: Duración no entera o ausente (%s)', (_name, mutate) => {
    const raw = rawContent();
    mutate(raw);
    expect(failure(raw).field).toBe('run.durationSeconds');
  });

  it('rechaza un campo extra en el fichero de partida', () => {
    const raw = rawContent();
    Reflect.set(raw.run, 'extra', 1);
    expect(failure(raw).field).toMatch(/^run/);
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
    expect(types.map((t) => t.id)).toEqual(['goblin-torch', 'goblin-tnt', 'goblin-barrel']);
    for (const t of types) {
      expect(Math.min(t.speed, t.radius, t.cost, t.health, t.damage)).toBeGreaterThan(0);
    }
  });

  // Spec world-camera (0017): el núcleo recibe el mundo, pero no el tope de vista ni la ventana.
  it('Scenario: Contenido por defecto (el núcleo recibe el mundo de 3.840 × 2.160, sin vista)', () => {
    expect(config?.arena).toEqual({ width: 3840, height: 2160 });
    expect(config?.waves.spawn.ringRadius).toBe(1500);
  });

  // Spec enemy-spawning (0017): "Radio del anillo por defecto", sin tamaño de vista ni de ventana.
  it('Scenario: Radio del anillo por defecto (spawn sin tamaño de vista; reglas sin view)', () => {
    expect(Object.keys(config?.waves.spawn ?? {}).sort()).toEqual([
      'maxAttempts',
      'minDistance',
      'ringRadius',
    ]);
    const rules = config ? buildRunRules(config) : null;
    expect(rules?.ok && 'view' in rules.value).toBe(false);
  });

  it('Scenario: Catálogo de tipos de enemigo (ids goblin con los stats heredados, mismo orden)', () => {
    const stats = (config?.enemies.types ?? []).map((t) => [
      t.id,
      t.speed,
      t.radius,
      t.health,
      t.damage,
      t.xp,
    ]);
    expect(stats).toEqual([
      ['goblin-torch', 90, 10, 10, 5, 1],
      ['goblin-tnt', 45, 22, 45, 15, 4],
      ['goblin-barrel', 70, 16, 20, 8, 2],
    ]);
  });

  // Spec enemy-spawning (0012), verify-report W2: los stats y los tramos de antes, con el id renombrado.
  it('Scenario: Stats heredados sin cambios', () => {
    const stats = Object.fromEntries(
      (config?.enemies.types ?? []).map(({ id, speed, radius, cost, damage, health, xp }) => [
        id,
        { speed, radius, cost, damage, health, xp },
      ]),
    );
    expect(stats).toEqual({
      'goblin-torch': { speed: 90, radius: 10, cost: 1, damage: 5, health: 10, xp: 1 },
      'goblin-tnt': { speed: 45, radius: 22, cost: 3, damage: 15, health: 45, xp: 4 },
      'goblin-barrel': { speed: 70, radius: 16, cost: 2, damage: 8, health: 20, xp: 2 },
    });
    const all = ['goblin-torch', 'goblin-barrel', 'goblin-tnt'];
    expect((config?.waves.segments ?? []).map((s) => s.types)).toEqual([
      ['goblin-torch'],
      ['goblin-torch', 'goblin-barrel'],
      all,
      all,
      all,
    ]);
  });

  it('Scenario: Contenido de enemigos y oleadas validado (oleadas con los ids goblin)', () => {
    const segments = (config?.waves.segments ?? []).map((s) => s.types);
    expect(segments).toEqual([
      ['goblin-torch'],
      ['goblin-torch', 'goblin-barrel'],
      ['goblin-torch', 'goblin-barrel', 'goblin-tnt'],
      ['goblin-torch', 'goblin-barrel', 'goblin-tnt'],
      ['goblin-torch', 'goblin-barrel', 'goblin-tnt'],
    ]);
  });

  it('Oleadas que crecen con el contenido por defecto', () => {
    const budgets = (config?.waves.segments ?? []).map((s) => s.budgetPerSecond);
    expect(budgets.length).toBeGreaterThan(1);
    expect(budgets).toEqual([...budgets].sort((a, b) => a - b));
  });

  it('Scenario: Contenido de los tests igual al del juego (loadRunConfig = aDefaultConfig)', () => {
    expect(config).toEqual(aDefaultConfig());
  });
});

// Spec procedural-map (0015), "Contenido del mapa validado".
describe('Contenido del mapa validado', () => {
  const loaded = loadRunConfig();

  it('Scenario: Contenido por defecto (cellSize 60, startRadius 180, troncos 0,12, 1 río)', () => {
    const map = loaded.ok ? loaded.value.map : null;
    expect(map && { ...map, tuning: undefined }).toEqual({
      cellSize: 60,
      startRadius: 180,
      trunkDensity: 0.12,
      trunkPatch: { min: 3, max: 8 },
      rivers: 1,
      bridges: { min: 2, max: 3 },
      castle: { cols: 5, rows: 4 },
      tuning: undefined,
    });
  });

  it('el dominio recibe las reglas del mapa: rejilla de 64 × 36', () => {
    const rules = loaded.ok ? buildRunRules(loaded.value) : null;
    expect(rules?.ok && [rules.value.map.cols, rules.value.map.rows]).toEqual([64, 36]);
  });

  it('Scenario: Celda en el límite del radio del jugador (32 carga, 31 falla con cellSize)', () => {
    const at32 = rawContent();
    at32.map.cellSize = 32;
    expect(parseRunConfig(at32).ok).toBe(true);
    const at31 = rawContent();
    at31.map.cellSize = 31;
    expect(failure(at31)).toEqual({
      code: 'invalid-config',
      field: 'map.cellSize',
      message: CELL_SIZE_BELOW_PLAYER,
    });
  });

  it.each([
    ['cellSize', (m: RawMap) => (m.cellSize = 0)],
    ['cellSize', (m: RawMap) => (m.cellSize = 60.5)],
    ['startRadius', (m: RawMap) => (m.startRadius = 0)],
    ['startRadius', (m: RawMap) => (m.startRadius = 1081)],
    ['trunkDensity', (m: RawMap) => (m.trunkDensity = -0.01)],
    ['trunkDensity', (m: RawMap) => (m.trunkDensity = 0.31)],
    ['trunkPatch', (m: RawMap) => (m.trunkPatch = { min: 4, max: 3 })],
    ['trunkPatch', (m: RawMap) => (m.trunkPatch = { min: 0, max: 3 })],
    ['rivers', (m: RawMap) => (m.rivers = 3)],
    ['rivers', (m: RawMap) => (m.rivers = 1.5)],
    ['bridges', (m: RawMap) => (m.bridges = { min: 0, max: 2 })],
    ['bridges', (m: RawMap) => (m.bridges = { min: 3, max: 2 })],
    ['tuning.riverMeander', (m: RawMap) => (m.tuning.riverMeander = 1.5)],
    ['tuning.riverVerticalChance', (m: RawMap) => (m.tuning.riverVerticalChance = -0.1)],
    ['tuning.patchAttempts', (m: RawMap) => (m.tuning.patchAttempts = 0)],
    ['castle.cols', (m: RawMap) => (m.castle = { cols: 0, rows: 4 })],
    ['castle.rows', (m: RawMap) => (m.castle = { cols: 5, rows: 0 })],
    ['castle.cols', (m: RawMap) => (m.castle = { cols: 5.5, rows: 4 })],
    ['castle', (m: RawMap) => (m.castle = { cols: 33, rows: 4 })],
    ['castle', (m: RawMap) => (m.castle = { cols: 5, rows: 19 })],
  ])('Scenario: Valores fuera de rango (%s)', (field, mutate) => {
    const raw = rawContent();
    mutate(raw.map);
    expect(failure(raw).field).toContain(`map.${field}`);
  });

  it.each([
    ['startRadius 1.080', (m: RawMap) => (m.startRadius = 1080)],
    ['trunkDensity 0', (m: RawMap) => (m.trunkDensity = 0)],
    ['trunkDensity 0,3', (m: RawMap) => (m.trunkDensity = 0.3)],
    ['rivers 0', (m: RawMap) => (m.rivers = 0)],
    ['rivers 2', (m: RawMap) => (m.rivers = 2)],
    ['trunkPatch { 1, 1 }', (m: RawMap) => (m.trunkPatch = { min: 1, max: 1 })],
    ['castle { 1, 1 }', (m: RawMap) => (m.castle = { cols: 1, rows: 1 })],
    ['castle { 32, 18 }', (m: RawMap) => (m.castle = { cols: 32, rows: 18 })],
  ])('Scenario: Límites válidos (%s)', (_name, mutate) => {
    const raw = rawContent();
    mutate(raw.map);
    expect(parseRunConfig(raw).ok).toBe(true);
  });

  it('Scenario: Campo ausente o desconocido (sin trunkDensity)', () => {
    const raw = without(rawContent(), (r) => r.map, 'trunkDensity');
    expect(failure(raw).field).toBe('map.trunkDensity');
  });

  it('Scenario: Campo ausente o desconocido (sin castle)', () => {
    const raw = without(rawContent(), (r) => r.map, 'castle');
    expect(failure(raw).field).toBe('map.castle');
  });

  it('castle estricto: campo extra en la huella', () => {
    const raw = rawContent();
    Object.assign(raw.map.castle, { depth: 1 });
    expect(failure(raw).field).toBe('map.castle.depth');
  });

  it('Scenario: Campo ausente o desconocido (campo extra lakes: 2)', () => {
    const raw = rawContent();
    Object.assign(raw.map, { lakes: 2 });
    expect(failure(raw).field).toBe('map.lakes');
  });

  it('campo de ajuste ausente o desconocido (tuning)', () => {
    const missing = without(rawContent(), (r) => r.map.tuning, 'patchAttempts');
    expect(failure(missing).field).toBe('map.tuning.patchAttempts');
    const extra = rawContent();
    Object.assign(extra.map.tuning, { lakes: 1 });
    expect(failure(extra).field).toBe('map.tuning.lakes');
  });
});
