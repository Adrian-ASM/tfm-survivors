import type { GameMap } from './GameMap';
import { codesOf, distancesFrom } from './connectivity';

/**
 * Tolerancia en el parámetro t del segmento para tratar dos cruces de rejilla como la misma esquina
 * (redondeo; a escala de juego solo hace la regla más conservadora).
 */
const CORNER_EPS = 1e-9;

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

  /**
   * ¿Línea libre del punto (ex, ey) al (px, py)? (spec enemy-behavior): toda celda con algún punto
   * del segmento es caminable, con la regla de celda de un punto (floor). Recorrido de rejilla
   * (Amanatides–Woo) desde la celda del enemigo; si el segmento pasa justo por una esquina, se
   * comprueban también las dos celdas laterales. Para en la primera celda bloqueada; sin asignar.
   */
  hasClearLine(ex: number, ey: number, px: number, py: number): boolean {
    const map = this.map;
    const s = map.cellSize;
    let c = map.colAt(ex);
    let r = map.rowAt(ey);
    const c1 = map.colAt(px);
    const r1 = map.rowAt(py);
    if (!map.isWalkable(c, r)) return false;
    const dx = px - ex;
    const dy = py - ey;
    const sx = dx > 0 ? 1 : -1;
    const sy = dy > 0 ? 1 : -1;
    let budget = Math.abs(c1 - c) + Math.abs(r1 - r);
    while ((c !== c1 || r !== r1) && budget-- > 0) {
      const tx = dx === 0 ? Infinity : ((sx > 0 ? c + 1 : c) * s - ex) / dx;
      const ty = dy === 0 ? Infinity : ((sy > 0 ? r + 1 : r) * s - ey) / dy;
      if (Math.abs(tx - ty) <= CORNER_EPS) {
        if (!map.isWalkable(c + sx, r) || !map.isWalkable(c, r + sy)) return false;
        c += sx;
        r += sy;
        budget--;
      } else if (tx < ty) {
        c += sx;
      } else {
        r += sy;
      }
      if (!map.isWalkable(c, r)) return false;
    }
    return true;
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
