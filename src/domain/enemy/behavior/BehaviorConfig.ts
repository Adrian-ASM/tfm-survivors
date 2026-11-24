/** Clases cerradas de estado de comportamiento (spec enemy-behavior, ADR-0019 y ADR-0020). */
export const STATE_KINDS = [
  'chase',
  'fuse',
  'charge',
  'wait',
  'patrol',
  'alert',
  'return',
] as const;
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

/** Patrulla (guardia, ADR-0020): recorre las esquinas de su puesto con radio `radius`. */
export interface PatrolStateConfig {
  readonly name: string;
  readonly kind: 'patrol';
  readonly radius: number;
  /** Detección: d ≤ `distance` tras moverse ⇒ entra en `to`. */
  readonly detect: ExitConfig;
}

/** Alerta: persigue; `exit` (lanzamiento) por distancia y `lose` (abandono) si d > `distance`. */
export interface AlertStateConfig {
  readonly name: string;
  readonly kind: 'alert';
  readonly exit: ExitConfig;
  readonly lose: ExitConfig;
}

/** Vuelta: va al puesto; `detect` como la patrulla y `to` al llegar exactamente al puesto. */
export interface ReturnStateConfig {
  readonly name: string;
  readonly kind: 'return';
  readonly detect: ExitConfig;
  readonly to: string;
}

export type StateConfig =
  | ChaseStateConfig
  | FuseStateConfig
  | ChargeStateConfig
  | WaitStateConfig
  | PatrolStateConfig
  | AlertStateConfig
  | ReturnStateConfig;

/** Clases de guardia: un tipo que las usa necesita un puesto y empezar en patrulla. */
export const GUARD_KINDS: readonly StateKind[] = ['patrol', 'alert', 'return'];

/** Forma del comportamiento de un tipo en content/enemies.json (validada antes con zod). */
export interface BehaviorConfig {
  readonly initial: string;
  readonly states: readonly StateConfig[];
}
