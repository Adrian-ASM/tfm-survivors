import { describe, expect, it } from 'vitest';
import type { ProjectileSnapshot } from '../../src/domain/run/RunSnapshot';
import { ProjectileLayer } from '../../src/infrastructure/phaser/ProjectileLayer';
import { ARROW_FILE } from '../support/appearance';
import { fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';

// Specs auto-weapons ("Sprites de proyectiles") y sprite-rendering ("Rotación de la flecha") (0012).
const shot = (id: number, x: number, y: number): ProjectileSnapshot => ({ id, x, y, radius: 4 });

function layer(capacity: number, facing: 'right' | 'left' = 'right') {
  const kit = fakeKit();
  const looks = someLooks((raw) => {
    raw.projectile.facing = facing;
  });
  const l = new ProjectileLayer(capacity, kit, looks.projectile);
  const sync = (shots: readonly ProjectileSnapshot[]): void => {
    l.sync(shots);
  };
  return { l, sync, created: kit.created };
}

const visible = <T extends { visible: boolean }>(sprites: T[]): T[] =>
  sprites.filter((s) => s.visible);

describe('ProjectileLayer', () => {
  it('preasigna maxProjectiles sprites ocultos y no crea más al sincronizar', () => {
    const { sync, created } = layer(32);
    expect([created.length, visible(created).length]).toEqual([32, 0]);
    for (let f = 0; f < 10; f++) sync(Array.from({ length: 32 }, (_, i) => shot(f * 32 + i, i, f)));
    expect(created).toHaveLength(32);
  });

  it('Scenario: Sprites de proyectiles (3 pintados; 1 desaparece y se crea otro)', () => {
    const { sync, created, l } = layer(32);
    sync([shot(1, 10, 10), shot(2, 20, 20), shot(3, 30, 30)]);
    const next = [shot(1, 18, 10), shot(3, 38, 30), shot(4, 480, 270)];
    sync(next);
    const shown = visible(created);
    expect(shown).toHaveLength(3);
    for (const p of next) {
      const s = shown.filter((c) => Math.abs(c.x - p.x) <= 0.001 && Math.abs(c.y - p.y) <= 0.001);
      expect(s, `proyectil ${String(p.id)}`).toHaveLength(1);
      expect(s[0]?.texture).toBe(ARROW_FILE);
    }
    expect(l.counts).toEqual({ visible: 3, placeholder: 0 });
  });

  it.each([
    [0, 1, Math.PI / 2],
    [-0.6, 0.8, Math.atan2(0.8, -0.6)],
  ])('Scenario: Rotación de la flecha (dirección (%s, %s))', (dx, dy, angle) => {
    const { sync, created } = layer(1);
    const rotations: number[] = [];
    for (let f = 0; f < 5; f++) {
      sync([shot(1, 100 + 8 * dx * f, 100 + 8 * dy * f)]);
      rotations.push(created[0]?.rotation ?? Number.NaN);
    }
    expect(rotations[0]).toBe(0);
    for (const r of rotations.slice(1)) expect(Math.abs(r - angle)).toBeLessThanOrEqual(0.01);
  });

  it('con un dibujo que mira a la izquierda suma π (también en el primer frame)', () => {
    const { sync, created } = layer(1, 'left');
    sync([shot(1, 100, 100)]);
    expect(created[0]?.rotation).toBeCloseTo(Math.PI, 6);
    sync([shot(1, 100, 108)]);
    expect(created[0]?.rotation).toBeCloseTo(Math.PI / 2 + Math.PI, 6);
  });

  it('un hueco reutilizado no hereda la rotación del proyectil anterior', () => {
    const { sync, created } = layer(1);
    sync([shot(1, 100, 100)]);
    sync([shot(1, 100, 108)]);
    sync([shot(2, 500, 500)]);
    expect(created[0]?.rotation).toBe(0);
  });
});
