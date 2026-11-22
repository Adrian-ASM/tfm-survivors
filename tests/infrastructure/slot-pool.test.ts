import { describe, expect, it } from 'vitest';
import { SlotPool } from '../../src/infrastructure/phaser/SlotPool';

// Change 0012 (design D6): `hide(slot, cleared)` y liberación en el orden del snapshot anterior.
interface Item {
  readonly id: number;
}
const items = (...ids: number[]): Item[] => ids.map((id) => ({ id }));

function pool(capacity: number) {
  const hides: { id: number; cleared: boolean }[] = [];
  let next = 0;
  const p = new SlotPool<Item, { n: number; id: number }>(capacity, () => ({ n: next++, id: -1 }), {
    show: (slot, item) => {
      slot.id = item.id;
    },
    hide: (slot, cleared) => hides.push({ id: slot.id, cleared }),
  });
  return { p, hides };
}

describe('SlotPool · orden de liberación (design D6)', () => {
  it('Scenario: Tope de cadáveres (las bajas se liberan en el orden de la lista anterior)', () => {
    const { p, hides } = pool(16);
    // Huecos asignados en un orden distinto al de la lista final: 7, 1, 5, 3, 6, 2, 4.
    p.sync(items(7, 1, 5));
    p.sync(items(7, 1, 5, 3, 6, 2, 4));
    p.sync(items(4, 2, 6, 3, 5, 1, 7));
    p.sync(items());
    expect(hides).toEqual([4, 2, 6, 3, 5, 1, 7].map((id) => ({ id, cleared: false })));
  });

  it('Scenario: Bajas en medio de la lista (3 y 7 de 10: solo ellos, en orden)', () => {
    const { p, hides } = pool(10);
    p.sync(items(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
    p.sync(items(1, 2, 4, 5, 6, 8, 9, 10));
    expect(hides).toEqual([
      { id: 3, cleared: false },
      { id: 7, cleared: false },
    ]);
  });

  it('clear() oculta con cleared = true', () => {
    const { p, hides } = pool(4);
    p.sync(items(2, 1));
    p.clear();
    expect(hides).toEqual([
      { id: 2, cleared: true },
      { id: 1, cleared: true },
    ]);
  });

  it('los elementos sin hueco (pool lleno) no se liberan ni se ocultan', () => {
    const { p, hides } = pool(2);
    p.sync(items(1, 2, 3));
    p.sync(items());
    expect(hides.map((h) => h.id)).toEqual([1, 2]);
  });
});
