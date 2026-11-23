import { circlesOverlap } from '../collision/contact';
import type { GameMap } from '../map/GameMap';
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
  /** Punto de creación tras la recolocación (reutilizado: sin asignar por suelta). */
  private readonly spot = { x: 0, y: 0 };

  constructor(
    private readonly rules: GemRules,
    private readonly map: GameMap,
  ) {
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
   * Suelta una gema de `xp` en (x, y), o en el centro de la celda caminable más cercana si (x, y)
   * cae en una no caminable (spec xp-gems). Con el tope lleno no crea ni recoloca ninguna: suma
   * `xp` a la más antigua del suelo, sin perder XP.
   */
  drop(x: number, y: number, xp: number, attracted = false): void {
    const gem = this.free.pop();
    if (!gem) {
      const oldest = this.active[0];
      if (oldest) oldest.value += xp;
      return;
    }
    this.map.nearestWalkable(x, y, this.spot);
    gem.set(this.nextGemId, this.spot.x, this.spot.y, xp, attracted);
    this.nextGemId += 1;
    this.active.push(gem);
  }

  /**
   * Paso de gemas con el jugador ya movido en (px, py), en orden de creación: atracción inclusiva
   * (d ≤ pickupRadius, para siempre), avance de `magnetSpeed / 60` sin sobrepasar al jugador y
   * recogida estricta (círculos solapados, atraída o no). Después, compactación estable: las
   * recogidas vuelven al pool. Devuelve la XP recogida en este paso.
   */
  step(px: number, py: number, playerRadius: number, pickupRadius: number): number {
    const reach = pickupRadius * pickupRadius;
    const { gemRadius, pullPerTick } = this.rules;
    let xp = 0;
    let collected = false;
    for (const gem of this.active) {
      if (!gem.attracted) {
        const dx = px - gem.x;
        const dy = py - gem.y;
        gem.attracted = dx * dx + dy * dy <= reach;
      }
      if (gem.attracted) gem.pull(px, py, pullPerTick);
      if (circlesOverlap(px, py, playerRadius, gem.x, gem.y, gemRadius)) {
        gem.collected = true;
        collected = true;
        xp += gem.value;
      }
    }
    if (collected) this.compact();
    return xp;
  }

  /** Compactación estable en el sitio (ADR-0006): O(n), sin asignar. */
  private compact(): void {
    let w = 0;
    for (let r = 0; r < this.active.length; r++) {
      const g = this.active[r];
      if (!g) continue;
      if (g.collected) {
        this.free.push(g);
      } else {
        this.active[w] = g;
        w++;
      }
    }
    this.active.length = w;
  }
}
