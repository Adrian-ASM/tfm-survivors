import Phaser from 'phaser';
import type { RestartRun } from '../../application/RestartRun';
import type { StartedRun } from '../../application/StartRun';
import type { TickRun } from '../../application/TickRun';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { ChoiceKeys, choiceIndex } from './ChoiceKeys';
import { EnemyLayer, type CircleSprite } from './EnemyLayer';
import { GemLayer } from './GemLayer';
import type { Hud } from './Hud';
import { KeyboardInput } from './KeyboardInput';
import { ProjectileLayer } from './ProjectileLayer';
import { PulseLayer, type RingSprite } from './PulseLayer';
import { RestartKey } from './RestartKey';
import type { ResultsOverlay } from './ResultsOverlay';
import type { ResultsView } from './resultsText';
import { createHud, createResultsOverlay, createUpgradeOverlay } from './sceneWidgets';
import type { UpgradeOverlay } from './UpgradeOverlay';
import { playerVisible } from './playerBlink';

const PLAYER_COLOR = 0x3dd68c;
const PULSE_COLOR = 0x7ce2fe;
const PULSE_LINE_WIDTH = 2;

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
 * Progreso del jugador en cada frame pintado (design 0007): la composición registra la partida
 * terminada y pinta el panel de resultados. La escena no decide nada: solo llama a `sync`.
 */
export interface SceneProgress {
  sync(snapshot: RunSnapshot, run: TickRun): void;
}

/** Lo que la escena ha pintado en un frame (para el probe de E2E). */
export type OnRender = (snapshot: RunSnapshot, results: ResultsView | null) => void;

interface Widgets {
  readonly player: Phaser.GameObjects.Arc;
  readonly enemies: EnemyLayer;
  readonly projectiles: ProjectileLayer;
  readonly pulses: PulseLayer;
  readonly gems: GemLayer;
  readonly hud: Hud;
  readonly offer: UpgradeOverlay;
  readonly results: ResultsOverlay;
  readonly move: KeyboardInput;
  readonly choice: ChoiceKeys;
  readonly restart: RestartKey;
}

/**
 * Adaptador de render (ADR-0002): lee el input, pasa el tiempo del frame a TickRun, la elección a
 * ChooseUpgrade y la tecla R a RestartRun, y pinta el RunSnapshot y el progreso. Al reiniciar cambia de partida
 * (ADR-0009) y vacía las capas; los objetos del motor se reutilizan. No contiene reglas de juego.
 */
export class GameScene extends Phaser.Scene {
  private w?: Widgets;
  private last?: RunSnapshot;

  constructor(
    private started: StartedRun,
    private readonly restartRun: RestartRun,
    private readonly capacity: SceneCapacity,
    private readonly progress: SceneProgress,
    private readonly onRender: OnRender = () => undefined,
  ) {
    super('game');
  }

  create(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Este navegador no expone teclado a Phaser.');
    // Orden de creación = orden de pintado: anillos, gemas, enemigos, proyectiles, jugador, HUD y
    // overlays encima de todo.
    const circle = (): CircleSprite => this.add.circle(0, 0, 1, 0).setVisible(false);
    const ring = (): RingSprite =>
      this.add.circle(0, 0, 1).setStrokeStyle(PULSE_LINE_WIDTH, PULSE_COLOR).setVisible(false);
    const { enemies, projectiles, pulses, gems, visualTicks } = this.capacity;
    const snapshot = this.started.tickRun.snapshot();
    const { x, y, radius } = snapshot.player;
    this.w = {
      pulses: new PulseLayer(pulses, visualTicks, ring),
      gems: new GemLayer(gems, circle),
      enemies: new EnemyLayer(enemies, circle),
      projectiles: new ProjectileLayer(projectiles, circle),
      player: this.add.circle(x, y, radius, PLAYER_COLOR),
      hud: createHud(this),
      offer: createUpgradeOverlay(this),
      results: createResultsOverlay(this),
      move: new KeyboardInput(keyboard),
      choice: new ChoiceKeys(keyboard),
      restart: new RestartKey(keyboard),
    };
    this.render(snapshot);
  }

  override update(_time: number, deltaMs: number): void {
    const w = this.w;
    if (!w) return;
    // Las teclas y el clic se leen siempre (se consumen): sin oferta o sin partida terminada no
    // hacen nada. RestartRun decide si el reinicio procede.
    if (w.restart.read()) this.restart(w);
    const index = choiceIndex(this.last?.offer.length ?? 0, w.choice.read(), w.offer.takeClicked());
    if (index >= 0) {
      const chosen = this.started.chooseUpgrade.execute(index);
      if (chosen.ok) this.render(chosen.value);
    }
    this.render(this.started.tickRun.execute(deltaMs, w.move.read()));
  }

  /** Partida nueva (solo desde una terminada): capas vacías antes de su primer render. */
  private restart(w: Widgets): void {
    const next = this.restartRun.execute(this.started.tickRun);
    if (!next.ok) return;
    this.started = next.value;
    w.enemies.clear();
    w.projectiles.clear();
    w.pulses.clear();
    w.gems.clear();
  }

  private render(snapshot: RunSnapshot): void {
    const w = this.w;
    if (!w) return;
    this.last = snapshot;
    w.player.setPosition(snapshot.player.x, snapshot.player.y);
    w.player.setVisible(playerVisible(snapshot));
    w.pulses.sync(snapshot.pulses, snapshot.tick);
    w.gems.sync(snapshot.gems);
    w.enemies.sync(snapshot.enemies);
    w.projectiles.sync(snapshot.projectiles);
    w.hud.sync(snapshot);
    w.offer.sync(snapshot.offer);
    w.results.sync(snapshot);
    // En el frame en que termina la partida: se guarda antes de que R pueda leerse (spec).
    this.progress.sync(snapshot, this.started.tickRun);
    this.onRender(snapshot, w.results.view);
  }
}
