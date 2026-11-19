/** Cómo pinta y oculta una capa el contenido de un hueco (sprites del motor u otros dobles). */
export interface SlotHandler<T, S> {
  /** Pinta `item` en el hueco; `appearing` es true si el hueco estaba oculto. */
  show(slot: S, item: T, appearing: boolean): void;
  hide(slot: S): void;
}

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
 * los demás. No asigna por frame salvo las entradas del `Map`.
 */
export class SlotPool<T extends { readonly id: number }, S> {
  private readonly entries: Entry<S>[];
  /** Huecos libres (pila); al empezar, el hueco 0 queda en la cima. */
  private readonly free: Entry<S>[];
  private readonly byId = new Map<number, Entry<S>>();
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
  }

  /**
   * Tres pasadas: actualiza a los que ya tienen hueco, libera los huecos de los que faltan y
   * después da hueco a los nuevos (así una reposición en el mismo frame reutiliza lo liberado).
   * Si llegan más elementos que huecos, los sobrantes no se pintan.
   */
  sync(items: readonly T[]): void {
    this.frame += 1;
    for (const item of items) {
      const entry = this.byId.get(item.id);
      if (entry) this.show(entry, item);
    }
    this.releaseUnseen();
    for (const item of items) {
      if (this.byId.has(item.id)) continue;
      const entry = this.free.pop();
      if (!entry) continue;
      entry.id = item.id;
      this.byId.set(item.id, entry);
      this.show(entry, item);
    }
  }

  private releaseUnseen(): void {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (!entry?.visible || entry.seen === this.frame) continue;
      this.handler.hide(entry.slot);
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
