import { describe, expect, it } from 'vitest';
import { BuildingRules, type BuildingsConfig } from '../../../src/domain/site/BuildingRules';
import { BuildSite } from '../../../src/domain/site/BuildSite';
import { TowerBattery } from '../../../src/domain/weapon/TowerBattery';
import type { WeaponTypeConfig } from '../../../src/domain/weapon/WeaponType';
import { CONTENT_BUILDINGS } from '../../support/builders';
import { mapRules } from '../../support/mapLayouts';
import { FakeTarget, aLinter, anArsenal, weaponsOf } from '../../support/weapons';

// Spec build-sites 0026, "Torre que dispara sola", y auto-weapons, "Tope de proyectiles": la reserva
// propia de las torres, con dobles de enemigo. Solares en (20, 10), (24, 10) y (28, 10): puntos de
// disparo en (1.260, 660), (1.500, 660) y (1.740, 660).
const MAP = mapRules();
/** Flecha lenta (1 px/s) y longeva: ninguna alcanza a su objetivo en los ticks del escenario. */
const SLOW = { type: 'projectile', speed: 1, radius: 4, lifetimeTicks: 100_000 } as const;

function battery(
  tower: Partial<Omit<BuildingsConfig['tower'], 'weapon'>> & {
    weapon?: Partial<WeaponTypeConfig>;
  } = {},
  anchors: readonly [number, number][] = [[20, 10]],
) {
  const config: BuildingsConfig = {
    ...CONTENT_BUILDINGS,
    tower: {
      ...CONTENT_BUILDINGS.tower,
      ...tower,
      weapon: { ...CONTENT_BUILDINGS.tower.weapon, ...tower.weapon },
    },
  };
  const rules = BuildingRules.create(config, MAP);
  if (!rules.ok) throw new Error(rules.error.message);
  const sites = anchors.map(([c, r], id) => new BuildSite(id, c, r, rules.value, MAP.cellSize));
  const b = new TowerBattery(rules.value, sites);
  for (const s of sites) b.add(s);
  return b;
}

/** Ticks de 1 a `ticks` en los que se crea al menos un proyectil nuevo en la lista dada. */
function creationTicks(
  list: () => readonly { id: number }[],
  step: (n: number) => void,
  n: number,
) {
  const out: number[] = [];
  let seen = -1;
  for (let t = 1; t <= n; t++) {
    step(t);
    const newest = list().reduce((m, p) => Math.max(m, p.id), -1);
    if (newest > seen) out.push(t);
    seen = Math.max(seen, newest);
  }
  return out;
}

describe('TowerBattery (spec build-sites 0026)', () => {
  it('Scenario: Límite del alcance (350 dispara, 351 no)', () => {
    const at350 = battery();
    const at351 = battery();
    at350.fire(1, [new FakeTarget(1260, 660 - 350)]);
    at351.fire(1, [new FakeTarget(1260, 660 - 351)]);
    expect(at350.projectiles).toHaveLength(1);
    expect(at351.projectiles).toHaveLength(0);
  });

  it('la flecha nace en el punto de disparo con su propia secuencia de ids y se dirige al objetivo', () => {
    const b = battery();
    const target = new FakeTarget(1260, 360, 1e9);
    b.fire(1, [target]);
    const [arrow] = b.projectiles;
    expect([arrow?.id, arrow?.x, arrow?.y]).toEqual([0, 1260, 660]);
    b.advance(2, [target]);
    expect(b.projectiles[0]?.x).toBeCloseTo(1260, 9);
    expect(b.projectiles[0]?.y).toBeCloseTo(652, 9);
  });

  it('impacta solo en enemigos vivos y cuenta la baja', () => {
    const b = battery();
    const dead = new FakeTarget(1260, 560, 0);
    const target = new FakeTarget(1260, 560, 4);
    b.fire(1, [target]);
    let kills = 0;
    for (let n = 2; n <= 20; n++) kills += b.advance(n, [dead, target]);
    expect([kills, target.hp, b.projectiles.length]).toEqual([1, 0, 0]);
  });

  it('Scenario: Reserva de las torres llena (tope 2, 3 torres, y el Linter con objetivo)', () => {
    const b = battery({ maxProjectiles: 2, weapon: { attack: SLOW } }, [
      [20, 10],
      [24, 10],
      [28, 10],
    ]);
    const arsenal = anArsenal(weaponsOf([aLinter({ attack: SLOW })]));
    const target = new FakeTarget(1500, 500, 1e9);
    arsenal.step(1, 1740, 810, [target]);
    b.advance(1, [target]);
    b.fire(1, [target]);
    expect(b.projectiles.map((p) => [p.x, p.y])).toEqual([
      [1260, 660],
      [1500, 660],
    ]);
    expect(b.isChargedAt(2, 1)).toBe(true);
    expect(b.isChargedAt(0, 2)).toBe(false);
    expect(arsenal.projectiles).toHaveLength(1);
  });

  it('Scenario: El jugador conserva su tope (reserva de torres llena, Linter con cadencia 1)', () => {
    const b = battery({ maxProjectiles: 1, weapon: { attack: SLOW } });
    const arsenal = anArsenal(weaponsOf([aLinter({ cooldownTicks: 1, attack: SLOW })]));
    const target = new FakeTarget(1260, 450, 1e9);
    const towerArrows = new Set<object>();
    let at32 = -1;
    for (let n = 1; n <= 60; n++) {
      arsenal.step(n, 1260, 810, [target]);
      b.advance(n, [target]);
      b.fire(n, [target]);
      expect(b.projectiles).toHaveLength(1);
      for (const p of b.projectiles) towerArrows.add(p);
      if (n === 32) at32 = arsenal.projectiles.length;
    }
    expect(at32).toBe(32);
    expect(arsenal.projectiles.some((p) => towerArrows.has(p))).toBe(false);
  });

  it('Scenario: Con el tope del jugador lleno las torres disparan', () => {
    const arsenal = anArsenal(weaponsOf([aLinter({ cooldownTicks: 1, attack: SLOW })]));
    const target = new FakeTarget(1260, 450, 1e9);
    for (let n = 1; n <= 32; n++) arsenal.step(n, 1260, 810, [target]);
    expect(arsenal.projectiles).toHaveLength(32);
    const b = battery();
    b.fire(33, [target]);
    expect(b.projectiles).toHaveLength(1);
  });

  it('Scenario: Tope lleno con torres disparando (auto-weapons: Linter en 1, 2 y 61)', () => {
    const linter = aLinter({
      cooldownTicks: 1,
      attack: { type: 'projectile', speed: 1, radius: 4, lifetimeTicks: 60 },
    });
    const arsenal = anArsenal(weaponsOf([linter], { maxProjectiles: 2 }));
    const b = battery({ weapon: { cooldownTicks: 1000, attack: SLOW } });
    const target = new FakeTarget(1260, 500, 1e9);
    let maxAlive = 0;
    const fired = creationTicks(
      () => arsenal.projectiles,
      (n) => {
        arsenal.step(n, 1260, 810, [target]);
        b.advance(n, [target]);
        b.fire(n, [target]);
        maxAlive = Math.max(maxAlive, arsenal.projectiles.length);
      },
      61,
    );
    expect(fired).toEqual([1, 2, 61]);
    expect(maxAlive).toBe(2);
    expect(b.projectiles).toHaveLength(1);
  });

  it('sin torres construidas no dispara ni asigna', () => {
    const config = CONTENT_BUILDINGS;
    const rules = BuildingRules.create(config, MAP);
    if (!rules.ok) throw new Error(rules.error.message);
    const site = new BuildSite(0, 20, 10, rules.value, MAP.cellSize);
    const b = new TowerBattery(rules.value, [site]);
    b.fire(1, [new FakeTarget(1260, 600)]);
    expect(b.projectiles).toHaveLength(0);
  });
});
