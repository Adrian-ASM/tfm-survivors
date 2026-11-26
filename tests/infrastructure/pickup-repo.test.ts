import { describe, expect, it } from 'vitest';
import type { PickupKind } from '../../src/domain/pickup/PickupKind';
import type { PickupSnapshot } from '../../src/domain/run/RunSnapshot';
import { PLACEHOLDER_SIZE } from '../../src/infrastructure/phaser/art/looks';
import { PickupLayer } from '../../src/infrastructure/phaser/PickupLayer';
import { aDefaultConfig } from '../support/builders';
import { fakeKit, type FakeSprite } from '../support/FakeSprite';
import { repoLooks } from '../support/looks';

// Spec sprite-rendering (0030) con los datos de aspecto del repositorio y sus PNG reales: tamaños de
// los recogibles en pantalla.
const pick = (id: number, kind: PickupKind, x: number, y: number, source?: string) =>
  ({
    id,
    kind,
    value: 1,
    x,
    y,
    radius: 5,
    ...(source === undefined ? {} : { source }),
  }) as PickupSnapshot;

function repoLayer(missing: readonly string[] = []) {
  const kit = fakeKit();
  const looks = repoLooks(missing);
  const l = new PickupLayer(436, kit, looks.pickups, looks.stones, looks.pickupMotion);
  return { l, created: kit.created, looks };
}

const shownNear = (sprites: FakeSprite[], x: number) =>
  sprites.filter((s) => s.visible && Math.abs(s.x - x) <= 0.001);

/** Lado en pantalla de un sprite cuyo frame mide `frame` px (en la forma de color, el disco). */
const side = (s: FakeSprite | undefined, frame: number) => (s?.scale ?? 0) * frame;

describe('Recogibles con los datos de aspecto del repositorio (sprite-rendering 0030)', () => {
  it('Scenario: Tamaños de los recogibles del repositorio (64 px; rocas 0,75 × 64; gema 20 px)', () => {
    const { l, created } = repoLayer();
    const config = aDefaultConfig();
    const snap = [
      pick(0, 'xp', 100, 100),
      pick(1, 'gold', 200, 100),
      pick(2, 'wood', 300, 100),
      pick(3, 'meat', 400, 100),
      pick(4, 'stone', 500, 100, 'goblin-torch'),
      pick(5, 'stone', 600, 100, 'goblin-tnt'),
      pick(6, 'stone', 700, 100, 'goblin-tnt-guard'),
    ];
    for (const ms of [0, 10_000]) {
      l.sync(snap, ms);
      for (const x of [200, 300, 400])
        expect(side(shownNear(created, x)[0], 128)).toBeCloseTo(64, 3);
      for (const x of [500, 600, 700])
        expect(side(shownNear(created, x)[0], 64)).toBeCloseTo(48, 3);
      expect(side(shownNear(created, 100)[0], PLACEHOLDER_SIZE)).toBeCloseTo(20, 3);
    }
    expect([config.progression.gemRadius, config.player.pickupRadius]).toEqual([5, 128]);
  });
});
