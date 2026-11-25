/**
 * Oro, madera y piedra de la partida (spec resources, "Contadores de oro y madera de la partida" y
 * "Contador de piedra de la partida", 0025): enteros que empiezan en 0 (o en los de `RunSetup`).
 * La madera y la piedra solo suben, sin bonificación; el oro sube con cada ingreso
 * (con la bonificación de oro y un resto propio, 0024) y solo baja al comprar en la tienda. Interno
 * a `Run` (ADR-0021).
 */
export class Stockpile {
  /** Resto en centésimas de la bonificación de oro (0..99; no sale en el snapshot). */
  private remainder = 0;

  constructor(
    private goldCount = 0,
    private woodCount = 0,
    private stoneCount = 0,
  ) {}

  get gold(): number {
    return this.goldCount;
  }

  get wood(): number {
    return this.woodCount;
  }

  get stone(): number {
    return this.stoneCount;
  }

  /** Suma la piedra recogida (entero ≥ 0), tal cual: sin bonificación ni resto (0025). */
  addStone(stone: number): void {
    this.stoneCount += stone;
  }

  /**
   * Suma un ingreso (valores enteros ≥ 0 del paso de recogibles o de una veta): la madera tal cual
   * y el oro con la bonificación `goldBonusPercent` g, `t = oro × (100 + g) + r`, ⌊t / 100⌋ y
   * `r = t mod 100`. Con g = 0, exactamente el oro.
   */
  add(gold: number, wood: number, goldBonusPercent = 0): void {
    if (gold > 0) {
      const total = gold * (100 + goldBonusPercent) + this.remainder;
      this.remainder = total % 100;
      this.goldCount += (total - this.remainder) / 100;
    }
    this.woodCount += wood;
  }

  /** Gasta `price` si alcanza (true) o no cambia nada (false). Único camino que baja el oro. */
  spend(price: number): boolean {
    if (this.goldCount < price) return false;
    this.goldCount -= price;
    return true;
  }
}
