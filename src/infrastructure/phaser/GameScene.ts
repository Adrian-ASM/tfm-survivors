import Phaser from 'phaser';
import type { RestartRun } from '../../application/RestartRun';
import type { StartedRun } from '../../application/StartRun';
import type { TickRun } from '../../application/TickRun';
import type { MapSnapshot } from '../../domain/map/MapSnapshot';
import type { PlayerInput } from '../../domain/player/PlayerInput';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { TICK_MS } from './advanceFrame';
import { ChoiceKeys, choiceIndex } from './ChoiceKeys';
import type { Hud } from './Hud';
import { KeyboardInput } from './KeyboardInput';
import { PauseGate, type PauseAction } from './PauseGate';
import { PauseKey } from './PauseKey';
import { ShopGate, playScreen, shopVisible, type ShopAction } from './ShopGate';
import { BuildGate, buildVisible, type BuildAction } from './BuildGate';
import type { ShopSnapshot } from '../../domain/run/RunSnapshot';
import type { RingSprite } from './PulseLayer';
import { RestartKey } from './RestartKey';
import { SoundPanelGate, type SoundPanelLike } from './SoundPanelGate';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from './sceneKeys';
import type { ResultsOverlay, ResultsTexts } from './ResultsOverlay';
import type { ResultsView } from './resultsText';
import type { RunLauncher } from './RunLauncher';
import {
  createHud,
  hudIcons,
  createJoystickView,
  createResultsOverlay,
  createUpgradeOverlay,
} from './sceneWidgets';
import { desktopFrameRule, type FrameRule, type ScreenFrame } from './ui/screenFrame';
import type { JoystickView } from './touch/JoystickView';
import { preferKeyboard, type MoveSource } from './touch/preferKeyboard';
import { TouchJoystick, type InputLike, type JoystickSettings } from './touch/TouchJoystick';
import { pressedOnce, type TouchBarView } from '../dom/TouchBar';
import { hudLayout, veilLayout } from './ui/uiLayout';
import { watchScreen } from './ui/watchScreen';
import type { OfferIconView, UpgradeOverlay } from './UpgradeOverlay';
import type { IconChoice } from '../icons/upgradeIcons';
import type { Appearance } from '../content/appearanceSchema';
import { damageNumberStyle } from './art/combatFeedback';
import { resolveLooks } from './art/looks';
import {
  resolveMapLooks,
  resolveSiteLooks,
  resolveStructureLooks,
  resolveVeinLooks,
  type MapLooks,
} from './map/mapLooks';
import { planMapArt } from './map/planMapArt';
import {
  ensurePlaceholderTexture,
  mapArtLayers,
  spriteKit,
  textureFrames,
  textureHasFrame,
} from './phaserArt';
import type { MapArtCanvas } from './TerrainView';
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
  /** Flechas de torre vivas como mucho (tope de las torres, 0026). */
  readonly towerProjectiles: number;
  readonly pulses: number;
  /** Recogibles de los cuatro tipos: suma de los topes (0022, 0023). */
  readonly pickups: number;
  /** Ovejas vivas como mucho: el tope del contenido (0023). */
  readonly sheep: number;
  /** Tope de cadáveres visibles a la vez (datos de aspecto, design D6). */
  readonly corpses: number;
  readonly visualTicks: ReadonlyMap<string, number>;
  /** Tope de dinamitas (contenido) y de explosiones pintadas a la vez (datos de aspecto, 0020). */
  readonly hazards: { readonly dynamites: number; readonly blasts: number };
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

/**
 * Overlay de la tienda (DOM, 0024): la escena lo pinta con la tienda del snapshot, lo muestra solo
 * en tienda y lee la acción pulsada.
 */
export interface ShopView {
  sync(shop: ShopSnapshot, health: { current: number; max: number }): void;
  setVisible(visible: boolean): void;
  takeAction(): ShopAction;
}

/**
 * Panel de obra (DOM, 0026): la escena lo pinta con el snapshot, lo muestra solo en obra y lee la
 * acción pulsada.
 */
export interface BuildView {
  sync(snapshot: RunSnapshot): void;
  setVisible(visible: boolean): void;
  takeAction(): BuildAction;
}

/** Pantalla visible (para la sonda de E2E). */
export type Screen = 'menu' | 'playing' | 'paused' | 'shop' | 'build';

/**
 * Lo que la escena ha pintado en un frame (para el probe de E2E) y el reloj de render de ese frame
 * (0035: la limitación por tipo del audio; en modo manual avanza `n × TICK_MS` por `step(n)`).
 */
export type OnRender = (
  snapshot: RunSnapshot,
  results: ResultsView | null,
  sprites: SpriteCounts,
  renderMs: number,
) => void;

export interface GameSceneDeps {
  readonly launcher: RunLauncher;
  readonly restartRun: RestartRun;
  readonly capacity: SceneCapacity;
  /** Tamaño del mundo (la `arena` del contenido): límites de la cámara y del suelo (0013). */
  readonly world: WorldSize;
  /** Datos de aspecto validados (las hojas las carga `BootScene`). */
  readonly appearance: Appearance;
  /**
   * Semilla de decoración de la partida en curso (`deriveSeed(semilla, DECOR_STREAM)`, change 0016):
   * la variedad de árboles. Se pide al pintar cada mapa nuevo; no toca la simulación.
   */
  readonly decorSeed: () => number;
  readonly progress: SceneProgress;
  /** Las 5 líneas de resultados, en el DOM con el panel (design 0017 D11). */
  readonly resultsLines: ResultsTexts;
  readonly pause: PauseView;
  /** Overlay de la tienda (0024). */
  readonly shop: ShopView;
  /** Panel de obra (0026). */
  readonly build: BuildView;
  readonly onRender?: OnRender;
  readonly onScreen?: (screen: Screen) => void;
  /** Velocidad de simulación ya resuelta (1 en modo jugador; solo `?e2e&speed` la cambia). */
  readonly simSpeed?: number;
  /**
   * Modo de avance manual (`?e2e&manual`, change 0014): si está, la partida solo avanza los ticks
   * que planifica y nunca por el tiempo del frame. Sin él, tiempo real como siempre.
   */
  readonly manual?: ManualFrames;
  /** Regla del frame (0033): la móvil con k fraccionario; sin ella, la de escritorio de siempre. */
  readonly frameRule?: FrameRule;
  /** Controles táctiles del modo móvil (0033): joystick, indicación y barra. Sin ellos, ninguno. */
  readonly touch?: SceneTouch;
  /** Retención externa (0033: aviso de orientación visible). Sin ella, nunca retenida. */
  readonly hold?: () => boolean;
  /** Icono de cada opción de mejora (0034, IconBook.resolve). Sin él, ninguno (hueco vacío). */
  readonly iconFor?: (id: string) => IconChoice;
  /**
   * Panel Sonido abierto desde la pausa (0035, design D10): mientras está abierto, Esc o ⏸ lo
   * cierran y la acción de la pausa, R y la elección se descartan. Sin él, nada cambia.
   */
  readonly soundPanel?: SoundPanelLike;
}

/** Controles táctiles que recibe la escena en modo móvil (0033, design §4). */
export interface SceneTouch {
  /** Joystick del contenido (px CSS) y texto de la indicación en reposo. */
  readonly joystick: JoystickSettings & { readonly hint: string };
  /** Barra DOM ⏸ ↻ ⛶: ⏸ es una fuente más de Esc y ↻ de R. */
  readonly bar: TouchBarView;
}

/** Joystick y su vista, creados en `create` solo con el modo móvil. */
interface TouchWidgets {
  readonly stick: TouchJoystick;
  readonly view: JoystickView;
}

/** Lo que la escena necesita del modo manual (lo implementa `ManualStepper`, design 0014 §3.2). */
export interface ManualFrames {
  /** Ticks de este frame (0 si no hay petición) e input congelado de la petición. */
  plan(readInput: () => PlayerInput): { readonly ticks: number; readonly input: PlayerInput };
  /** Ticks ejecutados de verdad y si la petición puede seguir en el siguiente frame. */
  served(executed: number, canContinue: boolean): void;
}

interface Widgets {
  readonly layers: RenderLayers;
  /** Lienzo del mapa (dos capas): se repinta al cambiar de partida (R), no por frame. */
  readonly mapArt: MapArtCanvas;
  /** Aspectos del mapa resueltos contra las texturas cargadas (una vez por entrada). */
  readonly mapLooks: MapLooks;
  readonly hud: Hud;
  readonly offer: UpgradeOverlay;
  readonly results: ResultsOverlay;
  /** Velo de resultados (Phaser): se recoloca al redimensionar. */
  readonly resultsVeil: {
    setPosition(x: number, y: number): unknown;
    setSize(w: number, h: number): unknown;
  };
  /** Teclado; en modo móvil, teclado con precedencia sobre el joystick (0033). */
  readonly move: MoveSource;
  readonly choice: ChoiceKeys;
  readonly restart: RestartKey;
  readonly esc: PauseKey;
  readonly touch?: TouchWidgets;
  /** Panel Sonido sobre la pausa (0035) y la captura global del teclado. */
  readonly sound?: SoundPanelGate;
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
  private readonly shopGate = new ShopGate();
  private readonly buildGate = new BuildGate();

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
    // Orden de creación = orden de pintado: suelo, mapa (0015), anillos, gemas, cadáveres, enemigos,
    // proyectiles, jugador, capa alta del mapa, peligros (0020), combate (0031), HUD y overlays.
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
    const { appearance } = this.deps;
    const looks = resolveLooks(appearance, textureFrames(this));
    const mapLooks = resolveMapLooks(
      appearance.map,
      appearance.terrain,
      textureFrames(this),
      textureHasFrame(this),
      resolveStructureLooks(appearance, textureFrames(this)),
      resolveVeinLooks(appearance, textureFrames(this)),
      resolveSiteLooks(appearance, textureFrames(this)),
    );
    const { layers, mapArt } = createPlayfield(
      {
        kit: spriteKit(this),
        ring,
        warnings: () => this.add.graphics(),
        looks,
        capacity: this.deps.capacity,
        structureTypes: Object.keys(appearance.structures),
        // Capa de combate (0031): números con relleno blanco y tinte por clase; barras en un Graphics.
        feedback: {
          text: () => this.add.text(0, 0, '', damageNumberStyle(appearance.combat.numbers.fontPx)),
          bars: () => this.add.graphics(),
          looks: appearance.combat,
        },
      },
      ground,
      this.deps.world,
      mapArtLayers(this),
    );
    layers.paintMap(mapArt, this.mapPlan(started, mapLooks));
    // En cada entrada: Volver al menú destruye la cámara de la escena y la recrea (design D2).
    this.rig = new CameraRig(this.cameras.main, this.deps.world);
    const snapshot = started.tickRun.snapshot();
    const frameRule = this.deps.frameRule ?? desktopFrameRule;
    const frame = frameRule(this.scale.gameSize, this.scale.displaySize);
    const results = createResultsOverlay(this, frame, this.deps.resultsLines);
    const keys = new KeyboardInput(keyboard);
    const touch = this.deps.touch ? this.createTouch(this.deps.touch) : undefined;
    this.w = {
      mapArt,
      mapLooks,
      layers,
      // 0036: 4 contadores con icono recortado (la calavera, del cadáver); la piedra usa la roca
      // `medium` (0025). Lado y paso, de `appearance.json` `hud`.
      hud: createHud(
        this,
        frame,
        hudIcons(appearance, looks, textureFrames(this)),
        appearance.hud,
        appearance.ui,
      ),
      offer: createUpgradeOverlay(this, frame, appearance.ui, this.deps.iconFor),
      results: results.overlay,
      resultsVeil: results.veil,
      move: touch ? preferKeyboard(keys, touch.stick) : keys,
      choice: new ChoiceKeys(keyboard),
      restart: new RestartKey(keyboard),
      esc: new PauseKey(keyboard),
      ...(touch ? { touch } : {}),
      sound: new SoundPanelGate(this.deps.soundPanel, keyboard),
    };
    // Al entrar y en cada RESIZE (0017, design D6); la escucha se quita en SHUTDOWN.
    watchScreen(
      this.scale,
      this.events,
      (f, cssPerUnit) => {
        this.relayout(f, cssPerUnit);
      },
      frameRule,
    );
    this.render(snapshot);
    this.showPause(false);
  }

  /**
   * Recoloca la presentación al tamaño nuevo del lienzo: cámara, HUD, cartas y velo. No toca la
   * partida, la pausa ni el mapa (redimensionar no ejecuta ni salta ticks; spec world-camera).
   */
  private relayout(frame: ScreenFrame, cssPerUnit: number): void {
    const w = this.w;
    if (!w) return;
    w.touch?.stick.relayout(frame, cssPerUnit);
    w.touch?.view.relayout(frame, cssPerUnit);
    this.rig?.resize(frame);
    w.hud.relayout(hudLayout(frame, this.deps.appearance.hud));
    w.offer.relayout(frame);
    const v = veilLayout(frame);
    w.resultsVeil.setPosition(v.x, v.y);
    w.resultsVeil.setSize(v.width, v.height);
  }

  override update(_time: number, deltaMs: number): void {
    const w = this.w;
    const started = this.started;
    if (!w || !started) return;
    // Retención externa (0033, aviso de orientación): solo quita ticks; el teclado sigue igual.
    this.gate.hold(this.deps.hold?.() ?? false, started.tickRun);
    // Las teclas y los clics se leen siempre (se consumen). Esc va primero: si pausa en este
    // frame, R y la elección se descartan. Sin oferta o sin partida terminada no hacen nada.
    // ⏸ y ↻ (0033) son otra fuente de Esc y de R: las dos se consumen antes de combinarse.
    const bar = this.deps.touch?.bar;
    // Con el panel Sonido abierto (0035), Esc o ⏸ solo lo cierran y lo demás se descarta.
    const keys = {
      esc: pressedOnce(w.esc.read(), bar?.takePause() ?? false),
      action: this.deps.pause.takeAction(),
      restart: pressedOnce(w.restart.read(), bar?.takeRestart() ?? false),
      index: choiceIndex(this.last?.offer.length ?? 0, w.choice.read(), w.offer.takeClicked()),
    };
    const { esc, action, restart, index } = w.sound?.step(keys) ?? keys;
    // Tienda (0024) antes que la pausa: en tienda, Esc sale y se consume (nunca pausa este frame);
    // 1–3 y R se leen y se descartan (sin oferta ni partida terminada no hacen nada).
    const shopAction = this.deps.shop.takeAction();
    const shopStatus = this.last?.status ?? started.tickRun.status;
    const shop = this.shopGate.step(esc, shopAction, shopStatus, started);
    if (shop.snapshot) this.render(shop.snapshot);
    // Obra (0026) tras la tienda y antes de la pausa, con la misma regla de Esc.
    const buildAction = this.deps.build.takeAction();
    const buildStatus = this.last?.status ?? started.tickRun.status;
    const site = this.buildGate.step(shop.esc, buildAction, buildStatus, started);
    if (site.snapshot) this.render(site.snapshot);
    const status = this.last?.status ?? started.tickRun.status;
    if (this.gate.step(site.esc, action, status, started.tickRun) === 'menu') {
      this.scene.start(MENU_SCENE_KEY);
      return;
    }
    // Joystick (0033) solo con la partida en curso y sin pausa ni aviso: si no, se suelta.
    this.enableStick(w, started);
    const manual = this.deps.manual;
    // Reloj de render: una vez por frame, congelado con el mundo detenido. En modo manual sigue
    // al tiempo simulado (más abajo), no al del frame.
    if (!manual) w.layers.advance(deltaMs, this.gate.halted);
    // Partida de este frame: la actual o, si R reinicia, la nueva.
    let current = started;
    if (!this.gate.paused) {
      if (restart) current = this.restart(w, started);
      const chosen = index >= 0 ? current.chooseUpgrade.execute(index) : undefined;
      if (chosen?.ok) this.render(chosen.value);
    }
    if (manual) {
      this.manualFrame(w, manual, current.tickRun);
    } else {
      // `simSpeed` avances por frame con el input leído una vez (0 ticks en pausa); un render.
      const speed = this.deps.simSpeed ?? 1;
      this.render(this.gate.frame(current.tickRun, deltaMs, this.readMove(w), speed));
    }
    this.syncTouch(w, current);
    this.showPause(this.gate.paused);
  }

  /** Input de movimiento que lee la escena; el primero no nulo quita la indicación (0033). */
  private readMove(w: Widgets): PlayerInput {
    const input = w.move.read();
    w.touch?.view.noteInput(input);
    return input;
  }

  /** ¿Se juega? En curso, sin pausa ni aviso de orientación (joystick e indicación, 0033). */
  private playing(run: StartedRun): boolean {
    return !this.gate.halted && (this.last?.status ?? run.tickRun.status) === 'running';
  }

  private enableStick(w: Widgets, run: StartedRun): void {
    const touch = w.touch;
    if (!touch) return;
    touch.stick.setEnabled(this.playing(run));
    // Sondeo en cada frame: un dedo levantado se suelta aunque nadie lea el input (modo manual).
    touch.stick.read();
  }

  /** Joystick pintado y barra táctil del frame (0033); sin modo móvil no hace nada. */
  private syncTouch(w: Widgets, run: StartedRun): void {
    const touch = w.touch;
    if (!touch) return;
    touch.view.sync(touch.stick.state, this.playing(run));
    this.deps.touch?.bar.sync({ inRun: true, ended: this.last?.status === 'over' });
  }

  /** Joystick y su vista (solo modo móvil); el `InputPlugin` de la escena da los toques. */
  private createTouch(touch: SceneTouch): TouchWidgets {
    const { hint, ...settings } = touch.joystick;
    const input: InputLike = this.input;
    return {
      stick: new TouchJoystick(input, settings),
      view: createJoystickView(this, hint, settings.radiusPx, this.deps.appearance.ui),
    };
  }

  /**
   * Frame en modo manual (design 0014 §3.4): los ticks que planifica el stepper, nunca el tiempo
   * del frame (0 sin `step`). El reloj de render avanza lo mismo que el tiempo simulado.
   */
  private manualFrame(w: Widgets, manual: ManualFrames, run: TickRun): void {
    const plan = manual.plan(() => this.readMove(w));
    const r = this.gate.manualFrame(run, plan.ticks, plan.input);
    manual.served(r.ticks, !this.gate.halted && run.status === 'running');
    w.layers.advance(r.ticks * TICK_MS, this.gate.halted);
    this.render(r.snapshot);
  }

  /**
   * Partida nueva (solo desde una terminada): capas vacías antes de su primer render. Devuelve la
   * partida que sigue en juego (la misma si el reinicio no procede).
   */
  private restart(w: Widgets, current: StartedRun): StartedRun {
    const next = this.deps.restartRun.execute(current.tickRun);
    if (!next.ok) return current;
    this.started = next.value;
    w.touch?.view.resetHint();
    w.layers.clear();
    w.layers.paintMap(w.mapArt, this.mapPlan(next.value, w.mapLooks));
    return next.value;
  }

  /** Plan del pintado del mapa de una partida, con su semilla de decoración. */
  private mapPlan(run: StartedRun, mapLooks: MapLooks) {
    return planMapArt(run.tickRun.map(), mapLooks, {
      decorSeed: this.deps.decorSeed(),
      world: this.deps.world,
    });
  }

  /** Volver al menú: el motor destruye los objetos de la escena; aquí se sueltan las referencias. */
  private leave(): void {
    this.w?.touch?.stick.destroy();
    this.deps.touch?.bar.sync({ inRun: false, ended: false });
    this.deps.pause.setVisible(false);
    this.deps.shop.setVisible(false);
    this.deps.build.setVisible(false);
    this.deps.progress.leave();
    this.w = undefined;
    this.rig = undefined;
    this.last = undefined;
    this.started = undefined;
    this.gate = new PauseGate();
  }

  /** Mapa de la partida en curso (null sin partida, p. ej. en el menú), para la sonda E2E. */
  mapView(): MapSnapshot | null {
    return this.started?.tickRun.map() ?? null;
  }

  /** Números de oro, madera y piedra del HUD (0022, 0025; null sin partida), para la sonda E2E. */
  hudView(): { readonly gold: string; readonly wood: string; readonly stone: string } | null {
    // Solo con la escena de la partida activa: en el menú (escena parada, `leave`) no hay HUD.
    if (!this.started || !this.sys.isActive()) return null;
    return this.w?.hud.shown ?? null;
  }

  /** Icono de cada carta de la oferta visible (0034; vacío sin oferta o sin partida), sonda E2E. */
  offerIconsView(): readonly OfferIconView[] {
    if (!this.started || !this.sys.isActive()) return [];
    return this.w?.offer.iconStates ?? [];
  }

  /** Indicación en reposo visible en el último frame (0033; falso sin partida), para la sonda. */
  hintView(): boolean {
    if (!this.started || !this.sys.isActive()) return false;
    return this.w?.touch?.view.hintVisible ?? false;
  }

  /** Rectángulo visible del último frame pintado (null sin partida), para la sonda E2E. */
  cameraView(): CameraView | null {
    return this.rig?.view() ?? null;
  }

  private showPause(paused: boolean): void {
    this.deps.pause.setVisible(paused);
    this.deps.shop.setVisible(shopVisible(this.last?.status, paused));
    this.deps.build.setVisible(buildVisible(this.last?.status, paused));
    this.deps.onScreen?.(playScreen(this.last?.status, paused));
  }

  private render(snapshot: RunSnapshot): void {
    const w = this.w;
    const started = this.started;
    if (!w || !started) return;
    this.last = snapshot;
    w.layers.render(snapshot);
    // El motor centra y recorta la cámara en su preRender, en este mismo frame (design D2).
    this.rig?.track(snapshot.player);
    // Recorte del mapa con la vista que pintará ese preRender (0018, design D1 y §8).
    if (this.rig) w.layers.cullMap(this.rig.nextView());
    w.hud.sync(snapshot);
    w.offer.sync(snapshot.offer);
    this.deps.shop.sync(snapshot.shop, {
      current: snapshot.player.health,
      max: snapshot.player.maxHealth,
    });
    this.deps.build.sync(snapshot);
    w.results.sync(snapshot);
    // En el frame en que termina la partida: se guarda antes de que R pueda leerse (spec).
    this.deps.progress.sync(snapshot, started.tickRun);
    this.deps.onRender?.(snapshot, w.results.view, w.layers.counts, w.layers.renderMs);
  }
}
