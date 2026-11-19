import Phaser from 'phaser';
import type { TickRun } from '../../application/TickRun';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { EnemyLayer, type CircleSprite } from './EnemyLayer';
import { KeyboardInput } from './KeyboardInput';
import { ProjectileLayer } from './ProjectileLayer';
import { PulseLayer, type RingSprite } from './PulseLayer';
import { playerVisible } from './playerBlink';

const PLAYER_COLOR = 0x3dd68c;
const PULSE_COLOR = 0x7ce2fe;
const PULSE_LINE_WIDTH = 2;

/**
 * Tamaño de los pools de sprites, calculado en la composición desde el contenido validado:
 * `maxAlive`, `maxProjectiles` y `pulseCapacity`. `visualTicks` da la duración visible de cada arma
 * de pulso (para desvanecer su anillo).
 */
export interface SceneCapacity {
  readonly enemies: number;
  readonly projectiles: number;
  readonly pulses: number;
  readonly visualTicks: ReadonlyMap<string, number>;
}

/**
 * Adaptador de render (ADR-0002): lee el input, pasa el tiempo del frame al caso de uso TickRun y
 * pinta el RunSnapshot. No contiene reglas de juego.
 */
export class GameScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Arc;
  private enemies?: EnemyLayer;
  private projectiles?: ProjectileLayer;
  private pulses?: PulseLayer;
  private input$?: KeyboardInput;

  constructor(
    private readonly tickRun: TickRun,
    private readonly capacity: SceneCapacity,
    private readonly onSnapshot: (snapshot: RunSnapshot) => void = () => undefined,
  ) {
    super('game');
  }

  create(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Este navegador no expone teclado a Phaser.');
    this.input$ = new KeyboardInput(keyboard);

    // Orden de creación = orden de pintado: anillos, enemigos, proyectiles y el jugador encima.
    const circle = (): CircleSprite => this.add.circle(0, 0, 1, 0).setVisible(false);
    const ring = (): RingSprite =>
      this.add.circle(0, 0, 1).setStrokeStyle(PULSE_LINE_WIDTH, PULSE_COLOR).setVisible(false);
    const { enemies, projectiles, pulses, visualTicks } = this.capacity;
    this.pulses = new PulseLayer(pulses, visualTicks, ring);
    this.enemies = new EnemyLayer(enemies, circle);
    this.projectiles = new ProjectileLayer(projectiles, circle);
    const snapshot = this.tickRun.snapshot();
    this.player = this.add.circle(
      snapshot.player.x,
      snapshot.player.y,
      snapshot.player.radius,
      PLAYER_COLOR,
    );
    this.render(snapshot);
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.input$) return;
    this.render(this.tickRun.execute(deltaMs, this.input$.read()));
  }

  private render(snapshot: RunSnapshot): void {
    this.player?.setPosition(snapshot.player.x, snapshot.player.y);
    this.player?.setVisible(playerVisible(snapshot));
    this.pulses?.sync(snapshot.pulses, snapshot.tick);
    this.enemies?.sync(snapshot.enemies);
    this.projectiles?.sync(snapshot.projectiles);
    this.onSnapshot(snapshot);
  }
}
