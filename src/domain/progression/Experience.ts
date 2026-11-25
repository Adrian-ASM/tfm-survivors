import type { XpCurve } from './XpCurve';

/**
 * Experiencia del jugador (entidad mutable interna a `Run`, escalares; spec leveling). `xp` es la
 * XP acumulada dentro del nivel actual. `pendingLevelUps` cuenta las subidas aún sin resolver,
 * incluida la de la oferta abierta. Sin nivel máximo.
 */
export class Experience {
  private lvl: number;
  private current: number;
  private pending = 0;
  private remainder = 0;

  /** `level` y `xp` iniciales ya validados (`RunSetup`): level entero ≥ 1, 0 ≤ xp < toNext. */
  constructor(
    private readonly curve: XpCurve,
    level = 1,
    xp = 0,
  ) {
    this.lvl = level;
    this.current = xp;
  }

  get level(): number {
    return this.lvl;
  }

  get xp(): number {
    return this.current;
  }

  get xpToNext(): number {
    return this.curve.toNext(this.lvl);
  }

  get pendingLevelUps(): number {
    return this.pending;
  }

  /** Resto en centésimas de la bonificación de XP (0..99; no sale en el snapshot). */
  get bonusRemainder(): number {
    return this.remainder;
  }

  /**
   * Suma la XP de `amount` con la bonificación `bonusPercent` (spec leveling 0024): con el resto r,
   * `t = amount × (100 + b) + r`, suma ⌊t / 100⌋ y deja `r = t mod 100`. Con b = 0, exactamente
   * `amount`. Cada umbral alcanzado sube 1 nivel, arrastra el sobrante y registra una subida.
   */
  gain(amount: number, bonusPercent = 0): void {
    const total = amount * (100 + bonusPercent) + this.remainder;
    this.remainder = total % 100;
    this.current += (total - this.remainder) / 100;
    for (let need = this.xpToNext; this.current >= need; need = this.xpToNext) {
      this.current -= need;
      this.lvl += 1;
      this.pending += 1;
    }
  }

  /** Una subida pendiente se ha resuelto con una elección. */
  resolveOne(): void {
    if (this.pending > 0) this.pending -= 1;
  }

  /** Sin mejoras disponibles: las subidas quedan registradas (nivel ya subido) sin oferta. */
  clearPending(): void {
    this.pending = 0;
  }
}
