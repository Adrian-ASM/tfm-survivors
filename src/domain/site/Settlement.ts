import { BUILDING_KINDS, type BuildingKind, type BuildingRules } from './BuildingRules';
import type { BuildSite } from './BuildSite';

/** Lo asequible se mide con la madera y la piedra de la partida. */
export interface Materials {
  readonly wood: number;
  readonly stone: number;
}

/**
 * Asentamiento de la partida (servicio de dominio con estado, propiedad de `Run`; spec build-sites
 * 0026): los solares en orden de id, el paso 12 (re-armado y apertura de la oferta de obra, como
 * mucho un solar por tick), el solar abierto con su oferta fija (los tipos asequibles al abrirse,
 * en el orden `house`, `tower`). No consume azar ni asigna en el tick salvo al abrir una oferta.
 */
export class Settlement {
  private openSite: BuildSite | null = null;
  private offer: readonly BuildingKind[] = [];

  constructor(
    readonly sites: readonly BuildSite[],
    private readonly rules: BuildingRules,
  ) {}

  /** Solar con la oferta abierta, o `null`. */
  get open(): BuildSite | null {
    return this.openSite;
  }

  /** Tipos de la oferta abierta en su orden fijo ([] sin oferta). */
  get offered(): readonly BuildingKind[] {
    return this.offer;
  }

  /** ¿Alcanzan los materiales el coste del tipo? */
  canAfford(kind: BuildingKind, m: Materials): boolean {
    const { wood, stone } = this.rules.cost(kind);
    return m.wood >= wood && m.stone >= stone;
  }

  /**
   * Paso 12 con el jugador en (x, y) (spec build-sites, "Apertura del solar con re-armado"), en el
   * orden de los solares: cada solar `free` se re-arma si procede y, si `canOpen` (la partida sigue
   * en curso), no se ha abierto otro en este paso y hay ≥ 1 tipo asequible, el primero armado a
   * d < radio abre la oferta y queda desarmado. Uno armado que no se abre sigue armado. Devuelve true
   * si se ha abierto una oferta.
   */
  step(x: number, y: number, canOpen: boolean, m: Materials): boolean {
    const affordable = canOpen && BUILDING_KINDS.some((k) => this.canAfford(k, m));
    let opened = false;
    for (const site of this.sites) {
      if (!site.isFree) continue;
      if (!site.gate.step(x, y, affordable && !opened)) continue;
      opened = true;
      this.openSite = site;
      this.offer = Object.freeze(BUILDING_KINDS.filter((k) => this.canAfford(k, m)));
    }
    return opened;
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
