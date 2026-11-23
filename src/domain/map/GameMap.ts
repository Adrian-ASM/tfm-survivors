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
  readonly start: StartZone;

  private constructor(
    readonly rules: MapRules,
    private readonly cells: Uint8Array,
  ) {
    this.cols = rules.cols;
    this.rows = rules.rows;
    this.cellSize = rules.cellSize;
    this.width = rules.width;
    this.height = rules.height;
    this.start = rules.start;
    Object.freeze(this);
  }

  /** Mapa vacío: todas las celdas `grass`. */
  static open(rules: MapRules): GameMap {
    return new GameMap(rules, new Uint8Array(rules.cellCount).fill(GRASS));
  }

  /**
   * Mapa dado por su lista de tipos en orden de filas (tests, escenarios). Solo exige las
   * dimensiones de la rejilla; no exige composición, zona de inicio ni conectividad.
   */
  static fromCells(types: readonly CellType[], rules: MapRules): Result<GameMap, DomainError> {
    if (types.length !== rules.cellCount) {
      const got = String(types.length);
      const want = `${String(rules.cols)} × ${String(rules.rows)} = ${String(rules.cellCount)}`;
      const message = `${MAP_DIMENSIONS_MISMATCH}: ${got} celdas, se esperaban ${want}.`;
      return err(invalidConfig('map.cells', message));
    }
    const cells = new Uint8Array(types.length);
    types.forEach((t, i) => (cells[i] = codeOf(t)));
    return ok(new GameMap(rules, cells));
  }

  /** Adopta una rejilla de códigos ya construida por el generador del dominio (sin copiarla). */
  static adopt(cells: Uint8Array, rules: MapRules): GameMap {
    if (cells.length !== rules.cellCount) throw new Error('Invariante rota: rejilla del mapa');
    return new GameMap(rules, cells);
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
}
