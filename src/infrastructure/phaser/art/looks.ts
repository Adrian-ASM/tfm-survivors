import type {
  Appearance,
  Aspect,
  PickupLooksAppearance,
  ResourcePickupAspect,
  RockSize,
  SheepAspect,
  StillAspect,
} from '../../content/appearanceSchema';
import { ROCK_SIZES } from '../../content/appearanceSchema';
import type { PickupKind } from '../../../domain/pickup/PickupKind';
import type { AnimSpec, Facing } from './animation';
import type { PickupMotion } from './pickupMotion';

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
/**
 * Aspecto de un recogible (0022). `shape`: la gema sin hoja, pintada como forma de color con la
 * textura de reserva y su color, que nunca cuenta como reserva en la sonda.
 */
export interface PickupLook extends StillLook {
  readonly shape: boolean;
  /**
   * Aparición (0030): la vista con la hoja `spawn` (sus frames en `idle`) y la escala, el origen y el
   * color del `idle`; `null` si el tipo no la declara, si `idle` va con reserva o si la hoja `spawn`
   * no cargó o no tiene alguno de sus frames (entonces va directo a `idle`, sin contar reserva).
   */
  readonly spawn: StillLook | null;
  /** Radio en px de la gema sin hoja (`diameter / 2`, 0030); `null` en los aspectos con hoja. */
  readonly shapeRadius: number | null;
}
/**
 * Aspecto de la oveja (0023): una vista por animación, cada una con la textura de su hoja (`idle`
 * en pasto, `bounce` en paseo y huida; el campo `idle` de cada vista es su animación). Si falla
 * cualquiera de las dos hojas, las dos vistas son la reserva (disco del color de la oveja).
 */
export interface SheepLook {
  readonly idle: StillLook;
  readonly bounce: StillLook;
  readonly placeholder: boolean;
}

/**
 * Rocas de la piedra (0025): una vista por tamaño y la de cada piedra según su origen (el tipo de
 * enemigo que la soltó). Sin origen, o con un origen sin aspecto, la roca `medium`.
 */
export interface StoneLooks {
  readonly rocks: Readonly<Record<RockSize, PickupLook>>;
  of(source: string | undefined): PickupLook;
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
  /** Por tipo de recogible (0022, 0025): la piedra, con la roca `medium` (icono y sin origen). */
  readonly pickups: Readonly<Record<PickupKind, PickupLook>>;
  readonly sheep: SheepLook;
  /** Rocas de la piedra (0025), elegidas por el origen de cada piedra. */
  readonly stones: StoneLooks;
  readonly ground: StillLook;
  readonly corpse: CorpseLook;
  readonly dynamite: StillLook;
  readonly explosion: ExplosionLook;
  readonly warnings: { readonly fuse: WarningLook; readonly dynamite: WarningLook };
  /** Flote y desfase de aparición de los recogibles (0030). */
  readonly pickupMotion: PickupMotion;
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

/** Vistas de la oveja contra las texturas cargadas: las dos con su hoja o las dos en reserva. */
function sheepLook(a: SheepAspect, frames: FrameCount): SheepLook {
  const fits = (anim: SheepAspect['idle']): boolean => {
    const count = frames(anim.sheet.file);
    return count !== null && anim.frames.every((i) => i < count);
  };
  const painted = fits(a.idle) && fits(a.bounce);
  const view = (anim: SheepAspect['idle']): StillLook => ({
    texture: painted ? anim.sheet.file : PLACEHOLDER_TEXTURE,
    placeholder: !painted,
    scale: a.scale,
    origin: painted ? a.origin : CENTER,
    facing: a.facing,
    color: a.placeholderColor,
    flips: painted,
    idle: { frames: anim.frames, fps: anim.fps, loop: anim.loop },
  });
  return { idle: view(a.idle), bounce: view(a.bounce), placeholder: !painted };
}

/** `idle` de la gema sin hoja: el único frame de la textura de reserva. */
const SHAPE_IDLE: AnimSpec = Object.freeze({ frames: Object.freeze([0]), fps: 1, loop: true });

/**
 * Aspectos de los recogibles (0022, 0023): `gold`, `wood` y `meat` con su hoja (o reserva si no cargó); la gema,
 * con hoja como ellos o, sin hoja, como forma de color sobre la textura de reserva (`shape`).
 */
function pickupLooks(
  p: PickupLooksAppearance,
  still: (a: StillAspect) => StillLook,
  frames: FrameCount,
): Omit<Record<PickupKind, PickupLook>, 'stone'> {
  const sheet = (a: StillAspect): PickupLook => ({
    ...still(a),
    shape: false,
    spawn: null,
    shapeRadius: null,
  });
  const resource = (a: ResourcePickupAspect): PickupLook => {
    const look = sheet(a);
    return { ...look, spawn: spawnLook(a, look, frames) };
  };
  const xp: PickupLook =
    'sheet' in p.xp
      ? sheet(p.xp)
      : {
          texture: PLACEHOLDER_TEXTURE,
          placeholder: true,
          scale: 1,
          origin: CENTER,
          facing: 'right',
          color: p.xp.placeholderColor,
          flips: false,
          idle: SHAPE_IDLE,
          shape: true,
          spawn: null,
          shapeRadius: p.xp.diameter / 2,
        };
  return { xp, gold: resource(p.gold), wood: resource(p.wood), meat: resource(p.meat) };
}

/**
 * Vista de la aparición de oro, madera o carne (0030, design D3), como las de la oveja: la hoja
 * `spawn` con la escala, el origen y el color de `idle`. `null` sin `spawn`, con `idle` en reserva o
 * si la hoja `spawn` no cargó o no contiene alguno de sus frames.
 */
function spawnLook(a: ResourcePickupAspect, idle: StillLook, frames: FrameCount): StillLook | null {
  const spawn = a.spawn;
  if (!spawn || idle.placeholder) return null;
  const count = frames(spawn.sheet.file);
  if (count === null || !spawn.frames.every((i) => i < count)) return null;
  return {
    ...idle,
    texture: spawn.sheet.file,
    idle: { frames: spawn.frames, fps: spawn.fps, loop: false },
  };
}

/** Rocas de la piedra (0025): cada una con su hoja o su reserva, y la roca de cada tipo de enemigo. */
function stoneLooks(appearance: Appearance, still: (a: StillAspect) => StillLook): StoneLooks {
  const { stone } = appearance.pickups;
  const view = (size: RockSize): PickupLook => ({
    ...still({ ...stone.rocks[size], placeholderColor: stone.placeholderColor }),
    shape: false,
    spawn: null,
    shapeRadius: null,
  });
  const rocks = Object.fromEntries(ROCK_SIZES.map((size) => [size, view(size)])) as Record<
    RockSize,
    PickupLook
  >;
  const bySource = new Map(
    Object.entries(appearance.enemies).map(([id, a]) => [id, rocks[a.rock]]),
  );
  return {
    rocks,
    of: (source) => (source === undefined ? undefined : bySource.get(source)) ?? rocks.medium,
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
  const still = (a: StillAspect): StillLook => ({ ...base(a, frames), idle: a.idle });
  const stones = stoneLooks(appearance, still);
  return {
    player: moving(appearance.player),
    enemies: new Map(
      Object.entries(appearance.enemies).map(([id, a]) => [
        id,
        { ...moving(a), fuse: a.fuse, throw: a.throw },
      ]),
    ),
    projectile: still(appearance.projectile),
    // La piedra sin origen (y el icono del HUD) usa la roca `medium` (0025).
    pickups: { ...pickupLooks(appearance.pickups, still, frames), stone: stones.rocks.medium },
    sheep: sheepLook(appearance.sheep, frames),
    stones,
    ground: still(appearance.ground),
    corpse: { ...base(appearance.corpse, frames), death: appearance.corpse.death },
    dynamite: still(appearance.dynamite),
    explosion: { ...base(appearance.explosion, frames), explode: appearance.explosion.explode },
    warnings: appearance.warnings,
    pickupMotion: appearance.pickupMotion,
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
