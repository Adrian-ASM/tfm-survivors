import { describe, expect, it } from 'vitest';
import type { PickupKind } from '../../src/domain/pickup/PickupKind';
import type { PickupSnapshot } from '../../src/domain/run/RunSnapshot';
import { PLACEHOLDER_SIZE, PLACEHOLDER_TEXTURE } from '../../src/infrastructure/phaser/art/looks';
import { PickupLayer } from '../../src/infrastructure/phaser/PickupLayer';
import { aDefaultConfig } from '../support/builders';
import { fakeKit, type FakeSprite } from '../support/FakeSprite';
import { repoLooks } from '../support/looks';
import { startSeededRun } from '../support/runs';

// Spec sprite-rendering (0030) con los datos de aspecto del repositorio y sus PNG reales (rejilla de
// cada hoja, como `frameTotal − 1` en Phaser): tamaños, aparición, reserva y montones del inicio.
const FRAME_MS = 1000 / 60;
const G_IDLE = 'Resources/Resources/G_Idle.png';
const W_IDLE = 'Resources/Resources/W_Idle.png';
const M_IDLE = 'Resources/Resources/M_Idle.png';
const G_SPAWN = 'Resources/Resources/G_Spawn.png';
const W_SPAWN = 'Resources/Resources/W_Spawn.png';
const M_SPAWN = 'Resources/Resources/M_Spawn.png';
const SPAWNS = [G_SPAWN, W_SPAWN, M_SPAWN];

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
  it('Scenario: Tamaños de los recogibles del repositorio (64 px en aparición y en idle; rocas 48; gema 20)', () => {
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
    l.sync([], 0);
    for (const [ms, sheets] of [
      [100, SPAWNS],
      [10_000, [G_IDLE, W_IDLE, M_IDLE]],
    ] as const) {
      l.sync(snap, ms);
      [200, 300, 400].forEach((x, i) => {
        const [s] = shownNear(created, x);
        expect(s?.texture).toBe(sheets[i]);
        expect(side(s, 128)).toBeCloseTo(64, 3);
      });
      for (const x of [500, 600, 700])
        expect(side(shownNear(created, x)[0], 64)).toBeCloseTo(48, 3);
      expect(side(shownNear(created, 100)[0], PLACEHOLDER_SIZE)).toBeCloseTo(20, 3);
    }
    expect([config.progression.gemRadius, config.player.pickupRadius]).toEqual([5, 128]);
  });

  it('Scenario: Piedra y gema sin aparición (61 frames: roca y forma de color que flotan, sin *_Spawn)', () => {
    const { l, created } = repoLayer();
    const snap = [pick(0, 'stone', 500, 300, 'goblin-tnt'), pick(1, 'xp', 600, 300)];
    const ys = new Set<number>();
    for (let f = 0; f <= 60; f++) {
      l.sync(snap, 200 + f * FRAME_MS);
      const [rock] = shownNear(created, 500);
      const [gem] = shownNear(created, 600);
      expect([rock?.texture, gem?.texture]).toEqual(['Deco/05.png', PLACEHOLDER_TEXTURE]);
      ys.add(Number(rock?.y.toFixed(3)));
      expect(visible(created).some((s) => SPAWNS.includes(s.texture))).toBe(false);
    }
    expect(ys.size).toBeGreaterThan(1);
    expect([l.spawns.stone, l.spawns.xp]).toEqual([0, 0]);
  });

  it('Scenario: Hoja de aparición que no carga (sin W_Spawn: wood flota con W_Idle; gold con G_Spawn)', () => {
    const { l, created } = repoLayer([W_SPAWN]);
    l.sync([], 0);
    const snap = [pick(0, 'wood', 500, 300), pick(1, 'gold', 600, 300)];
    const woodYs = new Set<number>();
    for (let f = 0; f <= 60; f++) {
      l.sync(snap, 100 + f * FRAME_MS);
      const [wood] = shownNear(created, 500);
      expect(wood?.texture).toBe(W_IDLE);
      woodYs.add(Number(wood?.y.toFixed(3)));
      if (f < 30) expect(shownNear(created, 600)[0]?.texture).toBe(G_SPAWN);
    }
    expect(woodYs.size).toBeGreaterThan(1);
    expect([l.counts.wood.placeholder, l.counts.gold.placeholder]).toEqual([0, 0]);
  });

  it('Scenario: Hoja de aparición que falla sin reserva (las tres *_Spawn sin cargar: idle, 0 reservas)', () => {
    const { l, created } = repoLayer(SPAWNS);
    l.sync([], 0);
    l.sync([pick(0, 'gold', 100, 0), pick(1, 'wood', 200, 0), pick(2, 'meat', 300, 0)], 50);

    expect([100, 200, 300].map((x) => shownNear(created, x)[0]?.texture)).toEqual([
      G_IDLE,
      W_IDLE,
      M_IDLE,
    ]);
    expect([l.counts.gold, l.counts.wood, l.counts.meat].map((c) => c.placeholder)).toEqual([
      0, 0, 0,
    ]);
  });

  it('Scenario: Montones del repositorio (semilla 42: 8 inicios distintos; el último acaba ≤ R0 + 3.000)', () => {
    const run = startSeededRun(aDefaultConfig(), 42);
    const piles = run.snapshot().pickups.filter((p) => p.kind === 'wood');
    expect(piles.map((p) => p.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const { l, created } = repoLayer();
    const R0 = 5000;
    const sprite = (p: PickupSnapshot) =>
      created.find((s) => s.visible && s.x === p.x && Math.abs(s.y - p.y) <= 4.001);
    const leaveFrame0 = new Map<number, number>();
    const idleAt = new Map<number, number>();
    for (let ms = R0; ms <= R0 + 3000 + 0.001; ms += FRAME_MS) {
      l.sync(piles, ms);
      for (const p of piles) {
        const s = sprite(p);
        if (s?.texture === W_SPAWN && s.frame !== 0 && !leaveFrame0.has(p.id)) {
          leaveFrame0.set(p.id, ms);
        }
        if (s?.texture === W_IDLE && !idleAt.has(p.id)) idleAt.set(p.id, ms);
      }
    }
    // El inicio R_a se ve al dejar el frame 0 (R_a + 100 ms a 10 fps, ±1 frame de render).
    expect(new Set(piles.map((p) => leaveFrame0.get(p.id))).size).toBe(8);
    expect(piles.every((p) => idleAt.has(p.id))).toBe(true);
    expect(Math.max(...idleAt.values())).toBeLessThanOrEqual(R0 + 3000);
  });
});

const visible = (sprites: FakeSprite[]) => sprites.filter((s) => s.visible);
