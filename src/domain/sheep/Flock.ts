import type { Arena } from '../arena/Arena';
import type { GameMap } from '../map/GameMap';
import type { RandomGenerator } from '../shared/RandomGenerator';
import { Sheep } from './Sheep';
import type { SheepRules } from './SheepRules';

/**
 * Oveja inicial de la partida: posición y, opcionales (`RunSetup` y primer pasto del mapa
 * generado), su vida, su origen y el último tick de su primer pasto (por defecto, pasto completo).
 */
export interface SheepSpawn {
  readonly x: number;
  readonly y: number;
  readonly health?: number | undefined;
  readonly origin?: { readonly x: number; readonly y: number } | undefined;
  readonly phaseEnd?: number | undefined;
}

const D = Math.SQRT1_2;

/**
 * Las 8 direcciones del paseo aleatorio, en orden fijo (este, sureste, sur, …): tabla de unitarios
 * sin trigonometría, cuyo resultado ECMAScript no fija (contrato de determinismo, ADR-0022).
 */
const DIRS: readonly (readonly [number, number])[] = Object.freeze([
  [1, 0],
  [D, D],
  [0, 1],
  [-D, D],
  [-1, 0],
  [-D, -D],
  [0, -1],
  [D, -D],
]);

/**
 * Ovejas de la partida (servicio de dominio con estado; lo posee `Run`, ADR-0022). Lista viva en
 * orden de creación con compactación estable (ADR-0006), una secuencia de ids propia que no se
 * reutiliza y un pool preasignado de `capacity` registros: sin asignaciones por tick. Separada de
 * `Horde`: ni el director, ni `maxAlive`, ni las bajas las ven. Todo su azar sale de `random`, el
 * azar de las ovejas, nunca del de la partida.
 */
export class Flock {
  private readonly alive: Sheep[] = [];
  private readonly free: Sheep[] = [];
  private nextId = 0;

  constructor(
    private readonly rules: SheepRules,
    spawns: readonly SheepSpawn[],
    /** Ovejas vivas como mucho (tope del mapa generado o número de declaradas). */
    readonly capacity: number = spawns.length,
    private readonly random: RandomGenerator | null = null,
  ) {
    for (let i = 0; i < capacity; i++) this.free.push(new Sheep(rules.radius));
    const { ticks } = rules.config.graze;
    for (const s of spawns) {
      const sheep = this.add(s.x, s.y, s.health ?? rules.health, s.phaseEnd ?? ticks);
      if (s.origin) {
        sheep.originX = s.origin.x;
        sheep.originY = s.origin.y;
      }
    }
  }

  /** Ovejas vivas en orden de creación: el mismo array durante toda la partida (vista interna). */
  get all(): readonly Sheep[] {
    return this.alive;
  }

  /**
   * Paso 1 del tick n, tras el jugador (ya movido en (px, py)), en orden de lista (spec sheep): a
   * menos del radio de huida (estricto) huye en recta; al salir de la huida empieza un pasto
   * completo sin moverse; si no, alterna pasto (quieta) y paseo (dirección fija: hacia su origen si
   * está a más del radio de pasto o, si no, una de `DIRS` con 1 valor del azar de las ovejas).
   */
  step(n: number, px: number, py: number, map: GameMap, arena: Arena): void {
    const { graze, wander, flee } = this.rules.config;
    const fleeR2 = flee.radius * flee.radius;
    const grazeR2 = graze.radius * graze.radius;
    for (const s of this.alive) {
      const ax = s.x - px;
      const ay = s.y - py;
      const d2 = ax * ax + ay * ay;
      if (d2 < fleeR2) {
        const d = Math.sqrt(d2);
        s.mode = 'flee';
        s.dx = d === 0 ? 1 : ax / d;
        s.dy = d === 0 ? 0 : ay / d;
        this.move(s, this.rules.fleeStep, map, arena);
      } else if (s.mode === 'flee' || (s.mode === 'wander' && n > s.phaseEnd)) {
        s.mode = 'graze';
        s.phaseEnd = n + graze.ticks - 1;
      } else if (s.mode === 'graze' && n > s.phaseEnd) {
        s.mode = 'wander';
        s.phaseEnd = n + wander.ticks - 1;
        this.aim(s, grazeR2);
        this.move(s, this.rules.wanderStep, map, arena);
      } else if (s.mode === 'wander') {
        this.move(s, this.rules.wanderStep, map, arena);
      }
    }
  }

  /** Dirección de un paseo nuevo: a su origen si está fuera del radio de pasto; si no, al azar. */
  private aim(s: Sheep, grazeR2: number): void {
    const ox = s.originX - s.x;
    const oy = s.originY - s.y;
    const o2 = ox * ox + oy * oy;
    if (o2 > grazeR2) {
      const d = Math.sqrt(o2);
      s.dx = ox / d;
      s.dy = oy / d;
      return;
    }
    if (!this.random) throw new Error('Invariante rota: ovejas sin su azar');
    const dir = DIRS[Math.floor(this.random.next() * DIRS.length)] ?? DIRS[0];
    s.dx = dir?.[0] ?? 1;
    s.dy = dir?.[1] ?? 0;
  }

  /** Avance con el barrido por ejes del jugador (desliza, no rebota, puede atascarse). */
  private move(s: Sheep, step: number, map: GameMap, arena: Arena): void {
    const r = s.radius;
    const x0 = s.x;
    const x = map.limitMoveX(x0, arena.clampX(x0 + s.dx * step, r), s.y, r);
    const y = map.limitMoveY(s.y, arena.clampY(s.y + s.dy * step, r), x, r);
    s.x = x;
    s.y = y;
  }

  /** Crea una oveja del pool al final de la lista, con id nuevo. */
  private add(x: number, y: number, health: number, phaseEnd: number): Sheep {
    const sheep = this.free.pop();
    if (!sheep) throw new Error('Invariante rota: pool de ovejas agotado bajo su capacidad');
    sheep.set(this.nextId, x, y, health, phaseEnd);
    this.nextId += 1;
    this.alive.push(sheep);
    return sheep;
  }
}
