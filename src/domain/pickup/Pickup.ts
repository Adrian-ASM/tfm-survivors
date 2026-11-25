import type { PickupKind } from './PickupKind';

/**
 * Recogible del suelo (registro mutable y reutilizable del pool de `PickupField`, ADR-0003/0006 y
 * ADR-0021): tipo, valor, posición y estado del imán. Solo `PickupField` lo crea y lo mueve; el
 * snapshot copia sus escalares. Un registro reutilizado puede cambiar de tipo.
 */
export class Pickup {
  id = 0;
  kind: PickupKind = 'xp';
  x = 0;
  y = 0;
  value = 0;
  /** Atraído por el imán: lo sigue siendo hasta recogerse. */
  attracted = false;
  /** Marcado en el paso de recogibles; la compactación lo devuelve al pool. */
  collected = false;
  /** Tipo de enemigo que soltó la piedra (0025); `null` en el resto. Solo decide su aspecto. */
  source: string | null = null;

  set(
    id: number,
    kind: PickupKind,
    x: number,
    y: number,
    value: number,
    attracted: boolean,
    source: string | null = null,
  ): void {
    this.id = id;
    this.kind = kind;
    this.source = source;
    this.x = x;
    this.y = y;
    this.value = value;
    this.attracted = attracted;
    this.collected = false;
  }

  /** Avanza `step` hacia (px, py) sin sobrepasarlo. */
  pull(px: number, py: number, step: number): void {
    const dx = px - this.x;
    const dy = py - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= step) {
      this.x = px;
      this.y = py;
    } else {
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }
  }
}
