/**
 * Explosión visible (entidad reutilizable de `HazardField`): solo hizo daño en su `tick` y figura
 * en el snapshot de `tick` a `tick + blastTicks − 1` (spec enemy-hazards, "Explosión de área").
 */
export class Blast {
  id = 0;
  x = 0;
  y = 0;
  radius = 0;
  tick = 0;

  set(id: number, x: number, y: number, radius: number, tick: number): void {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.tick = tick;
  }
}
