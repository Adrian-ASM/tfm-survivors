import { describe, expect, it } from 'vitest';
import type {
  BlastSnapshot,
  HitSnapshot,
  PickupSnapshot,
  ProjectileSnapshot,
  RunSnapshot,
  SiteSnapshot,
} from '../../../src/domain/run/RunSnapshot';
import { AudioCues } from '../../../src/infrastructure/audio/audioCues';
import { EFFECT_TYPES, type EffectType } from '../../../src/infrastructure/audio/effectTypes';
import { aDefaultConfig } from '../../support/builders';
import { startSeededRun } from '../../support/runs';

/** Snapshot real del tick 0 (mapa vacío) sobre el que se arman los casos a mano. */
const BASE: RunSnapshot = startSeededRun(aDefaultConfig(), 42, 'empty').snapshot();

const snap = (over: Partial<RunSnapshot> = {}): RunSnapshot =>
  ({ ...BASE, ...over }) as RunSnapshot;

const hit = (id: number, tick: number, kind: HitSnapshot['kind'], x = 0, y = 0): HitSnapshot => ({
  id,
  tick,
  kind,
  x,
  y,
  amount: 1,
});

const blast = (id: number, tick: number, x: number, y: number, radius: number): BlastSnapshot => ({
  id,
  tick,
  x,
  y,
  radius,
});

const pickup = (id: number, value = 1, kind: PickupSnapshot['kind'] = 'xp'): PickupSnapshot => ({
  id,
  kind,
  value,
  x: 0,
  y: 0,
  radius: 4,
});

const arrow = (id: number, x: number, y: number): ProjectileSnapshot => ({ id, x, y, radius: 3 });

const site = (id: number, state: SiteSnapshot['state']): SiteSnapshot => {
  const foot = { col: 0, row: 0, cols: 2, rows: 2 };
  return { id, state, armed: true, house: foot, tower: foot };
};

const newCues = (towerMatchPx = 24): AudioCues =>
  new AudioCues({ towerMatchPx, maxTowerProjectiles: 16 });

/** Copia del recuento (la instancia se reutiliza entre llamadas). */
const counts = (cues: AudioCues, s: RunSnapshot): Record<EffectType, number> => ({
  ...cues.next(s),
});

const only = (partial: Partial<Record<EffectType, number>>): Record<EffectType, number> => {
  const out = {} as Record<EffectType, number>;
  for (const t of EFFECT_TYPES) out[t] = partial[t] ?? 0;
  return out;
};

const total = (c: Record<EffectType, number>): number =>
  EFFECT_TYPES.reduce((sum, t) => sum + c[t], 0);

describe('AudioCues (spec audio, "Sucesos de audio desde el snapshot")', () => {
  it('Scenario: Un golpe suena una vez en toda su ventana', () => {
    const cues = newCues();
    const perTick: number[] = [];
    for (let tick = 99; tick <= 115; tick++) {
      const hits = tick >= 100 ? [hit(7, 100, 'enemy')] : [];
      perTick.push(counts(cues, snap({ tick, hits })).impactWeapon);
    }

    expect(perTick).toEqual([0, 1, ...Array<number>(15).fill(0)]);
  });

  it('Scenario: Golpe al jugador', () => {
    const cues = newCues();
    cues.next(snap({ tick: 1, hits: [] }));

    const c = counts(cues, snap({ tick: 2, hits: [hit(0, 2, 'player'), hit(1, 2, 'enemy')] }));

    expect(c).toEqual(only({ playerHurt: 1, impactWeapon: 1 }));
  });

  it('Scenario: Bajas y mechas', () => {
    const cues = newCues();
    cues.next(snap({ kills: 10 }));

    // La mecha no es baja: solo cuenta la diferencia de bajas del snapshot.
    expect(counts(cues, snap({ kills: 13 })).enemyDeath).toBe(3);
  });

  const before = [pickup(4, 1, 'gold'), pickup(5, 1, 'xp'), pickup(6, 1, 'wood')];

  it('Scenario: Recogidas y despeje (sin obra: 2 pickupGold y 0 de piedra y madera)', () => {
    const cues = newCues();
    cues.next(snap({ pickups: before, sites: [site(0, 'free')] }));

    const c = counts(cues, snap({ pickups: [pickup(6, 1, 'wood')], sites: [site(0, 'free')] }));

    expect(c).toEqual(only({ pickupGold: 2 }));
  });

  it('Scenario: Recogidas y despeje (con obra: 0 recogidas y 1 obra)', () => {
    const cues = newCues();
    cues.next(snap({ pickups: before, sites: [site(0, 'free')] }));

    const c = counts(cues, snap({ pickups: [pickup(6, 1, 'wood')], sites: [site(0, 'house')] }));

    expect(c).toEqual(only({ build: 1 }));
  });

  it('Scenario: Una recogida por tipo de recurso (peticiones por tipo de recogida)', () => {
    const cues = newCues();
    const kinds = ['xp', 'meat', 'gold', 'stone', 'stone', 'wood', 'wood'] as const;
    cues.next(snap({ pickups: kinds.map((k, i) => pickup(10 + i, 1, k)) }));

    const c = counts(cues, snap({ pickups: [] }));

    expect(c).toEqual(only({ pickupGold: 3, pickupStone: 2, pickupWood: 2 }));
  });

  it('Scenario: Relleno al tope no es recogida', () => {
    const cues = newCues();
    const xp = Array.from({ length: 300 }, (_, i) => i);
    const wood = Array.from({ length: 64 }, (_, i) => 300 + i);
    const all = (bump: number) => [
      ...xp.map((id) => pickup(id, id === 0 ? bump : 1, 'xp')),
      ...wood.map((id) => pickup(id, id === 300 ? bump : 1, 'wood')),
    ];
    cues.next(snap({ pickups: all(1) }));

    const c = counts(cues, snap({ pickups: all(9) }));

    expect([c.pickupGold, c.pickupStone, c.pickupWood]).toEqual([0, 0, 0]);
  });

  it('Scenario: Varias subidas en un step', () => {
    const cues = newCues();
    cues.next(snap({ progression: { ...BASE.progression, level: 3 } }));

    const c = counts(cues, snap({ progression: { ...BASE.progression, level: 5 } }));

    expect(c.levelUp).toBe(2);
  });

  it('Scenario: Explosión visible varios ticks', () => {
    const cues = newCues();
    cues.next(snap({ tick: 9 }));
    const b = blast(2, 10, 100, 100, 64);

    const seen = [10, 11, 12].map((tick) => counts(cues, snap({ tick, blasts: [b] })).explosion);

    expect(seen).toEqual([1, 0, 0]);
  });

  it('Scenario: Compra en la tienda', () => {
    const cues = newCues();
    const shop = { ...BASE.shop, open: true, gold: 40 };
    cues.next(snap({ shop }));

    const bought = counts(cues, snap({ shop: { ...shop, gold: 28 } })).purchase;
    const left = counts(cues, snap({ shop: { ...shop, open: false, gold: 28 } })).purchase;

    expect([bought, left]).toEqual([1, 0]);
  });

  it('Scenario: Compra en la tienda (oro que baja fuera de la tienda no es compra)', () => {
    const cues = newCues();
    cues.next(snap({ shop: { ...BASE.shop, open: false, gold: 40 } }));

    expect(counts(cues, snap({ shop: { ...BASE.shop, open: false, gold: 20 } })).purchase).toBe(0);
  });

  it('Scenario: Partida nueva como referencia', () => {
    const cues = newCues();
    cues.next(snap({ kills: 0 }));
    cues.next(
      snap({
        kills: 200,
        progression: { ...BASE.progression, level: 9 },
        hits: [hit(500, 900, 'enemy')],
        blasts: [blast(40, 900, 0, 0, 64)],
      }),
    );

    cues.newRun();
    const first = counts(cues, snap({ kills: 0, hits: [hit(0, 0, 'player')] }));

    expect(total(first)).toBe(0);
  });

  it('Scenario: Partida nueva como referencia (los ids de la partida nueva vuelven a contar)', () => {
    const cues = newCues();
    cues.next(snap({ hits: [hit(500, 900, 'enemy')] }));
    cues.newRun();
    cues.next(snap({ tick: 0, hits: [] }));

    expect(counts(cues, snap({ tick: 1, hits: [hit(0, 1, 'enemy')] })).impactWeapon).toBe(1);
  });

  it('Scenario: Snapshot sin cambios', () => {
    const cues = newCues();
    const paused = snap({
      tick: 500,
      kills: 12,
      hits: [hit(3, 500, 'enemy'), hit(4, 500, 'player')],
      blasts: [blast(1, 500, 0, 0, 64)],
      pickups: [pickup(1), pickup(2)],
      towerProjectiles: [arrow(0, 10, 10)],
    });
    cues.next(paused);

    let sum = 0;
    for (let i = 0; i < 300; i++) sum += total(cues.next(paused));

    expect(sum).toBe(0);
  });

  it('Scenario: Snapshot sin cambios (procesar no cambia el snapshot)', () => {
    const cues = newCues();
    const s = snap({ hits: [hit(0, 0, 'enemy')], pickups: [pickup(1)] });
    const before = JSON.stringify(s);

    cues.next(s);
    cues.next(s);

    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('AudioCues (spec audio, "Origen del impacto")', () => {
  it('Scenario: Impacto de explosión', () => {
    const cues = newCues();
    cues.next(snap({ tick: 299 }));

    const c = counts(
      cues,
      snap({
        tick: 300,
        hits: [hit(0, 300, 'enemy', 500, 500)],
        blasts: [blast(0, 300, 530, 500, 64)],
      }),
    );

    expect([c.impactBlast, c.impactTower, c.impactWeapon]).toEqual([1, 0, 0]);
  });

  it('Scenario: Explosión de otro tick', () => {
    const cues = newCues();
    cues.next(snap({ tick: 299, blasts: [blast(0, 298, 530, 500, 64)] }));

    const c = counts(
      cues,
      snap({
        tick: 300,
        hits: [hit(0, 300, 'enemy', 500, 500)],
        blasts: [blast(0, 298, 530, 500, 64)],
      }),
    );

    expect([c.impactBlast, c.impactTower, c.impactWeapon]).toEqual([0, 0, 1]);
  });

  it('Scenario: Impacto de torre', () => {
    const cues = newCues(24);
    cues.next(snap({ tick: 1, towerProjectiles: [arrow(3, 400, 410)] }));

    const c = counts(
      cues,
      snap({ tick: 2, towerProjectiles: [], hits: [hit(0, 2, 'enemy', 400, 400)] }),
    );

    expect(c).toEqual(only({ impactTower: 1 }));
  });

  it('Scenario: Flecha de torre lejos del golpe', () => {
    const cues = newCues(24);
    cues.next(snap({ tick: 1, towerProjectiles: [arrow(3, 400, 430)] }));

    const c = counts(
      cues,
      snap({ tick: 2, towerProjectiles: [], hits: [hit(0, 2, 'enemy', 400, 400)] }),
    );

    expect(c).toEqual(only({ impactWeapon: 1 }));
  });

  it('Scenario: Impacto de torre (una flecha que sigue en vuelo no cuenta)', () => {
    const cues = newCues(24);
    cues.next(snap({ tick: 1, towerProjectiles: [arrow(3, 400, 410)] }));

    const c = counts(
      cues,
      snap({
        tick: 2,
        towerProjectiles: [arrow(3, 400, 405)],
        hits: [hit(0, 2, 'enemy', 400, 400)],
      }),
    );

    expect(c).toEqual(only({ impactWeapon: 1 }));
  });

  it('Scenario: Explosión gana a torre', () => {
    const cues = newCues(24);
    cues.next(snap({ tick: 1, towerProjectiles: [arrow(3, 400, 410)] }));

    const c = counts(
      cues,
      snap({
        tick: 2,
        towerProjectiles: [],
        hits: [hit(0, 2, 'structure', 400, 400)],
        blasts: [blast(0, 2, 400, 400, 64)],
      }),
    );

    expect(c).toEqual(only({ impactBlast: 1, explosion: 1 }));
  });

  it('Scenario: El jugador en una explosión', () => {
    const cues = newCues();
    cues.next(snap({ tick: 1 }));

    const c = counts(
      cues,
      snap({
        tick: 2,
        hits: [hit(0, 2, 'player', 100, 100)],
        blasts: [blast(0, 2, 100, 100, 64)],
      }),
    );

    expect(c).toEqual(only({ playerHurt: 1, explosion: 1 }));
  });

  it('Scenario: Golpe a una oveja cuenta como impacto', () => {
    const cues = newCues();
    cues.next(snap({ tick: 1 }));

    expect(counts(cues, snap({ tick: 2, hits: [hit(0, 2, 'sheep')] })).impactWeapon).toBe(1);
  });
});
