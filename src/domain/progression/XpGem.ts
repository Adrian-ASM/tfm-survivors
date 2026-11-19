/**
 * Gema de XP (registro mutable y reutilizable del pool de `GemField`, ADR-0003/0006). Solo
 * `GemField` la crea y la mueve; el snapshot copia sus escalares.
 */
export class XpGem {
  id = 0;
  x = 0;
  y = 0;
  value = 0;
  /** Atraída por el imán: lo sigue siendo hasta recogerse. */
  attracted = false;
  /** Marcada en el paso de gemas; la compactación la devuelve al pool. */
  collected = false;

  set(id: number, x: number, y: number, value: number, attracted: boolean): void {
    this.id = id;
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
