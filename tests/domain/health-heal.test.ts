import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { Player } from '../../src/domain/player/Player';
import { Health } from '../../src/domain/shared/Health';
import { Vector2 } from '../../src/domain/shared/Vector2';
import { aRunConfig } from '../support/builders';

// Spec player-health (0023), "Curación por carne": la vida sube con tope en la máxima y no resucita.
describe('Health.heal', () => {
  it('sube la vida actual sin cambiar la máxima (50 + 20 de 100 = 70)', () => {
    const h = Health.full(100).damage(50).heal(20);
    expect([h.current, h.max]).toEqual([70, 100]);
  });

  it('se acota a la vida máxima (90 + 20 = 100, no 110)', () => {
    expect(Health.full(100).damage(10).heal(20).current).toBe(100);
  });

  it('con la vida llena no cambia (devuelve la misma vida)', () => {
    const h = Health.full(100);
    expect(h.heal(20)).toBe(h);
  });

  it('no resucita: con la vida a 0 sigue a 0', () => {
    const dead = Health.full(100).damage(100);
    expect(dead.heal(20).current).toBe(0);
    expect(dead.heal(20).isDepleted).toBe(true);
  });

  it('es inmutable: la original no cambia', () => {
    const h = Health.full(100).damage(50);
    h.heal(20);
    expect(h.current).toBe(50);
  });
});

describe('Player.heal', () => {
  const rules = aRunConfig().player;
  const arena = Arena.create(960, 540);
  if (!arena.ok) throw new Error('arena');

  it('conserva posición e invulnerabilidad (spec "La curación no cambia la invulnerabilidad")', () => {
    const hit = Player.spawn(Vector2.of(100, 200), rules).hit(40, 10);
    const healed = hit.heal(20);
    expect(healed.health.current).toBe(80);
    expect(healed.position).toEqual(hit.position);
    expect(healed.invulnerableUntil).toBe(hit.invulnerableUntil);
  });

  it('sin cambio de vida devuelve el mismo jugador', () => {
    const p = Player.spawn(Vector2.of(100, 200), rules);
    expect(p.heal(20)).toBe(p);
  });
});
