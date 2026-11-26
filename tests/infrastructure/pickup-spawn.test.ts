import { describe, expect, it } from 'vitest';
import type { PickupKind } from '../../src/domain/pickup/PickupKind';
import type { PickupSnapshot } from '../../src/domain/run/RunSnapshot';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { PLACEHOLDER_TEXTURE, resolveLooks } from '../../src/infrastructure/phaser/art/looks';
import { PickupLayer } from '../../src/infrastructure/phaser/PickupLayer';
import {
  GOLD_FILE,
  GOLD_SPAWN_FILE,
  MEAT_FILE,
  MEAT_SPAWN_FILE,
  REGISTERED,
  WOOD_FILE,
  WOOD_SPAWN_FILE,
  rawAppearance,
  withPickupMotion,
} from '../support/appearance';
import { fakeKit, type FakeSprite } from '../support/FakeSprite';
import { GENERATED_PATHS } from '../support/generated';

// Spec sprite-rendering (0030), "Aparición de oro, madera y carne", "Aparición escalonada de los
// recogibles del inicio" y "Flote de los recogibles" (flote sin salto tras la aparición), y xp-gems
// ("Pintado de las gemas"): `PickupLayer` con el doble de `SpriteKit`. Datos de prueba: flote A 4,
// T 1.600 y s 200, y `spawn` de 7 frames [0..6] a 10 fps sin bucle en oro, madera y carne.
const FRAME_MS = 1000 / 60;
const SPAWN_FILES = [GOLD_SPAWN_FILE, WOOD_SPAWN_FILE, MEAT_SPAWN_FILE];

const pick = (id: number, kind: PickupKind, x: number, y: number, value = 1): PickupSnapshot => ({
  id,
  kind,
  value,
  x,
  y,
  radius: 5,
});

/** Capa con los datos de prueba, desfase `staggerMs` y las hojas de `missing` sin cargar. */
function layer(capacity: number, staggerMs = 0, missing: readonly string[] = []) {
  const raw = rawAppearance();
  withPickupMotion(raw, staggerMs);
  const r = parseAppearance(raw, REGISTERED, GENERATED_PATHS);
  if (!r.ok) throw new Error(r.error.message);
  const looks = resolveLooks(r.value, (key) => (missing.includes(key) ? null : 64));
  const kit = fakeKit();
  const l = new PickupLayer(capacity, kit, looks.pickups, looks.stones, looks.pickupMotion);
  return { l, created: kit.created };
}

const visible = (sprites: FakeSprite[]): FakeSprite[] => sprites.filter((s) => s.visible);
/** Sprite visible en la x dada (las x de los escenarios son distintas; la y lleva el flote). */
const atX = (sprites: FakeSprite[], x: number): FakeSprite | undefined =>
  visible(sprites).find((s) => Math.abs(s.x - x) <= 0.001);
/** [hoja, frame, y] de un sprite, con la y redondeada a 0,001. */
const look = (s: FakeSprite | undefined) => [s?.texture, s?.frame, Number(s?.y.toFixed(3))];

/** Un `sync` vacío previo: el recogible no figura en el primer pintado (sin retardo). */
function afterFirstPaint(capacity: number, staggerMs = 0, missing: readonly string[] = []) {
  const v = layer(capacity, staggerMs, missing);
  v.l.sync([], 0);
  return v;
}

describe('Aparición de oro, madera y carne (sprite-rendering 0030)', () => {
  it('Scenario: Aparición y paso a idle (gold de id 5: frames 0, 1 y 6 de spawn; idle en R = 1.700)', () => {
    const { l, created } = afterFirstPaint(1);
    const gold = [pick(5, 'gold', 300, 200)];
    const seen = [1000, 1150, 1650, 1700].map((ms) => {
      l.sync(gold, ms);
      const s = atX(created, 300);
      return [...look(s), s?.x];
    });

    expect(seen).toEqual([
      [GOLD_SPAWN_FILE, 0, 200, 300],
      [GOLD_SPAWN_FILE, 1, 200, 300],
      [GOLD_SPAWN_FILE, 6, 200, 300],
      [GOLD_FILE, 0, 200, 300],
    ]);
  });

  it('Scenario: Flote sin salto al terminar la aparición (R_f = 1.700; 200,262, 204 y 200; igual con id 6)', () => {
    const ys = (id: number) => {
      const { l, created } = afterFirstPaint(1);
      const gold = [pick(id, 'gold', 300, 200)];
      return [1000, 1650, 1700, 1716.667, 2100, 2500].map((ms) => {
        l.sync(gold, ms);
        return look(atX(created, 300));
      });
    };
    const five = ys(5);

    expect(five).toEqual([
      [GOLD_SPAWN_FILE, 0, 200],
      [GOLD_SPAWN_FILE, 6, 200],
      [GOLD_FILE, 0, 200],
      [GOLD_FILE, 0, 200.262],
      [GOLD_FILE, 0, 204],
      [GOLD_FILE, 0, 200],
    ]);
    expect(ys(6)).toEqual(five);
  });

  it('Scenario: Aparición fallida con fase por id (sin G_Spawn: gold de id 1 en idle, y 202,828)', () => {
    const { l, created } = layer(1, 0, [GOLD_SPAWN_FILE]);
    const gold = [pick(1, 'gold', 300, 200)];
    for (const ms of [0, 400]) {
      l.sync(gold, ms);
      expect(look(atX(created, 300))).toEqual([GOLD_FILE, 0, 202.828]);
    }
    expect(l.counts.gold).toEqual({ visible: 1, placeholder: 0 });
  });

  it('Scenario: Una sola vez por id (600 frames en idle, quieto y atraído: ningún frame de spawn)', () => {
    for (const pulled of [false, true]) {
      const { l, created } = afterFirstPaint(1);
      let ms = 1000;
      for (; ms <= 1700; ms += FRAME_MS) l.sync([pick(5, 'gold', 300, 200)], ms);
      const textures = new Set<string>();
      for (let f = 0; f < 600; f++) {
        ms += FRAME_MS;
        const x = pulled ? 300 + f : 300;
        l.sync([pick(5, 'gold', x, 200)], ms);
        textures.add(atX(created, x)?.texture ?? 'ninguno');
      }
      expect([...textures]).toEqual([GOLD_FILE]);
      expect(l.spawns.gold).toBe(0);
    }
  });

  it('Scenario: Sprite reutilizado por un id nuevo (wood 12 en el sprite del gold 5: frame 0 de W_Spawn)', () => {
    const { l, created } = afterFirstPaint(1);
    for (const ms of [1000, 1700, 2000]) l.sync([pick(5, 'gold', 300, 200)], ms);
    expect(atX(created, 300)?.texture).toBe(GOLD_FILE);

    l.sync([pick(12, 'wood', 450, 350)], 3000);

    expect(created).toHaveLength(1);
    expect([...look(atX(created, 450)), created[0]?.x]).toEqual([WOOD_SPAWN_FILE, 0, 350, 450]);
  });

  it('Scenario: Valor sumado por el tope (el gold más antiguo suma valor: sin spawn, mismos visibles)', () => {
    const { l, created } = afterFirstPaint(3);
    const golds = (bonus: number) => [
      pick(5, 'gold', 300, 200, 1 + bonus),
      pick(6, 'gold', 400, 200),
      pick(7, 'gold', 500, 200),
    ];
    let ms = 1000;
    for (; ms <= 1800; ms += FRAME_MS) l.sync(golds(0), ms);
    expect(visible(created).every((s) => s.texture === GOLD_FILE)).toBe(true);
    for (let f = 0; f < 31; f++) {
      ms += FRAME_MS;
      l.sync(golds(15), ms);
      expect(visible(created).map((s) => s.texture)).toEqual([GOLD_FILE, GOLD_FILE, GOLD_FILE]);
    }
    expect([l.counts.gold.visible, l.spawns.gold]).toEqual([3, 0]);
  });

  it('Scenario: Recogido durante la aparición (en el frame 3 de spawn: ningún sprite visible)', () => {
    const { l, created } = afterFirstPaint(1);
    l.sync([pick(5, 'gold', 300, 200)], 1000);
    l.sync([pick(5, 'gold', 300, 200)], 1350);
    expect(look(atX(created, 300))).toEqual([GOLD_SPAWN_FILE, 3, 200]);

    l.sync([], 1366);

    expect(visible(created)).toEqual([]);
    expect([l.counts.gold.visible, l.spawns.gold]).toEqual([0, 0]);
  });

  it('Scenario: Hoja idle que no carga con la aparición cargada (sin M_Idle: forma de 10 px, nunca M_Spawn)', () => {
    const { l, created } = layer(1, 0, [MEAT_FILE]);
    const textures = new Set<string>();
    for (let f = 0; f <= 60; f++) {
      l.sync([pick(0, 'meat', 700, 400)], f * FRAME_MS);
      const [s] = visible(created);
      textures.add(s?.texture ?? 'ninguno');
      expect([s?.x, s?.y, s?.tint]).toEqual([700, 400, 0xc8504a]);
      expect((s?.scale ?? 0) * 64).toBeCloseTo(10, 6);
    }
    expect([...textures]).toEqual([PLACEHOLDER_TEXTURE]);
    expect(l.counts.meat).toEqual({ visible: 1, placeholder: 1 });
    expect(l.spawns.meat).toBe(0);
  });

  it('Scenario: Reserva de la carne (sin M_Idle con M_Spawn cargada: la carne de reserva; el oro con G_Spawn)', () => {
    const { l, created } = afterFirstPaint(2, 0, [MEAT_FILE]);
    l.sync([pick(0, 'meat', 700, 400), pick(1, 'gold', 50, 50)], 100);

    expect([atX(created, 700)?.texture, atX(created, 700)?.y]).toEqual([PLACEHOLDER_TEXTURE, 400]);
    expect(atX(created, 50)?.texture).toBe(GOLD_SPAWN_FILE);
    expect(l.counts.meat).toEqual({ visible: 1, placeholder: 1 });
  });

  it('Scenario: Reserva de un tipo de recogible (sin W_Idle con W_Spawn: wood de reserva; gold y meat aparecen)', () => {
    const { l, created } = afterFirstPaint(8, 0, [WOOD_FILE]);
    l.sync(
      [
        pick(0, 'xp', 1, 1),
        pick(1, 'xp', 2, 2),
        pick(2, 'gold', 3, 3),
        pick(3, 'gold', 4, 4),
        pick(4, 'wood', 100.5, 200.25),
        pick(5, 'wood', 300, 400),
        pick(6, 'meat', 600, 400),
        pick(7, 'meat', 610, 400),
      ],
      0,
    );
    for (const x of [100.5, 300]) {
      const s = atX(created, x);
      expect([s?.texture, s?.tint]).toEqual([PLACEHOLDER_TEXTURE, 0x9c6b3c]);
    }
    expect([3, 4].map((x) => atX(created, x)?.texture)).toEqual([GOLD_SPAWN_FILE, GOLD_SPAWN_FILE]);
    expect([600, 610].map((x) => atX(created, x)?.texture)).toEqual([
      MEAT_SPAWN_FILE,
      MEAT_SPAWN_FILE,
    ]);
    expect([l.counts.wood, l.spawns.wood]).toEqual([{ visible: 2, placeholder: 2 }, 0]);
  });

  it('Scenario: Gema reutilizada por un recogible con aparición (meat 4 en el sprite de la gema 3: frame 0)', () => {
    const { l, created } = afterFirstPaint(1);
    l.sync([pick(3, 'xp', 100, 100)], 400);
    expect(atX(created, 100)?.y).not.toBe(100);

    l.sync([pick(4, 'meat', 500, 300)], 800);

    expect(visible(created)).toHaveLength(1);
    expect([...look(atX(created, 500)), atX(created, 500)?.x]).toEqual([
      MEAT_SPAWN_FILE,
      0,
      300,
      500,
    ]);
  });

  it('Scenario: Topes de los cinco tipos pintados (en aparición y en idle: uno por recogible, sin reserva)', () => {
    const { l, created } = afterFirstPaint(436);
    const all = [
      ...Array.from({ length: 300 }, (_, i) => pick(i, 'xp', i, 0)),
      ...Array.from({ length: 32 }, (_, i) => pick(300 + i, 'gold', 1000 + i, 500)),
      ...Array.from({ length: 64 }, (_, i) => pick(332 + i, 'wood', 2000 + i, 800)),
      ...Array.from({ length: 8 }, (_, i) => pick(396 + i, 'meat', 2500 + i, 900)),
      ...Array.from({ length: 32 }, (_, i) => ({ ...pick(404 + i, 'stone', 3000 + i, 950) })),
    ];
    const byTexture = () => {
      const m = new Map<string, number>();
      for (const s of visible(created)) m.set(s.texture, (m.get(s.texture) ?? 0) + 1);
      return m;
    };
    l.sync(all, 100);
    expect(visible(created)).toHaveLength(436);
    expect(
      [GOLD_SPAWN_FILE, WOOD_SPAWN_FILE, MEAT_SPAWN_FILE].map((f) => byTexture().get(f)),
    ).toEqual([32, 64, 8]);
    l.sync(all, 900);
    expect(visible(created)).toHaveLength(436);
    expect([GOLD_FILE, WOOD_FILE, MEAT_FILE].map((f) => byTexture().get(f))).toEqual([32, 64, 8]);
    expect(Object.values(l.counts).every((c) => c.placeholder === 0)).toBe(true);
  });
});

describe('Aparición escalonada de los recogibles del inicio (sprite-rendering 0030)', () => {
  const R0 = 1000;
  const piles = Array.from({ length: 8 }, (_, id) => pick(id, 'wood', 100 * (id + 1), 500));
  const H = 'oculto';
  /** Frame de hoja de cada montón visible, `idle` u `oculto` (en su retardo). */
  const frames = (created: FakeSprite[]) =>
    piles.map((p) => {
      const s = atX(created, p.x);
      if (!s) return H;
      return s.texture === WOOD_SPAWN_FILE ? s.frame : 'idle';
    });
  /** Sprite del montón, visible o no. */
  const anyAt = (created: FakeSprite[], x: number) =>
    created.find((s) => Math.abs(s.x - x) <= 0.001);

  it('Scenario: Montones escalonados (e 100: 1, 4 y 8 visibles con R0 + 50, 350 y 1.350/1.400)', () => {
    const { l, created } = layer(8, 100);
    const at = (dt: number, shown: number) => {
      l.sync(piles, R0 + dt);
      expect(visible(created), `R0 + ${String(dt)}`).toHaveLength(shown);
      expect(l.counts.wood.visible).toBe(shown);
      return frames(created);
    };

    expect(at(0, 1)).toEqual([0, H, H, H, H, H, H, H]);
    expect(at(50, 1)).toEqual([0, H, H, H, H, H, H, H]);
    // En su retardo el sprite ya tiene la hoja `spawn` y su frame 0, pero oculto.
    const waiting = anyAt(created, 800);
    expect([waiting?.visible, waiting?.texture, waiting?.frame]).toEqual([
      false,
      WOOD_SPAWN_FILE,
      0,
    ]);
    expect(at(350, 4)).toEqual([3, 2, 1, 0, H, H, H, H]);
    expect(at(1350, 8)).toEqual(['idle', 'idle', 'idle', 'idle', 'idle', 'idle', 'idle', 6]);
    expect(at(1400, 8)).toEqual(Array.from({ length: 8 }, () => 'idle'));
    // Ya en idle flotan sin salto desde su R_f (en R0 + 1.400 el id 7 está en d = 0).
    expect(atX(created, 800)?.y).toBeCloseTo(500, 3);
  });

  it('Scenario: Montones escalonados (ningún montón se ve antes del inicio de su aparición)', () => {
    const { l, created } = layer(8, 100);
    for (let f = 0; f <= 84; f++) {
      const dt = (f * 1000) / 60;
      l.sync(piles, R0 + dt);
      for (const p of piles) {
        const shown = atX(created, p.x) !== undefined;
        expect(shown, `id ${String(p.id)}, frame ${String(f)}`).toBe(dt >= p.id * 100);
      }
    }
  });

  it('Scenario: Recoger un montón en su retardo (id 7 recogido en R0 + 300: nunca visible)', () => {
    const { l, created } = layer(8, 100);
    l.sync(piles, R0);
    const rest = piles.filter((p) => p.id !== 7);
    for (let f = 0; f <= 66; f++) {
      l.sync(rest, R0 + 300 + (f * 1000) / 60);
      expect(anyAt(created, 800)?.visible ?? false).toBe(false);
      expect(l.counts.wood.visible).toBe(visible(created).length);
    }
    expect([l.counts.wood.visible, l.spawns.wood]).toEqual([7, 0]);
  });

  it('Scenario: Recuentos de recogibles sin depender de la aparición ni del flote (R0 + 350: 4 wood; luego 8)', () => {
    const { l } = layer(16, 100);
    const stone = (id: number, x: number) => ({ ...pick(id, 'stone', x, 0), source: 'goblin-tnt' });
    const start = [
      ...piles,
      pick(20, 'xp', 1000, 0),
      pick(21, 'xp', 1010, 0),
      pick(22, 'xp', 1020, 0),
      stone(23, 1100),
      stone(24, 1110),
    ];
    l.sync(start, R0);
    // Oro y carne llegan después (sin retardo): en R0 + 350, en su aparición.
    const snap = [
      ...start,
      pick(30, 'gold', 1200, 0),
      pick(31, 'gold', 1210, 0),
      pick(32, 'meat', 1300, 0),
    ];
    l.sync(snap, R0 + 50);
    const visibleAt = (ms: number) => {
      l.sync(snap, ms);
      const c = l.counts;
      expect(Object.values(c).map((k) => k.placeholder)).toEqual([0, 0, 0, 0, 0]);
      return [c.xp.visible, c.gold.visible, c.wood.visible, c.meat.visible, c.stone.visible];
    };

    expect(visibleAt(R0 + 350)).toEqual([3, 2, 4, 1, 2]);
    expect(l.spawns.gold).toBe(2);
    expect(visibleAt(R0 + 1000)).toEqual([3, 2, 8, 1, 2]);
    expect(visibleAt(R0 + 10_000)).toEqual([3, 2, 8, 1, 2]);
  });

  it('Scenario: Recuento en aparición (wood 8 en R0 + 350: 4 visibles y 4 en retardo; 0 y 8 en R0 + 1.400)', () => {
    const { l } = layer(8, 100);
    l.sync(piles, R0);
    l.sync(piles, R0 + 350);
    const during = { counts: structuredClone(l.counts), spawns: { ...l.spawns } };
    l.sync(piles, R0 + 1400);

    expect(during.spawns).toEqual({ xp: 0, gold: 0, wood: 8, meat: 0, stone: 0 });
    expect(l.spawns).toEqual({ xp: 0, gold: 0, wood: 0, meat: 0, stone: 0 });
    expect([during.counts.wood.visible, l.counts.wood.visible]).toEqual([4, 8]);
    expect({ ...l.counts, wood: null }).toEqual({ ...during.counts, wood: null });
  });

  it('Scenario: Recogible posterior sin retardo (wood de id 20 en R1: frame 0 y frame 1 en R1 + 150)', () => {
    const { l, created } = layer(9, 100);
    l.sync(piles, R0);
    const R1 = R0 + 2000;
    const later = [...piles, pick(20, 'wood', 2000, 700)];
    l.sync(later, R1);
    expect(look(atX(created, 2000))).toEqual([WOOD_SPAWN_FILE, 0, 700]);
    l.sync(later, R1 + 150);
    expect(look(atX(created, 2000))).toEqual([WOOD_SPAWN_FILE, 1, 700]);
  });

  it('Scenario: Desfase 0 (e 0: los 8 montones en el frame 3 con R0 + 350)', () => {
    const { l, created } = layer(8, 0);
    l.sync(piles, R0);
    l.sync(piles, R0 + 350);
    expect(frames(created)).toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
  });

  it('clear() descarta las apariciones y el siguiente pintado vuelve a escalonar (R con apariciones en curso)', () => {
    const { l, created } = layer(9, 100);
    l.sync(piles, R0);
    l.sync([...piles, pick(30, 'gold', 5000, 100)], R0 + 1500);
    l.sync([...piles, pick(30, 'gold', 5000, 100)], R0 + 1850);
    expect(atX(created, 5000)?.frame).toBe(3);
    expect(frames(created)).toEqual(Array.from({ length: 8 }, () => 'idle'));

    l.clear();
    expect([l.spawns.gold, l.spawns.wood]).toEqual([0, 0]);
    l.sync(piles, R0 + 1900);

    expect(frames(created)).toEqual([0, H, H, H, H, H, H, H]);
    expect(atX(created, 5000)).toBeUndefined();
    expect(l.spawns.wood).toBe(8);
    l.sync(piles, R0 + 1900 + 150);
    expect(frames(created)).toEqual([1, 0, H, H, H, H, H, H]);
  });

  it('las hojas de aparición solo las usan oro, madera y carne', () => {
    const { l, created } = layer(3, 0);
    l.sync([pick(0, 'xp', 10, 0), { ...pick(1, 'stone', 20, 0), source: 'goblin-tnt' }], 0);
    expect(visible(created).some((s) => SPAWN_FILES.includes(s.texture))).toBe(false);
  });
});
