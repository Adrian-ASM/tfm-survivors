import type { HitKind } from '../combat/HitKind';
import type { StateKind } from '../enemy/behavior/BehaviorConfig';
import type { PickupKind } from '../pickup/PickupKind';
import type { SheepState } from '../sheep/Sheep';
import type { RunPhase } from './RunPhase';

export type { StateKind, SheepState, HitKind };

/** Oveja viva (spec sheep 0023): copia de escalares, con su punto de origen. */
export interface SheepSnapshot {
  /** De la secuencia de las ovejas (desde 0, nunca se reutiliza); no cambia mientras vive. */
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Vida actual (> 0: solo se listan ovejas vivas). */
  readonly health: number;
  readonly state: SheepState;
  /** Ha recibido daño en los últimos `hitFlashTicks` ticks (misma regla que los enemigos). */
  readonly damaged: boolean;
  readonly origin: { readonly x: number; readonly y: number };
}

/** Enemigo vivo tal y como lo ve el adaptador de render (copia de escalares). */
export interface EnemySnapshot {
  /** Único en la partida (contador desde 0, nunca se reutiliza); no cambia mientras vive. */
  readonly id: number;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Vida actual (> 0: solo se listan enemigos vivos). */
  readonly health: number;
  /** Ha recibido daño en los últimos `hitFlashTicks` ticks (spec auto-weapons). */
  readonly damaged: boolean;
  /** Nombre del estado de comportamiento (spec enemy-behavior). */
  readonly state: string;
  /** Clase del estado: persecución, mecha, carga, espera, patrulla, alerta o vuelta. */
  readonly stateKind: StateKind;
}

/** Dinamita en vuelo (spec enemy-hazards): posición interpolada, objetivo fijo y radio visual. */
export interface DynamiteSnapshot {
  /** Único en la partida, nunca reutilizado. */
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly radius: number;
  readonly explodesAt: number;
}

/** Aviso en el suelo de una explosión pendiente: radio igual al de la explosión que anuncia. */
export interface WarningSnapshot {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly source: 'fuse' | 'dynamite';
  readonly explodesAt: number;
}

/** Explosión visible: solo hizo daño en su tick, figura `blastTicks` ticks. */
export interface BlastSnapshot {
  /** Único en la partida, nunca reutilizado. */
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly tick: number;
}

/**
 * Casa o torre de la partida (spec goblin-structures): id, tipo, posición, radio de impacto, huella
 * (primera columna y fila, columnas y filas), vida actual (0 en las ruinas), vida máxima y si está
 * destruida.
 */
export interface StructureSnapshot {
  readonly id: number;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
  readonly health: number;
  /** Vida con la que se crea (la de su tipo; 0031): > 0 y fija toda la partida, también en ruina. */
  readonly maxHealth: number;
  readonly destroyed: boolean;
}

/**
 * Golpe de combate (0031, ADR-0027): daño aplicado a un objetivo en un tick, sumado por objetivo,
 * con id de su propia secuencia, la posición del objetivo en ese tick y su clase. `targetId` es el
 * del enemigo, la estructura o la oveja; no existe en los de clase `player`.
 */
export interface HitSnapshot {
  readonly id: number;
  readonly tick: number;
  readonly kind: HitKind;
  readonly targetId?: number;
  readonly x: number;
  readonly y: number;
  /** Entero ≥ 1: la suma de lo aplicado al objetivo en el tick. */
  readonly amount: number;
}

/** Arma equipada, en el orden de content/weapons.json, y si está cargada en este tick. */
export interface WeaponSnapshot {
  readonly id: string;
  readonly ready: boolean;
}

/** Proyectil vivo (spec auto-weapons): id único en la partida, nunca reutilizado. */
export interface ProjectileSnapshot {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Pulso visible: arma que lo disparó, tick de disparo, centro fijo y radio del criterio. */
export interface PulseSnapshot {
  readonly weapon: string;
  readonly firedAt: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Gema en el suelo (spec xp-gems): id único en la partida, nunca reutilizado. */
export interface GemSnapshot {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/**
 * Recogible en el suelo (spec xp-gems, "Recogibles con tipo"): id de una sola secuencia para los
 * tres tipos, nunca reutilizado.
 */
export interface PickupSnapshot {
  readonly id: number;
  readonly kind: PickupKind;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Tipo de enemigo que soltó la piedra (0025): solo en recogibles `stone` con origen. */
  readonly source?: string;
}

/** Contadores de la partida (spec resources). */
export interface ResourcesSnapshot {
  readonly gold: number;
  readonly wood: number;
  /** Piedra de la partida (0025): solo sube, sin bonificación. */
  readonly stone: number;
}

/** Veta de oro (spec resources, "Vetas de oro al pasar"): fija, activa o agotada. */
export interface VeinSnapshot {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Radio de contacto. */
  readonly radius: number;
  readonly gold: number;
  readonly depleted: boolean;
}

/** Nivel y XP del jugador (spec leveling); `xp` es la XP dentro del nivel actual. */
export interface ProgressionSnapshot {
  readonly level: number;
  readonly xp: number;
  readonly xpToNext: number;
  /** Subidas aún sin resolver, incluida la de la oferta abierta. */
  readonly pendingLevelUps: number;
}

/** Opción de la oferta abierta (spec upgrades), en el orden sorteado. */
export interface OfferSnapshot {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly nextLevel: number;
}

/** Mejora adquirida (nivel ≥ 1), en el orden del catálogo. */
export interface UpgradeLevelSnapshot {
  readonly id: string;
  readonly level: number;
}

/**
 * Producto de la tienda (spec castle-shop 0024): un nivel de una mejora de arma (precio del
 * siguiente nivel o `null` en el máximo) o la curación de pago. `affordable`: oro ≥ precio (y, en la
 * curación, vida por debajo de la máxima).
 */
export type ShopProductSnapshot =
  | {
      readonly kind: 'upgrade';
      readonly id: string;
      readonly name: string;
      readonly description: string;
      readonly level: number;
      readonly maxLevel: number;
      readonly price: number | null;
      readonly affordable: boolean;
    }
  | {
      readonly kind: 'heal';
      readonly id: string;
      readonly name: string;
      readonly description: string;
      readonly amount: number;
      readonly price: number;
      readonly affordable: boolean;
    };

/** La tienda en todo snapshot (0024): puerta, si está armada, si está abierta, oro y productos. */
export interface ShopSnapshot {
  readonly armed: boolean;
  /** La partida está en tienda. */
  readonly open: boolean;
  readonly door: { readonly x: number; readonly y: number; readonly radius: number } | null;
  readonly gold: number;
  /** Las mejoras de arma en el orden de su catálogo y después la curación (longitud fija). */
  readonly products: readonly ShopProductSnapshot[];
}

/** Huella de un edificio en un solar: primera columna y fila, columnas y filas. */
export interface FootprintSnapshot {
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
}

/**
 * Solar de obra (spec build-sites 0027): id, estado, si está armado y huellas de casa y de torre
 * (iguales con el contenido por defecto). Sin acceso.
 */
export interface SiteSnapshot {
  readonly id: number;
  readonly state: 'free' | 'house' | 'tower';
  readonly armed: boolean;
  readonly house: FootprintSnapshot;
  readonly tower: FootprintSnapshot;
}

/**
 * Opción de la oferta de obra (spec build-sites 0027): tipo de edificio, su coste, si es asequible
 * con la madera y la piedra al abrirse y lo que falta de cada una (max(0, coste − saldo)).
 */
export interface BuildOptionSnapshot {
  readonly kind: 'house' | 'tower';
  readonly wood: number;
  readonly stone: number;
  readonly affordable: boolean;
  readonly missing: { readonly wood: number; readonly stone: number };
}

/**
 * Oferta de obra (spec build-sites 0027): abierta si y solo si la partida está en obra, con el solar
 * abierto y siempre las dos opciones (`house` y después `tower`), cada una con su asequibilidad al
 * abrirse; cerrada, sin solar ni opciones.
 */
export interface BuildSnapshot {
  readonly open: boolean;
  readonly siteId: number | null;
  readonly options: readonly BuildOptionSnapshot[];
}

/** Todo el snapshot salvo la fase (estado + resultado). */
export interface RunSnapshotBody {
  readonly tick: number;
  /** Duración objetivo en ticks (constante en la partida; la vista calcula el tiempo restante). */
  readonly durationTicks: number;
  /** Bajas de la partida (spec run-outcome). */
  readonly kills: number;
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly health: number;
    /** Vida máxima efectiva (base + mejoras). */
    readonly maxHealth: number;
    /** Un contacto en el tick siguiente no haría daño (spec player-health). */
    readonly invulnerable: boolean;
  };
  /** Enemigos vivos en orden de aparición. */
  readonly enemies: readonly EnemySnapshot[];
  /** Ovejas vivas en orden de creación (0023). */
  readonly sheep: readonly SheepSnapshot[];
  /** Proyectiles vivos del jugador en orden de creación. */
  readonly projectiles: readonly ProjectileSnapshot[];
  /** Flechas de torre vivas en orden de creación (0026; ids propios, fuera del tope del jugador). */
  readonly towerProjectiles: readonly ProjectileSnapshot[];
  /** Pulsos visibles en orden de disparo. */
  readonly pulses: readonly PulseSnapshot[];
  /** Dinamitas en vuelo en orden de creación. */
  readonly dynamites: readonly DynamiteSnapshot[];
  /** Avisos por tick de explosión; a igual tick, mechas (orden de lista) y luego dinamitas. */
  readonly warnings: readonly WarningSnapshot[];
  /** Explosiones visibles en orden de creación. */
  readonly blasts: readonly BlastSnapshot[];
  /** Casas y torres en su orden fijo, ruinas incluidas (misma longitud toda la partida). */
  readonly structures: readonly StructureSnapshot[];
  /** Armas equipadas en el orden del contenido. */
  readonly weapons: readonly WeaponSnapshot[];
  /** Recogibles de los tres tipos en el suelo, en orden de creación sin agrupar por tipo. */
  readonly pickups: readonly PickupSnapshot[];
  /**
   * Gemas (recogibles `xp`) en el suelo en orden de creación: vista de `pickups` con la forma de
   * antes de 0022 (design §3). Obsoleta: la retira un chore posterior (sin la etiqueta
   * `deprecated`, que `no-deprecated` convierte en ~70 errores de lint en los usos vivos).
   */
  readonly gems: readonly GemSnapshot[];
  /** Oro, madera y piedra de la partida (spec resources). */
  readonly resources: ResourcesSnapshot;
  /** Vetas de la partida en su orden fijo, agotadas incluidas (misma longitud toda la partida). */
  readonly veins: readonly VeinSnapshot[];
  readonly progression: ProgressionSnapshot;
  /** Oferta abierta ([] si no hay). */
  readonly offer: readonly OfferSnapshot[];
  readonly upgrades: readonly UpgradeLevelSnapshot[];
  /** Tienda del castillo (0024), en todos los estados. */
  readonly shop: ShopSnapshot;
  /** Solares de obra en su orden fijo, construidos incluidos (0026, misma longitud toda la partida). */
  readonly sites: readonly SiteSnapshot[];
  /** Oferta de obra (0026): abierta solo en obra. */
  readonly build: BuildSnapshot;
  /** Golpes de los ticks k − N + 1 … k en orden de id (0031; N = ventana de golpes). */
  readonly hits: readonly HitSnapshot[];
}

/**
 * Lo único que el adaptador de render necesita para pintar un frame (spec simulation-loop). La
 * fase garantiza por tipo que `outcome` está definido si y solo si `status` es `over`.
 */
export type RunSnapshot = RunSnapshotBody & RunPhase;
