import Phaser from 'phaser';
import type { RestartRun } from '../../application/RestartRun';
import type { StartedRun } from '../../application/StartRun';
import type { TickRun } from '../../application/TickRun';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { ChoiceKeys, choiceIndex } from './ChoiceKeys';
import type { Hud } from './Hud';
import { KeyboardInput } from './KeyboardInput';
import { PauseGate, type PauseAction } from './PauseGate';
import { PauseKey } from './PauseKey';
import type { RingSprite } from './PulseLayer';
import { RestartKey } from './RestartKey';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from './sceneKeys';
import type { ResultsOverlay } from './ResultsOverlay';
import type { ResultsView } from './resultsText';
import type { RunLauncher } from './RunLauncher';
import { createHud, createResultsOverlay, createUpgradeOverlay } from './sceneWidgets';
import type { UpgradeOverlay } from './UpgradeOverlay';
import type { Appearance } from '../content/appearanceSchema';
import { resolveLooks } from './art/looks';
import { ensurePlaceholderTexture, spriteKit, textureFrames } from './phaserArt';
import type { SpriteCounts } from './renderCounts';
import { createPlayfield, type GroundFactory } from './GroundView';
import type { RenderLayers } from './RenderLayers';
import { CameraRig, type CameraView, type WorldSize } from './CameraRig';

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
  /** Tope de cadáveres visibles a la vez (datos de aspecto, design D6). */
  readonly corpses: number;
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
export type OnRender = (
  snapshot: RunSnapshot,
  results: ResultsView | null,
  sprites: SpriteCounts,
) => void;

export interface GameSceneDeps {
  readonly launcher: RunLauncher;
  readonly restartRun: RestartRun;
  readonly capacity: SceneCapacity;
  /** Tamaño del mundo (la `arena` del contenido): límites de la cámara y del suelo (0013). */
  readonly world: WorldSize;
  /** Datos de aspecto validados (las hojas las carga `BootScene`). */
  readonly appearance: Appearance;
  readonly progress: SceneProgress;
  readonly pause: PauseView;
  readonly onRender?: OnRender;
  readonly onScreen?: (screen: Screen) => void;
  /** Velocidad de simulación ya resuelta (1 en modo jugador; solo `?e2e&speed` la cambia). */
  readonly simSpeed?: number;
}

interface Widgets {
  readonly layers: RenderLayers;
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
  private rig: CameraRig | undefined;
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
    // Orden de creación = orden de pintado: suelo, anillos, gemas, cadáveres, enemigos,
    // proyectiles, jugador, HUD y overlays encima de todo (design 0012).
    ensurePlaceholderTexture(this);
    const ring = (): RingSprite =>
      this.add.circle(0, 0, 1).setStrokeStyle(PULSE_LINE_WIDTH, PULSE_COLOR).setVisible(false);
    const ground: GroundFactory = {
      tiles: (width, height, texture, frame, tileScale) => {
        this.add
          .tileSprite(0, 0, width, height, texture, frame)
          .setOrigin(0, 0)
          .setTileScale(tileScale);
      },
      rect: (width, height, color) => {
        this.add.rectangle(0, 0, width, height, color).setOrigin(0, 0);
      },
    };
    const looks = resolveLooks(this.deps.appearance, textureFrames(this));
    const { layers } = createPlayfield(
      { kit: spriteKit(this), ring, looks, capacity: this.deps.capacity },
      ground,
      this.deps.world,
    );
    // En cada entrada: Volver al menú destruye la cámara de la escena y la recrea (design D2).
    this.rig = new CameraRig(this.cameras.main, this.deps.world);
    const snapshot = started.tickRun.snapshot();
    this.w = {
      layers,
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
    // Reloj de render: una vez por frame, congelado con el mundo detenido.
    w.layers.advance(deltaMs, this.gate.paused);
    // Partida de este frame: la actual o, si R reinicia, la nueva.
    let current = started;
    if (!this.gate.paused) {
      if (restart) current = this.restart(w, started);
      const chosen = index >= 0 ? current.chooseUpgrade.execute(index) : undefined;
      if (chosen?.ok) this.render(chosen.value);
    }
    // `simSpeed` avances por frame con el input leído una vez (0 ticks en pausa); un render.
    const speed = this.deps.simSpeed ?? 1;
    this.render(this.gate.frame(current.tickRun, deltaMs, w.move.read(), speed));
    this.showPause(this.gate.paused);
  }

  /**
   * Partida nueva (solo desde una terminada): capas vacías antes de su primer render. Devuelve la
   * partida que sigue en juego (la misma si el reinicio no procede).
   */
  private restart(w: Widgets, current: StartedRun): StartedRun {
    const next = this.deps.restartRun.execute(current.tickRun);
    if (!next.ok) return current;
    this.started = next.value;
    w.layers.clear();
    return next.value;
  }

  /** Volver al menú: el motor destruye los objetos de la escena; aquí se sueltan las referencias. */
  private leave(): void {
    this.deps.pause.setVisible(false);
    this.deps.progress.leave();
    this.w = undefined;
    this.rig = undefined;
    this.last = undefined;
    this.started = undefined;
    this.gate = new PauseGate();
  }

  /** Rectángulo visible del último frame pintado (null sin partida), para la sonda E2E. */
  cameraView(): CameraView | null {
    return this.rig?.view() ?? null;
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
    w.layers.render(snapshot);
    // El motor centra y recorta la cámara en su preRender, en este mismo frame (design D2).
    this.rig?.track(snapshot.player);
    w.hud.sync(snapshot);
    w.offer.sync(snapshot.offer);
    w.results.sync(snapshot);
    // En el frame en que termina la partida: se guarda antes de que R pueda leerse (spec).
    this.deps.progress.sync(snapshot, started.tickRun);
    this.deps.onRender?.(snapshot, w.results.view, w.layers.counts);
  }
}
