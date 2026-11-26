import { describe, expect, it } from 'vitest';
import type { PickupKind } from '../../src/domain/pickup/PickupKind';
import type { PickupSnapshot } from '../../src/domain/run/RunSnapshot';
import { PLACEHOLDER_TEXTURE, resolveLooks } from '../../src/infrastructure/phaser/art/looks';
import { floatOffset } from '../../src/infrastructure/phaser/art/pickupMotion';
import { PickupLayer } from '../../src/infrastructure/phaser/PickupLayer';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import {
  FLOAT_TEST,
  GOLD_FILE,
  MEAT_FILE,
  REGISTERED,
  ROCK_LARGE_FILE,
  ROCK_MEDIUM_FILE,
  ROCK_SMALL_FILE,
  WOOD_FILE,
  rawAppearance,
  withPickupMotion,
  type RawAppearance,
} from '../support/appearance';
import { fakeKit, type FakeSprite } from '../support/FakeSprite';

// Specs xp-gems ("Pintado de las gemas") y sprite-rendering ("Aspectos de los recogibles", "Flechas
// y gemas", "Recogibles de los cinco tipos", "Flote de los recogibles" de 0030): un pool de
// recogibles con aspecto por tipo que flotan con el reloj de render. Salvo que se diga otra cosa, el
// flote de "Desplazamiento según el reloj" (A 4, T 1.600, s 200) y sin aparición.
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
/** Amplitud del flote 0 (escenarios que fijan las posiciones del snapshot). */
const still = (r: RawAppearance) => {
  r.pickupMotion.float.amplitude = 0;
};

/** Aspectos del fixture (con el guardia y el flote de prueba) con las hojas cargadas salvo `missing`. */
function looks(
  missing: readonly string[] = [],
  change: (r: RawAppearance) => void = () => undefined,
) {
  const raw = rawAppearance();
  withGuard(raw);
  withPickupMotion(raw, 0, false);
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
  const l = new PickupLayer(capacity, kit, all.pickups, all.stones, all.pickupMotion);
  return { l, created: kit.created };
}

const visible = (sprites: FakeSprite[]): FakeSprite[] => sprites.filter((s) => s.visible);
const at = (sprites: FakeSprite[], p: { x: number; y: number }) =>
  sprites.filter((c) => Math.abs(c.x - p.x) <= 0.001 && Math.abs(c.y - p.y) <= 0.001);
/** Posición pintada de un recogible que flota con fase por id en el reloj `ms`. */
const floating = (p: PickupSnapshot, ms = 0) => ({
  x: p.x,
  y: p.y + floatOffset(FLOAT_TEST, p.id, ms),
});

describe('PickupLayer', () => {
  it('Scenario: Recogidas y nuevas (10 pintadas; 3 recogidas y 2 nuevas: 9 visibles, con su flote)', () => {
    const { l, created } = layer(396);
    const first = gems(0, 10);
    l.sync(first, 0);
    const next = [
      ...first.filter((g) => ![1, 4, 7].includes(g.id)),
      pick(10, 'xp', 500, 1),
      pick(11, 'xp', 600, 2),
    ];
    l.sync(next, 250);
    const shown = visible(created);
    expect(shown).toHaveLength(9);
    for (const g of next)
      expect(at(shown, floating(g, 250)), `gema ${String(g.id)}`).toHaveLength(1);
    expect(l.counts.xp).toEqual({ visible: 9, placeholder: 0 });
  });

  it('Scenario: Tope de gemas pintado (300 gemas: 300 visibles, todas con el aspecto de la gema)', () => {
    const { l, created } = layer(396);
    l.sync(gems(0, 300), 0);
    const shown = visible(created);
    expect(shown).toHaveLength(300);
    // La gema sin hoja es una forma de color (textura de reserva teñida con su color).
    expect(shown.every((s) => s.texture === PLACEHOLDER_TEXTURE && s.tint === 0x3e9bff)).toBe(true);
    expect(created).toHaveLength(396);
    expect(l.counts.xp).toEqual({ visible: 300, placeholder: 0 });
  });

  it('Scenario: Todas recogidas (300 pintadas y después ninguna)', () => {
    const { l, created } = layer(396);
    l.sync(gems(0, 300), 0);
    l.sync([], 16);
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
    l.sync(all, 0);
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
    const { l, created } = layer(1, [], still);
    l.sync([stone(0, 10, 10, 'goblin-tnt-guard')], 0);
    expect(visible(created)[0]?.texture).toBe(ROCK_LARGE_FILE);
    l.sync([stone(1, 70, 80, 'goblin-torch')], 16);
    const shown = visible(created);

    expect(shown).toHaveLength(1);
    expect([shown[0]?.texture, shown[0]?.x, shown[0]?.y]).toEqual([ROCK_SMALL_FILE, 70, 80]);
    expect(l.counts.stone).toEqual({ visible: 1, placeholder: 0 });
  });

  it('Scenario: Cada piedra con la roca de su origen (torch 04, tnt 05, guard 06 y sin origen 05)', () => {
    const { l, created } = layer(4, [], still);
    const snap = [
      stone(0, 100, 100, 'goblin-torch'),
      stone(1, 200, 100, 'goblin-tnt'),
      stone(2, 300, 100, 'goblin-tnt-guard'),
      stone(3, 400, 100),
    ];
    l.sync(snap, 0);
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
    l.sync([stone(0, 10, 10, 'goblin-torch')], 0);

    expect(visible(created)[0]?.texture).toBe(ROCK_LARGE_FILE);
  });

  it('Scenario: Reserva de una roca (sin Deco/04: la de torch, forma de 10 px del color de stone)', () => {
    const { l, created } = layer(3, [ROCK_SMALL_FILE]);
    const guard = stone(1, 800, 400, 'goblin-tnt-guard');
    const gold = pick(2, 'gold', 50, 50);
    l.sync([stone(0, 700, 400, 'goblin-torch'), guard, gold], 400);
    // La reserva no flota: centrada en la posición del snapshot.
    const [torch] = at(visible(created), { x: 700, y: 400 });

    expect([torch?.texture, torch?.tint]).toEqual([PLACEHOLDER_TEXTURE, 0x9aa0a6]);
    expect((torch?.scale ?? 0) * 64).toBeCloseTo(10, 6);
    expect(at(visible(created), floating(guard, 400))[0]?.texture).toBe(ROCK_LARGE_FILE);
    expect(at(visible(created), floating(gold, 400))[0]?.texture).toBe(GOLD_FILE);
    expect(l.counts.stone).toEqual({ visible: 2, placeholder: 1 });
  });

  it('Scenario: Recuento de piedras por roca agregado (2 torch, 1 tnt y 3 guard sin Deco/06)', () => {
    const { l } = layer(6, [ROCK_LARGE_FILE]);
    l.sync(
      [
        stone(0, 1, 1, 'goblin-torch'),
        stone(1, 2, 1, 'goblin-torch'),
        stone(2, 3, 1, 'goblin-tnt'),
        stone(3, 4, 1, 'goblin-tnt-guard'),
        stone(4, 5, 1, 'goblin-tnt-guard'),
        stone(5, 6, 1, 'goblin-tnt-guard'),
      ],
      0,
    );

    expect(l.counts.stone).toEqual({ visible: 6, placeholder: 3 });
    l.sync([], 16);
    expect(l.counts.stone).toEqual({ visible: 0, placeholder: 0 });
  });

  it('Scenario: Sprite reutilizado para la carne (el wood recogido; la carne con su aspecto)', () => {
    const { l, created } = layer(1, [], still);
    l.sync([pick(0, 'wood', 10, 10)], 0);
    l.sync([pick(1, 'meat', 70, 80)], 16);
    const shown = visible(created);
    expect(shown).toHaveLength(1);
    expect([shown[0]?.texture, shown[0]?.x, shown[0]?.y]).toEqual([MEAT_FILE, 70, 80]);
    expect([l.counts.wood.visible, l.counts.meat.visible]).toEqual([0, 1]);
  });

  it('Scenario: Reserva de la carne (sin M_Idle: forma de 10 px del color de meat; el oro con G_Idle)', () => {
    const { l, created } = layer(2, [MEAT_FILE]);
    const gold = pick(1, 'gold', 50, 50);
    l.sync([pick(0, 'meat', 700, 400), gold], 0);
    const [meat] = at(visible(created), { x: 700, y: 400 });
    expect([meat?.texture, meat?.tint]).toEqual([PLACEHOLDER_TEXTURE, 0xc8504a]);
    expect((meat?.scale ?? 0) * 64).toBeCloseTo(10, 6);
    expect(at(visible(created), floating(gold))[0]?.texture).toBe(GOLD_FILE);
    expect(l.counts.meat).toEqual({ visible: 1, placeholder: 1 });
  });

  it('Scenario: Sprite reutilizado con otro tipo (la gema recogida; el oro con su aspecto)', () => {
    const { l, created } = layer(1, [], still);
    l.sync([pick(0, 'xp', 10, 10)], 0);
    l.sync([pick(1, 'gold', 50, 60)], 16);
    const shown = visible(created);
    expect(shown).toHaveLength(1);
    expect([shown[0]?.texture, shown[0]?.x, shown[0]?.y]).toEqual([GOLD_FILE, 50, 60]);
    expect([l.counts.xp.visible, l.counts.gold.visible]).toEqual([0, 1]);
  });

  it('Scenario: Recogibles de los cinco tipos (4 gemas, 2 gold, 3 wood, 1 meat y 2 stone; con flote)', () => {
    const { l, created } = layer(436);
    const snap = [
      ...gems(0, 4),
      pick(4, 'gold', 400, 400),
      pick(5, 'gold', 410, 400),
      pick(6, 'wood', 500, 400),
      pick(7, 'wood', 510, 400),
      pick(8, 'wood', 520, 400),
      pick(9, 'meat', 600, 400),
      stone(10, 700, 400, 'goblin-torch'),
      stone(11, 710, 400, 'goblin-tnt-guard'),
    ];
    l.sync(snap, 400);
    const shown = visible(created);
    for (const p of snap) expect(at(shown, floating(p, 400)), `id ${String(p.id)}`).toHaveLength(1);
    const gemSprites = snap
      .filter((p) => p.kind === 'xp')
      .flatMap((p) => at(shown, floating(p, 400)));
    expect(gemSprites.some((s) => s.texture === GOLD_FILE)).toBe(false);
    expect(gemSprites.every((s) => s.texture === PLACEHOLDER_TEXTURE)).toBe(true);
    expect(shown.filter((s) => s.texture === GOLD_FILE)).toHaveLength(2);
    expect(shown.filter((s) => s.texture === WOOD_FILE)).toHaveLength(3);
    expect(shown.filter((s) => s.texture === MEAT_FILE)).toHaveLength(1);
    expect(shown.filter((s) => s.texture === ROCK_SMALL_FILE)).toHaveLength(1);
    expect(shown.filter((s) => s.texture === ROCK_LARGE_FILE)).toHaveLength(1);
  });

  it('Scenario: Flechas y gemas (4 gemas en su x y en su y más el flote de su id)', () => {
    const { l, created } = layer(4);
    const snap = gems(0, 4);
    l.sync(snap, 1200);
    const shown = visible(created);
    expect(shown).toHaveLength(4);
    for (const g of snap) expect(at(shown, floating(g, 1200))).toHaveLength(1);
  });

  it('Flechas y gemas (tamaño por aspecto, no por gemRadius; frame fijo, sin rotar)', () => {
    const { l, created } = layer(2);
    l.sync([pick(1, 'gold', 0, 0, 5), pick(2, 'gold', 10, 0, 9)], 0);
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
    l.sync(snap, 0);
    const woods = [snap[4], snap[5]].flatMap((p) => (p ? at(visible(created), p) : []));
    expect(woods).toHaveLength(2);
    for (const s of woods) {
      expect([s.texture, s.tint]).toEqual([PLACEHOLDER_TEXTURE, 0x9c6b3c]);
      expect(s.scale * 64).toBeCloseTo(10, 6);
    }
    const golds = [snap[2], snap[3]].flatMap((p) => (p ? at(visible(created), floating(p)) : []));
    expect(golds.map((s) => s.texture)).toEqual([GOLD_FILE, GOLD_FILE]);
    const meats = [snap[6], snap[7]].flatMap((p) => (p ? at(visible(created), floating(p)) : []));
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

describe('Flote de los recogibles en la capa (sprite-rendering 0030)', () => {
  it('Scenario: Desplazamiento según el reloj (gemas 0 y 1 y piedra 2 con R = 0, 400 y 1.200)', () => {
    const { l, created } = layer(3);
    const snap = [
      pick(0, 'xp', 300, 200),
      pick(1, 'xp', 500, 200),
      stone(2, 700, 200, 'goblin-tnt'),
    ];
    const expected = [
      [0, [200, 202.828, 204]],
      [400, [204, 202.828, 200]],
      [1200, [196, 197.172, 200]],
    ] as const;
    for (const [ms, ys] of expected) {
      l.sync(snap, ms);
      snap.forEach((p, i) => {
        const [sprite] = at(visible(created), {
          x: p.x,
          y: p.y + floatOffset(FLOAT_TEST, p.id, ms),
        });
        expect(sprite, `id ${String(p.id)} en R = ${String(ms)}`).toBeDefined();
        expect(Math.abs((sprite?.y ?? 0) - (ys[i] ?? 0))).toBeLessThanOrEqual(0.001);
        expect(sprite?.x).toBe(p.x);
      });
    }
  });

  it('Scenario: Fases distintas con el mismo reloj (ids 0 y 4 con R = 400: y 204 y 196)', () => {
    const { l, created } = layer(2);
    l.sync([pick(0, 'xp', 300, 200), pick(4, 'xp', 500, 200)], 400);
    const ys = visible(created).map((s) => [s.x, Number(s.y.toFixed(3))]);

    expect(ys).toEqual([
      [300, 204],
      [500, 196],
    ]);
  });

  it('Scenario: Recogible atraído (de (300, 200) a (306, 200) con R = 400 y 416,667)', () => {
    const { l, created } = layer(1);
    l.sync([pick(0, 'xp', 300, 200)], 400);
    const [first] = visible(created);
    expect([first?.x, first?.y]).toEqual([300, expect.closeTo(204, 3)]);

    l.sync([pick(0, 'xp', 306, 200)], 416.667);
    const [next] = visible(created);
    expect(next?.x).toBe(306);
    expect(next?.y).toBeCloseTo(200 + 4 * Math.sin((2 * Math.PI * 416.667) / 1600), 3);
  });

  it('Scenario: Hueco reutilizado (la gema 9 en el sprite de la 7: y = 302,828 con R = 0)', () => {
    const { l, created } = layer(1);
    l.sync([pick(7, 'xp', 100, 100)], 0);
    l.sync([pick(9, 'xp', 400, 300)], 0);
    const shown = visible(created);

    expect(shown).toHaveLength(1);
    expect(shown[0]?.x).toBe(400);
    expect(shown[0]?.y).toBeCloseTo(302.828, 3);
  });

  it('Scenario: La reserva no flota (W_Idle sin cargar: wood de id 3 centrado en (700, 400))', () => {
    const { l, created } = layer(1, [WOOD_FILE]);
    for (const ms of [0, 400, 1200]) {
      l.sync([pick(3, 'wood', 700, 400)], ms);
      const [s] = visible(created);
      expect([s?.x, s?.y, s?.texture, s?.tint]).toEqual([700, 400, PLACEHOLDER_TEXTURE, 0x9c6b3c]);
      expect((s?.scale ?? 0) * 64).toBeCloseTo(10, 6);
    }
  });

  it('Scenario: Diámetro de la gema independiente de gemRadius (20 px con radio 5 y con radio 9)', () => {
    const twenty = (r: RawAppearance) => {
      still(r);
      (r.pickups.xp as { diameter: number }).diameter = 20;
    };
    for (const radius of [5, 9]) {
      const { l, created } = layer(1, [], twenty);
      l.sync([pick(0, 'xp', 300, 200, radius)], 0);
      const [gem] = visible(created);
      expect([gem?.x, gem?.y, gem?.originX, gem?.originY]).toEqual([300, 200, 0.5, 0.5]);
      expect((gem?.scale ?? 0) * 64).toBeCloseTo(20, 6);
    }
  });
});
