import Phaser from "phaser";
import { startBench } from "./bench";
import { readInput } from "./input";
import { readCount } from "./params";
import {
  createWorld, ENEMY_RADIUS, FixedStepper, HEIGHT, PLAYER_RADIUS, WIDTH,
} from "./scenario";

// API a verificar contra la documentación de Phaser 4 (riesgo de mezclar con Phaser 3):
// textures.addCanvas, add.image, setPosition, Scene.update(time, delta).

const n = readCount();
const world = createWorld(n);
const stepper = new FixedStepper();

function circleCanvas(radius: number, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = radius * 2;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.beginPath();
  g.arc(radius, radius, radius, 0, Math.PI * 2);
  g.fill();
  return c;
}

class BenchScene extends Phaser.Scene {
  private enemies: Phaser.GameObjects.Image[] = [];
  private player!: Phaser.GameObjects.Image;

  constructor() {
    super("bench");
  }

  create(): void {
    this.textures.addCanvas("enemy", circleCanvas(ENEMY_RADIUS, "#e5484d"));
    this.textures.addCanvas("player", circleCanvas(PLAYER_RADIUS, "#3dd68c"));
    for (let i = 0; i < world.count; i++) {
      this.enemies.push(this.add.image(world.ex[i], world.ey[i], "enemy"));
    }
    this.player = this.add.image(world.player.x, world.player.y, "player");
    startBench("phaser", n);
  }

  update(_time: number, deltaMs: number): void {
    stepper.advance(world, readInput(), deltaMs / 1000);
    for (let i = 0; i < world.count; i++) {
      this.enemies[i].setPosition(world.ex[i], world.ey[i]);
    }
    this.player.setPosition(world.player.x, world.player.y);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#14141e",
  parent: "game",
  scene: [BenchScene],
});
