import { describe, expect, it } from 'vitest';
import { FakeTarget, aLinter, anArsenal, stepTicks, weaponsOf } from '../support/weapons';

const xs = (a: { projectiles: readonly { x: number }[] }): number[] =>
  a.projectiles.map((p) => p.x);

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
