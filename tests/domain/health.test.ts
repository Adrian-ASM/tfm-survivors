import { describe, expect, it } from 'vitest';
import { Health } from '../../src/domain/shared/Health';

describe('Health · vida mínima 0', () => {
  it('empieza llena', () => {
    const h = Health.full(100);
    expect([h.current, h.max, h.isDepleted]).toEqual([100, 100, false]);
  });

  it('Scenario: Daño exactamente igual a la vida restante', () => {
    const h = Health.full(10).damage(10);
    expect(h.current).toBe(0);
    expect(h.isDepleted).toBe(true);
  });

  it('Scenario: Daño mayor que la vida restante (0, no −15)', () => {
    const h = Health.full(10).damage(25);
    expect(h.current).toBe(0);
    expect(h.isDepleted).toBe(true);
  });

  it('Scenario: Vida que no llega a 0', () => {
    const h = Health.full(100).damage(89).damage(10);
    expect([h.current, h.max, h.isDepleted]).toEqual([1, 100, false]);
  });

  it('es inmutable: damage devuelve una vida nueva y la original no cambia', () => {
    const h = Health.full(100);
    const hit = h.damage(10);
    expect([h.current, hit.current]).toEqual([100, 90]);
    expect(() => {
      (h as unknown as { current: number }).current = 1;
    }).toThrow(TypeError);
  });
});

describe('Health.raise · vida máxima mejorable', () => {
  it('Scenario: Con la vida llena (+20: 120 de 120)', () => {
    const h = Health.full(100).raise(20);
    expect([h.current, h.max]).toEqual([120, 120]);
  });

  it('Scenario: Con la vida a medias (55 de 100 + 20: 75 de 120)', () => {
    const h = Health.full(100).damage(45).raise(20);
    expect([h.current, h.max]).toEqual([75, 120]);
  });

  it('Scenario: Nivel máximo (5 × 20 sin golpes: 200 de 200)', () => {
    let h = Health.full(100);
    for (let i = 0; i < 5; i++) h = h.raise(20);
    expect([h.current, h.max]).toEqual([200, 200]);
  });

  it('con un incremento negativo recorta la vida actual a [1, max]: elegir no mata', () => {
    expect(Health.full(100).damage(95).raise(-20)).toMatchObject({ current: 1, max: 80 });
    expect(Health.full(100).raise(-20)).toMatchObject({ current: 80, max: 80 });
  });
});
