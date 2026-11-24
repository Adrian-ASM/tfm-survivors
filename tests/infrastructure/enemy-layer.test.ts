import { describe, expect, it } from 'vitest';
import type { EnemySnapshot } from '../../src/domain/run/RunSnapshot';
import { PLACEHOLDER_SIZE, PLACEHOLDER_TEXTURE } from '../../src/infrastructure/phaser/art/looks';
import { EnemyLayer, type CorpseSink } from '../../src/infrastructure/phaser/EnemyLayer';
import { WHITE } from '../../src/infrastructure/phaser/SpriteLike';
import { BARREL_FILE, TNT_FILE, TORCH_FILE } from '../support/appearance';
import { FAKE_TINT, fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';

// Specs simulation-loop ("Pintado de los enemigos vivos"), sprite-rendering y auto-weapons (0012).
const FRAME_MS = 16.667;
const IDLE = [0, 1];
const WALK = [6, 7, 8, 9];

const enemy = (
  id: number,
  type: string,
  x: number,
  y: number,
  opts: { radius?: number; damaged?: boolean } = {},
): EnemySnapshot => ({
  id,
  type,
  x,
  y,
  radius: opts.radius ?? 10,
  health: 10,
  damaged: opts.damaged ?? false,
  state: 'chase',
  stateKind: 'chase',
});

class SpyCorpses implements CorpseSink {
  readonly spawned: { x: number; y: number; facingLeft: boolean; radius: number }[] = [];
  spawn(x: number, y: number, facingLeft: boolean, radius: number): boolean {
    this.spawned.push({ x, y, facingLeft, radius });
    return true;
  }
}

function layer(
  capacity: number,
  opts: { missing?: string[]; edit?: Parameters<typeof someLooks>[0] } = {},
) {
  const kit = fakeKit();
  const corpses = new SpyCorpses();
  const looks = someLooks(opts.edit, opts.missing);
  const l = new EnemyLayer(capacity, kit, looks.enemies, corpses);
  let tick = 0;
  const sync = (enemies: readonly EnemySnapshot[]): void => {
    tick += 1;
    l.sync(enemies, tick, tick * FRAME_MS);
  };
  return { l, sync, sprites: kit.created, corpses };
}

const visible = <T extends { visible: boolean }>(sprites: T[]): T[] =>
  sprites.filter((s) => s.visible);

describe('EnemyLayer · pool y aspecto por tipo', () => {
  it('preasigna el pool completo, oculto, y no crea más al sincronizar', () => {
    const { sync, sprites } = layer(200);
    expect(sprites).toHaveLength(200);
    expect(visible(sprites)).toHaveLength(0);
    const many = Array.from({ length: 200 }, (_, i) => enemy(i, 'goblin-torch', i, i));
    for (let frame = 0; frame < 10; frame++) sync(many);
    expect(sprites).toHaveLength(200);
  });

  it('Scenario: Aspecto por tipo (tres hojas distintas)', () => {
    const { sync, sprites } = layer(4);
    sync([
      enemy(0, 'goblin-torch', 10, 20),
      enemy(1, 'goblin-tnt', 30, 40, { radius: 22 }),
      enemy(2, 'goblin-barrel', 50, 60, { radius: 16 }),
    ]);
    expect(sprites.slice(0, 3).map((s) => [s.texture, s.x, s.y, s.visible])).toEqual([
      [TORCH_FILE, 10, 20, true],
      [TNT_FILE, 30, 40, true],
      [BARREL_FILE, 50, 60, true],
    ]);
  });

  it('Scenario: Escala independiente de la hitbox (192 px, escala 0,5, origen (0,5; 0,75))', () => {
    const { sync, sprites } = layer(2, {
      edit: (raw) => {
        const tnt = raw.enemies['goblin-tnt'] ?? {};
        tnt.scale = 0.5;
        tnt.origin = { x: 0.5, y: 0.75 };
      },
    });
    sync([
      enemy(0, 'goblin-tnt', 400, 300, { radius: 22 }),
      enemy(1, 'goblin-tnt', 400, 300, { radius: 30 }),
    ]);
    for (const s of sprites) {
      expect(192 * s.scale).toBeCloseTo(96, 3);
      const tl = s.topLeft(192, 192);
      expect(tl.x + 0.5 * 96).toBeCloseTo(400, 3);
      expect(tl.y + 0.75 * 96).toBeCloseTo(300, 3);
    }
  });

  it('Scenario: Tamaño del aspecto de reserva (hoja sin cargar, radio 10 en (300, 200))', () => {
    const { sync, sprites, l } = layer(2, { missing: [TORCH_FILE] });
    sync([enemy(0, 'goblin-torch', 300, 200), enemy(1, 'goblin-tnt', 10, 10)]);
    const [s] = sprites;
    expect(s?.texture).toBe(PLACEHOLDER_TEXTURE);
    expect((s?.scale ?? 0) * PLACEHOLDER_SIZE).toBeCloseTo(20, 3);
    expect([s?.originX, s?.originY, s?.x, s?.y]).toEqual([0.5, 0.5, 300, 200]);
    expect(s?.tint).toBe(0xe5484d);
    expect(l.counts).toEqual({ visible: 2, placeholder: 1 });
    expect(l.placeholdersByType).toEqual({
      'goblin-torch': 1,
      'goblin-tnt': 0,
      'goblin-barrel': 0,
    });
  });
});

describe('EnemyLayer · bajas (hueco asociado al id)', () => {
  const ten = Array.from({ length: 10 }, (_, i) =>
    enemy(i + 1, i % 2 ? 'goblin-tnt' : 'goblin-torch', 10 * i, 5 * i),
  );

  it('Scenario: Bajas en medio de la lista (3 y 7: 8 visibles, cada uno en su posición)', () => {
    const { sync, sprites } = layer(10);
    sync(ten);
    const rest = ten.filter((e) => e.id !== 3 && e.id !== 7);
    sync(rest);
    const shown = visible(sprites).map((s) => [s.x, s.y, s.texture]);
    expect(shown).toHaveLength(8);
    for (const e of rest) {
      expect(shown).toContainEqual([e.x, e.y, e.type === 'goblin-tnt' ? TNT_FILE : TORCH_FILE]);
    }
  });

  it('Scenario: Todos dados de baja (200 pintados y después ninguno)', () => {
    const { sync, sprites, l } = layer(200);
    sync(Array.from({ length: 200 }, (_, i) => enemy(i, 'goblin-torch', i, i)));
    sync([]);
    expect(visible(sprites)).toHaveLength(0);
    expect(l.counts.visible).toBe(0);
  });

  it('Scenario: Reposición tras bajas (150 supervivientes y 50 nuevos de otro tipo)', () => {
    const { sync, sprites, l } = layer(200);
    const first = Array.from({ length: 200 }, (_, i) => enemy(i, 'goblin-torch', i, 0));
    sync(first);
    const next = [
      ...first.slice(0, 150),
      ...Array.from({ length: 50 }, (_, i) => enemy(1000 + i, 'goblin-tnt', i, 500)),
    ];
    sync(next);
    const shown = visible(sprites).map((s) => [s.texture, s.x, s.y].join('@'));
    expect(new Set(shown).size).toBe(200);
    expect(shown.filter((k) => k.startsWith(TNT_FILE))).toHaveLength(50);
    expect(l.counts.visible).toBe(200);
  });

  it('una baja avisa al sumidero de cadáveres con la última posición pintada', () => {
    const { sync, corpses } = layer(4);
    sync([enemy(1, 'goblin-torch', 300, 200)]);
    sync([]);
    expect(corpses.spawned).toEqual([{ x: 300, y: 200, facingLeft: false, radius: 10 }]);
  });

  it('clear() no genera cadáveres', () => {
    const { sync, corpses, l, sprites } = layer(4);
    sync([enemy(1, 'goblin-torch', 300, 200)]);
    l.clear();
    expect(corpses.spawned).toEqual([]);
    expect(visible(sprites)).toHaveLength(0);
  });
});

describe('EnemyLayer · animación y orientación', () => {
  it('Scenario: Hueco reutilizado (id 7 andando a la izquierda muere; id 9 en su hueco: idle)', () => {
    const { sync, sprites } = layer(1);
    for (let i = 0; i < 5; i++) sync([enemy(7, 'goblin-torch', 100 - 3 * i, 100)]);
    const [s] = sprites;
    expect([s?.flipX, WALK.includes(s?.frame ?? -1)]).toEqual([true, true]);
    sync([enemy(9, 'goblin-torch', 800, 100)]);
    expect([s?.flipX, IDLE.includes(s?.frame ?? -1)]).toEqual([false, true]);
  });

  it('Scenario: Umbral de movimiento (0,0005 px: idle)', () => {
    const { sync, sprites } = layer(1);
    sync([enemy(1, 'goblin-torch', 100, 100)]);
    sync([enemy(1, 'goblin-torch', 103, 100)]);
    expect(WALK).toContain(sprites[0]?.frame);
    sync([enemy(1, 'goblin-torch', 103.0005, 100)]);
    expect(IDLE).toContain(sprites[0]?.frame);
  });
});

describe('EnemyLayer · indicación de daño', () => {
  it('Scenario: Indicación de daño fiel al snapshot (FILL blanco y vuelta a MULTIPLY)', () => {
    const { sync, sprites } = layer(1);
    sync([enemy(1, 'goblin-torch', 0, 0, { damaged: true })]);
    expect([sprites[0]?.tint, sprites[0]?.tintMode]).toEqual([WHITE, FAKE_TINT.fill]);
    sync([enemy(1, 'goblin-torch', 0, 0)]);
    expect([sprites[0]?.tint, sprites[0]?.tintMode]).toEqual([WHITE, FAKE_TINT.multiply]);
  });

  it('Scenario: Indicación de daño con aspecto de reserva (destello y vuelta a su color)', () => {
    const { sync, sprites } = layer(1, { missing: [TORCH_FILE] });
    sync([enemy(1, 'goblin-torch', 0, 0, { damaged: true })]);
    expect([sprites[0]?.tint, sprites[0]?.tintMode]).toEqual([WHITE, FAKE_TINT.fill]);
    sync([enemy(1, 'goblin-torch', 0, 0)]);
    expect([sprites[0]?.tint, sprites[0]?.tintMode]).toEqual([0xe5484d, FAKE_TINT.multiply]);
  });

  it('solo retinta cuando cambia la indicación', () => {
    const { sync, sprites } = layer(1);
    sync([enemy(1, 'goblin-torch', 0, 0)]);
    const before = sprites[0]?.tintSets ?? 0;
    for (let i = 0; i < 10; i++) sync([enemy(1, 'goblin-torch', i, 0)]);
    expect(sprites[0]?.tintSets).toBe(before);
  });
});
