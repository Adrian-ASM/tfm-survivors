import kaplay from "kaplay";
import { startBench } from "./bench";
import { readInput } from "./input";
import { readCount } from "./params";
import {
  createWorld, ENEMY_RADIUS, FixedStepper, HEIGHT, PLAYER_RADIUS, WIDTH,
} from "./scenario";

// API a verificar contra la documentación de KAPLAY v3001
// (riesgo de mezclar con Kaboom.js o con v4000):
// opciones canvas/global/background, add([...]), circle, pos, color, onUpdate, dt.

const n = readCount();
const world = createWorld(n);
const stepper = new FixedStepper();

const canvas = document.createElement("canvas");
document.getElementById("game")!.appendChild(canvas);

const k = kaplay({
  width: WIDTH,
  height: HEIGHT,
  canvas,
  global: false,
  background: [20, 20, 30],
});

type Positioned = { pos: { x: number; y: number } };

const enemies: Positioned[] = [];
for (let i = 0; i < world.count; i++) {
  enemies.push(
    k.add([k.pos(world.ex[i], world.ey[i]), k.circle(ENEMY_RADIUS), k.color(229, 72, 77)]),
  );
}
const player: Positioned = k.add([
  k.pos(world.player.x, world.player.y),
  k.circle(PLAYER_RADIUS),
  k.color(61, 214, 140),
]);

k.onUpdate(() => {
  stepper.advance(world, readInput(), k.dt());
  for (let i = 0; i < world.count; i++) {
    enemies[i].pos.x = world.ex[i];
    enemies[i].pos.y = world.ey[i];
  }
  player.pos.x = world.player.x;
  player.pos.y = world.player.y;
});

startBench("kaplay", n);
