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
}
