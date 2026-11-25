import { isWalkableCode } from './CellType';
import type { GameMap } from './GameMap';
import { distancesFrom } from './connectivity';

/**
 * Tolerancia en el parámetro t del segmento para tratar dos cruces de rejilla como la misma esquina
 * (redondeo; a escala de juego solo hace la regla más conservadora).
 */
const CORNER_EPS = 1e-9;

/**
 * Campo de flujo (servicio de dominio con estado; ADR-0017 y ADR-0025): distancias 4-vecinas hacia
 * una celda (la del jugador, propiedad de `Run`, o un punto fijo de un `GuardPost`) sobre los
 * códigos vivos del mapa (spec procedural-map, "Campo de distancias hacia una celda"). Es función
 * solo de (mapa con sus obras, celda): un cambio de celda o de revisión del mapa (una obra)
 * recalcula desde cero. Perezoso: `retarget` y `sync` marcan el campo como sucio y la BFS se hace en
 * la primera consulta que la necesita. Buffers preasignados: no asigna en el tick ni consume azar.
 */
export class FlowField {
  private readonly dist: Int32Array;
  private readonly queue: Int32Array;
  private readonly cols: number;
  private readonly rows: number;
  /** ¿Tiene el mapa alguna celda no caminable? Sin ninguna, `steer` es la persecución recta. */
  private blocked: boolean;
  /** Revisión del mapa con la que se calcularon `blocked` y las distancias. */
  private seenRevision: number;
  private targetCol = -1;
  private targetRow = -1;
  private dirty = true;
  private bfsCount = 0;

  constructor(private readonly map: GameMap) {
    this.cols = map.cols;
    this.rows = map.rows;
    const n = map.cols * map.rows;
    this.dist = new Int32Array(n);
    this.queue = new Int32Array(n);
    this.seenRevision = map.revision;
    this.blocked = hasBlocked(map.liveCodes);
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
    this.sync();
    this.ensure();
    return this.dist[row * this.cols + col] ?? -1;
  }

  /**
   * Objetivo del tick para un enemigo en (ex, ey) con el jugador en (px, py) (design §2.3), escrito
   * en `out` sin asignar: el centro del jugador si el mapa no tiene celdas bloqueadas, si comparten
   * celda, si hay línea libre o si la celda del enemigo no tiene distancia (reserva); si no, el
   * centro (del rectángulo recortado) del primer vecino, en el orden izquierda, derecha, arriba,
   * abajo, con distancia una menos que la suya.
   */
  steer(ex: number, ey: number, px: number, py: number, out: { x: number; y: number }): void {
    out.x = px;
    out.y = py;
    this.sync();
    if (!this.blocked) return;
    const map = this.map;
    const c = map.colAt(ex);
    const r = map.rowAt(ey);
    if (c === map.colAt(px) && r === map.rowAt(py)) return;
    if (this.hasClearLine(ex, ey, px, py)) return;
    const d = this.distanceAt(c, r);
    if (d <= 0) return;
    let nc = c;
    let nr = r;
    if (this.distanceAt(c - 1, r) === d - 1) nc = c - 1;
    else if (this.distanceAt(c + 1, r) === d - 1) nc = c + 1;
    else if (this.distanceAt(c, r - 1) === d - 1) nr = r - 1;
    else nr = r + 1;
    const s = map.cellSize;
    out.x = (nc * s + Math.min((nc + 1) * s, map.width)) / 2;
    out.y = (nr * s + Math.min((nr + 1) * s, map.height)) / 2;
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

  /**
   * Si el mapa cambió de revisión (una obra, ADR-0025), el campo queda sucio y se recalcula
   * `blocked`: O(celdas), una vez por obra. Sin obras no hace nada.
   */
  private sync(): void {
    const { revision } = this.map;
    if (revision === this.seenRevision) return;
    this.seenRevision = revision;
    this.blocked = hasBlocked(this.map.liveCodes);
    this.dirty = true;
  }

  private ensure(): void {
    if (!this.dirty) return;
    const inside =
      this.targetCol >= 0 &&
      this.targetRow >= 0 &&
      this.targetCol < this.cols &&
      this.targetRow < this.rows;
    const start = inside ? this.targetRow * this.cols + this.targetCol : -1;
    distancesFrom(this.map.liveCodes, this.cols, this.rows, start, this.dist, this.queue);
    this.dirty = false;
    this.bfsCount += 1;
  }
}

/** ¿Hay algún código no caminable? */
function hasBlocked(codes: ArrayLike<number>): boolean {
  for (let i = 0; i < codes.length; i++) if (!isWalkableCode(codes[i] ?? 0)) return true;
  return false;
}
