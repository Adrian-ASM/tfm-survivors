import { describe, expect, it } from 'vitest';
import { CombatRules, HIT_WINDOW_MUST_BE_INTEGER } from '../../../src/domain/combat/CombatRules';
import { HitLog, type HitRecord } from '../../../src/domain/combat/HitLog';
import { FakeTarget } from '../../support/weapons';

function rules(hitWindowTicks = 15, maxHitsPerTick = 48): CombatRules {
  const r = CombatRules.create({ hitWindowTicks, maxHitsPerTick });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Copia de los registros de la ventana del tick k (los registros se reutilizan). */
function window(log: HitLog, k: number) {
  const out: Omit<HitRecord, 'view'>[] = [];
  log.forWindow(k, (r) => {
    const { id, tick, kind, targetId, x, y, amount } = r;
    out.push({ id, tick, kind, targetId, x, y, amount });
  });
  return out;
}

describe('CombatRules · enteros ≥ 1', () => {
  it.each([0, -1, 2.5])('Scenario: Valores de combate fuera de rango (dominio: %s)', (v) => {
    expect(CombatRules.create({ hitWindowTicks: v, maxHitsPerTick: 48 })).toMatchObject({
      ok: false,
      error: { field: 'combat.hitWindowTicks', message: HIT_WINDOW_MUST_BE_INTEGER },
    });
    expect(CombatRules.create({ hitWindowTicks: 15, maxHitsPerTick: v })).toMatchObject({
      ok: false,
      error: { field: 'combat.maxHitsPerTick' },
    });
  });

  it('acepta 1 y valores grandes', () => {
    expect(CombatRules.create({ hitWindowTicks: 1, maxHitsPerTick: 1 }).ok).toBe(true);
    expect(CombatRules.create({ hitWindowTicks: 600, maxHitsPerTick: 1000 }).ok).toBe(true);
  });
});

describe('HitLog · daño aplicado, suma por objetivo y tick', () => {
  it('recorta el golpe letal a la vida restante y devuelve si lo deja a 0', () => {
    const log = new HitLog(rules());
    const t = new FakeTarget(1000, 1000, 4, 10, 7);
    log.begin(5);
    expect(log.strike('enemy', t, 6, 5)).toBe(true);
    expect(window(log, 5)).toEqual([
      { id: 0, tick: 5, kind: 'enemy', targetId: 7, x: 1000, y: 1000, amount: 4 },
    ]);
  });

  it('suma por referencia de objetivo en el mismo tick, con la posición del primer impacto', () => {
    const log = new HitLog(rules());
    const a = new FakeTarget(10, 20, 45, 22, 1);
    const b = new FakeTarget(30, 40, 45, 22, 2);
    log.begin(3);
    log.strike('enemy', a, 6, 3);
    log.strike('enemy', b, 4, 3);
    a.x = 99;
    log.strike('enemy', a, 6, 3);
    log.strike('enemy', a, 4, 3);
    expect(window(log, 3).map((h) => [h.id, h.targetId, h.x, h.amount])).toEqual([
      [0, 1, 10, 16],
      [1, 2, 30, 4],
    ]);
  });

  it('un impacto que no quita vida no crea golpe ni suma', () => {
    const log = new HitLog(rules());
    const dead = new FakeTarget(0, 0, 0);
    log.begin(1);
    expect(log.strike('enemy', dead, 6, 1)).toBe(false);
    expect(window(log, 1)).toEqual([]);
    expect(log.nextId).toBe(0);
  });

  it('golpes en ticks distintos no se suman', () => {
    const log = new HitLog(rules());
    const t = new FakeTarget(0, 0, 45);
    log.begin(1);
    log.strike('enemy', t, 6, 1);
    log.begin(2);
    log.strike('enemy', t, 6, 2);
    expect(window(log, 2).map((h) => [h.id, h.tick, h.amount])).toEqual([
      [0, 1, 6],
      [1, 2, 6],
    ]);
  });

  it('el desactivado aplica el daño y no anota nada', () => {
    const log = HitLog.disabled();
    const t = new FakeTarget(0, 0, 10);
    log.begin(1);
    expect(log.strike('enemy', t, 10, 1)).toBe(true);
    log.recordPlayer(0, 0, 5, 1);
    expect(t.hp).toBe(0);
    expect(window(log, 1)).toEqual([]);
  });
});
