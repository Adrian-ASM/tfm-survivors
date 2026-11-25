import { describe, expect, it } from 'vitest';
import {
  BuildingRules,
  CONTACT_EPS,
  CONTACT_REARM_MUST_EXCEED_EPS,
  type BuildingsConfig,
} from '../../../src/domain/site/BuildingRules';
import { BuildSite } from '../../../src/domain/site/BuildSite';
import { ProximityGate } from '../../../src/domain/shared/ProximityGate';
import { buildRunRules } from '../../../src/domain/run/RunConfig';
import { CONTENT_BUILDINGS, aDefaultConfig } from '../../support/builders';
import { mapRules } from '../../support/mapLayouts';

// Spec build-sites 0027, "Contenido de los edificios validado" (parte del dominio: invariantes; la de
// zod va en tests/infrastructure/content) y design 0027 §1.4 (contacto g ≤ ε y re-armado g ≥ X).
const MAP = mapRules();

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const raw = (): Mutable<BuildingsConfig> => structuredClone(CONTENT_BUILDINGS);
const create = (c: BuildingsConfig) => BuildingRules.create(c);
const fieldOf = (c: BuildingsConfig): string | null => {
  const r = create(c);
  return r.ok ? null : r.error.field;
};
const rulesOf = (c: BuildingsConfig = CONTENT_BUILDINGS): BuildingRules => {
  const r = create(c);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('BuildingRules · contenido de los edificios (spec build-sites 0027)', () => {
  it('Scenario: Contenido por defecto (reglas del dominio)', () => {
    const rules = rulesOf();
    expect(rules.cost('house')).toEqual({ wood: 15, stone: 0 });
    expect(rules.cost('tower')).toEqual({ wood: 30, stone: 15 });
    expect(rules.income).toEqual({ gold: 1, everyTicks: 1800 });
    expect(rules.towerWeapon.targeting).toEqual({ mode: 'nearest-in-range', range: 350 });
    expect(rules.towerWeapon.attack.type).toBe('projectile');
    expect(rules.towerWeapon.damage).toBeGreaterThanOrEqual(1);
    expect(rules.towerWeapon.damage).toBeLessThan(10);
    expect(rules.maxTowerProjectiles).toBeGreaterThanOrEqual(1);
    expect(rules.contact).toEqual({ rearmDistance: 64 });
    expect('access' in rules).toBe(false);
  });

  it('ε es una constante del dominio con 0 < ε ≤ 1 px', () => {
    expect(CONTACT_EPS).toBeGreaterThan(0);
    expect(CONTACT_EPS).toBeLessThanOrEqual(1);
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
    [
      'separación de re-armado 0',
      (c) => (c.contact.rearmDistance = 0),
      'buildings.contact.rearmDistance',
    ],
    [
      'separación de re-armado −5',
      (c) => (c.contact.rearmDistance = -5),
      'buildings.contact.rearmDistance',
    ],
    [
      'separación de re-armado = ε',
      (c) => (c.contact.rearmDistance = CONTACT_EPS),
      'buildings.contact.rearmDistance',
    ],
    [
      'separación de re-armado infinita',
      (c) => (c.contact.rearmDistance = Infinity),
      'buildings.contact.rearmDistance',
    ],
    ['huella de 0 columnas', (c) => (c.sites.footprint.cols = 0), 'buildings.sites.footprint.cols'],
    ['número de solares −1', (c) => (c.sites.count = -1), 'buildings.sites.count'],
    ['ruta con min > max', (c) => (c.sites.route.min = 40), 'buildings.sites.route.min'],
  ];

  it.each(invalid)('Scenario: Valores inválidos (%s)', (_name, patch, field) => {
    const c = raw();
    patch(c);
    expect(fieldOf(c)).toBe(field);
  });

  it('la separación de re-armado = ε da el mensaje de la regla', () => {
    const c = raw();
    c.contact.rearmDistance = CONTACT_EPS;
    const r = create(c);
    expect(r.ok ? null : r.error.message).toContain(CONTACT_REARM_MUST_EXCEED_EPS);
  });

  const limits: [string, (c: Mutable<BuildingsConfig>) => void][] = [
    ['piedra 0 en las dos', (c) => ((c.house.cost.stone = 0), (c.tower.cost.stone = 0))],
    ['madera 1 en las dos', (c) => ((c.house.cost.wood = 1), (c.tower.cost.wood = 1))],
    ['periodo 1', (c) => (c.house.income.everyTicks = 1)],
    ['tope de flechas 1', (c) => (c.tower.maxProjectiles = 1)],
    ['re-armado = ε + 0,001', (c) => (c.contact.rearmDistance = CONTACT_EPS + 0.001)],
    ['0 solares', (c) => (c.sites.count = 0)],
  ];

  it.each(limits)('Scenario: Límites válidos (%s)', (_name, patch) => {
    const c = raw();
    patch(c);
    expect(fieldOf(c)).toBeNull();
  });
});

describe('BuildSite · huella, contacto y re-armado (design 0027 §1.4)', () => {
  const rules = rulesOf();
  const R = MAP.playerRadius;
  const site = (): BuildSite => new BuildSite(3, 20, 10, rules, MAP);

  it('huella 2 × 2 desde el ancla, centro y rectángulo; nace libre y armado, sin acceso', () => {
    const s = site();
    expect([s.id, s.col, s.row, s.cols, s.rows]).toEqual([3, 20, 10, 2, 2]);
    expect([s.x, s.y]).toEqual([1260, 660]);
    expect([s.left, s.top, s.right, s.bottom]).toEqual([1200, 600, 1320, 720]);
    expect(s.state).toBe('free');
    expect(s.builtAt).toBeNull();
    expect(s.armed).toBe(true);
    expect('access' in s).toBe(false);
  });

  it('separación g desde el borde del jugador: caras, esquina y dentro', () => {
    const s = site();
    expect(s.gap(1260, 736, R)).toBe(0);
    expect(s.gap(1260, 800, R)).toBe(64);
    expect(s.gap(1400, 660, R)).toBe(64);
    expect(s.gap(1200 - 3, 600 - 4, R)).toBeCloseTo(5 - R, 9);
    expect(s.gap(1260, 660, R)).toBe(-R);
  });

  it('el rectángulo se recorta al borde del mundo', () => {
    const last = new BuildSite(0, MAP.cols - 2, MAP.rows - 2, rules, {
      cellSize: MAP.cellSize,
      width: MAP.cellSize * MAP.cols - 10,
      height: MAP.cellSize * MAP.rows - 20,
    });
    expect(last.right).toBe(MAP.cellSize * MAP.cols - 10);
    expect(last.bottom).toBe(MAP.cellSize * MAP.rows - 20);
  });

  it('armado y tocado (g ≤ ε) con canOpen: abre y queda desarmado', () => {
    const s = site();
    expect(s.touch(1260, 720 + R + CONTACT_EPS, R, true)).toBe(true);
    expect(s.armed).toBe(false);
  });

  it('armado y tocado sin canOpen: no abre y sigue armado', () => {
    const s = site();
    expect(s.touch(1260, 736, R, false)).toBe(false);
    expect(s.armed).toBe(true);
  });

  it('armado a g > ε: no abre', () => {
    const s = site();
    expect(s.touch(1260, 720 + R + 1.5, R, true)).toBe(false);
    expect(s.armed).toBe(true);
  });

  it('desarmado: se re-arma a g ≥ X (no a X − 0,1) y nunca abre en ese paso', () => {
    const s = site();
    s.touch(1260, 736, R, true);
    expect(s.touch(1260, 736 + 63.9, R, true)).toBe(false);
    expect(s.armed).toBe(false);
    expect(s.touch(1260, 736, R, true)).toBe(false);
    expect(s.armed).toBe(false);
    expect(s.touch(1260, 736 + 64, R, true)).toBe(false);
    expect(s.armed).toBe(true);
  });

  it('nace desarmado si se pide (escenarios preparados)', () => {
    const s = new BuildSite(0, 20, 10, rules, MAP, false);
    expect(s.armed).toBe(false);
  });
});

describe('ProximityGate (de la tienda, sin cambio de comportamiento)', () => {
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
