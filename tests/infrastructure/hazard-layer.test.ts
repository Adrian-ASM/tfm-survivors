import { describe, expect, it } from 'vitest';
import type {
  BlastSnapshot,
  DynamiteSnapshot,
  WarningSnapshot,
} from '../../src/domain/run/RunSnapshot';
import { PLACEHOLDER_SIZE } from '../../src/infrastructure/phaser/art/looks';
import { HazardLayer } from '../../src/infrastructure/phaser/HazardLayer';
import { DYNAMITE_FILE, EXPLOSION_FILE } from '../support/appearance';
import {
  FAKE_HAZARD_CAPACITY,
  FakeGraphics,
  fakeKit,
  type FakeSprite,
} from '../support/FakeSprite';
import { someLooks } from '../support/looks';

// Spec sprite-rendering (0020), "Pintado de los peligros" y reservas: capa de avisos, dinamitas y
// explosiones con un Graphics y pools fijos (sin motor).
const FRAME_MS = 1000 / 60;

const fuseWarning: WarningSnapshot = {
  x: 1039.333,
  y: 1000,
  radius: 56,
  source: 'fuse',
  explodesAt: 82,
};
const dynamiteWarning: WarningSnapshot = {
  x: 1000,
  y: 1000,
  radius: 48,
  source: 'dynamite',
  explodesAt: 194,
};
const dynamite = (x: number, y: number, id = 0): DynamiteSnapshot => ({
  id,
  x,
  y,
  targetX: 1000,
  targetY: 1000,
  radius: 8,
  explodesAt: 194,
});
const blast = (x: number, y: number, radius = 56, id = 0): BlastSnapshot => ({
  id,
  x,
  y,
  radius,
  tick: 1,
});

function layer(missing: string[] = [], edit?: Parameters<typeof someLooks>[0]) {
  const kit = fakeKit();
  const g = new FakeGraphics();
  const looks = someLooks(edit, missing);
  const l = new HazardLayer(kit, g, looks, FAKE_HAZARD_CAPACITY);
  const sprites = kit.created;
  // Creación: primero las dinamitas y después las explosiones (orden de pintado de la capa).
  const dynamites = sprites.slice(0, FAKE_HAZARD_CAPACITY.dynamites);
  const explosions = sprites.slice(FAKE_HAZARD_CAPACITY.dynamites);
  return { l, g, kit, looks, dynamites, explosions };
}

const shown = (sprites: readonly FakeSprite[]) => sprites.filter((s) => s.visible);

describe('HazardLayer · pintado de los peligros', () => {
  it('Scenario: Peligros del snapshot', () => {
    const { l, g, looks, dynamites, explosions } = layer();
    l.sync([fuseWarning, dynamiteWarning], [dynamite(1099.75, 1000)], [blast(500, 500)], 0);
    const { fuse, dynamite: dyn } = looks.warnings;
    expect(g.circles).toEqual([
      { x: 1039.333, y: 1000, radius: 56, color: fuse.color, alpha: fuse.alpha },
      { x: 1000, y: 1000, radius: 48, color: dyn.color, alpha: dyn.alpha },
    ]);
    expect(shown(dynamites).map((s) => [s.x, s.y, s.texture])).toEqual([
      [1099.75, 1000, DYNAMITE_FILE],
    ]);
    expect(shown(explosions).map((s) => [s.x, s.y, s.texture])).toEqual([
      [500, 500, EXPLOSION_FILE],
    ]);
    expect(l.counts).toEqual({
      warnings: { visible: 2, placeholder: 0 },
      dynamites: { visible: 1, placeholder: 0 },
      explosions: { visible: 1, placeholder: 0 },
    });
  });

  it('no crea objetos del motor por frame (todo en el constructor)', () => {
    const { l, kit } = layer();
    const created = kit.created.length;
    for (let k = 0; k < 120; k++) {
      const many = Array.from({ length: 30 }, (_, i) => blast(i * 10, 0, 56, k * 30 + i));
      l.sync([fuseWarning], [dynamite(k, 0, k)], many, k * FRAME_MS);
    }
    expect(kit.created.length).toBe(created);
    expect(created).toBe(FAKE_HAZARD_CAPACITY.dynamites + FAKE_HAZARD_CAPACITY.blasts);
  });

  it('Scenario: Fin de un aviso', () => {
    const { l, g, explosions } = layer();
    l.sync([dynamiteWarning], [dynamite(1004.9875, 1000)], [], 0);
    l.sync([], [], [blast(1000, 1000, 48)], FRAME_MS);
    expect(g.circles).toEqual([]);
    expect(l.counts.warnings.visible).toBe(0);
    expect(shown(explosions)).toHaveLength(1);
  });

  it('Scenario: Explosión más larga que su animación', () => {
    const explode = { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8], fps: 18, loop: false };
    const { l, explosions } = layer([], (raw) => {
      raw.explosion['explode'] = explode;
    });
    const frames: number[] = [];
    for (let k = 0; k < 60; k++) {
      l.sync([], [], [blast(500, 500)], 1000 + k * FRAME_MS);
      frames.push(shown(explosions)[0]?.frame ?? -1);
    }
    expect(frames[0]).toBe(0);
    const end = Math.ceil(500 / FRAME_MS);
    expect(frames.slice(end)).toEqual(frames.slice(end).map(() => 8));
    l.sync([], [], [], 1000 + 60 * FRAME_MS);
    expect(shown(explosions)).toEqual([]);
  });

  it('Scenario: Peligros con el mundo detenido (mismo frame de hoja en 300 frames)', () => {
    const { l, g, dynamites, explosions } = layer();
    const frame = () => [shown(dynamites)[0]?.frame, shown(explosions)[0]?.frame, g.circles.length];
    l.sync([dynamiteWarning], [dynamite(1050, 1000)], [blast(500, 500)], 250);
    const first = frame();
    for (let k = 0; k < 300; k++) {
      l.sync([dynamiteWarning], [dynamite(1050, 1000)], [blast(500, 500)], 250);
      expect(frame()).toEqual(first);
    }
  });

  it('clear() lo oculta todo sin animación de salida', () => {
    const { l, g, dynamites, explosions } = layer();
    l.sync([fuseWarning], [dynamite(1, 1)], [blast(2, 2)], 0);
    l.clear();
    expect([g.circles, shown(dynamites), shown(explosions)]).toEqual([[], [], []]);
    expect(l.counts).toEqual({
      warnings: { visible: 0, placeholder: 0 },
      dynamites: { visible: 0, placeholder: 0 },
      explosions: { visible: 0, placeholder: 0 },
    });
  });
});

describe('HazardLayer · reservas', () => {
  it('Scenario: Reserva de la dinamita y la explosión', () => {
    const { l, g, dynamites, explosions } = layer([DYNAMITE_FILE, EXPLOSION_FILE]);
    l.sync([dynamiteWarning], [dynamite(700, 400)], [blast(500, 500, 56)], 0);
    const [d] = shown(dynamites);
    const [e] = shown(explosions);
    expect([d?.x, d?.y]).toEqual([700, 400]);
    expect((d?.scale ?? 0) * PLACEHOLDER_SIZE).toBeCloseTo(16, 3);
    expect([e?.x, e?.y]).toEqual([500, 500]);
    expect((e?.scale ?? 0) * PLACEHOLDER_SIZE).toBeCloseTo(112, 3);
    expect(l.counts.dynamites).toEqual({ visible: 1, placeholder: 1 });
    expect(l.counts.explosions).toEqual({ visible: 1, placeholder: 1 });
    expect(l.counts.warnings).toEqual({ visible: 1, placeholder: 0 });
    expect(g.circles).toHaveLength(1);
  });
});
