import type { PickupKind } from '../../domain/pickup/PickupKind';
import type { PickupSnapshot } from '../../domain/run/RunSnapshot';
import type { PickupLook, StillLook, StoneLooks } from './art/looks';
import {
  floatOffset,
  floatOffsetFrom,
  spawnDelay,
  spawnFrame,
  type PickupMotion,
} from './art/pickupMotion';
import type { SpriteCount } from './PlayerView';
import { SlotPool } from './SlotPool';
import { PaintedSprite, type SpriteKit } from './SpriteLike';

/** Sprites de recogible visibles por tipo, y cuántos con aspecto de reserva (0022). */
export type PickupCounts = Readonly<Record<PickupKind, SpriteCount>>;

/** Recogibles que muestran un frame de su aparición por tipo, retardo incluido (0030, design D5). */
export type PickupSpawnCounts = Readonly<Record<PickupKind, number>>;

/**
 * Hueco del pool: el sprite, el tipo del recogible que pinta y el aspecto que usó al aparecer (para
 * contar al ocultarlo; en la piedra, cada roca puede ir a reserva por separado, 0025). Desde 0030,
 * el estado de su aparición, que se reinicia al aparecer (es **por id**: un hueco reutilizado no
 * hereda nada del recogible anterior).
 */
interface PickupSlot {
  readonly painted: PaintedSprite;
  kind: PickupKind;
  look: PickupLook | null;
  /** Vista aplicada al sprite (`idle` o `spawn`): hoja, escala y tinte solo al cambiar. */
  view: StillLook | null;
  /** Reloj del primer frame en que su id figura en el snapshot (R_1). */
  spawnStart: number;
  /** Retardo de la aparición: id · e en el primer pintado de la partida, 0 después. */
  spawnDelay: number;
  /** Muestra un frame de `spawn` (retardo incluido). */
  spawning: boolean;
  /** R_f: reloj del primer frame tras la aparición; `null` si no tuvo aparición. */
  floatFrom: number | null;
}

/**
 * Pinta los recogibles del snapshot (los cinco tipos, ADR-0021) sobre un único pool de `Σ topes`
 * sprites preasignados, asociados por id (los ids son únicos entre tipos, ADR-0006). Al aparecer, el
 * sprite toma el aspecto de su tipo, y la piedra el de la roca de su origen (0025; un sprite
 * reutilizado cambia de aspecto); el tamaño lo fija el aspecto (en la gema sin hoja, su diámetro,
 * 0030), no `gemRadius`, salvo en reserva. La gema sin hoja es una forma de color: nunca cuenta como
 * reserva. Desde 0030 (design D4), con el reloj de render: oro, madera y carne con `spawn` la
 * reproducen una vez por id (con un retardo id · e en el primer pintado de la partida) y después
 * flotan desde R_f, sin salto; el resto flota con fase por id; la reserva ni aparece ni flota. Ningún
 * sprite de un recogible recogido queda visible; no crea objetos por frame.
 */
export class PickupLayer {
  readonly counts: PickupCounts = {
    xp: { visible: 0, placeholder: 0 },
    gold: { visible: 0, placeholder: 0 },
    wood: { visible: 0, placeholder: 0 },
    meat: { visible: 0, placeholder: 0 },
    stone: { visible: 0, placeholder: 0 },
  };
  /** Recuento de la sonda `sprites.pickupSpawns` (0030). */
  readonly spawns: Record<PickupKind, number> = { xp: 0, gold: 0, wood: 0, meat: 0, stone: 0 };
  private readonly pool: SlotPool<PickupSnapshot, PickupSlot>;
  /** Reloj de render del `sync` en curso (ms). */
  private ms = 0;
  /** Primer `sync` tras crear la capa o tras `clear()`: el primer pintado de la partida. */
  private initial = true;

  constructor(
    capacity: number,
    kit: SpriteKit,
    looks: Readonly<Record<PickupKind, PickupLook>>,
    stones: StoneLooks,
    private readonly motion: PickupMotion,
  ) {
    const newSlot = (): PickupSlot => ({
      painted: new PaintedSprite(kit.create(), kit.tint),
      kind: 'xp',
      look: null,
      view: null,
      spawnStart: 0,
      spawnDelay: 0,
      spawning: false,
      floatFrom: null,
    });
    this.pool = new SlotPool(capacity, newSlot, {
      show: (slot, p, appearing) => {
        if (appearing)
          this.appear(slot, p, p.kind === 'stone' ? stones.of(p.source) : looks[p.kind]);
        this.paint(slot, p);
      },
      hide: (slot) => {
        slot.painted.show(false);
        if (slot.look) this.count(slot.kind, slot.look, -1);
        this.stopSpawning(slot);
      },
    });
  }

  /** Pinta los recogibles con el reloj de render `ms` (el de la espuma y los árboles). */
  sync(pickups: readonly PickupSnapshot[], ms: number): void {
    this.ms = ms;
    this.pool.sync(pickups);
    this.initial = false;
  }

  /**
   * Oculta todos los sprites (reinicio de partida) y descarta las apariciones en curso: el siguiente
   * `sync` es el primer pintado de la partida nueva (con su retardo).
   */
  clear(): void {
    this.pool.clear();
    this.initial = true;
  }

  /** Un id entra en un hueco: su aspecto y, si tiene aparición, su inicio y su retardo. */
  private appear(slot: PickupSlot, p: PickupSnapshot, look: PickupLook): void {
    slot.kind = p.kind;
    slot.look = look;
    slot.view = null;
    slot.floatFrom = null;
    this.count(p.kind, look, 1);
    slot.spawning = look.spawn !== null;
    if (!slot.spawning) return;
    slot.spawnStart = this.ms;
    slot.spawnDelay = spawnDelay(this.motion.spawnStaggerMs, p.id, this.initial);
    this.spawns[p.kind] += 1;
  }

  /** Hoja, frame y posición del frame: la aparición en la del snapshot; si no, con su flote. */
  private paint(slot: PickupSlot, p: PickupSnapshot): void {
    const look = slot.look;
    if (!look) return;
    let view: StillLook = look;
    let frame = look.idle.frames[0] ?? 0;
    if (slot.spawning && look.spawn) {
      const k = spawnFrame(look.spawn.idle, this.ms - slot.spawnStart - slot.spawnDelay);
      if (k === null) {
        this.stopSpawning(slot);
        slot.floatFrom = this.ms;
      } else {
        view = look.spawn;
        frame = k;
      }
    }
    if (view !== slot.view) {
      slot.view = view;
      slot.painted.look(view, look.shapeRadius ?? p.radius).paint(view, false);
    }
    slot.painted
      .setFrame(view, frame)
      .at(p.x, p.y + this.offset(slot, look, p.id))
      .show(true);
  }

  /**
   * Desplazamiento vertical del flote: ninguno durante la aparición ni con aspecto de reserva (la
   * gema sin hoja sí flota); desde R_f tras una aparición y con fase por id en el resto.
   */
  private offset(slot: PickupSlot, look: PickupLook, id: number): number {
    if (slot.spawning || (look.placeholder && !look.shape)) return 0;
    const { float } = this.motion;
    return slot.floatFrom === null
      ? floatOffset(float, id, this.ms)
      : floatOffsetFrom(float, slot.floatFrom, this.ms);
  }

  private stopSpawning(slot: PickupSlot): void {
    if (!slot.spawning) return;
    slot.spawning = false;
    this.spawns[slot.kind] -= 1;
  }

  private count(kind: PickupKind, look: PickupLook, delta: number): void {
    const c = this.counts[kind];
    c.visible += delta;
    if (look.placeholder && !look.shape) c.placeholder += delta;
  }
}
