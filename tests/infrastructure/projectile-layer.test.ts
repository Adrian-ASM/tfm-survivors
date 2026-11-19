import { describe, expect, it } from 'vitest';
import type { ProjectileSnapshot } from '../../src/domain/run/RunSnapshot';
import type { CircleSprite } from '../../src/infrastructure/phaser/EnemyLayer';
import { PROJECTILE_COLOR, ProjectileLayer } from '../../src/infrastructure/phaser/ProjectileLayer';

class FakeCircle implements CircleSprite {
  x = 0;
  y = 0;
  radius = 0;
  color = 0;
  visible = true;
  resizes = 0;

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setRadius(radius: number): this {
    this.radius = radius;
    this.resizes += 1;
    return this;
  }
  setFillStyle(color: number): this {
    this.color = color;
    return this;
  }
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
}

function layer(capacity: number) {
  const created: FakeCircle[] = [];
  const l = new ProjectileLayer(capacity, () => {
    const c = new FakeCircle();
    created.push(c);
    return c;
  });
  return { l, created };
}

const shot = (id: number, x: number, y: number): ProjectileSnapshot => ({ id, x, y, radius: 4 });
const visible = (created: FakeCircle[]) => created.filter((c) => c.visible);

describe('ProjectileLayer', () => {
  it('preasigna maxProjectiles sprites ocultos y no crea más al sincronizar', () => {
    const { l, created } = layer(32);
    expect(created).toHaveLength(32);
    expect(visible(created)).toHaveLength(0);
    for (let f = 0; f < 10; f++)
      l.sync(Array.from({ length: 32 }, (_, i) => shot(f * 32 + i, i, f)));
    expect(created).toHaveLength(32);
  });

  it('Scenario: Sprites de proyectiles (3 pintados; 1 desaparece y se crea otro)', () => {
    const { l, created } = layer(32);
    l.sync([shot(1, 10, 10), shot(2, 20, 20), shot(3, 30, 30)]);
    const next = [shot(1, 18, 10), shot(3, 38, 30), shot(4, 480, 270)];
    l.sync(next);
    const shown = visible(created);
    expect(shown).toHaveLength(3);
    for (const p of next) {
      const sprite = shown.find(
        (c) => Math.abs(c.x - p.x) <= 0.001 && Math.abs(c.y - p.y) <= 0.001,
      );
      expect(sprite, `proyectil ${String(p.id)}`).toBeDefined();
    }
    expect(created).toHaveLength(32);
  });

  it('un color fijo y el radio solo al ocupar un hueco', () => {
    const { l, created } = layer(1);
    l.sync([shot(1, 0, 0)]);
    l.sync([shot(1, 8, 0)]);
    l.sync([shot(1, 16, 0)]);
    expect([created[0]?.color, created[0]?.radius, created[0]?.resizes]).toEqual([
      PROJECTILE_COLOR,
      4,
      1,
    ]);
  });
});
