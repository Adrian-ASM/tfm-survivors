// Animación por tiempo de render (change 0012, design "Comportamiento de las capas"). Puro: sin motor.

/** Una animación de los datos de aspecto: índices de frame de la hoja, fps y bucle. */
export interface AnimSpec {
  readonly frames: readonly number[];
  readonly fps: number;
  readonly loop: boolean;
}

/** Orientación del dibujo sin voltear. */
export type Facing = 'right' | 'left';

/** Desplazamiento mínimo (px) para considerar que un elemento se mueve (spec "Umbral de movimiento"). */
export const MOVE_EPSILON = 0.001;

/**
 * Reloj de render: suma el tiempo real de cada frame salvo con el mundo detenido (pausa, elección o
 * partida terminada). Se avanza una vez por `update`.
 */
export class AnimClock {
  private elapsed = 0;

  get ms(): number {
    return this.elapsed;
  }

  advance(deltaMs: number, frozen: boolean): void {
    if (!frozen) this.elapsed += deltaMs;
  }

  reset(): void {
    this.elapsed = 0;
  }
}

const step = (anim: AnimSpec, ms: number): number => Math.floor((ms * anim.fps) / 1000);

/** Frame de hoja a los `ms` de empezar: en bucle, módulo n; sin bucle, se queda en el último. */
export function frameAt(anim: AnimSpec, ms: number): number {
  const n = anim.frames.length;
  const i = anim.loop ? step(anim, ms) % n : Math.min(n - 1, step(anim, ms));
  return anim.frames[i] ?? anim.frames[0] ?? 0;
}

/**
 * Frame de hoja de una animación en bucle con fase (0029, árboles y torres del mapa): la posición
 * `(⌊ms · fps / 1000⌋ + phase) mod n` de sus frames. Con fase 0 es `frameAt` en bucle.
 */
export function phasedFrameAt(
  anim: Pick<AnimSpec, 'frames' | 'fps'>,
  ms: number,
  phase: number,
): number {
  const n = anim.frames.length;
  const i = (((Math.floor((ms * anim.fps) / 1000) + phase) % n) + n) % n;
  return anim.frames[i] ?? anim.frames[0] ?? 0;
}

/** Una animación sin bucle ha terminado cuando el tiempo alcanza n · 1000 / fps. */
export function animDone(anim: AnimSpec, ms: number): boolean {
  return ms >= (anim.frames.length * 1000) / anim.fps;
}

/**
 * Animación en curso de un sprite: al cambiar de animación empieza desde su primer frame. Devuelve
 * el tiempo transcurrido desde que empezó la actual.
 */
export class AnimTrack<K extends string> {
  private current: K | null = null;
  private startMs = 0;

  play(name: K, nowMs: number): number {
    if (name !== this.current) {
      this.current = name;
      this.startMs = nowMs;
    }
    return nowMs - this.startMs;
  }

  reset(): void {
    this.current = null;
  }
}

/**
 * Estado y orientación de un sprite por el desplazamiento entre snapshots de ticks distintos. Un
 * frame que repite el tick conserva todo; el primero tras `reset` no hereda nada (idle, sin voltear).
 */
export class Motion {
  moving = false;
  /** Lado al que mira; `null` hasta el primer Δx horizontal (se pinta como el dibujo, sin voltear). */
  facingLeft: boolean | null = null;
  private lastX = 0;
  private lastY = 0;
  private lastTick = -1;
  private primed = false;

  reset(): void {
    this.moving = false;
    this.facingLeft = null;
    this.primed = false;
    this.lastTick = -1;
  }

  update(x: number, y: number, tick: number): void {
    if (this.primed && tick === this.lastTick) return;
    if (this.primed) {
      const dx = x - this.lastX;
      this.moving = Math.hypot(dx, y - this.lastY) > MOVE_EPSILON;
      if (dx < -MOVE_EPSILON) this.facingLeft = true;
      else if (dx > MOVE_EPSILON) this.facingLeft = false;
    }
    this.primed = true;
    this.lastX = x;
    this.lastY = y;
    this.lastTick = tick;
  }

  /** Voltear si mira al lado contrario del dibujo sin voltear (nunca antes del primer Δx). */
  flipX(facing: Facing): boolean {
    return this.facingLeft !== null && this.facingLeft !== (facing === 'left');
  }
}
