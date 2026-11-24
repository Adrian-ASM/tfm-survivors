import type { WeaponTarget } from '../weapon/WeaponTarget';
import type { StructureSite } from './StructureSite';

/**
 * Casa o torre goblin (entidad, ADR-0020). Vida escalar mutable e interna al agregado `Run`
 * (ADR-0003); cumple `WeaponTarget`: las armas la dañan, nada más. Su vida no baja de 0; deja de
 * ser alcanzable en cuanto llega a 0 y queda **destruida** (ruina, irreversible) al cerrar el paso
 * de armas (`settle`). Nunca sale del agregado: el snapshot copia sus escalares.
 */
export class Structure implements WeaponTarget {
  private life: number;
  private ruined: boolean;

  constructor(
    readonly site: StructureSite,
    health: number,
  ) {
    this.life = health;
    this.ruined = health <= 0;
  }

  get id(): number {
    return this.site.id;
  }

  get x(): number {
    return this.site.x;
  }

  get y(): number {
    return this.site.y;
  }

  get radius(): number {
    return this.site.radius;
  }

  get hp(): number {
    return this.life;
  }

  /** Alcanzable por las armas: vida > 0 (una ruina nunca lo es). */
  get alive(): boolean {
    return this.life > 0;
  }

  get destroyed(): boolean {
    return this.ruined;
  }

  /**
   * Resta el daño con recorte a 0; sobre una estructura sin vida no hace nada. Devuelve si este
   * golpe la ha dejado a 0 (las armas no lo cuentan como baja, D6).
   */
  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.life = Math.max(0, this.life - amount);
    return !this.alive;
  }

  /** Paso 3.4 del tick: si su vida ha llegado a 0, queda destruida. */
  settle(): void {
    if (this.life <= 0) this.ruined = true;
  }
}
