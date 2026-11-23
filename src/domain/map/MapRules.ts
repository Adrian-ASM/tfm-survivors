import type { Arena } from '../arena/Arena';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

/** Mensajes de las invariantes del mapa; la validación de contenido (zod) usa los mismos. */
export const CELL_SIZE_MUST_BE_INTEGER = 'El tamaño de celda debe ser un entero ≥ 1.';
export const START_RADIUS_MUST_BE_POSITIVE = 'El radio de la zona de inicio debe ser positivo.';
export const TRUNK_DENSITY_OUT_OF_RANGE = 'La densidad de troncos debe estar en [0, 0,3].';
export const TRUNK_PATCH_OUT_OF_RANGE =
  'El tamaño de mancha de troncos necesita enteros con 1 ≤ min ≤ max ≤ 16.';
export const RIVERS_OUT_OF_RANGE = 'El número de ríos debe ser un entero en [0, 2].';
export const BRIDGES_OUT_OF_RANGE = 'Los puentes por río necesitan enteros con 1 ≤ min ≤ max ≤ 6.';
export const CHANCE_OUT_OF_RANGE = 'Una probabilidad de ajuste del mapa debe estar en [0, 1].';
export const PATCH_ATTEMPTS_MUST_BE_INTEGER =
  'Los intentos de colocar manchas deben ser un entero ≥ 1.';
export const CELL_SIZE_BELOW_PLAYER =
  'El tamaño de celda debe ser al menos el diámetro del jugador (cabe por un pasillo de 1 celda).';
export const START_RADIUS_TOO_LARGE =
  'El radio de la zona de inicio no puede pasar de la mitad del lado menor del mundo.';

/** Límites de los campos de rango (spec procedural-map, "Contenido del mapa validado"). */
export const MAP_LIMITS = {
  trunkDensityMax: 0.3,
  trunkPatchMax: 16,
  riversMax: 2,
  bridgesMax: 6,
} as const;

/** Forma de los parámetros del mapa en el contenido (content/map.json). */
export interface MapConfig {
  readonly cellSize: number;
  readonly startRadius: number;
  readonly trunkDensity: number;
  readonly trunkPatch: { readonly min: number; readonly max: number };
  readonly rivers: number;
  readonly bridges: { readonly min: number; readonly max: number };
  /** Ajustes de la generación (design 0015 §3.1). */
  readonly tuning: {
    readonly riverVerticalChance: number;
    readonly riverMeander: number;
    readonly patchAttempts: number;
  };
}

/** Zona de inicio: disco centrado en el mundo (spec procedural-map, "Zona de inicio"). */
export interface StartZone {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

const isInt = (v: number, min: number, max = Infinity): boolean =>
  Number.isInteger(v) && v >= min && v <= max;
const inRange = (v: number, min: number, max: number): boolean =>
  Number.isFinite(v) && v >= min && v <= max;
const isIntRange = (r: { min: number; max: number }, top: number): boolean =>
  isInt(r.min, 1, top) && isInt(r.max, r.min, top);

/** Campo inválido de los rangos del contenido del mapa, o null. */
function checkRanges(config: MapConfig): DomainError | null {
  const { cellSize, startRadius, trunkDensity, trunkPatch, rivers, bridges, tuning } = config;
  const checks: readonly [boolean, string, string][] = [
    [isInt(cellSize, 1), 'cellSize', CELL_SIZE_MUST_BE_INTEGER],
    [Number.isFinite(startRadius) && startRadius > 0, 'startRadius', START_RADIUS_MUST_BE_POSITIVE],
    [
      inRange(trunkDensity, 0, MAP_LIMITS.trunkDensityMax),
      'trunkDensity',
      TRUNK_DENSITY_OUT_OF_RANGE,
    ],
    [isIntRange(trunkPatch, MAP_LIMITS.trunkPatchMax), 'trunkPatch', TRUNK_PATCH_OUT_OF_RANGE],
    [isInt(rivers, 0, MAP_LIMITS.riversMax), 'rivers', RIVERS_OUT_OF_RANGE],
    [isIntRange(bridges, MAP_LIMITS.bridgesMax), 'bridges', BRIDGES_OUT_OF_RANGE],
    [inRange(tuning.riverVerticalChance, 0, 1), 'tuning.riverVerticalChance', CHANCE_OUT_OF_RANGE],
    [inRange(tuning.riverMeander, 0, 1), 'tuning.riverMeander', CHANCE_OUT_OF_RANGE],
    [isInt(tuning.patchAttempts, 1), 'tuning.patchAttempts', PATCH_ATTEMPTS_MUST_BE_INTEGER],
  ];
  const failed = checks.find(([valid]) => !valid);
  return failed ? invalidConfig(`map.${failed[1]}`, failed[2]) : null;
}

/** Invariantes cruzadas con el mundo y el radio del jugador (design 0015 §3.1), o null. */
function checkCross(config: MapConfig, arena: Arena, playerRadius: number): DomainError | null {
  const { cellSize, startRadius } = config;
  // Desviación del design §3.1 (regla 3, resto 0 o ≥ 2r): la spec exige que `cellSize` 32 cargue
  // con el mundo de 1.920 × 1.080 (1.080 mod 32 = 24). Manda la spec; ver diario de IA de 0015.
  if (cellSize < 2 * playerRadius) return invalidConfig('map.cellSize', CELL_SIZE_BELOW_PLAYER);
  if (startRadius > Math.min(arena.width, arena.height) / 2) {
    return invalidConfig('map.startRadius', START_RADIUS_TOO_LARGE);
  }
  return null;
}

/**
 * Reglas del mapa (value object): parámetros del contenido y la rejilla que cubre el mundo,
 * ⌈ancho / cellSize⌉ × ⌈alto / cellSize⌉ celdas con la última columna y fila recortadas. Invariante
 * `cellSize ≥ 2 · radio`: la BFS 4-vecina por celdas equivale a la alcanzabilidad del círculo.
 */
export class MapRules {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
  readonly start: StartZone;

  private constructor(
    readonly config: MapConfig,
    arena: Arena,
  ) {
    this.cellSize = config.cellSize;
    this.width = arena.width;
    this.height = arena.height;
    this.cols = Math.ceil(arena.width / config.cellSize);
    this.rows = Math.ceil(arena.height / config.cellSize);
    this.start = Object.freeze({
      x: arena.width / 2,
      y: arena.height / 2,
      radius: config.startRadius,
    });
    Object.freeze(this);
  }

  static create(
    config: MapConfig,
    arena: Arena,
    playerRadius: number,
  ): Result<MapRules, DomainError> {
    const error = checkRanges(config) ?? checkCross(config, arena, playerRadius);
    if (error) return err(error);
    return ok(new MapRules(config, arena));
  }

  get cellCount(): number {
    return this.cols * this.rows;
  }

  /**
   * ¿Pertenece la celda (c, r) a la zona de inicio? Sí si algún punto de su rectángulo (recortado)
   * está a distancia estrictamente menor que `startRadius` del centro del mundo.
   */
  inStartZone(col: number, row: number): boolean {
    const s = this.cellSize;
    const { x, y, radius } = this.start;
    const nx = Math.max(col * s, Math.min(x, Math.min((col + 1) * s, this.width)));
    const ny = Math.max(row * s, Math.min(y, Math.min((row + 1) * s, this.height)));
    const dx = x - nx;
    const dy = y - ny;
    return dx * dx + dy * dy < radius * radius;
  }
}
