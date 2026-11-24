import type { Horde } from '../enemy/Horde';
import type { Structure } from './Structure';

/**
 * Casas y torres de la partida (servicio de dominio con estado, propiedad de `Run`; ADR-0020): lista
 * de orden y longitud fijos durante toda la partida (las ruinas no se retiran). No consume azar.
 */
export class StructureField {
  constructor(private readonly list: readonly Structure[]) {}

  /** Todas, ruinas incluidas, en su orden fijo (vista de solo lectura; también para las armas). */
  get all(): readonly Structure[] {
    return this.list;
  }

  /** Paso 3.4: las que han llegado a vida 0 en este tick quedan destruidas, sin gema ni baja. */
  settle(): void {
    for (const s of this.list) s.settle();
  }

  /**
   * Paso 9 del tick n (spec enemy-spawning, "Nacimiento de guardias en casas"): en el orden de la
   * lista, cada casa no destruida con menos guardias vivos que su tope, al menos `everyTicks` ticks
   * después de su último nacimiento (o del tick 0) y con hueco bajo `maxAlive`, hace nacer 1 guardia
   * en su puerta, que es su puesto. Sin azar; solo asigna el guardia nuevo.
   */
  spawnGuards(n: number, horde: Horde, maxAlive: number): void {
    for (const s of this.list) {
      if (horde.alive.length >= maxAlive) return;
      const guards = s.site.type.guards;
      const { post } = s;
      const door = s.site.door;
      if (!guards || !post || !door || s.destroyed) continue;
      if (post.alive >= guards.max || n - s.lastSpawnAt < guards.everyTicks) continue;
      horde.spawn(guards.type, door.x, door.y, n, post);
      post.take();
      s.lastSpawnAt = n;
    }
  }
}
