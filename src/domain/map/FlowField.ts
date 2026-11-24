import type { GameMap } from './GameMap';
import { codesOf, distancesFrom } from './connectivity';

/**
 * Campo de flujo de la partida (servicio de dominio con estado, propiedad de `Run`; ADR-0017):
 * distancias 4-vecinas hacia la celda del jugador sobre el mapa inmutable de la partida (spec
 * procedural-map, "Campo de distancias hacia una celda"). Es función solo de (mapa, celda): cada
 * cambio de celda recalcula desde cero. Perezoso: `retarget` marca el campo como sucio y la BFS se
 * hace en la primera consulta que la necesita. Buffers preasignados: no asigna en el tick ni
 * consume azar.
 */
export class FlowField {
  private readonly cells: Uint8Array;
  private readonly dist: Int32Array;
  private readonly queue: Int32Array;
  private readonly cols: number;
  private readonly rows: number;
  private targetCol = -1;
  private targetRow = -1;
  private dirty = true;
  private bfsCount = 0;

  constructor(private readonly map: GameMap) {
    this.cells = codesOf(map);
    this.cols = map.cols;
    this.rows = map.rows;
    this.dist = new Int32Array(this.cells.length);
    this.queue = new Int32Array(this.cells.length);
  }

  /** BFS hechas desde la creación (observabilidad del cálculo perezoso, tests y bench). */
  get computations(): number {
    return this.bfsCount;
  }

  /** Fija la celda objetivo; si cambia, el campo queda sucio hasta la siguiente consulta. */
  retarget(col: number, row: number): void {
    if (col === this.targetCol && row === this.targetRow) return;
    this.targetCol = col;
    this.targetRow = row;
    this.dirty = true;
  }

  /** Pasos 4-vecinos de (col, row) hasta el objetivo; −1 = sin distancia (o fuera de la rejilla). */
  distanceAt(col: number, row: number): number {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return -1;
    this.ensure();
    return this.dist[row * this.cols + col] ?? -1;
  }

  private ensure(): void {
    if (!this.dirty) return;
    const inside =
      this.targetCol >= 0 &&
      this.targetRow >= 0 &&
      this.targetCol < this.cols &&
      this.targetRow < this.rows;
    const start = inside ? this.targetRow * this.cols + this.targetCol : -1;
    distancesFrom(this.cells, this.cols, this.rows, start, this.dist, this.queue);
    this.dirty = false;
    this.bfsCount += 1;
  }
}
