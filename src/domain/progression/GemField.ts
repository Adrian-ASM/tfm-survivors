import type { GemRules } from './GemRules';
import { XpGem } from './XpGem';

/**
 * Gemas en el suelo (servicio de dominio con estado; lo posee `Run`, como el `Arsenal`). Pool
 * preasignado de `maxGems` (ADR-0003, ADR-0006): cero asignaciones por suelta o recogida. La
 * lista activa va en orden de creación; los ids nunca se reutilizan. No consume azar.
 */
export class GemField {
  private readonly active: XpGem[] = [];
  private readonly free: XpGem[] = [];
  private nextGemId = 0;

  constructor(private readonly rules: GemRules) {
    for (let i = 0; i < rules.maxGems; i++) this.free.push(new XpGem());
  }

  /** Gemas en el suelo en orden de creación (vista interna de solo lectura para el snapshot). */
  get gems(): readonly XpGem[] {
    return this.active;
  }

  get radius(): number {
    return this.rules.gemRadius;
  }

  /**
   * Suelta una gema de `xp` en (x, y). Con el tope lleno no crea ninguna: suma `xp` a la más
   * antigua del suelo, sin perder XP (spec xp-gems).
   */
  drop(x: number, y: number, xp: number, attracted = false): void {
    const gem = this.free.pop();
    if (!gem) {
      const oldest = this.active[0];
      if (oldest) oldest.value += xp;
      return;
    }
    gem.set(this.nextGemId, x, y, xp, attracted);
    this.nextGemId += 1;
    this.active.push(gem);
  }

  /**
   * Paso de gemas con el jugador ya movido en (px, py), en orden de creación: atracción inclusiva
   * (d ≤ pickupRadius, para siempre) y avance de `magnetSpeed / 60` sin sobrepasar al jugador.
   * Devuelve la XP recogida en este paso.
   */
  step(px: number, py: number, _playerRadius: number, pickupRadius: number): number {
    const reach = pickupRadius * pickupRadius;
    for (const gem of this.active) {
      if (!gem.attracted) {
        const dx = px - gem.x;
        const dy = py - gem.y;
        gem.attracted = dx * dx + dy * dy <= reach;
      }
      if (gem.attracted) gem.pull(px, py, this.rules.pullPerTick);
    }
    return 0;
  }
}
