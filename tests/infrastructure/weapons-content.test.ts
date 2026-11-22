import { describe, expect, it } from 'vitest';
import { WEAPON_ID_MUST_BE_UNIQUE } from '../../src/domain/weapon/WeaponLoadout';
import { WEAPON_TARGETING_INCOMPATIBLE } from '../../src/domain/weapon/WeaponType';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { WEAPONS_REQUIRED } from '../../src/infrastructure/content/schemas';
import { DEFAULT_WEAPONS, rawContent, type RawContent } from '../support/builders';

function failure(raw: RawContent): { field: string; message: string } {
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

/** Contenido crudo por defecto con un cambio aplicado sobre `weapons`. */
function withChange(change: (w: RawContent['weapons']) => void): RawContent {
  const raw = rawContent();
  change(raw.weapons);
  return raw;
}

describe('Contenido de armas validado', () => {
  const loaded = loadRunConfig();
  const weapons = loaded.ok ? loaded.value.weapons : null;

  it('Scenario: Contenido por defecto (linter y tests con los valores de la spec)', () => {
    expect(weapons).toEqual(DEFAULT_WEAPONS);
    expect(weapons?.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);
  });

  it('Scenario: Daños base distintos y menores que la vida del goblin-torch', () => {
    const [linter, tests] = weapons?.weapons ?? [];
    const torch = loaded.ok
      ? loaded.value.enemies.types.find((t) => t.id === 'goblin-torch')
      : undefined;
    expect(linter?.damage).not.toBe(tests?.damage);
    expect(Math.max(linter?.damage ?? 99, tests?.damage ?? 99)).toBeLessThan(torch?.health ?? 0);
  });

  it.each([
    ['cooldownTicks', (w: RawContent['weapons']) => (w.weapons[0].cooldownTicks = 0)],
    ['damage', (w: RawContent['weapons']) => (w.weapons[0].damage = 0)],
    ['damage', (w: RawContent['weapons']) => (w.weapons[1].damage = -1)],
    ['targeting.range', (w: RawContent['weapons']) => (w.weapons[0].targeting.range = 0)],
    ['targeting.radius', (w: RawContent['weapons']) => (w.weapons[1].targeting.radius = 0)],
    ['attack.speed', (w: RawContent['weapons']) => (w.weapons[0].attack.speed = 0)],
    ['attack.radius', (w: RawContent['weapons']) => (w.weapons[0].attack.radius = 0)],
    ['attack.lifetimeTicks', (w: RawContent['weapons']) => (w.weapons[0].attack.lifetimeTicks = 0)],
    ['attack.visualTicks', (w: RawContent['weapons']) => (w.weapons[1].attack.visualTicks = 0)],
    ['maxProjectiles', (w: RawContent['weapons']) => (w.maxProjectiles = 0)],
    ['hitFlashTicks', (w: RawContent['weapons']) => (w.hitFlashTicks = 0)],
  ])('Scenario: Valores no positivos (%s)', (field, change) => {
    expect(failure(withChange(change)).field).toMatch(
      new RegExp(`^weapons\\.(weapons\\.\\d\\.)?${field}$`),
    );
  });

  it.each([
    [
      'weapons.weapons.0.cooldownTicks',
      (w: RawContent['weapons']) => (w.weapons[0].cooldownTicks = 1.5),
    ],
    ['weapons.weapons.0.damage', (w: RawContent['weapons']) => (w.weapons[0].damage = 2.5)],
    [
      'weapons.weapons.0.attack.lifetimeTicks',
      (w: RawContent['weapons']) => (w.weapons[0].attack.lifetimeTicks = 10.5),
    ],
    ['weapons.maxProjectiles', (w: RawContent['weapons']) => (w.maxProjectiles = 3.2)],
  ])('Scenario: Valores no enteros (%s)', (field, change) => {
    expect(failure(withChange(change)).field).toBe(field);
  });

  it('Scenario: Identificadores duplicados o lista vacía', () => {
    const dup = failure(withChange((w) => (w.weapons[1] = structuredClone(w.weapons[0]))));
    expect(dup).toMatchObject({
      field: 'weapons.weapons.1.id',
      message: `${WEAPON_ID_MUST_BE_UNIQUE}: linter`,
    });
    const empty = failure(withChange((w) => Reflect.set(w, 'weapons', [])));
    expect(empty).toMatchObject({ field: 'weapons.weapons', message: WEAPONS_REQUIRED });
  });

  it('rechaza un id vacío', () => {
    expect(failure(withChange((w) => (w.weapons[0].id = ''))).field).toBe('weapons.weapons.0.id');
  });

  it.each([
    ['pulse con nearest-in-range', 1, { mode: 'nearest-in-range', range: 400 }],
    ['projectile con any-in-radius', 0, { mode: 'any-in-radius', radius: 90 }],
  ])('Scenario: Combinación incompatible (%s)', (_name, index, targeting) => {
    const e = failure(
      withChange((w) => Reflect.set(w.weapons[index] ?? {}, 'targeting', targeting)),
    );
    expect(e.field).toBe(`weapons.weapons.${String(index)}.targeting.mode`);
    expect(e.message).toContain(WEAPON_TARGETING_INCOMPATIBLE);
  });

  it.each([
    [
      'campo extra pierce',
      'weapons.weapons.0',
      (w: RawContent['weapons']) => Reflect.set(w.weapons[0], 'pierce', 2),
    ],
    [
      'mode random',
      'weapons.weapons.0.targeting',
      (w: RawContent['weapons']) => (w.weapons[0].targeting.mode = 'random'),
    ],
    [
      'type laser',
      'weapons.weapons.0.attack',
      (w: RawContent['weapons']) => (w.weapons[0].attack.type = 'laser'),
    ],
  ])('Scenario: Campos o variantes desconocidos (%s)', (_name, prefix, change) => {
    expect(failure(withChange(change)).field.startsWith(prefix)).toBe(true);
  });

  it('Scenario: Daño mayor que la vida de un enemigo (damage 50 es válido)', () => {
    expect(parseRunConfig(withChange((w) => (w.weapons[0].damage = 50))).ok).toBe(true);
  });
});
