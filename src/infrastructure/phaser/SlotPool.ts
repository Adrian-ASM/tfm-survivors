/** Cómo pinta y oculta una capa el contenido de un hueco (sprites del motor u otros dobles). */
export interface SlotHandler<T, S> {
  /** Pinta `item` en el hueco; `appearing` es true si el hueco estaba oculto. */
  show(slot: S, item: T, appearing: boolean): void;
  /**
   * Oculta el hueco. `cleared` es true si lo vacía `clear()` (cambio de partida) y false si su
   * elemento ha dejado de figurar en el snapshot (en enemigos, una baja: design 0012 D6).
   */
  hide(slot: S, cleared: boolean): void;
}

/** Lista vacía compartida para `clear()` (no asigna). */
const NONE: readonly never[] = Object.freeze([]);

interface Entry<S> {
  readonly slot: S;
  /** Elemento que lo ocupa (si `visible`). */
  id: number;
  visible: boolean;
  /** Último frame en que su elemento estaba en el snapshot. */
  seen: number;
}

/**
 * Asociación hueco ↔ id sobre un pool preasignado (ADR-0006), sin motor: cada elemento conserva su
 * hueco mientras sigue en el snapshot, así que una desaparición solo oculta un hueco y no repinta a
 * los demás. Los que faltan se liberan en el orden de la lista del snapshot anterior (design 0012
 * D6), con un array de ids preasignado. No asigna por frame salvo las entradas del `Map`.
 */
export class SlotPool<T extends { readonly id: number }, S> {
  private readonly entries: Entry<S>[];
  /** Huecos libres (pila); al empezar, el hueco 0 queda en la cima. */
  private readonly free: Entry<S>[];
  private readonly byId = new Map<number, Entry<S>>();
  /** Ids con hueco en el último `sync`, en el orden de su lista. */
  private readonly order: number[];
  private orderLength = 0;
  private frame = 0;

  constructor(
    capacity: number,
    create: () => S,
    private readonly handler: SlotHandler<T, S>,
  ) {
    this.entries = Array.from({ length: capacity }, () => ({
      slot: create(),
      id: -1,
      visible: false,
      seen: 0,
    }));
    this.free = [...this.entries].reverse();
    this.order = new Array<number>(capacity).fill(-1);
  }

  /**
   * Tres pasadas: actualiza a los que ya tienen hueco, libera los huecos de los que faltan y
   * después da hueco a los nuevos (así una reposición en el mismo frame reutiliza lo liberado).
   * Si llegan más elementos que huecos, los sobrantes no se pintan.
   */
  sync(items: readonly T[]): void {
    this.pass(items, false);
  }

  /**
   * Oculta y libera todos los huecos (reinicio de partida): un id que reaparece entra como nuevo
   * (`appearing`), sin heredar el hueco de un elemento de la partida anterior. Sin asignar.
   */
  clear(): void {
    this.pass(NONE, true);
  }

  private pass(items: readonly T[], cleared: boolean): void {
    this.frame += 1;
    for (const item of items) {
      const entry = this.byId.get(item.id);
      if (entry) this.show(entry, item);
    }
    this.releaseUnseen(cleared);
    for (const item of items) {
      if (this.byId.has(item.id)) continue;
      const entry = this.free.pop();
      if (!entry) continue;
      entry.id = item.id;
      this.byId.set(item.id, entry);
      this.show(entry, item);
    }
    this.orderLength = 0;
    for (const item of items) {
      if (this.byId.has(item.id)) this.order[this.orderLength++] = item.id;
    }
  }

  private releaseUnseen(cleared: boolean): void {
    for (let i = 0; i < this.orderLength; i++) {
      const entry = this.byId.get(this.order[i] ?? -1);
      if (!entry?.visible || entry.seen === this.frame) continue;
      this.handler.hide(entry.slot, cleared);
      entry.visible = false;
      this.byId.delete(entry.id);
      this.free.push(entry);
    }
  }

  private show(entry: Entry<S>, item: T): void {
    entry.seen = this.frame;
    this.handler.show(entry.slot, item, !entry.visible);
    entry.visible = true;
  }
}
