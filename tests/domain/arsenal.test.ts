import { describe, expect, it } from 'vitest';
import { FakeTarget, aLinter, aPulse, anArsenal, stepTicks, weaponsOf } from '../support/weapons';

const xs = (a: { projectiles: readonly { x: number }[] }): number[] =>
  a.projectiles.map((p) => p.x);

/** Ticks de 1 a `ticks` en los que el arsenal crea al menos un proyectil nuevo. */
function launchTicks(
  arsenal: ReturnType<typeof anArsenal>,
  ticks: number,
  targetsAt: (n: number) => FakeTarget[],
): { fired: number[]; maxAlive: number } {
  const fired: number[] = [];
  let maxAlive = 0;
  let seen = -1;
  for (let n = 1; n <= ticks; n++) {
    arsenal.step(n, 480, 270, targetsAt(n));
    const newest = arsenal.projectiles.reduce((m, p) => Math.max(m, p.id), -1);
    if (newest > seen) fired.push(n);
    seen = Math.max(seen, newest);
    maxAlive = Math.max(maxAlive, arsenal.projectiles.length);
  }
  return { fired, maxAlive };
}

describe('Arsenal · pools sin asignaciones en régimen (ADR-0003)', () => {
  it('tras 600 ticks de disparos solo se han usado los objetos preasignados', () => {
    const linter = aLinter({
      cooldownTicks: 1,
      targeting: { mode: 'nearest-in-range', range: 2000 },
    });
    const pulse = aPulse({ cooldownTicks: 3 });
    const arsenal = anArsenal(weaponsOf([linter, pulse]));
    // Objetivos indestructibles: el pulso y los proyectiles disparan sin parar.
    const anchor = new FakeTarget(480, 270, 1e12);
    const far = new FakeTarget(-5000, 270, 1e12);
    const projectiles = new Set<object>();
    const echoes = new Set<object>();
    const ids = new Set<number>();
    for (let n = 1; n <= 600; n++) {
      arsenal.step(n, 480, 270 + 100, [far, anchor]);
      for (const p of arsenal.projectiles) {
        projectiles.add(p);
        ids.add(p.id);
      }
      for (const e of arsenal.pulses) echoes.add(e);
    }
    expect(projectiles.size).toBeLessThanOrEqual(32);
    expect(echoes.size).toBeLessThanOrEqual(3);
    expect(ids.size).toBeGreaterThan(projectiles.size * 10);
  });
});

describe('Arsenal · pulso de área', () => {
  it('Scenario: Tres dentro y uno fuera (distancias 50, 80, 99 y 101)', () => {
    const arsenal = anArsenal(weaponsOf([aPulse()]));
    const bugs = [50, 80, 99, 101].map((d) => new FakeTarget(480 + d, 270));
    arsenal.step(1, 480, 270, bugs);
    expect(bugs.map((b) => b.hp)).toEqual([6, 6, 6, 10]);
  });

  it('Scenario: Sin enemigos en el radio, sin pulso (300 ticks a distancia 100)', () => {
    const arsenal = anArsenal(weaponsOf([aPulse()]));
    const bug = new FakeTarget(580, 270);
    stepTicks(arsenal, 1, 300, [bug]);
    expect([bug.hp, arsenal.pulses.length]).toEqual([10, 0]);
    expect(arsenal.weapons[0]?.isChargedAt(300)).toBe(true);
  });

  it('Scenario: Duración del pulso (de T a T + 7 con centro fijo y radio 90; no en T + 8)', () => {
    const arsenal = anArsenal(weaponsOf([aPulse()]));
    const bug = new FakeTarget(530, 270, 100);
    const T = 5;
    stepTicks(arsenal, 1, T - 1, []);
    arsenal.step(T, 480, 270, [bug]);
    const seen: (readonly [string, number, number, number, number])[] = [];
    for (let n = T; n <= T + 8; n++) {
      if (n > T) arsenal.step(n, 480 + 10 * (n - T), 270, [bug]);
      seen.push(...arsenal.pulses.map((p) => [p.weaponId, p.firedAt, p.x, p.y, p.radius] as const));
    }
    expect(seen).toEqual(Array.from({ length: 8 }, () => ['tests', T, 480, 270, 90]));
    expect(arsenal.pulses).toHaveLength(0);
  });

  it('devuelve las bajas del pulso', () => {
    const arsenal = anArsenal(weaponsOf([aPulse()]));
    const bugs = [
      new FakeTarget(500, 270, 4),
      new FakeTarget(510, 270, 3),
      new FakeTarget(520, 270),
    ];
    expect(arsenal.step(1, 480, 270, bugs)).toBe(2);
  });

  it('el orden de la lista decide: el pulso mata antes y el Linter retiene la carga', () => {
    const arsenal = anArsenal(weaponsOf([aPulse(), aLinter()]));
    const bug = new FakeTarget(530, 270, 4);
    expect(arsenal.step(1, 480, 270, [bug])).toBe(1);
    expect(arsenal.projectiles).toHaveLength(0);
    expect(arsenal.weapons.map((w) => w.isChargedAt(2))).toEqual([false, true]);
  });
});

describe('Arsenal · disparo de proyectiles', () => {
  it('Scenario: Tope lleno (maxProjectiles 2, cooldown 1: crea en 1, 2 y 61)', () => {
    const slow = aLinter({
      cooldownTicks: 1,
      attack: { type: 'projectile', speed: 1, radius: 4, lifetimeTicks: 60 },
    });
    const arsenal = anArsenal(weaponsOf([slow], { maxProjectiles: 2 }));
    const target = new FakeTarget(780, 270);
    const { fired, maxAlive } = launchTicks(arsenal, 61, () => [target]);
    expect(fired).toEqual([1, 2, 61]);
    expect(maxAlive).toBe(2);
  });

  it('Scenario: Retención sin objetivo en alcance (nada de 1 a 120; 1 proyectil en 121)', () => {
    const arsenal = anArsenal(weaponsOf([aLinter()]));
    const far = new FakeTarget(480 + 401, 270);
    const near = new FakeTarget(480 + 390, 270);
    const { fired } = launchTicks(arsenal, 121, (n) => (n < 121 ? [far] : [far, near]));
    expect(fired).toEqual([121]);
    expect(arsenal.projectiles).toHaveLength(1);
  });

  it('Scenario: Sin enemigos, sin disparos (600 ticks; el arma sigue cargada)', () => {
    const arsenal = anArsenal(weaponsOf([aLinter()]));
    stepTicks(arsenal, 1, 600, []);
    expect(arsenal.projectiles).toHaveLength(0);
    expect(arsenal.weapons.map((w) => w.isChargedAt(600))).toEqual([true]);
  });

  it('el proyectil no se mueve ni colisiona en su tick de creación', () => {
    const arsenal = anArsenal(weaponsOf([aLinter()]));
    const close = new FakeTarget(485, 270);
    arsenal.step(1, 480, 270, [close]);
    expect([close.hp, ...xs(arsenal)]).toEqual([10, 480]);
    arsenal.step(2, 480, 270, [close]);
    expect(close.hits).toEqual([2]);
  });
});

describe('Arsenal · proyectiles en vuelo', () => {
  it('Scenario: Impacto en vuelo (T + 10 en 560 sin daño; T + 11 impacta: vida 4)', () => {
    const arsenal = anArsenal(weaponsOf([aLinter()]));
    const bug = new FakeTarget(580, 270);
    stepTicks(arsenal, 1, 12, [bug]);
    expect(bug.hp).toBe(4);
    expect(arsenal.projectiles).toHaveLength(0);
  });

  it('Impacto en vuelo: en T + 10 (T = 1) está en 560 y la vida sigue en 10', () => {
    const arsenal = anArsenal(weaponsOf([aLinter()]));
    const bug = new FakeTarget(580, 270);
    stepTicks(arsenal, 1, 11, [bug]);
    expect(xs(arsenal)).toEqual([560]);
    expect(bug.hp).toBe(10);
  });

  it('Scenario: Agota su vida sin impactar (de T a T + 59; no en T + 60)', () => {
    const arsenal = anArsenal(weaponsOf([aLinter({ cooldownTicks: 1000 })]));
    // Un objetivo en alcance para el disparo del tick 1 que luego sale de la trayectoria.
    const lure = new FakeTarget(880, 270);
    arsenal.step(1, 480, 270, [lure]);
    lure.y = 10_000;
    stepTicks(arsenal, 2, 60, [lure]);
    expect(arsenal.projectiles.map((p) => [p.x, p.y])).toEqual([[952, 270]]);
    arsenal.step(61, 480, 270, [lure]);
    expect(arsenal.projectiles).toHaveLength(0);
  });

  it('Scenario: Solo daña a un enemigo (el primero de la lista)', () => {
    const arsenal = anArsenal(weaponsOf([aLinter()]));
    const a = new FakeTarget(580, 270);
    const b = new FakeTarget(580, 270);
    stepTicks(arsenal, 1, 12, [a, b]);
    expect([a.hp, b.hp]).toEqual([4, 10]);
    expect(arsenal.projectiles).toHaveLength(0);
  });

  it('Scenario: Varios proyectiles sobre el mismo bug en un tick', () => {
    const three = [1, 2, 3].map((i) => aLinter({ id: `l${String(i)}`, cooldownTicks: 1000 }));
    const arsenal = anArsenal(weaponsOf(three));
    const bug = new FakeTarget(580, 270);
    const kills = stepTicks(arsenal, 1, 12, [bug]);
    expect([bug.alive, kills]).toEqual([false, 1]);
    expect(bug.hits).toEqual([12, 12]);
    expect(arsenal.projectiles).toHaveLength(1);
  });

  it('Scenario: El objetivo muere antes del impacto (sigue recto e impacta a otro)', () => {
    const arsenal = anArsenal(weaponsOf([aLinter()]));
    const a = new FakeTarget(580, 270);
    const b = new FakeTarget(700, 270);
    stepTicks(arsenal, 1, 4, [a, b]);
    a.takeDamage(100, 4);
    stepTicks(arsenal, 5, 26, [a, b]);
    expect(xs(arsenal)).toEqual([480 + 8 * 25]);
    expect(b.hp).toBe(10);
    arsenal.step(27, 480, 270, [a, b]);
    expect(b.hits).toEqual([27]);
    expect(arsenal.projectiles).toHaveLength(0);
  });

  it('Scenario: Proyectiles en el snapshot (p2 impacta y se crea p4: p1, p3, p4)', () => {
    const arsenal = anArsenal(weaponsOf([aLinter({ cooldownTicks: 1 })]));
    const far = new FakeTarget(780, 270);
    stepTicks(arsenal, 1, 3, [far]);
    const before = arsenal.projectiles.map((p) => p.id);
    // En el tick 4, p2 avanza a 496: una víctima pequeña allí solo la toca a ella.
    const victim = new FakeTarget(496, 270, 1, 1);
    arsenal.step(4, 480, 270, [victim, far]);
    expect(victim.alive).toBe(false);
    const ids = arsenal.projectiles.map((p) => p.id);
    expect(ids.slice(0, 2)).toEqual([before[0], before[2]]);
    expect(ids).toHaveLength(3);
    expect(before).not.toContain(ids[2]);
    expect(arsenal.projectiles.map((p) => p.radius)).toEqual([4, 4, 4]);
  });
});
