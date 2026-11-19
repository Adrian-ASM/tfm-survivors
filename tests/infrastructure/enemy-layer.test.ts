import { describe, expect, it } from 'vitest';
import type { EnemySnapshot } from '../../src/domain/run/RunSnapshot';
import { EnemyLayer, type CircleSprite } from '../../src/infrastructure/phaser/EnemyLayer';
import { DEFAULT_ENEMY_COLOR, enemyPalette } from '../../src/infrastructure/phaser/enemyPalette';

/** Doble de un círculo del motor: registra su estado y cuántas veces se recolorea o redimensiona. */
class FakeCircle implements CircleSprite {
  x = 0;
  y = 0;
  radius = 1;
  color = 0;
  visible = true;
  restyles = 0;

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setRadius(radius: number): this {
    this.radius = radius;
    this.restyles += 1;
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
  const l = new EnemyLayer(capacity, () => {
    const c = new FakeCircle();
    created.push(c);
    return c;
  });
  return { l, created };
}

const enemy = (id: number, type: string, x: number, y: number, radius = 10): EnemySnapshot => ({
  id,
  type,
  x,
  y,
  radius,
  health: 10,
});

describe('EnemyLayer', () => {
  it('preasigna el pool completo, oculto, y no crea más al sincronizar', () => {
    const { l, created } = layer(200);
    expect(created).toHaveLength(200);
    expect(created.every((c) => !c.visible)).toBe(true);
    const many = Array.from({ length: 200 }, (_, i) => enemy(i, 'bug', i, i));
    for (let frame = 0; frame < 10; frame++) l.sync(many);
    expect(created).toHaveLength(200);
  });

  it('posiciona los n primeros huecos y los hace visibles con el radio y el color del tipo', () => {
    const { l, created } = layer(4);
    l.sync([enemy(0, 'bug', 10, 20), enemy(1, 'memory-leak', 30, 40, 22)]);
    expect(created.slice(0, 2).map((c) => [c.x, c.y, c.radius, c.color, c.visible])).toEqual([
      [10, 20, 10, enemyPalette('bug'), true],
      [30, 40, 22, enemyPalette('memory-leak'), true],
    ]);
    expect(created.slice(2).every((c) => !c.visible)).toBe(true);
  });

  it('oculta los huecos sobrantes cuando hay menos enemigos', () => {
    const { l, created } = layer(3);
    l.sync([enemy(0, 'bug', 1, 1), enemy(1, 'bug', 2, 2), enemy(2, 'bug', 3, 3)]);
    l.sync([enemy(0, 'bug', 1, 1)]);
    expect(created.map((c) => c.visible)).toEqual([true, false, false]);
  });

  it('cambia radio y color solo si cambia el tipo del hueco', () => {
    const { l, created } = layer(1);
    l.sync([enemy(0, 'bug', 1, 1)]);
    l.sync([enemy(0, 'bug', 5, 5)]);
    expect(created[0]?.restyles).toBe(1);
    l.sync([enemy(7, 'merge-conflict', 5, 5, 16)]);
    expect(created[0]?.restyles).toBe(2);
    expect([created[0]?.radius, created[0]?.color]).toEqual([16, enemyPalette('merge-conflict')]);
  });

  it('ignora los enemigos que no caben en el pool', () => {
    const { l, created } = layer(1);
    l.sync([enemy(0, 'bug', 1, 1), enemy(1, 'bug', 2, 2)]);
    expect(created).toHaveLength(1);
    expect([created[0]?.x, created[0]?.y]).toEqual([1, 1]);
  });
});

describe('enemyPalette', () => {
  it('da un color distinto a cada tipo por defecto', () => {
    const colors = ['bug', 'memory-leak', 'merge-conflict'].map(enemyPalette);
    expect(new Set(colors).size).toBe(3);
    expect(colors).not.toContain(DEFAULT_ENEMY_COLOR);
  });

  it('usa un color por defecto si el id no está en la paleta', () => {
    expect(enemyPalette('segfault')).toBe(DEFAULT_ENEMY_COLOR);
  });
});
