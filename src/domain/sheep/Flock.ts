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

/**
 * Celdas en las que puede reaparecer una oveja (design 0023 §4.2), en orden de filas, ya filtradas
 * a centros que son posición legal de su círculo, sobre el mapa de la partida.
 */
export interface SheepGround {
  readonly map: GameMap;
  readonly cells: readonly number[];
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
  /** Celdas base de reaparición con sus centros (calculados una vez al crear la partida). */
  private readonly baseCells: Int32Array;
  private readonly baseX: Float64Array;
  private readonly baseY: Float64Array;
  /** Cola FIFO de reapariciones pendientes: tick en que tocan y celda de la muerte. */
  private readonly pendingDue: Float64Array;
  private readonly pendingCell: Int32Array;
  private pending = 0;

  constructor(
    private readonly rules: SheepRules,
    spawns: readonly SheepSpawn[],
    /** Ovejas vivas como mucho (tope del mapa generado o número de declaradas). */
    readonly capacity: number = spawns.length,
    private readonly random: RandomGenerator | null = null,
    private readonly ground: SheepGround | null = null,
  ) {
    for (let i = 0; i < capacity; i++) this.free.push(new Sheep(rules.radius));
    const cells = ground?.cells ?? [];
    this.baseCells = Int32Array.from(cells);
    this.baseX = new Float64Array(cells.length);
    this.baseY = new Float64Array(cells.length);
    if (ground) {
      const { map } = ground;
      for (const [j, i] of cells.entries()) {
        const c = i % map.cols;
        const rect = map.cellRect(c, (i - c) / map.cols);
        this.baseX[j] = (rect.left + rect.right) / 2;
        this.baseY[j] = (rect.top + rect.bottom) / 2;
      }
    }
    this.pendingDue = new Float64Array(capacity);
    this.pendingCell = new Int32Array(capacity);
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

  /**
   * Despeje de una obra (spec build-sites 0026), en orden de lista y sin azar: cada oveja cuyo
   * círculo solapa una celda no caminable (solo puede ser la obra nueva) pasa al centro de la celda
   * caminable más cercana a su centro (la suya si es caminable), y cada origen en una celda
   * construida, al centro de la caminable más cercana.
   */
  evict(map: GameMap): void {
    const spot = { x: 0, y: 0 };
    for (const s of this.alive) {
      if (map.overlapsBlocked(s.x, s.y, s.radius)) {
        map.nearestWalkableCenter(s.x, s.y, spot);
        s.x = spot.x;
        s.y = spot.y;
      }
      if (map.isBuiltAt(s.originX, s.originY)) {
        map.nearestWalkable(s.originX, s.originY, spot);
        s.originX = spot.x;
        s.originY = spot.y;
      }
    }
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

  /**
   * Pasos 3.5 y 4.2 del tick n: las ovejas a vida 0 salen de la lista sin cambiar el orden de las
   * demás (compactación estable); de cada una, en orden de lista, se avisa a `onDeath` (su carne,
   * spec resources) y se encola su reaparición para el tick n + intervalo con la celda de su centro,
   * antes de devolver su registro al pool.
   */
  settle(n: number, onDeath: (dead: Sheep) => void): void {
    let w = 0;
    for (let r = 0; r < this.alive.length; r++) {
      const s = this.alive[r];
      if (!s) continue;
      if (s.alive) {
        this.alive[w] = s;
        w++;
      } else {
        onDeath(s);
        this.enqueue(n + this.rules.config.respawn.everyTicks, s.x, s.y);
        this.free.push(s);
      }
    }
    this.alive.length = w;
  }

  /**
   * Paso 9.2 del tick n con el jugador en (px, py) (spec sheep, "Reaparición de ovejas"): en orden de
   * cola, cada pendiente que ya toca aparece en una celda candidata (base, distinta de la de su
   * muerte y con el centro a ≥ la distancia mínima del jugador), elegida con 1 valor del azar de las
   * ovejas; sin candidatas sigue pendiente sin consumir azar. La nueva va al final de la lista.
   */
  respawn(n: number, px: number, py: number): void {
    if (this.pending === 0) return;
    const { pendingDue, pendingCell } = this;
    let w = 0;
    for (let r = 0; r < this.pending; r++) {
      const due = pendingDue[r] ?? 0;
      const cell = pendingCell[r] ?? -1;
      if (due <= n && this.spawnAway(n, px, py, cell)) continue;
      pendingDue[w] = due;
      pendingCell[w] = cell;
      w++;
    }
    this.pending = w;
  }

  /** Encola una reaparición con la celda del punto (x, y) de la muerte. */
  private enqueue(due: number, x: number, y: number): void {
    const map = this.ground?.map;
    if (!map || this.pending >= this.capacity) return;
    this.pendingDue[this.pending] = due;
    this.pendingCell[this.pending] = map.rowAt(y) * map.cols + map.colAt(x);
    this.pending += 1;
  }

  /** Dos pasadas sin asignar: cuenta las candidatas y crea la oveja en la ⌊next · k⌋-ésima. */
  private spawnAway(n: number, px: number, py: number, deathCell: number): boolean {
    const { baseCells, baseX, baseY } = this;
    const min = this.rules.config.respawn.minPlayerDistance;
    const min2 = min * min;
    const map = this.ground?.map;
    const r = this.rules.radius;
    const ok = (j: number): boolean => {
      if (baseCells[j] === deathCell) return false;
      const x = baseX[j] ?? 0;
      const y = baseY[j] ?? 0;
      const dx = x - px;
      const dy = y - py;
      // Una celda base que solapa una celda no caminable (de obra incluida, ADR-0026) no es candidata.
      const blocked = map !== undefined && map.overlapsBlocked(x, y, r);
      return dx * dx + dy * dy >= min2 && !blocked;
    };
    let k = 0;
    for (let j = 0; j < baseCells.length; j++) if (ok(j)) k++;
    if (k === 0) return false;
    if (!this.random) throw new Error('Invariante rota: ovejas sin su azar');
    let pick = Math.floor(this.random.next() * k);
    for (let j = 0; j < baseCells.length; j++) {
      if (!ok(j)) continue;
      if (pick === 0) {
        this.add(
          baseX[j] ?? 0,
          baseY[j] ?? 0,
          this.rules.health,
          n + this.rules.config.graze.ticks,
        );
        return true;
      }
      pick--;
    }
    return false;
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
