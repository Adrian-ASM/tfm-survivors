import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOO_CLOSE,
  BuildingRules,
  type BuildingsConfig,
} from '../../../src/domain/site/BuildingRules';
import { BuildSite } from '../../../src/domain/site/BuildSite';
import { ProximityGate } from '../../../src/domain/shared/ProximityGate';
import { buildRunRules } from '../../../src/domain/run/RunConfig';
import { CONTENT_BUILDINGS, aDefaultConfig } from '../../support/builders';
import { mapRules } from '../../support/mapLayouts';

// Spec build-sites 0026, "Contenido de los edificios validado" (parte del dominio: invariantes y
// reglas cruzadas; la de zod va en 6.1) y design §1 (huella 2 × 2, acceso a 1,5 celdas).
const MAP = mapRules();

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const raw = (): Mutable<BuildingsConfig> => structuredClone(CONTENT_BUILDINGS);
const create = (c: BuildingsConfig) => BuildingRules.create(c, MAP);
const fieldOf = (c: BuildingsConfig): string | null => {
  const r = create(c);
  return r.ok ? null : r.error.field;
};

describe('BuildingRules · contenido de los edificios (spec build-sites 0026)', () => {
  it('Scenario: Contenido por defecto (reglas del dominio)', () => {
    const r = create(CONTENT_BUILDINGS);
    if (!r.ok) throw new Error(r.error.message);
    const rules = r.value;
    expect(rules.cost('house')).toEqual({ wood: 15, stone: 0 });
    expect(rules.cost('tower')).toEqual({ wood: 30, stone: 15 });
    expect(rules.income).toEqual({ gold: 1, everyTicks: 1800 });
    expect(rules.towerWeapon.targeting).toEqual({ mode: 'nearest-in-range', range: 350 });
    expect(rules.towerWeapon.attack.type).toBe('projectile');
    expect(rules.towerWeapon.damage).toBeGreaterThanOrEqual(1);
    expect(rules.towerWeapon.damage).toBeLessThan(10);
    expect(rules.maxTowerProjectiles).toBeGreaterThanOrEqual(1);
    expect(rules.access.radius).toBeGreaterThan(0);
    expect(rules.access.rearmDistance).toBeGreaterThan(rules.access.radius);
  });

  it('la partida lleva las reglas de los edificios', () => {
    const r = buildRunRules(aDefaultConfig());
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.buildings.sites.count).toBe(6);
  });

  const invalid: [string, (c: Mutable<BuildingsConfig>) => void, string][] = [
    ['madera de la casa 0', (c) => (c.house.cost.wood = 0), 'buildings.house.cost.wood'],
    ['madera de la casa 2,5', (c) => (c.house.cost.wood = 2.5), 'buildings.house.cost.wood'],
    ['piedra de la torre −1', (c) => (c.tower.cost.stone = -1), 'buildings.tower.cost.stone'],
    ['piedra de la torre 1,5', (c) => (c.tower.cost.stone = 1.5), 'buildings.tower.cost.stone'],
    ['oro por pago 0', (c) => (c.house.income.gold = 0), 'buildings.house.income.gold'],
    ['periodo 0', (c) => (c.house.income.everyTicks = 0), 'buildings.house.income.everyTicks'],
    ['periodo 1,5', (c) => (c.house.income.everyTicks = 1.5), 'buildings.house.income.everyTicks'],
    [
      'range 0',
      (c) => (c.tower.weapon.targeting = { mode: 'nearest-in-range', range: 0 }),
      'buildings.tower.weapon.targeting.range',
    ],
    [
      'pulse con any-in-radius',
      (c) => {
        c.tower.weapon.targeting = { mode: 'any-in-radius', radius: 90 };
        c.tower.weapon.attack = { type: 'pulse', visualTicks: 8 };
      },
      'buildings.tower.weapon.attack.type',
    ],
    ['tope de flechas 0', (c) => (c.tower.maxProjectiles = 0), 'buildings.tower.maxProjectiles'],
    ['radio de oferta 0', (c) => (c.access.radius = 0), 'buildings.access.radius'],
    ['radio de oferta −5', (c) => (c.access.radius = -5), 'buildings.access.radius'],
    [
      're-armado igual al radio',
      (c) => (c.access.rearmDistance = c.access.radius),
      'buildings.access.rearmDistance',
    ],
    ['acceso que deja tocar la huella', (c) => (c.access.radius = 74), 'buildings.access.radius'],
    ['huella de 0 columnas', (c) => (c.sites.footprint.cols = 0), 'buildings.sites.footprint.cols'],
    ['número de solares −1', (c) => (c.sites.count = -1), 'buildings.sites.count'],
    ['ruta con min > max', (c) => (c.sites.route.min = 40), 'buildings.sites.route.min'],
  ];

  it.each(invalid)('Scenario: Valores inválidos (%s)', (_name, patch, field) => {
    const c = raw();
    patch(c);
    expect(fieldOf(c)).toBe(field);
  });

  it('el acceso demasiado cerca de la huella da el mensaje de la regla cruzada', () => {
    const c = raw();
    c.access.radius = 74;
    const r = create(c);
    expect(r.ok ? null : r.error.message).toContain(ACCESS_TOO_CLOSE);
  });

  const limits: [string, (c: Mutable<BuildingsConfig>) => void][] = [
    ['piedra 0 en las dos', (c) => ((c.house.cost.stone = 0), (c.tower.cost.stone = 0))],
    ['madera 1 en las dos', (c) => ((c.house.cost.wood = 1), (c.tower.cost.wood = 1))],
    ['periodo 1', (c) => (c.house.income.everyTicks = 1)],
    ['tope de flechas 1', (c) => (c.tower.maxProjectiles = 1)],
    ['re-armado = radio + 0,001', (c) => (c.access.rearmDistance = c.access.radius + 0.001)],
    ['0 solares', (c) => (c.sites.count = 0)],
  ];

  it.each(limits)('Scenario: Límites válidos (%s)', (_name, patch) => {
    const c = raw();
    patch(c);
    expect(fieldOf(c)).toBeNull();
  });
});

describe('BuildSite · huella y acceso (design 0026 §1)', () => {
  const rules = (() => {
    const r = create(CONTENT_BUILDINGS);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  })();

  it('huella 2 × 2 desde el ancla, centro y acceso a 1,5 celdas bajo el borde inferior', () => {
    const site = new BuildSite(3, 20, 10, rules, MAP.cellSize);
    expect([site.id, site.col, site.row, site.cols, site.rows]).toEqual([3, 20, 10, 2, 2]);
    expect([site.x, site.y]).toEqual([1260, 660]);
    expect(site.access).toEqual({ x: 1260, y: 810 });
    expect(site.state).toBe('free');
    expect(site.builtAt).toBeNull();
    expect(site.gate.armed).toBe(true);
  });

  it('Scenario: Jugador fuera de la huella al abrir (rejilla de 1 px en el radio de oferta)', () => {
    const site = new BuildSite(0, 20, 10, rules, MAP.cellSize);
    const { radius } = rules.access;
    const r = MAP.playerRadius;
    const left = site.col * MAP.cellSize;
    const top = site.row * MAP.cellSize;
    const right = left + site.cols * MAP.cellSize;
    const bottom = top + site.rows * MAP.cellSize;
    let overlaps = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (!(Math.hypot(dx, dy) < radius)) continue;
        const x = site.access.x + dx;
        const y = site.access.y + dy;
        const ex = Math.max(left - x, 0, x - right);
        const ey = Math.max(top - y, 0, y - bottom);
        if (ex * ex + ey * ey < r * r) overlaps++;
      }
    }
    expect(overlaps).toBe(0);
  });
});

describe('ProximityGate (extraída de CastleGate, sin cambio de comportamiento)', () => {
  const at = { x: 1000, y: 1000 };
  const access = { radius: 40, rearmDistance: 300 };

  it('armada, se abre a d < radio y queda desarmada; sin poder abrir sigue armada', () => {
    const g = new ProximityGate(at, access, true);
    expect(g.step(1000, 1000, false)).toBe(false);
    expect(g.armed).toBe(true);
    expect(g.step(1039.9, 1000, true)).toBe(true);
    expect(g.armed).toBe(false);
  });

  it('desarmada, se vuelve a armar a d ≥ re-armado', () => {
    const g = new ProximityGate(at, access, false);
    g.step(1299, 1000, true);
    expect(g.armed).toBe(false);
    g.step(1300, 1000, true);
    expect(g.armed).toBe(true);
  });
});
