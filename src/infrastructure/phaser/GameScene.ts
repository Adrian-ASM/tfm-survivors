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
import { PauseGate, type PauseAction } from './PauseGate';
import { PauseKey } from './PauseKey';
import { ProjectileLayer } from './ProjectileLayer';
import { PulseLayer, type RingSprite } from './PulseLayer';
import { RestartKey } from './RestartKey';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from './sceneKeys';
import type { ResultsOverlay } from './ResultsOverlay';
import type { ResultsView } from './resultsText';
import type { RunLauncher } from './RunLauncher';
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
 * terminada y pinta el panel de resultados. `leave` lo oculta al salir de la partida (design
 * 0009). La escena no decide nada.
 */
export interface SceneProgress {
  sync(snapshot: RunSnapshot, run: TickRun): void;
  leave(): void;
}

/** Overlay de pausa (DOM): la escena lo muestra y lee el botón pulsado. */
export interface PauseView {
  takeAction(): PauseAction;
  setVisible(visible: boolean): void;
}

/** Pantalla visible (para la sonda de E2E). */
export type Screen = 'menu' | 'playing' | 'paused';

/** Lo que la escena ha pintado en un frame (para el probe de E2E). */
export type OnRender = (snapshot: RunSnapshot, results: ResultsView | null) => void;

export interface GameSceneDeps {
  readonly launcher: RunLauncher;
  readonly restartRun: RestartRun;
  readonly capacity: SceneCapacity;
  readonly progress: SceneProgress;
  readonly pause: PauseView;
  readonly onRender?: OnRender;
  readonly onScreen?: (screen: Screen) => void;
  /** Velocidad de simulación ya resuelta (1 en modo jugador; solo `?e2e&speed` la cambia). */
  readonly simSpeed?: number;
}

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
  readonly esc: PauseKey;
}

/**
 * Adaptador de render (ADR-0002, ADR-0011): al entrar pide una partida nueva al `RunLauncher`;
 * en cada frame lee el input, pasa Esc y el overlay a `PauseGate`, el tiempo del frame a TickRun,
 * la elección a ChooseUpgrade y la tecla R a RestartRun, y pinta el RunSnapshot y el progreso. Al
 * reiniciar cambia de partida (ADR-0009) y vacía las capas; al salir (Volver al menú) el motor
 * destruye sus objetos. No contiene reglas de juego.
 */
export class GameScene extends Phaser.Scene {
  private started: StartedRun | undefined;
  private w: Widgets | undefined;
  private last: RunSnapshot | undefined;
  private gate = new PauseGate();

  constructor(private readonly deps: GameSceneDeps) {
    super(GAME_SCENE_KEY);
  }

  create(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Este navegador no expone teclado a Phaser.');
    const started = this.deps.launcher.launch();
    if (!started) return;
    this.started = started;
    this.gate = new PauseGate();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.leave();
    });
    // Orden de creación = orden de pintado: anillos, gemas, enemigos, proyectiles, jugador, HUD y
    // overlays encima de todo.
    const circle = (): CircleSprite => this.add.circle(0, 0, 1, 0).setVisible(false);
    const ring = (): RingSprite =>
      this.add.circle(0, 0, 1).setStrokeStyle(PULSE_LINE_WIDTH, PULSE_COLOR).setVisible(false);
    const { enemies, projectiles, pulses, gems, visualTicks } = this.deps.capacity;
    const snapshot = started.tickRun.snapshot();
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
      esc: new PauseKey(keyboard),
    };
    this.render(snapshot);
    this.showPause(false);
  }

  override update(_time: number, deltaMs: number): void {
    const w = this.w;
    const started = this.started;
    if (!w || !started) return;
    // Las teclas y los clics se leen siempre (se consumen). Esc va primero: si pausa en este
    // frame, R y la elección se descartan. Sin oferta o sin partida terminada no hacen nada.
    const esc = w.esc.read();
    const action = this.deps.pause.takeAction();
    const restart = w.restart.read();
    const index = choiceIndex(this.last?.offer.length ?? 0, w.choice.read(), w.offer.takeClicked());
    const status = this.last?.status ?? started.tickRun.status;
    if (this.gate.step(esc, action, status, started.tickRun) === 'menu') {
      this.scene.start(MENU_SCENE_KEY);
      return;
    }
    if (!this.gate.paused) {
      if (restart) this.restart(w);
      const chosen = index >= 0 ? this.started?.chooseUpgrade.execute(index) : undefined;
      if (chosen?.ok) this.render(chosen.value);
    }
    // `simSpeed` avances por frame con el input leído una vez (0 ticks en pausa); un render.
    const run = this.started?.tickRun ?? started.tickRun;
    this.render(this.gate.frame(run, deltaMs, w.move.read(), this.deps.simSpeed ?? 1));
    this.showPause(this.gate.paused);
  }

  /** Partida nueva (solo desde una terminada): capas vacías antes de su primer render. */
  private restart(w: Widgets): void {
    if (!this.started) return;
    const next = this.deps.restartRun.execute(this.started.tickRun);
    if (!next.ok) return;
    this.started = next.value;
    w.enemies.clear();
    w.projectiles.clear();
    w.pulses.clear();
    w.gems.clear();
  }

  /** Volver al menú: el motor destruye los objetos de la escena; aquí se sueltan las referencias. */
  private leave(): void {
    this.deps.pause.setVisible(false);
    this.deps.progress.leave();
    this.w = undefined;
    this.last = undefined;
    this.started = undefined;
    this.gate = new PauseGate();
  }

  private showPause(paused: boolean): void {
    this.deps.pause.setVisible(paused);
    this.deps.onScreen?.(paused ? 'paused' : 'playing');
  }

  private render(snapshot: RunSnapshot): void {
    const w = this.w;
    const started = this.started;
    if (!w || !started) return;
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
    this.deps.progress.sync(snapshot, started.tickRun);
    this.deps.onRender?.(snapshot, w.results.view);
  }
}
