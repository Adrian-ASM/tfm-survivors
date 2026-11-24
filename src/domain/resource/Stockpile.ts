/**
 * Oro y madera de la partida (spec resources, "Contadores de oro y madera de la partida"): enteros
 * que empiezan en 0 (o en los de `RunSetup`) y solo suben. Interno a `Run` (ADR-0021); en este
 * change no hay forma de gastarlos.
 */
export class Stockpile {
  constructor(
    private goldCount = 0,
    private woodCount = 0,
  ) {}

  get gold(): number {
    return this.goldCount;
  }

  get wood(): number {
    return this.woodCount;
  }

  /** Suma lo recogido (valores enteros ≥ 0 del paso de recogibles o de las vetas). */
  add(gold: number, wood: number): void {
    this.goldCount += gold;
    this.woodCount += wood;
  }
}
