import Phaser from 'phaser';
import type { TickRun } from '../../application/TickRun';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { KeyboardInput } from './KeyboardInput';

const PLAYER_COLOR = 0x3dd68c;

/**
 * Adaptador de render (ADR-0002): lee el input, pasa el tiempo del frame al caso de uso TickRun y pinta el
 * RunSnapshot. No contiene reglas de juego.
 */
export class GameScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Arc;
  private input$?: KeyboardInput;

  constructor(
    private readonly tickRun: TickRun,
    private readonly onSnapshot: (snapshot: RunSnapshot) => void = () => undefined,
  ) {
    super('game');
  }

  create(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Este navegador no expone teclado a Phaser.');
    this.input$ = new KeyboardInput(keyboard);

    const snapshot = this.tickRun.snapshot();
    this.player = this.add.circle(
      snapshot.player.x,
      snapshot.player.y,
      snapshot.player.radius,
      PLAYER_COLOR,
    );
    this.onSnapshot(snapshot);
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.player || !this.input$) return;
    const snapshot = this.tickRun.execute(deltaMs, this.input$.read());
    this.player.setPosition(snapshot.player.x, snapshot.player.y);
    this.onSnapshot(snapshot);
  }
}
