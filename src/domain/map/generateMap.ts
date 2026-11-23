import type { RandomGenerator } from '../shared/RandomGenerator';
import { BRIDGE, WATER } from './CellType';
import { GameMap } from './GameMap';
import type { MapRules } from './MapRules';

/** Entero uniforme en [lo, hi] (un valor del generador). */
const pickInt = (random: RandomGenerator, lo: number, hi: number): number =>
  lo + Math.floor(random.next() * (hi - lo + 1));

interface Span {
  readonly min: number;
  readonly max: number;
}

/** Rejilla en construcción: tipos, celdas vetadas a los troncos y extensión de la zona de inicio. */
class Draft {
  readonly cols: number;
  readonly rows: number;
  readonly cells: Uint8Array;
  readonly noTrunk: Uint8Array;
  readonly zoneCols: Span;
  readonly zoneRows: Span;

  constructor(readonly rules: MapRules) {
    this.cols = rules.cols;
    this.rows = rules.rows;
    this.cells = new Uint8Array(rules.cellCount);
    this.noTrunk = new Uint8Array(rules.cellCount);
    let [c0, c1, r0, r1] = [rules.cols, -1, rules.rows, -1];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!rules.inStartZone(c, r)) continue;
        this.noTrunk[r * this.cols + c] = 1;
        [c0, c1, r0, r1] = [Math.min(c0, c), Math.max(c1, c), Math.min(r0, r), Math.max(r1, r)];
      }
    }
    this.zoneCols = { min: c0, max: c1 };
    this.zoneRows = { min: r0, max: r1 };
  }

  /** Veta los troncos en la vecindad 3 × 3 de la celda (c, r). */
  protectAround(c: number, r: number): void {
    for (let rr = Math.max(0, r - 1); rr <= Math.min(this.rows - 1, r + 1); rr++) {
      for (let cc = Math.max(0, c - 1); cc <= Math.min(this.cols - 1, c + 1); cc++) {
        this.noTrunk[rr * this.cols + cc] = 1;
      }
    }
  }
}

/**
 * Geometría de un río: las líneas que recorre (filas si es vertical, columnas si es horizontal) y
 * la posición transversal en cada línea.
 */
class RiverAxis {
  readonly lines: number;

  constructor(
    readonly draft: Draft,
    readonly vertical: boolean,
  ) {
    this.lines = vertical ? draft.rows : draft.cols;
  }

  index(line: number, pos: number): number {
    return this.vertical ? line * this.draft.cols + pos : pos * this.draft.cols + line;
  }

  /** Banda del lado `side` (0 antes de la zona, 1 después), con 1 celda de margen al borde y a la zona. */
  band(side: number): Span {
    const across = this.vertical ? this.draft.cols : this.draft.rows;
    const zone = this.vertical ? this.draft.zoneCols : this.draft.zoneRows;
    return side === 0 ? { min: 1, max: zone.min - 2 } : { min: zone.max + 2, max: across - 2 };
  }
}

/**
 * Un río de borde a borde (design 0015 §3.2 paso 2): una celda por línea y, con probabilidad
 * `riverMeander`, un desplazamiento ±1 con su celda de enlace en la misma línea (4-conexo); un
 * desplazamiento no invierte el de la línea anterior (sin bloques 2 × 2). Devuelve las líneas
 * "rectas" (una sola celda, ni la primera ni la última), candidatas a puente.
 */
function carveRiver(axis: RiverAxis, band: Span, random: RandomGenerator, cells: Uint8Array) {
  const meander = axis.draft.rules.config.tuning.riverMeander;
  const straight: { line: number; pos: number }[] = [];
  let pos = pickInt(random, band.min, band.max);
  let previous = 0;
  const allowed = (d: number): boolean =>
    d !== -previous && pos + d >= band.min && pos + d <= band.max;
  for (let line = 0; line < axis.lines; line++) {
    cells[axis.index(line, pos)] = WATER;
    let shift = 0;
    if (line < axis.lines - 1 && random.next() < meander) {
      const d = random.next() < 0.5 ? -1 : 1;
      shift = allowed(d) ? d : allowed(-d) ? -d : 0;
    }
    if (shift !== 0) {
      pos += shift;
      cells[axis.index(line, pos)] = WATER;
    } else if (line > 0 && line < axis.lines - 1) {
      straight.push({ line, pos });
    }
    previous = shift;
  }
  return straight;
}

/** Puentes: `n` en [min, max] entre las líneas rectas, nunca en líneas contiguas. */
function placeBridges(
  axis: RiverAxis,
  straight: readonly { line: number; pos: number }[],
  random: RandomGenerator,
  draft: Draft,
): void {
  const { min, max } = draft.rules.config.bridges;
  const n = pickInt(random, min, max);
  const chosen: number[] = [];
  for (let k = 0; k < n; k++) {
    const free = straight.filter((s) => chosen.every((line) => Math.abs(line - s.line) > 1));
    const pick = free[Math.floor(random.next() * free.length)];
    if (!pick) return;
    chosen.push(pick.line);
    const i = axis.index(pick.line, pick.pos);
    draft.cells[i] = BRIDGE;
    draft.protectAround(i % draft.cols, Math.floor(i / draft.cols));
  }
}

/** Ríos: orientación común; el primero elige lado al azar y el segundo va al opuesto. */
function carveRivers(draft: Draft, random: RandomGenerator): void {
  const { rivers, tuning } = draft.rules.config;
  if (rivers === 0) return;
  const axis = new RiverAxis(draft, random.next() < tuning.riverVerticalChance);
  const first = random.next() < 0.5 ? 0 : 1;
  for (let k = 0; k < rivers; k++) {
    const band = axis.band(k === 0 ? first : 1 - first);
    if (band.min > band.max) continue;
    const straight = carveRiver(axis, band, random, draft.cells);
    placeBridges(axis, straight, random, draft);
  }
}

/**
 * Mapa de una partida (design 0015 §3.2), función pura de las reglas y de su propio generador. El
 * orden de consumo de azar (orientación, lado, ríos, puentes, troncos) es parte del contrato de
 * determinismo (ADR-0013).
 */
export function generateMap(rules: MapRules, random: RandomGenerator): GameMap {
  const draft = new Draft(rules);
  carveRivers(draft, random);
  return GameMap.adopt(draft.cells, rules);
}
