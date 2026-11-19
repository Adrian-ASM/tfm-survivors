import { startBench } from "./bench";
import { readInput } from "./input";
import { readCount } from "./params";
import {
  createWorld, ENEMY_RADIUS, FixedStepper, HEIGHT, PLAYER_RADIUS, WIDTH,
} from "./scenario";

const n = readCount();
const world = createWorld(n);
const stepper = new FixedStepper();

const canvas = document.createElement("canvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
document.getElementById("game")!.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

let last = performance.now();
const frame = (now: number): void => {
  stepper.advance(world, readInput(), (now - last) / 1000);
  last = now;

  ctx.fillStyle = "#14141e";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Un único path para todos los enemigos: un fill por frame.
  ctx.fillStyle = "#e5484d";
  ctx.beginPath();
  for (let i = 0; i < world.count; i++) {
    const x = world.ex[i];
    const y = world.ey[i];
    ctx.moveTo(x + ENEMY_RADIUS, y);
    ctx.arc(x, y, ENEMY_RADIUS, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.fillStyle = "#3dd68c";
  ctx.beginPath();
  ctx.arc(world.player.x, world.player.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
startBench("canvas", n);
