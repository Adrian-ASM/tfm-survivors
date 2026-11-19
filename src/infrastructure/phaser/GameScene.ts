import Phaser from 'phaser';
import type { ChooseUpgrade } from '../../application/ChooseUpgrade';
import type { TickRun } from '../../application/TickRun';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { ChoiceKeys, choiceIndex } from './ChoiceKeys';
import { CARD_WIDTH } from './cardLayout';
import { EnemyLayer, type CircleSprite } from './EnemyLayer';
import { GemLayer } from './GemLayer';
import { KeyboardInput } from './KeyboardInput';
import { ProjectileLayer } from './ProjectileLayer';
import { PulseLayer, type RingSprite } from './PulseLayer';
import { UpgradeOverlay, type CardBox, type CardParts, type CardText } from './UpgradeOverlay';
import { XpBar } from './XpBar';
import { playerVisible } from './playerBlink';

const PLAYER_COLOR = 0x3dd68c;
const PULSE_COLOR = 0x7ce2fe;
const PULSE_LINE_WIDTH = 2;

/** HUD y overlay (presentación): por encima del mundo y fijos a la cámara (pensando en 0006). */
const HUD_DEPTH = 100;
const OVERLAY_DEPTH = 200;
const BAR = { x: 16, y: 16, width: 240, height: 10 } as const;
const BAR_BACK = 0x2a2a3a;
const BAR_FILL = 0x4fd1c5;
const VEIL_COLOR = 0x000000;
const VEIL_ALPHA = 0.6;
const CARD_COLOR = 0x23233a;
const CARD_BORDER = 0x7ce2fe;
const TEXT_STYLE = { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' } as const;
const CARD_TEXT_PADDING = 16;

/**
 * Tamaño de los pools de sprites, calculado en la composición desde el contenido validado:
 * `maxAlive`, `maxProjectiles`, `pulseCapacity` (peor caso de las mejoras) y `maxGems`.
 * `visualTicks` da la duración visible de cada arma de pulso (para desvanecer su anillo).
 */
export interface SceneCapacity {
  readonly enemies: number;
  readonly projectiles: number;
  readonly pulses: number;
  readonly gems: number;
  readonly visualTicks: ReadonlyMap<string, number>;
}

/**
 * Adaptador de render (ADR-0002): lee el input, pasa el tiempo del frame al caso de uso TickRun,
 * pasa la elección de mejora al caso de uso ChooseUpgrade y pinta el RunSnapshot. No contiene
 * reglas de juego.
 */
export class GameScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Arc;
  private enemies?: EnemyLayer;
  private projectiles?: ProjectileLayer;
  private pulses?: PulseLayer;
  private gems?: GemLayer;
  private xpBar?: XpBar;
  private overlay?: UpgradeOverlay;
  private input$?: KeyboardInput;
  private choice?: ChoiceKeys;
  private last?: RunSnapshot;

  constructor(
    private readonly tickRun: TickRun,
    private readonly chooseUpgrade: ChooseUpgrade,
    private readonly capacity: SceneCapacity,
    private readonly onSnapshot: (snapshot: RunSnapshot) => void = () => undefined,
  ) {
    super('game');
  }

  create(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Este navegador no expone teclado a Phaser.');
    this.input$ = new KeyboardInput(keyboard);
    this.choice = new ChoiceKeys(keyboard, Phaser.Input.Keyboard.JustDown);

    // Orden de creación = orden de pintado: anillos, gemas, enemigos, proyectiles, jugador, barra
    // de XP y overlay encima de todo.
    const circle = (): CircleSprite => this.add.circle(0, 0, 1, 0).setVisible(false);
    const ring = (): RingSprite =>
      this.add.circle(0, 0, 1).setStrokeStyle(PULSE_LINE_WIDTH, PULSE_COLOR).setVisible(false);
    const { enemies, projectiles, pulses, gems, visualTicks } = this.capacity;
    this.pulses = new PulseLayer(pulses, visualTicks, ring);
    this.gems = new GemLayer(gems, circle);
    this.enemies = new EnemyLayer(enemies, circle);
    this.projectiles = new ProjectileLayer(projectiles, circle);
    const snapshot = this.tickRun.snapshot();
    this.player = this.add.circle(
      snapshot.player.x,
      snapshot.player.y,
      snapshot.player.radius,
      PLAYER_COLOR,
    );
    this.xpBar = this.createXpBar();
    this.overlay = this.createOverlay();
    this.render(snapshot);
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.input$ || !this.choice || !this.overlay) return;
    // Las teclas y el clic se leen siempre (se consumen): sin oferta no hacen nada.
    const key = this.choice.read();
    const click = this.overlay.takeClicked();
    const offerSize = this.last?.offer.length ?? 0;
    const index = choiceIndex(offerSize, key, click);
    if (index >= 0) {
      const chosen = this.chooseUpgrade.execute(index);
      if (chosen.ok) this.render(chosen.value);
    }
    this.render(this.tickRun.execute(deltaMs, this.input$.read()));
  }

  private render(snapshot: RunSnapshot): void {
    this.last = snapshot;
    this.player?.setPosition(snapshot.player.x, snapshot.player.y);
    this.player?.setVisible(playerVisible(snapshot));
    this.pulses?.sync(snapshot.pulses, snapshot.tick);
    this.gems?.sync(snapshot.gems);
    this.enemies?.sync(snapshot.enemies);
    this.projectiles?.sync(snapshot.projectiles);
    this.xpBar?.sync(snapshot.progression);
    this.overlay?.sync(snapshot.offer);
    this.onSnapshot(snapshot);
  }

  private createXpBar(): XpBar {
    this.add
      .rectangle(BAR.x, BAR.y, BAR.width, BAR.height, BAR_BACK)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    const fill = this.add
      .rectangle(BAR.x, BAR.y, 0, BAR.height, BAR_FILL)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    const label = this.add
      .text(BAR.x + BAR.width + 8, BAR.y, '', TEXT_STYLE)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    return new XpBar(fill, label, BAR.width, BAR.height);
  }

  private createOverlay(): UpgradeOverlay {
    const { width, height } = this.scale;
    const veil = this.add
      .rectangle(width / 2, height / 2, width, height, VEIL_COLOR, VEIL_ALPHA)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);
    const text = (wrap: number): CardText =>
      this.add
        .text(0, 0, '', { ...TEXT_STYLE, align: 'center', wordWrap: { width: wrap } })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(OVERLAY_DEPTH + 2);
    const cards: CardParts[] = [0, 1, 2].map(() => {
      const rect = this.add
        .rectangle(0, 0, 1, 1, CARD_COLOR)
        .setStrokeStyle(2, CARD_BORDER)
        .setScrollFactor(0)
        .setDepth(OVERLAY_DEPTH + 1)
        .setInteractive({ useHandCursor: true });
      const box: CardBox = {
        setVisible: (v) => rect.setVisible(v),
        setPosition: (x, y) => rect.setPosition(x, y),
        // Rectangle.setSize también ajusta el área de clic (no es personalizada).
        setSize: (w, h) => rect.setSize(w, h),
        onPointerDown: (handler) => {
          rect.on('pointerdown', handler);
        },
      };
      const wrap = CARD_WIDTH - 2 * CARD_TEXT_PADDING;
      return { box, name: text(wrap), description: text(wrap), level: text(wrap) };
    });
    return new UpgradeOverlay(veil, cards, { width, height });
  }
}
