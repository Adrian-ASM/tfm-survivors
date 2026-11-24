/** Clases cerradas de estado de comportamiento (spec enemy-behavior, ADR-0018). */
export const STATE_KINDS = ['chase', 'fuse', 'charge', 'wait'] as const;
export type StateKind = (typeof STATE_KINDS)[number];

/** Salida por distancia de una persecución: d ≤ `distance` tras moverse ⇒ entra en `to`. */
export interface ExitConfig {
  readonly distance: number;
  readonly to: string;
}

/** Dinamita que lanza una carga al terminar: vuelo en ticks, radio y daño de su explosión. */
export interface DynamiteConfig {
  readonly flightTicks: number;
  readonly radius: number;
  readonly damage: number;
}

export interface ChaseStateConfig {
  readonly name: string;
  readonly kind: 'chase';
  readonly exit?: ExitConfig | undefined;
}

/** Mecha (terminal): explota en `since + ticks` con su radio y daño y da de baja al enemigo. */
export interface FuseStateConfig {
  readonly name: string;
  readonly kind: 'fuse';
  readonly ticks: number;
  readonly radius: number;
  readonly damage: number;
}

/** Carga: quieta `ticks`; lanza una dinamita en cuanto hay sitio y pasa a `to`. */
export interface ChargeStateConfig {
  readonly name: string;
  readonly kind: 'charge';
  readonly ticks: number;
  readonly to: string;
  readonly dynamite: DynamiteConfig;
}

/** Espera: quieta `ticks` y pasa a `to` al empezar el paso de comportamiento. */
export interface WaitStateConfig {
  readonly name: string;
  readonly kind: 'wait';
  readonly ticks: number;
  readonly to: string;
}

export type StateConfig = ChaseStateConfig | FuseStateConfig | ChargeStateConfig | WaitStateConfig;

/** Forma del comportamiento de un tipo en content/enemies.json (validada antes con zod). */
export interface BehaviorConfig {
  readonly initial: string;
  readonly states: readonly StateConfig[];
}
