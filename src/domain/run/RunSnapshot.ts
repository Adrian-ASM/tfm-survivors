import type { StateKind } from '../enemy/behavior/BehaviorConfig';
import type { RunPhase } from './RunPhase';

export type { StateKind };

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
  /** Clase del estado: persecución, mecha, carga o espera. */
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
  /** Proyectiles vivos en orden de creación. */
  readonly projectiles: readonly ProjectileSnapshot[];
  /** Pulsos visibles en orden de disparo. */
  readonly pulses: readonly PulseSnapshot[];
  /** Dinamitas en vuelo en orden de creación. */
  readonly dynamites: readonly DynamiteSnapshot[];
  /** Avisos por tick de explosión; a igual tick, mechas (orden de lista) y luego dinamitas. */
  readonly warnings: readonly WarningSnapshot[];
  /** Explosiones visibles en orden de creación. */
  readonly blasts: readonly BlastSnapshot[];
  /** Armas equipadas en el orden del contenido. */
  readonly weapons: readonly WeaponSnapshot[];
  /** Gemas en el suelo en orden de creación. */
  readonly gems: readonly GemSnapshot[];
  readonly progression: ProgressionSnapshot;
  /** Oferta abierta ([] si no hay). */
  readonly offer: readonly OfferSnapshot[];
  readonly upgrades: readonly UpgradeLevelSnapshot[];
}

/**
 * Lo único que el adaptador de render necesita para pintar un frame (spec simulation-loop). La
 * fase garantiza por tipo que `outcome` está definido si y solo si `status` es `over`.
 */
export type RunSnapshot = RunSnapshotBody & RunPhase;
