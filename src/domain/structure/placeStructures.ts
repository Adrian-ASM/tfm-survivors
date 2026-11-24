import type { GameMap } from '../map/GameMap';
import type { RandomGenerator } from '../shared/RandomGenerator';
import type { StructureRules } from './StructureRules';
import { structureSite, type StructureSite } from './StructureSite';
import type { StructurePlacementConfig, StructureType } from './StructureType';

/** Distancia de una celda sin fuentes (mayor que cualquier distancia de la rejilla). */
const FAR = 0x7fffffff;

/** Entero uniforme en [lo, hi] (un valor del generador). */
const pickInt = (random: RandomGenerator, lo: number, hi: number): number =>
  lo + Math.floor(random.next() * (hi - lo + 1));

/**
 * Distancia de Chebyshev en celdas de cada celda al conjunto `isSource` (BFS de 8 vecinos desde
 * todas las fuentes a la vez; `FAR` si no hay ninguna). O(celdas).
 */
function chebyshevFrom(map: GameMap, isSource: (c: number, r: number) => boolean): Int32Array {
  const { cols, rows } = map;
  const dist = new Int32Array(cols * rows).fill(FAR);
  const queue = new Int32Array(cols * rows);
  let tail = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isSource(c, r)) continue;
      dist[r * cols + c] = 0;
      queue[tail++] = r * cols + c;
    }
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head] ?? 0;
    const c = i % cols;
    const r = (i - c) / cols;
    const d = (dist[i] ?? 0) + 1;
    for (let rr = Math.max(0, r - 1); rr <= Math.min(rows - 1, r + 1); rr++) {
      for (let cc = Math.max(0, c - 1); cc <= Math.min(cols - 1, c + 1); cc++) {
        const j = rr * cols + cc;
        if ((dist[j] ?? 0) !== FAR) continue;
        dist[j] = d;
        queue[tail++] = j;
      }
    }
  }
  return dist;
}

/**
 * Rejillas de la colocación (design 0021 §3.2): distancias a la zona de inicio, a la huella del
 * castillo y a las celdas `water`/`bridge`, y ocupación (huellas colocadas ampliadas en
 * `minGapCells` y sus puertas).
 */
class PlacementGrid {
  private readonly toStart: Int32Array;
  private readonly toCastle: Int32Array;
  private readonly toWater: Int32Array;
  private readonly occupied: Uint8Array;

  constructor(
    private readonly map: GameMap,
    private readonly p: StructurePlacementConfig,
  ) {
    const castle = map.castle;
    this.toStart = chebyshevFrom(map, (c, r) => map.rules.inStartZone(c, r));
    this.toCastle = chebyshevFrom(
      map,
      (c, r) =>
        castle !== null &&
        c >= castle.firstCol &&
        c <= castle.lastCol &&
        r >= castle.firstRow &&
        r <= castle.lastRow,
    );
    this.toWater = chebyshevFrom(map, (c, r) => {
      const t = map.typeAt(c, r);
      return t === 'water' || t === 'bridge';
    });
    this.occupied = new Uint8Array(map.cols * map.rows);
  }

  /** ¿Admite la celda (c, r) una huella o una puerta? Hierba, libre y a las distancias mínimas. */
  private fits(c: number, r: number): boolean {
    const i = r * this.map.cols + c;
    return (
      this.map.typeAt(c, r) === 'grass' &&
      this.occupied[i] === 0 &&
      (this.toStart[i] ?? 0) >= this.p.minStartCells &&
      (this.toCastle[i] ?? 0) >= this.p.minCastleCells &&
      (this.toWater[i] ?? 0) >= this.p.minWaterCells
    );
  }

  /** ¿Cabe el sitio (huella y, si es casa, puerta)? */
  accepts(site: StructureSite): boolean {
    for (let r = site.row; r < site.row + site.rows; r++) {
      for (let c = site.col; c < site.col + site.cols; c++) if (!this.fits(c, r)) return false;
    }
    return site.door === null || this.fits(site.door.col, site.door.row);
  }

  /** Marca la huella ampliada en la separación mínima y la puerta. */
  occupy(site: StructureSite): void {
    const { cols, rows } = this.map;
    const g = this.p.minGapCells;
    const r1 = Math.min(rows - 1, site.row + site.rows - 1 + g);
    const c1 = Math.min(cols - 1, site.col + site.cols - 1 + g);
    for (let r = Math.max(0, site.row - g); r <= r1; r++) {
      for (let c = Math.max(0, site.col - g); c <= c1; c++) this.occupied[r * cols + c] = 1;
    }
    if (site.door) this.occupied[site.door.row * cols + site.door.col] = 1;
  }
}

/** Hasta `maxAttempts` intentos de 2 valores (columna y luego fila); `null` si se agotan. */
function attempt(
  map: GameMap,
  grid: PlacementGrid,
  type: StructureType,
  id: number,
  maxAttempts: number,
  random: RandomGenerator,
): StructureSite | null {
  const door = type.kind === 'house' ? 1 : 0;
  for (let k = 0; k < maxAttempts; k++) {
    const col = pickInt(random, 0, map.cols - type.cols);
    const row = pickInt(random, 0, map.rows - type.rows - door);
    const site = structureSite(id, type, col, row, type.cols, type.rows, map);
    if (grid.accepts(site)) return site;
  }
  return null;
}

/**
 * Casas y torres de un mapa generado (design 0021 §3.2), función pura del mapa, de las reglas y de
 * su propio generador (ADR-0020): los tipos en el orden del contenido y, de cada uno, hasta su
 * número; un tipo deja de colocarse en cuanto una estructura agota sus intentos (mejor esfuerzo,
 * sin error). El orden de consumo (2 valores por intento) y el criterio de aceptación son parte del
 * contrato de determinismo. Solo lee el mapa.
 */
export function placeStructures(
  map: GameMap,
  rules: StructureRules,
  random: RandomGenerator,
): StructureSite[] {
  const grid = new PlacementGrid(map, rules.placement);
  const sites: StructureSite[] = [];
  for (const type of rules.types) {
    for (let k = 0; k < type.count; k++) {
      const site = attempt(map, grid, type, sites.length, rules.placement.maxAttempts, random);
      if (!site) break;
      grid.occupy(site);
      sites.push(site);
    }
  }
  return sites;
}
