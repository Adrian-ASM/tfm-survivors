// Simulación compartida por los tres motores (mismo espíritu que ADR-0002: el motor solo pinta).
// Enemigos en arrays planos (Float32Array) para no penalizar a ningún motor
// por el modelo de datos.

export const WIDTH = 960;
export const HEIGHT = 540;
export const STEP = 1 / 60;
export const PLAYER_SPEED = 220;
export const ENEMY_SPEED = 90;
export const PLAYER_RADIUS = 10;
export const ENEMY_RADIUS = 6;

export interface Input {
  x: number;
  y: number;
}

export interface World {
  readonly count: number;
  readonly ex: Float32Array;
  readonly ey: Float32Array;
  player: { x: number; y: number };
  readonly rng: () => number;
}

/** PRNG determinista (mulberry32) para que todos los motores vean la misma partida. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function placeOnRing(world: World, i: number): void {
  const angle = world.rng() * Math.PI * 2;
  const radius = Math.max(WIDTH, HEIGHT) * (0.35 + world.rng() * 0.4);
  world.ex[i] = world.player.x + Math.cos(angle) * radius;
  world.ey[i] = world.player.y + Math.sin(angle) * radius;
}

export function createWorld(count: number, seed = 42): World {
  const world: World = {
    count,
    ex: new Float32Array(count),
    ey: new Float32Array(count),
    player: { x: WIDTH / 2, y: HEIGHT / 2 },
    rng: mulberry32(seed),
  };
  for (let i = 0; i < count; i++) placeOnRing(world, i);
  return world;
}

/** Un tick de paso fijo: el jugador se mueve y los enemigos le persiguen. */
export function step(world: World, input: Input, dt: number): void {
  const p = world.player;
  p.x = Math.min(WIDTH, Math.max(0, p.x + input.x * PLAYER_SPEED * dt));
  p.y = Math.min(HEIGHT, Math.max(0, p.y + input.y * PLAYER_SPEED * dt));

  const reach = PLAYER_RADIUS + ENEMY_RADIUS;
  for (let i = 0; i < world.count; i++) {
    const dx = p.x - world.ex[i];
    const dy = p.y - world.ey[i];
    const dist = Math.hypot(dx, dy);
    if (dist < reach) {
      placeOnRing(world, i); // mantiene N constante durante la medición
      continue;
    }
    world.ex[i] += (dx / dist) * ENEMY_SPEED * dt;
    world.ey[i] += (dy / dist) * ENEMY_SPEED * dt;
  }
}

/** Acumulador de paso fijo: desacopla la simulación (60 Hz) de la tasa de refresco. */
export class FixedStepper {
  private acc = 0;

  advance(world: World, input: Input, dtSeconds: number): void {
    this.acc += Math.min(dtSeconds, 0.25);
    while (this.acc >= STEP) {
      step(world, input, STEP);
      this.acc -= STEP;
    }
  }
}
