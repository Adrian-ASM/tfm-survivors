/**
 * Vida (value object). Invariante: 0 ≤ current ≤ max; un daño mayor que la vida restante la deja
 * exactamente en 0 (spec player-health "Vida mínima 0"). Inmutable: solo asigna al recibir un golpe
 * o una mejora, nunca por tick.
 */
export class Health {
  private constructor(
    readonly current: number,
    readonly max: number,
  ) {
    Object.freeze(this);
  }

  /** Vida llena; `max` ya validado (> 0 y finito) por `buildRunRules`. */
  static full(max: number): Health {
    return new Health(max, max);
  }

  damage(amount: number): Health {
    return new Health(Math.max(0, this.current - amount), this.max);
  }

  /**
   * Mejora de vida máxima (spec player-health): max y current suben lo mismo. Con un incremento
   * negativo, current se recorta a [1, max]: una elección no puede matar fuera de un tick.
   */
  raise(amount: number): Health {
    const max = this.max + amount;
    return new Health(Math.min(max, Math.max(1, this.current + amount)), max);
  }

  get isDepleted(): boolean {
    return this.current === 0;
  }
}
