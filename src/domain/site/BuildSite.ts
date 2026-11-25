import { CONTACT_EPS, type BuildingKind, type BuildingRules } from './BuildingRules';

/** Estado de un solar (spec build-sites 0026): sin construir o con su edificio. */
export type SiteState = 'free' | BuildingKind;

/** Lo que el solar necesita de la rejilla: tamaño de celda y del mundo (recorte de la huella). */
export interface SiteGrid {
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
}

/** Distancia de v al intervalo cerrado [lo, hi] (0 si está dentro). */
const gapTo = (v: number, lo: number, hi: number): number => {
  if (v < lo) return lo - v;
  if (v > hi) return v - hi;
  return 0;
};

/**
 * Solar de obra (entidad interna a `Run`, spec build-sites 0026 y 0027): id en la partida, ancla
 * (primera columna y fila), huella del contenido (casa = torre), centro y rectángulo de mundo de la
 * huella (recortado al mundo), su armado (design 0027 §1.4: se abre al tocar la huella, g ≤ ε, y se
 * re-arma a g ≥ `contact.rearmDistance`) y su estado. Solo pasa de `free` a un edificio, una vez
 * (`markBuilt`). Sin azar ni asignaciones.
 */
export class BuildSite {
  readonly cols: number;
  readonly rows: number;
  /** Centro de la huella (punto de disparo de la torre). */
  readonly x: number;
  readonly y: number;
  /** Rectángulo cerrado de la huella en el mundo. */
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  private readonly rearmDistance: number;
  private isArmed: boolean;
  private current: SiteState = 'free';
  private built: number | null = null;

  constructor(
    readonly id: number,
    readonly col: number,
    readonly row: number,
    rules: BuildingRules,
    grid: SiteGrid,
    armed = true,
  ) {
    const { cols, rows } = rules.sites.footprint;
    const s = grid.cellSize;
    this.cols = cols;
    this.rows = rows;
    this.x = (col + cols / 2) * s;
    this.y = (row + rows / 2) * s;
    this.left = col * s;
    this.top = row * s;
    this.right = Math.min((col + cols) * s, grid.width);
    this.bottom = Math.min((row + rows) * s, grid.height);
    this.rearmDistance = rules.contact.rearmDistance;
    this.isArmed = armed;
  }

  get state(): SiteState {
    return this.current;
  }

  /** ¿Se abrirá su oferta al tocarlo? */
  get armed(): boolean {
    return this.isArmed;
  }

  /** `snapshot.tick` en que se construyó, o `null` sin construir. */
  get builtAt(): number | null {
    return this.built;
  }

  get isFree(): boolean {
    return this.current === 'free';
  }

  /**
   * Separación g del círculo (x, y, r) a la huella: distancia del centro al rectángulo cerrado menos
   * el radio (0 es tangencia; negativa si solapa).
   */
  gap(x: number, y: number, r: number): number {
    const ex = gapTo(x, this.left, this.right);
    const ey = gapTo(y, this.top, this.bottom);
    return Math.hypot(ex, ey) - r;
  }

  /**
   * Paso 12 con el jugador (x, y, r) (spec build-sites 0027, "Apertura del solar con re-armado"):
   * desarmado y g ≥ X ⇒ armado (también con otra fase abierta en el tick); armado, `canOpen` y
   * g ≤ ε ⇒ se desarma y devuelve true. Armado y sin `canOpen` sigue armado. Como X > ε, nunca
   * pasan las dos cosas en el mismo paso.
   */
  touch(x: number, y: number, r: number, canOpen: boolean): boolean {
    const g = this.gap(x, y, r);
    if (!this.isArmed) {
      if (g >= this.rearmDistance) this.isArmed = true;
      return false;
    }
    if (!canOpen || !(g <= CONTACT_EPS)) return false;
    this.isArmed = false;
    return true;
  }

  /** Construye el edificio en el tick dado; solo desde `free` (lo garantiza `Run`). */
  markBuilt(kind: BuildingKind, tick: number): void {
    if (this.current !== 'free') throw new Error('Invariante rota: solar ya construido');
    this.current = kind;
    this.built = tick;
  }
}
