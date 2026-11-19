import { describe, expect, it } from 'vitest';
import { ENEMY_SPEED_MUST_BE_POSITIVE } from '../../src/domain/enemy/EnemyType';
import { SPEED_MUST_BE_POSITIVE, buildRunRules } from '../../src/domain/run/RunConfig';
import { MAX_ALIVE_MUST_BE_INTEGER } from '../../src/domain/wave/SpawnRules';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { aRunConfig, rawContent, type RawContent } from '../support/builders';

function failure(raw: RawContent): { field: string; message: string } {
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

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
    const domain = buildRunRules({ ...aRunConfig(), player: { speed: 0, radius: 16 } });
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
      expect(Math.min(t.speed, t.radius, t.cost)).toBeGreaterThan(0);
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
