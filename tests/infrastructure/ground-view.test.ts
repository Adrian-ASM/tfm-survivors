import { describe, expect, it } from 'vitest';
import { createPlayfield, type GroundFactory } from '../../src/infrastructure/phaser/GroundView';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { GROUND_FILE } from '../support/appearance';
import { fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';
import { aDefaultConfig } from '../support/builders';
import { startRun } from '../support/runs';

// Spec sprite-rendering, "Fondo de hierba en el mundo entero" (0012, 0013): cubre el mundo
// (0, 0)–(1.920, 1.080), no la vista de 960 × 540, primero en
// profundidad (orden de creación) y en una posición fija.
interface Made {
  kind: 'tiles' | 'rect' | 'sprite' | 'ring';
  x: number;
  y: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  texture?: string;
  frame?: number;
  tileScale?: number;
  color?: number;
}

function setup(missing: string[] = []) {
  const log: Made[] = [];
  const kit = fakeKit();
  const create = kit.create.bind(kit);
  const ground: GroundFactory = {
    tiles: (width, height, texture, frame, tileScale) => {
      log.push({
        kind: 'tiles',
        x: 0,
        y: 0,
        width,
        height,
        originX: 0,
        originY: 0,
        texture,
        frame,
        tileScale,
      });
    },
    rect: (width, height, color) => {
      log.push({ kind: 'rect', x: 0, y: 0, width, height, originX: 0, originY: 0, color });
    },
  };
  const ring = (): RingSprite => {
    log.push({ kind: 'ring', x: 0, y: 0, width: 0, height: 0, originX: 0, originY: 0 });
    return { setPosition: () => 0, setRadius: () => 0, setAlpha: () => 0, setVisible: () => 0 };
  };
  const playfield = createPlayfield(
    {
      kit: {
        tint: kit.tint,
        create: () => {
          log.push({ kind: 'sprite', x: 0, y: 0, width: 0, height: 0, originX: 0, originY: 0 });
          return create();
        },
      },
      ring,
      looks: someLooks(() => undefined, missing),
      capacity: {
        enemies: 2,
        projectiles: 1,
        pulses: 1,
        gems: 1,
        corpses: 1,
        visualTicks: new Map(),
      },
    },
    ground,
    aDefaultConfig().arena,
    () => ({ clear: () => undefined, fill: () => undefined, refresh: () => undefined }),
  );
  return { log, playfield };
}

describe('Fondo de hierba', () => {
  it('Scenario: Fondo de hierba en el mundo entero (1.920 × 1.080 desde (0, 0), primero, fijo)', () => {
    const { log, playfield } = setup();
    const [first] = log;
    expect(first).toMatchObject({
      kind: 'tiles',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      originX: 0,
      originY: 0,
      texture: GROUND_FILE,
      frame: 0,
      tileScale: 0.5,
    });
    expect(log.slice(1).every((m) => m.kind !== 'tiles' && m.kind !== 'rect')).toBe(true);
    const base = startRun(aDefaultConfig()).snapshot();
    for (const [x, y] of [
      [480, 270],
      [100, 100],
    ] as const) {
      playfield.layers.render({ ...base, player: { ...base.player, x, y } });
    }
    expect(log.filter((m) => m.kind === 'tiles')).toHaveLength(1);
    expect(playfield.layers.counts.ground).toEqual({ visible: 1, placeholder: 0 });
  });

  it('Scenario: Fondo de reserva en el mundo entero (relleno liso (0, 0)–(1.920, 1.080))', () => {
    const { log, playfield } = setup([GROUND_FILE]);
    expect(log[0]).toMatchObject({ kind: 'rect', width: 1920, height: 1080, color: 0x2f6b3a });
    expect(playfield.layers.counts.ground).toEqual({ visible: 1, placeholder: 1 });
  });
});
