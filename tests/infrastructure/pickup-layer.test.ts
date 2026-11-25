import { describe, expect, it } from 'vitest';
import type { PickupKind } from '../../src/domain/pickup/PickupKind';
import type { PickupSnapshot } from '../../src/domain/run/RunSnapshot';
import { PLACEHOLDER_TEXTURE, resolveLooks } from '../../src/infrastructure/phaser/art/looks';
import { PickupLayer } from '../../src/infrastructure/phaser/PickupLayer';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import {
  GOLD_FILE,
  MEAT_FILE,
  REGISTERED,
  ROCK_LARGE_FILE,
  ROCK_MEDIUM_FILE,
  ROCK_SMALL_FILE,
  WOOD_FILE,
  rawAppearance,
  type RawAppearance,
} from '../support/appearance';
import { fakeKit } from '../support/FakeSprite';

// Specs xp-gems ("Pintado de las gemas") y sprite-rendering ("Aspectos de los recogibles", "Flechas
// y gemas", "Recogibles de los tres tipos") de 0022: un pool de recogibles con aspecto por tipo.
const pick = (id: number, kind: PickupKind, x: number, y: number, radius = 5): PickupSnapshot => ({
  id,
  kind,
  value: 1,
  x,
  y,
  radius,
});
const gems = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => pick(from + i, 'xp', 10 * i, 3 * i));

/** Piedra del snapshot con su origen (o sin él). */
const stone = (id: number, x: number, y: number, source?: string): PickupSnapshot => ({
  ...pick(id, 'stone', x, y),
  ...(source === undefined ? {} : { source }),
});
/** Fixture con el guardia (roca `large`); torch `small` y tnt `medium` como en el fixture. */
const withGuard = (r: RawAppearance) => {
  r.enemies['goblin-tnt-guard'] = { ...(r.enemies['goblin-tnt'] as object), rock: 'large' };
};

/** Aspectos del fixture (con el guardia) con las hojas cargadas salvo las de `missing`. */
function looks(
  missing: readonly string[] = [],
  change: (r: RawAppearance) => void = () => undefined,
) {
  const raw = rawAppearance();
  withGuard(raw);
  change(raw);
  const r = parseAppearance(raw, REGISTERED);
  if (!r.ok) throw new Error(r.error.message);
  return resolveLooks(r.value, (key) => (missing.includes(key) ? null : 64));
}

function layer(
  capacity: number,
  missing: readonly string[] = [],
  change?: (r: RawAppearance) => void,
) {
  const kit = fakeKit();
  const all = looks(missing, change);
  const l = new PickupLayer(capacity, kit, all.pickups, all.stones);
  return { l, created: kit.created };
}

const visible = <T extends { visible: boolean }>(sprites: T[]): T[] =>
  sprites.filter((s) => s.visible);
const at = <T extends { x: number; y: number }>(sprites: T[], p: { x: number; y: number }) =>
  sprites.filter((c) => Math.abs(c.x - p.x) <= 0.001 && Math.abs(c.y - p.y) <= 0.001);

describe('PickupLayer', () => {
  it('Scenario: Recogidas y nuevas (10 pintadas; 3 recogidas y 2 nuevas: 9 visibles)', () => {
    const { l, created } = layer(396);
    const first = gems(0, 10);
    l.sync(first);
    const next = [
      ...first.filter((g) => ![1, 4, 7].includes(g.id)),
      pick(10, 'xp', 500, 1),
      pick(11, 'xp', 600, 2),
    ];
    l.sync(next);
    const shown = visible(created);
    expect(shown).toHaveLength(9);
    for (const g of next) expect(at(shown, g), `gema ${String(g.id)}`).toHaveLength(1);
    expect(l.counts.xp).toEqual({ visible: 9, placeholder: 0 });
  });

  it('Scenario: Tope de gemas pintado (300 gemas: 300 visibles, todas con el aspecto de la gema)', () => {
    const { l, created } = layer(396);
    l.sync(gems(0, 300));
    const shown = visible(created);
    expect(shown).toHaveLength(300);
    // La gema sin hoja es una forma de color (textura de reserva teñida con su color).
    expect(shown.every((s) => s.texture === PLACEHOLDER_TEXTURE && s.tint === 0x3e9bff)).toBe(true);
    expect(created).toHaveLength(396);
    expect(l.counts.xp).toEqual({ visible: 300, placeholder: 0 });
  });

  it('Scenario: Todas recogidas (300 pintadas y después ninguna)', () => {
    const { l, created } = layer(396);
    l.sync(gems(0, 300));
    l.sync([]);
    expect([visible(created).length, l.counts.xp.visible]).toEqual([0, 0]);
  });

  it('Scenario: Topes de los cinco tipos pintados (uno por recogible, con su aspecto, sin reserva)', () => {
    const { l, created } = layer(436);
    const sources = ['goblin-torch', 'goblin-tnt', 'goblin-tnt-guard'];
    const all = [
      ...gems(0, 300),
      ...Array.from({ length: 32 }, (_, i) => pick(300 + i, 'gold', 1000 + i, 500)),
      ...Array.from({ length: 64 }, (_, i) => pick(332 + i, 'wood', 2000 + i, 800)),
      ...Array.from({ length: 8 }, (_, i) => pick(396 + i, 'meat', 2500 + i, 900)),
      ...Array.from({ length: 32 }, (_, i) => stone(404 + i, 3000 + i, 950, sources[i % 3])),
    ];
    l.sync(all);
    const shown = visible(created);
    expect(shown).toHaveLength(436);
    expect(created).toHaveLength(436);
    expect(shown.filter((s) => s.texture === GOLD_FILE)).toHaveLength(32);
    expect(shown.filter((s) => s.texture === WOOD_FILE)).toHaveLength(64);
    expect(shown.filter((s) => s.texture === MEAT_FILE)).toHaveLength(8);
    expect(shown.filter((s) => s.texture === ROCK_SMALL_FILE)).toHaveLength(11);
    expect(shown.filter((s) => s.texture === ROCK_MEDIUM_FILE)).toHaveLength(11);
    expect(shown.filter((s) => s.texture === ROCK_LARGE_FILE)).toHaveLength(10);
    expect(l.counts).toEqual({
      xp: { visible: 300, placeholder: 0 },
      gold: { visible: 32, placeholder: 0 },
      wood: { visible: 64, placeholder: 0 },
      meat: { visible: 8, placeholder: 0 },
      stone: { visible: 32, placeholder: 0 },
    });
  });

  it('Scenario: Sprite reutilizado para la piedra (la de goblin-tnt-guard recogida; la nueva small)', () => {
    const { l, created } = layer(1);
    l.sync([stone(0, 10, 10, 'goblin-tnt-guard')]);
    expect(visible(created)[0]?.texture).toBe(ROCK_LARGE_FILE);
    l.sync([stone(1, 70, 80, 'goblin-torch')]);
    const shown = visible(created);

    expect(shown).toHaveLength(1);
    expect([shown[0]?.texture, shown[0]?.x, shown[0]?.y]).toEqual([ROCK_SMALL_FILE, 70, 80]);
    expect(l.counts.stone).toEqual({ visible: 1, placeholder: 0 });
  });

  it('Scenario: Cada piedra con la roca de su origen (torch 04, tnt 05, guard 06 y sin origen 05)', () => {
    const { l, created } = layer(4);
    const snap = [
      stone(0, 100, 100, 'goblin-torch'),
      stone(1, 200, 100, 'goblin-tnt'),
      stone(2, 300, 100, 'goblin-tnt-guard'),
      stone(3, 400, 100),
    ];
    l.sync(snap);
    const textures = snap.map((p) => at(visible(created), p).map((s) => [s.texture, s.originX]));

    expect(textures).toEqual([
      [[ROCK_SMALL_FILE, 0.5]],
      [[ROCK_MEDIUM_FILE, 0.5]],
      [[ROCK_LARGE_FILE, 0.5]],
      [[ROCK_MEDIUM_FILE, 0.5]],
    ]);
  });

  it('Scenario: Cambiar la roca es solo de datos (goblin-torch large: Deco/06)', () => {
    const { l, created } = layer(1, [], (r) => {
      (r.enemies['goblin-torch'] as Record<string, unknown>).rock = 'large';
    });
    l.sync([stone(0, 10, 10, 'goblin-torch')]);

    expect(visible(created)[0]?.texture).toBe(ROCK_LARGE_FILE);
  });

  it('Scenario: Reserva de una roca (sin Deco/04: la de torch, forma de 10 px del color de stone)', () => {
    const { l, created } = layer(3, [ROCK_SMALL_FILE]);
    l.sync([
      stone(0, 700, 400, 'goblin-torch'),
      stone(1, 800, 400, 'goblin-tnt-guard'),
      pick(2, 'gold', 50, 50),
    ]);
    const [torch] = at(visible(created), { x: 700, y: 400 });

    expect([torch?.texture, torch?.tint]).toEqual([PLACEHOLDER_TEXTURE, 0x9aa0a6]);
    expect((torch?.scale ?? 0) * 64).toBeCloseTo(10, 6);
    expect(at(visible(created), { x: 800, y: 400 })[0]?.texture).toBe(ROCK_LARGE_FILE);
    expect(at(visible(created), { x: 50, y: 50 })[0]?.texture).toBe(GOLD_FILE);
    expect(l.counts.stone).toEqual({ visible: 2, placeholder: 1 });
  });

  it('Scenario: Recuento de piedras por roca agregado (2 torch, 1 tnt y 3 guard sin Deco/06)', () => {
    const { l } = layer(6, [ROCK_LARGE_FILE]);
    l.sync([
      stone(0, 1, 1, 'goblin-torch'),
      stone(1, 2, 1, 'goblin-torch'),
      stone(2, 3, 1, 'goblin-tnt'),
      stone(3, 4, 1, 'goblin-tnt-guard'),
      stone(4, 5, 1, 'goblin-tnt-guard'),
      stone(5, 6, 1, 'goblin-tnt-guard'),
    ]);

    expect(l.counts.stone).toEqual({ visible: 6, placeholder: 3 });
    l.sync([]);
    expect(l.counts.stone).toEqual({ visible: 0, placeholder: 0 });
  });

  it('Scenario: Sprite reutilizado para la carne (el wood recogido; la carne con su aspecto)', () => {
    const { l, created } = layer(1);
    l.sync([pick(0, 'wood', 10, 10)]);
    l.sync([pick(1, 'meat', 70, 80)]);
    const shown = visible(created);
    expect(shown).toHaveLength(1);
    expect([shown[0]?.texture, shown[0]?.x, shown[0]?.y]).toEqual([MEAT_FILE, 70, 80]);
    expect([l.counts.wood.visible, l.counts.meat.visible]).toEqual([0, 1]);
  });

  it('Scenario: Reserva de la carne (sin M_Idle: forma de 10 px del color de meat; el oro con G_Idle)', () => {
    const { l, created } = layer(2, [MEAT_FILE]);
    l.sync([pick(0, 'meat', 700, 400), pick(1, 'gold', 50, 50)]);
    const [meat] = at(visible(created), { x: 700, y: 400 });
    expect([meat?.texture, meat?.tint]).toEqual([PLACEHOLDER_TEXTURE, 0xc8504a]);
    expect((meat?.scale ?? 0) * 64).toBeCloseTo(10, 6);
    expect(at(visible(created), { x: 50, y: 50 })[0]?.texture).toBe(GOLD_FILE);
    expect(l.counts.meat).toEqual({ visible: 1, placeholder: 1 });
  });

  it('Scenario: Sprite reutilizado con otro tipo (la gema recogida; el oro con su aspecto)', () => {
    const { l, created } = layer(1);
    l.sync([pick(0, 'xp', 10, 10)]);
    l.sync([pick(1, 'gold', 50, 60)]);
    const shown = visible(created);
    expect(shown).toHaveLength(1);
    expect([shown[0]?.texture, shown[0]?.x, shown[0]?.y]).toEqual([GOLD_FILE, 50, 60]);
    expect([l.counts.xp.visible, l.counts.gold.visible]).toEqual([0, 1]);
  });

  it('Scenario: Recogibles de los tres tipos (4 gemas, 2 gold y 3 wood; ninguna gema con G_Idle)', () => {
    const { l, created } = layer(396);
    const snap = [
      ...gems(0, 4),
      pick(4, 'gold', 400, 400),
      pick(5, 'gold', 410, 400),
      pick(6, 'wood', 500, 400),
      pick(7, 'wood', 510, 400),
      pick(8, 'wood', 520, 400),
    ];
    l.sync(snap);
    const shown = visible(created);
    for (const p of snap) expect(at(shown, p)).toHaveLength(1);
    const gemSprites = snap.filter((p) => p.kind === 'xp').flatMap((p) => at(shown, p));
    expect(gemSprites.some((s) => s.texture === GOLD_FILE)).toBe(false);
    expect(shown.filter((s) => s.texture === GOLD_FILE)).toHaveLength(2);
    expect(shown.filter((s) => s.texture === WOOD_FILE)).toHaveLength(3);
  });

  it('Scenario: Flechas y gemas (tamaño por aspecto, no por gemRadius; frame fijo, sin rotar)', () => {
    const { l, created } = layer(2);
    l.sync([pick(1, 'gold', 0, 0, 5), pick(2, 'gold', 10, 0, 9)]);
    expect(created.map((s) => [s.scale, s.frame, s.rotation, s.flipX])).toEqual([
      [0.5, 0, 0, false],
      [0.5, 0, 0, false],
    ]);
  });

  it('Scenario: Reserva de un tipo de recogible (wood sin hoja: 10 px, del color de wood; meat con su hoja)', () => {
    const { l, created } = layer(396, [WOOD_FILE]);
    const snap = [
      pick(0, 'xp', 1, 1),
      pick(1, 'xp', 2, 2),
      pick(2, 'gold', 3, 3),
      pick(3, 'gold', 4, 4),
      pick(4, 'wood', 100.5, 200.25),
      pick(5, 'wood', 300, 400),
      pick(6, 'meat', 600, 400),
      pick(7, 'meat', 610, 400),
    ];
    l.sync(snap);
    const woods = [snap[4], snap[5]].flatMap((p) => (p ? at(visible(created), p) : []));
    expect(woods).toHaveLength(2);
    for (const s of woods) {
      expect([s.texture, s.tint]).toEqual([PLACEHOLDER_TEXTURE, 0x9c6b3c]);
      expect(s.scale * 64).toBeCloseTo(10, 6);
    }
    const golds = [snap[2], snap[3]].flatMap((p) => (p ? at(visible(created), p) : []));
    expect(golds.every((s) => s.texture === GOLD_FILE)).toBe(true);
    const meats = [snap[6], snap[7]].flatMap((p) => (p ? at(visible(created), p) : []));
    expect(meats.map((s) => s.texture)).toEqual([MEAT_FILE, MEAT_FILE]);
    expect(l.counts).toEqual({
      xp: { visible: 2, placeholder: 0 },
      gold: { visible: 2, placeholder: 0 },
      wood: { visible: 2, placeholder: 2 },
      meat: { visible: 2, placeholder: 0 },
      stone: { visible: 0, placeholder: 0 },
    });
  });
});
