import { ProximityGate } from '../shared/ProximityGate';
import { ACCESS_OFFSET_CELLS, type BuildingKind, type BuildingRules } from './BuildingRules';

/** Estado de un solar (spec build-sites 0026): sin construir o con su edificio. */
export type SiteState = 'free' | BuildingKind;

/** Punto del mundo. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Solar de obra (entidad interna a `Run`, spec build-sites 0026): id en la partida, ancla (primera
 * columna y fila), huella del contenido (casa = torre, design §1), centro de la huella, acceso fijo
 * (x del centro, borde inferior + 1,5 celdas) con su puerta por proximidad, armada al empezar, y su
 * estado. Solo pasa de `free` a un edificio, una vez (`markBuilt`).
 */
export class BuildSite {
  readonly cols: number;
  readonly rows: number;
  /** Centro de la huella (punto de disparo de la torre). */
  readonly x: number;
  readonly y: number;
  readonly access: Point;
  readonly gate: ProximityGate;
  private current: SiteState = 'free';
  private built: number | null = null;

  constructor(
    readonly id: number,
    readonly col: number,
    readonly row: number,
    rules: BuildingRules,
    cellSize: number,
  ) {
    const { cols, rows } = rules.sites.footprint;
    this.cols = cols;
    this.rows = rows;
    this.x = (col + cols / 2) * cellSize;
    this.y = (row + rows / 2) * cellSize;
    this.access = Object.freeze({ x: this.x, y: (row + rows + ACCESS_OFFSET_CELLS) * cellSize });
    this.gate = new ProximityGate(this.access, rules.access, true);
  }

  get state(): SiteState {
    return this.current;
  }

  /** `snapshot.tick` en que se construyó, o `null` sin construir. */
  get builtAt(): number | null {
    return this.built;
  }

  get isFree(): boolean {
    return this.current === 'free';
  }

  /** Construye el edificio en el tick dado; solo desde `free` (lo garantiza `Run`). */
  markBuilt(kind: BuildingKind, tick: number): void {
    if (this.current !== 'free') throw new Error('Invariante rota: solar ya construido');
    this.current = kind;
    this.built = tick;
  }
}
