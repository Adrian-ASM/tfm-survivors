import { circlesOverlap } from '../collision/contact';
import type { GameMap } from '../map/GameMap';
import { Pickup } from './Pickup';
import type { PickupKind } from './PickupKind';
import type { PickupRules } from './PickupRules';

/** Lo recogido en un paso, por tipo (objeto reutilizado por el llamante: sin asignar por tick). */
export class PickupGain {
  xp = 0;
  gold = 0;
  wood = 0;
  meat = 0;
  stone = 0;

  reset(): void {
    this.xp = 0;
    this.gold = 0;
    this.wood = 0;
    this.meat = 0;
    this.stone = 0;
  }

  add(kind: PickupKind, value: number): void {
    this[kind] += value;
  }
}

/**
 * Recogibles en el suelo (servicio de dominio con estado; lo posee `Run`, ADR-0021). Una sola lista
 * en orden de creación, sin agrupar por tipo, y una sola secuencia de ids que no se reutilizan. Pool
 * preasignado y compartido de `Σ topes` registros (ADR-0003, ADR-0006): cero asignaciones por
 * suelta o recogida. El tope y el relleno son por tipo, así que un tipo nunca ocupa la plaza de
 * otro ni recibe su valor. No consume azar.
 */
export class PickupField {
  private readonly active: Pickup[] = [];
  private readonly free: Pickup[] = [];
  private readonly counts: Record<PickupKind, number> = {
    xp: 0,
    gold: 0,
    wood: 0,
    meat: 0,
    stone: 0,
  };
  private nextId = 0;
  /** Punto de creación tras la recolocación (reutilizado: sin asignar por suelta). */
  private readonly spot = { x: 0, y: 0 };

  constructor(
    private readonly rules: PickupRules,
    private readonly map: GameMap,
  ) {
    for (let i = 0; i < rules.capacity; i++) this.free.push(new Pickup());
  }

  /** Recogibles en el suelo en orden de creación (vista interna de solo lectura). */
  get pickups(): readonly Pickup[] {
    return this.active;
  }

  get radius(): number {
    return this.rules.gemRadius;
  }

  /** Recogibles de un tipo en el suelo. */
  count(kind: PickupKind): number {
    return this.counts[kind];
  }

  /**
   * Suelta un recogible de `kind` y `value` en (x, y), o en el centro de la celda caminable más
   * cercana si (x, y) cae en una no caminable (spec xp-gems). Con el tope de su tipo lleno no crea
   * ni recoloca nada: suma `value` al más antiguo de su tipo, sin perder valor (que conserva su
   * `source`). `source`: el tipo de enemigo que soltó una piedra (0025); `null` en el resto.
   */
  drop(
    kind: PickupKind,
    x: number,
    y: number,
    value: number,
    attracted = false,
    source: string | null = null,
  ): void {
    if (this.counts[kind] >= this.rules.max(kind)) {
      // Barrido desde el principio (orden de creación), sin cierre: el primero de su tipo.
      for (const p of this.active) {
        if (p.kind !== kind) continue;
        p.value += value;
        return;
      }
      return;
    }
    const pickup = this.free.pop();
    if (!pickup) throw new Error('Invariante rota: pool de recogibles agotado bajo los topes');
    this.map.nearestWalkable(x, y, this.spot);
    pickup.set(this.nextId, kind, this.spot.x, this.spot.y, value, attracted, source);
    this.nextId += 1;
    this.counts[kind] += 1;
    this.active.push(pickup);
  }

  /**
   * Paso de recogibles con el jugador ya movido en (px, py), en orden de creación y sin distinguir
   * tipo: atracción inclusiva (d ≤ pickupRadius, para siempre), avance de `magnetSpeed / 60` sin
   * sobrepasar al jugador y recogida estricta (círculos solapados, atraído o no). Después,
   * compactación estable: los recogidos vuelven al pool. Deja en `out` lo recogido por tipo.
   */
  step(px: number, py: number, playerRadius: number, pickupRadius: number, out: PickupGain): void {
    out.reset();
    const reach = pickupRadius * pickupRadius;
    const { gemRadius, pullPerTick } = this.rules;
    let collected = false;
    for (const p of this.active) {
      if (!p.attracted) {
        const dx = px - p.x;
        const dy = py - p.y;
        p.attracted = dx * dx + dy * dy <= reach;
      }
      if (p.attracted) p.pull(px, py, pullPerTick);
      if (circlesOverlap(px, py, playerRadius, p.x, p.y, gemRadius)) {
        p.collected = true;
        collected = true;
        out.add(p.kind, p.value);
      }
    }
    if (collected) this.compact();
  }

  /**
   * Despeje de una obra (spec build-sites 0026): cada recogible, atraído o no, con el centro en una
   * celda construida pasa al centro de la celda caminable más cercana, sin cambiar id, tipo, valor,
   * imán ni orden. Sin azar; solo al construir.
   */
  evict(): void {
    for (const p of this.active) {
      if (!this.map.isBuiltAt(p.x, p.y)) continue;
      this.map.nearestWalkable(p.x, p.y, this.spot);
      p.x = this.spot.x;
      p.y = this.spot.y;
    }
  }

  /** Compactación estable en el sitio (ADR-0006): O(n), sin asignar. */
  private compact(): void {
    let w = 0;
    for (let r = 0; r < this.active.length; r++) {
      const p = this.active[r];
      if (!p) continue;
      if (p.collected) {
        this.counts[p.kind] -= 1;
        this.free.push(p);
      } else {
        this.active[w] = p;
        w++;
      }
    }
    this.active.length = w;
  }
}
