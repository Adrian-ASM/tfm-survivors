import { describe, expect, it } from 'vitest';
import type { PickupKind } from '../../src/domain/pickup/PickupKind';
import type { PickupSnapshot } from '../../src/domain/run/RunSnapshot';
import { PLACEHOLDER_TEXTURE, resolveLooks } from '../../src/infrastructure/phaser/art/looks';
import { PickupLayer } from '../../src/infrastructure/phaser/PickupLayer';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { GOLD_FILE, REGISTERED, WOOD_FILE, rawAppearance } from '../support/appearance';
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

/** Aspectos del fixture con las hojas cargadas salvo las de `missing`. */
function looks(missing: readonly string[] = []) {
  const r = parseAppearance(rawAppearance(), REGISTERED);
  if (!r.ok) throw new Error(r.error.message);
  return resolveLooks(r.value, (key) => (missing.includes(key) ? null : 64)).pickups;
}

function layer(capacity: number, missing: readonly string[] = []) {
  const kit = fakeKit();
  const l = new PickupLayer(capacity, kit, looks(missing));
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

  it('Scenario: Topes de los tres tipos pintados (uno por recogible, con su aspecto, sin reserva)', () => {
    const { l, created } = layer(396);
    const all = [
      ...gems(0, 300),
      ...Array.from({ length: 32 }, (_, i) => pick(300 + i, 'gold', 1000 + i, 500)),
      ...Array.from({ length: 64 }, (_, i) => pick(332 + i, 'wood', 2000 + i, 800)),
    ];
    l.sync(all);
    const shown = visible(created);
    expect(shown).toHaveLength(396);
    expect(shown.filter((s) => s.texture === GOLD_FILE)).toHaveLength(32);
    expect(shown.filter((s) => s.texture === WOOD_FILE)).toHaveLength(64);
    expect(l.counts).toEqual({
      xp: { visible: 300, placeholder: 0 },
      gold: { visible: 32, placeholder: 0 },
      wood: { visible: 64, placeholder: 0 },
    });
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

  it('Scenario: Reserva de un tipo de recogible (wood sin hoja: 10 px, del color de wood)', () => {
    const { l, created } = layer(396, [WOOD_FILE]);
    const snap = [
      pick(0, 'xp', 1, 1),
      pick(1, 'xp', 2, 2),
      pick(2, 'gold', 3, 3),
      pick(3, 'gold', 4, 4),
      pick(4, 'wood', 100.5, 200.25),
      pick(5, 'wood', 300, 400),
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
    expect(l.counts).toEqual({
      xp: { visible: 2, placeholder: 0 },
      gold: { visible: 2, placeholder: 0 },
      wood: { visible: 2, placeholder: 2 },
    });
  });
});
