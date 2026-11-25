import type { BuildOptionSnapshot } from '../run/RunSnapshot';
import { BUILDING_KINDS, type BuildingKind, type BuildingRules } from './BuildingRules';
import type { BuildSite } from './BuildSite';

/** Lo asequible se mide con la madera y la piedra de la partida. */
export interface Materials {
  readonly wood: number;
  readonly stone: number;
}

/**
 * Asentamiento de la partida (servicio de dominio con estado, propiedad de `Run`; spec build-sites
 * 0026 y 0027): los solares en orden de id, el paso 12 (re-armado y apertura de la oferta de obra por
 * contacto, como mucho un solar por tick) y el solar abierto con su oferta fija: siempre `house` y
 * `tower`, cada una con su asequibilidad y lo que falta al abrirse. No consume azar ni asigna en el
 * tick salvo al abrir una oferta.
 */
export class Settlement {
  private openSite: BuildSite | null = null;
  private offer: readonly BuildOptionSnapshot[] = [];

  constructor(
    readonly sites: readonly BuildSite[],
    private readonly rules: BuildingRules,
  ) {}

  /** Solar con la oferta abierta, o `null`. */
  get open(): BuildSite | null {
    return this.openSite;
  }

  /** Opciones de la oferta abierta en su orden fijo ([] sin oferta), congeladas. */
  get options(): readonly BuildOptionSnapshot[] {
    return this.offer;
  }

  /** ¿Alcanzan los materiales el coste del tipo? */
  canAfford(kind: BuildingKind, m: Materials): boolean {
    const { wood, stone } = this.rules.cost(kind);
    return m.wood >= wood && m.stone >= stone;
  }

  /**
   * Paso 12 con el jugador (x, y, r) (spec build-sites 0027, "Apertura del solar con re-armado"), en
   * el orden de los solares: cada solar `free` se re-arma si procede y, si `canOpen` (la partida
   * sigue en curso) y no se ha abierto otro en este paso, el primero armado que el jugador toca abre
   * la oferta y queda desarmado, se pueda pagar algo o no. Uno armado que no se abre sigue armado.
   * Devuelve true si se ha abierto una oferta.
   */
  step(x: number, y: number, r: number, canOpen: boolean, m: Materials): boolean {
    let opened = false;
    for (const site of this.sites) {
      if (!site.isFree) continue;
      if (!site.touch(x, y, r, canOpen && !opened)) continue;
      opened = true;
      this.openSite = site;
      this.offer = this.optionsFor(m);
    }
    return opened;
  }

  /** Las dos opciones con su asequibilidad y lo que falta con estos materiales. */
  private optionsFor(m: Materials): readonly BuildOptionSnapshot[] {
    return Object.freeze(
      BUILDING_KINDS.map((kind) => {
        const { wood, stone } = this.rules.cost(kind);
        return Object.freeze({
          kind,
          wood,
          stone,
          affordable: this.canAfford(kind, m),
          missing: Object.freeze({
            wood: Math.max(0, wood - m.wood),
            stone: Math.max(0, stone - m.stone),
          }),
        });
      }),
    );
  }

  /**
   * Casas que pagan en el tick n (spec build-sites, "Oro periódico de las casas"): cada casa
   * construida en b paga en n = b + k · periodo (k ≥ 1). Llama a `pay` una vez por casa, en el orden
   * de los solares, con el oro por pago. Sin azar ni asignaciones.
   */
  payIncome(n: number, pay: (gold: number) => void): void {
    const { gold, everyTicks } = this.rules.income;
    for (const site of this.sites) {
      const b = site.builtAt;
      if (site.state !== 'house' || b === null || n <= b) continue;
      if ((n - b) % everyTicks === 0) pay(gold);
    }
  }

  /** Cierra la oferta (al construir o al salir); el solar sigue desarmado. */
  close(): void {
    this.openSite = null;
    this.offer = [];
  }
}
