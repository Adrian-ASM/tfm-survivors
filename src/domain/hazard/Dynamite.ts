/**
 * Dinamita en vuelo (entidad reutilizable del pool de `HazardField`, ADR-0003/0006): escalares
 * mutables e internos. Su objetivo y su tick de explosión se fijan al lanzarla y no cambian; la
 * posición no se guarda, se interpola en el snapshot (spec enemy-hazards, "Dinamita en vuelo").
 */
export class Dynamite {
  id = 0;
  ox = 0;
  oy = 0;
  tx = 0;
  ty = 0;
  launchedAt = 0;
  explodesAt = 0;
  /** Radio y daño de su explosión (del comportamiento del lanzador). */
  radius = 0;
  damage = 0;

  set(
    id: number,
    from: { readonly x: number; readonly y: number },
    tx: number,
    ty: number,
    launchedAt: number,
    explodesAt: number,
    radius: number,
    damage: number,
  ): void {
    this.id = id;
    this.ox = from.x;
    this.oy = from.y;
    this.tx = tx;
    this.ty = ty;
    this.launchedAt = launchedAt;
    this.explodesAt = explodesAt;
    this.radius = radius;
    this.damage = damage;
  }

  /** Posición en el snapshot del tick n: origen + (objetivo − origen) × k / W, k = n − lanzamiento. */
  xAt(n: number): number {
    return this.ox + (this.tx - this.ox) * this.progress(n);
  }

  yAt(n: number): number {
    return this.oy + (this.ty - this.oy) * this.progress(n);
  }

  private progress(n: number): number {
    return (n - this.launchedAt) / (this.explodesAt - this.launchedAt);
  }
}
