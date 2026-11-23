import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { GRASS, codeOf, isWalkableCode, typeOf, type CellType } from './CellType';
import type { MapRules, StartZone } from './MapRules';

export const MAP_DIMENSIONS_MISMATCH =
  'El mapa dado no tiene las dimensiones de la rejilla del contenido';

/** Celda (columna, fila) de la rejilla. */
export interface Cell {
  readonly col: number;
  readonly row: number;
}

/**
 * Huella del castillo de un mapa generado (primera y última columna y fila), o `null` en el mapa
 * vacío y en los explícitos, cuyas celdas `castle` son sueltas (spec procedural-map 0016).
 */
export interface CastleFootprint {
  readonly firstCol: number;
  readonly lastCol: number;
  readonly firstRow: number;
  readonly lastRow: number;
}

/** Punto del mundo. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** Rectángulo de mundo de una celda, recortado al borde del mundo. */
export interface CellRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Mapa de la partida (value object): rejilla inmutable de celdas tipadas en orden de filas, un
 * byte por celda en una `Uint8Array` privada. Ninguna consulta consume azar ni asigna en el tick.
 */
export class GameMap {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
  /** Punto de salida del jugador y centro de la zona de inicio de este mapa (0016). */
  readonly start: StartZone;
  readonly castle: CastleFootprint | null;

  private constructor(
    readonly rules: MapRules,
    private readonly cells: Uint8Array,
    start: StartZone,
    castle: CastleFootprint | null,
  ) {
    this.cols = rules.cols;
    this.rows = rules.rows;
    this.cellSize = rules.cellSize;
    this.width = rules.width;
    this.height = rules.height;
    this.start = start;
    this.castle = castle;
    Object.freeze(this);
  }

  /** Salida en el punto dado (sin él, el centro del mundo) con el radio de la zona de inicio. */
  private static startAt(rules: MapRules, at?: Point): StartZone {
    const center = rules.centerStart;
    return at ? Object.freeze({ x: at.x, y: at.y, radius: center.radius }) : center;
  }

  /** Mapa vacío: todas las celdas `grass`; salida en `start` o, sin ella, en el centro del mundo. */
  static open(rules: MapRules, start?: Point): GameMap {
    const cells = new Uint8Array(rules.cellCount).fill(GRASS);
    return new GameMap(rules, cells, GameMap.startAt(rules, start), null);
  }

  /**
   * Mapa dado por su lista de tipos en orden de filas (tests, escenarios). Solo exige las
   * dimensiones de la rejilla; no exige composición, zona de inicio ni conectividad.
   */
  static fromCells(
    types: readonly CellType[],
    rules: MapRules,
    start?: Point,
  ): Result<GameMap, DomainError> {
    if (types.length !== rules.cellCount) {
      const got = String(types.length);
      const want = `${String(rules.cols)} × ${String(rules.rows)} = ${String(rules.cellCount)}`;
      const message = `${MAP_DIMENSIONS_MISMATCH}: ${got} celdas, se esperaban ${want}.`;
      return err(invalidConfig('map.cells', message));
    }
    const cells = new Uint8Array(types.length);
    types.forEach((t, i) => (cells[i] = codeOf(t)));
    return ok(new GameMap(rules, cells, GameMap.startAt(rules, start), null));
  }

  /**
   * Adopta una rejilla de códigos ya construida por el generador del dominio (sin copiarla), con la
   * huella del castillo de las reglas y la salida ante su puerta.
   */
  static adopt(cells: Uint8Array, rules: MapRules): GameMap {
    if (cells.length !== rules.cellCount) throw new Error('Invariante rota: rejilla del mapa');
    const { firstCol, lastCol, firstRow, lastRow } = rules.castle;
    const footprint = Object.freeze({ firstCol, lastCol, firstRow, lastRow });
    return new GameMap(rules, cells, rules.castleStart, footprint);
  }

  private inside(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  /** Tipo de la celda (c, r); la celda debe estar en la rejilla. */
  typeAt(col: number, row: number): CellType {
    if (!this.inside(col, row))
      throw new RangeError(`Celda fuera de la rejilla: ${String(col)},${String(row)}`);
    return typeOf(this.cells[row * this.cols + col] ?? GRASS);
  }

  /** ¿Es caminable la celda (c, r)? Fuera de la rejilla, no. */
  isWalkable(col: number, row: number): boolean {
    if (!this.inside(col, row)) return false;
    return isWalkableCode(this.cells[row * this.cols + col] ?? GRASS);
  }

  /** Columna de la x de mundo (x = ancho ⇒ última columna). Sin asignar. */
  colAt(x: number): number {
    return Math.max(0, Math.min(Math.floor(x / this.cellSize), this.cols - 1));
  }

  /** Fila de la y de mundo (y = alto ⇒ última fila). Sin asignar. */
  rowAt(y: number): number {
    return Math.max(0, Math.min(Math.floor(y / this.cellSize), this.rows - 1));
  }

  /** Celda que contiene el punto (x, y) del mundo. */
  cellAt(x: number, y: number): Cell {
    return { col: this.colAt(x), row: this.rowAt(y) };
  }

  /** Rectángulo de mundo de la celda (c, r), recortado al borde del mundo. */
  cellRect(col: number, row: number): CellRect {
    const s = this.cellSize;
    return {
      left: col * s,
      top: row * s,
      right: Math.min((col + 1) * s, this.width),
      bottom: Math.min((row + 1) * s, this.height),
    };
  }

  /**
   * ¿Solapa el círculo (x, y, r) alguna celda no caminable? Distancia del centro al punto más
   * cercano del rectángulo cerrado, estricta: la tangencia no es solape (con un margen de redondeo
   * de `TANGENCY_EPS` en d², para que un contacto calculado con raíces siga siendo tangente).
   */
  overlapsBlocked(x: number, y: number, r: number): boolean {
    const limit = r * r - TANGENCY_EPS;
    for (let row = this.rowAt(y - r); row <= this.rowAt(y + r); row++) {
      const ey = gap(y, row * this.cellSize, this.edge(row + 1, this.height));
      for (let col = this.colAt(x - r); col <= this.colAt(x + r); col++) {
        if (this.isWalkable(col, row)) continue;
        const ex = gap(x, col * this.cellSize, this.edge(col + 1, this.width));
        if (ex * ex + ey * ey < limit) return true;
      }
    }
    return false;
  }

  /**
   * Posición x final de un círculo que barre de `x0` a `x1` a la altura `y` (design 0015 §4): el
   * primer contacto con una celda no caminable en la dirección del movimiento (cara: tangente a
   * ella; esquina: `left − √(r² − ey²)`), recortado a [x0, x1]. Sin túneles ni rebotes; sin asignar.
   */
  limitMoveX(x0: number, x1: number, y: number, r: number): number {
    return this.sweep(x0, x1, y, r, true);
  }

  /** Como `limitMoveX` en el eje y, con la x ya resuelta. */
  limitMoveY(y0: number, y1: number, x: number, r: number): number {
    return this.sweep(y0, y1, x, r, false);
  }

  /**
   * Punto donde crear algo que aparece en (x, y) (spec xp-gems, "Recolocación de gemas"): el mismo
   * si su celda es caminable; si no, el centro (del rectángulo recortado) de la celda caminable de
   * menor distancia euclídea a (x, y), con empate a la fila menor y luego a la columna menor. Sin
   * azar ni asignaciones: escribe en `out`. O(celdas), solo en bajas sobre celdas bloqueadas.
   */
  nearestWalkable(x: number, y: number, out: { x: number; y: number }): void {
    out.x = x;
    out.y = y;
    if (this.isWalkable(this.colAt(x), this.rowAt(y))) return;
    let best = Infinity;
    for (let row = 0; row < this.rows; row++) {
      const cy = (row * this.cellSize + this.edge(row + 1, this.height)) / 2;
      for (let col = 0; col < this.cols; col++) {
        if (!this.isWalkable(col, row)) continue;
        const cx = (col * this.cellSize + this.edge(col + 1, this.width)) / 2;
        const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
        if (d < best) {
          best = d;
          out.x = cx;
          out.y = cy;
        }
      }
    }
  }

  /** Columna (eje x) o fila (eje y) de una coordenada de mundo. */
  private indexAt(v: number, alongX: boolean): number {
    return alongX ? this.colAt(v) : this.rowAt(v);
  }

  /** Borde final de la celda `index − 1` en un eje, recortado al mundo. */
  private edge(index: number, side: number): number {
    return Math.min(index * this.cellSize, side);
  }

  private sweep(a0: number, a1: number, b: number, r: number, alongX: boolean): number {
    if (a1 === a0) return a0;
    const forward = a1 > a0;
    const aSide = alongX ? this.width : this.height;
    const bSide = alongX ? this.height : this.width;
    const j0 = this.indexAt(Math.min(a0, a1) - r, alongX);
    const j1 = this.indexAt(Math.max(a0, a1) + r, alongX);
    const k1 = this.indexAt(b + r, !alongX);
    let limit = a1;
    for (let k = this.indexAt(b - r, !alongX); k <= k1; k++) {
      const eb = gap(b, k * this.cellSize, this.edge(k + 1, bSide));
      if (eb >= r) continue;
      const reach = Math.sqrt(r * r - eb * eb);
      for (let j = j0; j <= j1; j++) {
        if (alongX ? this.isWalkable(j, k) : this.isWalkable(k, j)) continue;
        const near = j * this.cellSize;
        const far = this.edge(j + 1, aSide);
        if (forward && near >= a0) limit = Math.min(limit, near - reach);
        if (!forward && far <= a0) limit = Math.max(limit, far + reach);
      }
    }
    return forward ? Math.max(a0, limit) : Math.min(a0, limit);
  }
}

/** Margen de redondeo en d² para la tangencia (px²; irrelevante a escala de juego). */
const TANGENCY_EPS = 1e-6;

/** Distancia de v al intervalo cerrado [lo, hi] (0 si está dentro). */
function gap(v: number, lo: number, hi: number): number {
  if (v < lo) return lo - v;
  if (v > hi) return v - hi;
  return 0;
}
