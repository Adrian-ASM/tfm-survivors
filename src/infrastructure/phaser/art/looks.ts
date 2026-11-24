import type { Appearance, Aspect } from '../../content/appearanceSchema';
import type { AnimSpec, Facing } from './animation';

/** Textura generada por el juego para el aspecto de reserva: disco blanco, sin ficheros. */
export const PLACEHOLDER_TEXTURE = 'placeholder:disc';
/** Diámetro en px del disco de reserva. */
export const PLACEHOLDER_SIZE = 64;

/** Cómo se pinta un aspecto ya resuelto contra las texturas cargadas (o su reserva). */
export interface LookBase {
  /** Clave de la textura: la `file` de la hoja o `PLACEHOLDER_TEXTURE`. */
  readonly texture: string;
  readonly placeholder: boolean;
  readonly scale: number;
  readonly origin: { readonly x: number; readonly y: number };
  readonly facing: Facing;
  /** Color del aspecto de reserva (#rrggbb ya convertido). */
  readonly color: number;
  /** Con reserva no hay volteo ni rotación. */
  readonly flips: boolean;
}
export interface StillLook extends LookBase {
  readonly idle: AnimSpec;
}
export interface MovingLook extends StillLook {
  readonly walk: AnimSpec;
}
export interface CorpseLook extends LookBase {
  readonly death: AnimSpec;
}
/** Enemigo (0020): además, `fuse` (mecha) y `throw` (carga) si su comportamiento las tiene. */
export interface EnemyLook extends MovingLook {
  readonly fuse?: AnimSpec | undefined;
  readonly throw?: AnimSpec | undefined;
}
/** Explosión (0020): `explode` una vez, quieta en su último frame. */
export interface ExplosionLook extends LookBase {
  readonly explode: AnimSpec;
}
/** Color y opacidad de un aviso en el suelo (sin hoja: nunca es reserva). */
export interface WarningLook {
  readonly color: number;
  readonly alpha: number;
}

export interface Looks {
  readonly player: MovingLook;
  readonly enemies: ReadonlyMap<string, EnemyLook>;
  readonly projectile: StillLook;
  readonly gem: StillLook;
  readonly ground: StillLook;
  readonly corpse: CorpseLook;
  readonly dynamite: StillLook;
  readonly explosion: ExplosionLook;
  readonly warnings: { readonly fuse: WarningLook; readonly dynamite: WarningLook };
}

/** Nº de frames de una textura cargada o `null` si no está (en Phaser: `exists` y `frameTotal − 1`). */
export type FrameCount = (key: string) => number | null;

const CENTER = { x: 0.5, y: 0.5 };

/** Animaciones que puede tener un aspecto (las de comportamiento, `fuse` y `throw`, desde 0020). */
const ANIM_KEYS = ['idle', 'walk', 'fuse', 'throw', 'death', 'explode'] as const;

/** Todos los índices de frame que usa un aspecto: si alguno no está en la hoja, va con reserva. */
export function framesUsed(aspect: Aspect): number[] {
  const anims = aspect as Partial<Record<(typeof ANIM_KEYS)[number], AnimSpec>>;
  return ANIM_KEYS.flatMap((k) => [...(anims[k]?.frames ?? [])]);
}

function base(aspect: Aspect, frames: FrameCount): LookBase {
  const count = frames(aspect.sheet.file);
  const fits = count !== null && framesUsed(aspect).every((i) => i < count);
  return {
    texture: fits ? aspect.sheet.file : PLACEHOLDER_TEXTURE,
    placeholder: !fits,
    scale: aspect.scale,
    origin: fits ? aspect.origin : CENTER,
    facing: aspect.facing,
    color: aspect.placeholderColor,
    flips: fits,
  };
}

/**
 * Resuelve los aspectos contra las texturas cargadas (design "Fallback"): si la hoja falta o algún
 * índice usado no existe, el aspecto usa el disco de reserva. Puro: sin motor.
 */
export function resolveLooks(appearance: Appearance, frames: FrameCount): Looks {
  const moving = (a: Appearance['player']): MovingLook => ({
    ...base(a, frames),
    idle: a.idle,
    walk: a.walk,
  });
  const still = (a: Appearance['gem']): StillLook => ({ ...base(a, frames), idle: a.idle });
  return {
    player: moving(appearance.player),
    enemies: new Map(
      Object.entries(appearance.enemies).map(([id, a]) => [
        id,
        { ...moving(a), fuse: a.fuse, throw: a.throw },
      ]),
    ),
    projectile: still(appearance.projectile),
    gem: still(appearance.gem),
    ground: still(appearance.ground),
    corpse: { ...base(appearance.corpse, frames), death: appearance.corpse.death },
    dynamite: still(appearance.dynamite),
    explosion: { ...base(appearance.explosion, frames), explode: appearance.explosion.explode },
    warnings: appearance.warnings,
  };
}

/** Escala de un elemento de radio `radius`: la del aspecto o, en reserva, diámetro 2r. */
export function lookScale(look: LookBase, radius: number): number {
  return look.placeholder ? (2 * radius) / PLACEHOLDER_SIZE : look.scale;
}

/** Origen del sprite: el del aspecto o el centro en reserva. */
export function lookOrigin(look: LookBase): { x: number; y: number } {
  return { x: look.origin.x, y: look.origin.y };
}
