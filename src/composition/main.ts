// Composition root (AGENTS.md §3.4): el único sitio que conoce las implementaciones concretas.
// Primero: configura zod antes de que se construya ningún esquema (CSP sin 'unsafe-eval').
import '../infrastructure/validation/cspSafeZod';
import Phaser from 'phaser';
import appearanceJson from '../../content/appearance.json';
import guideJson from '../../content/guide.json';
import audioJson from '../../content/audio.json';
import provenanceJson from '../../content/asset-provenance.json';
import { RestartRun } from '../application/RestartRun';
import { buildRunRules, type RunConfig } from '../domain/run/RunConfig';
import type { MapSnapshot } from '../domain/map/MapSnapshot';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import type { DomainError } from '../domain/shared/Result';
import { repositoryContent } from '../infrastructure/content/loadRunConfig';
import { generatedPaths, registeredPaths } from '../infrastructure/content/loadAppearance';
import { soundPaths } from '../infrastructure/content/loadAudio';
import { IconBook } from '../infrastructure/icons/upgradeIcons';
import type { OfferIconView } from '../infrastructure/phaser/UpgradeOverlay';
import { PausePanel } from '../infrastructure/dom/PausePanel';
import { ShopPanel, type ShopPanelView } from '../infrastructure/dom/ShopPanel';
import { BuildPanel, type BuildPanelView } from '../infrastructure/dom/BuildPanel';
import { resourceIcons } from '../infrastructure/dom/resourceIcons';
import type { SiteSnapshot } from '../domain/run/RunSnapshot';
import { GameScene, type SceneCapacity, type Screen } from '../infrastructure/phaser/GameScene';
import { MenuScene } from '../infrastructure/phaser/MenuScene';
import { emptyCounts, type SpriteCounts } from '../infrastructure/phaser/renderCounts';
import type { ResultsView } from '../infrastructure/phaser/resultsText';
import { BootScene } from '../infrastructure/phaser/BootScene';
import type { CameraView, WorldSize } from '../infrastructure/phaser/CameraRig';
import { ManualStepper } from '../infrastructure/e2e/ManualStepper';
import { requestStep } from '../infrastructure/e2e/stepRequest';
import { viewportProbe, type ViewportView } from '../infrastructure/e2e/viewportProbe';
import { applyUiScale } from '../infrastructure/dom/applyUiScale';
import type { FullscreenLike } from '../infrastructure/dom/FullscreenControl';
import { applyUiKit, uiKitVariables } from '../infrastructure/dom/uiKit';
import { FONT_WAIT_MS, loadUiFont, withDeadline } from '../infrastructure/dom/uiFont';
import { assetUrl, fontUrl, iconUrl } from './assetUrl';
import { scaleConfig } from './scaleConfig';
import { bootContent } from './contentBoot';
import { resolveSeed } from '../infrastructure/url/resolveSeed';
import { resolveAdvance } from '../infrastructure/url/resolveAdvance';
import { resolveMapMode } from '../infrastructure/url/resolveMapMode';
import { resolveMobile } from '../infrastructure/url/resolveMobile';
import { wireMobile } from './mobileWiring';
import { wireProgress, type ProgressProbe } from './progressWiring';
import { createRunLauncher } from './runLauncher';
import { decorSeedOf, mapModeOf, restartRandoms } from './seedSource';

const BACKGROUND = '#14141e';

/**
 * Lectura del último snapshot, de la semilla de la partida actual, de los resultados mostrados y
 * del progreso para los E2E. Solo existe con ?e2e en la URL.
 */
interface E2EProbe {
  seed: number;
  /** Velocidad de simulación resuelta una vez en la carga (`?e2e&speed`, 1 por defecto). */
  readonly speed: number;
  /** Modo de avance manual (`?e2e&manual`, change 0014), resuelto una vez en la carga. */
  readonly manual: boolean;
  /** Avanza n ticks exactos en modo manual y resuelve con los ejecutados (0 sin modo manual). */
  step(n: unknown): Promise<number>;
  snapshot: RunSnapshot | null;
  results: ResultsView | null;
  readonly progress: ProgressProbe | null;
  /** Pantalla visible y partidas creadas en la carga (Jugar y reinicios con R). */
  screen: Screen;
  runs: number;
  /** Sprites visibles y de reserva del último frame pintado (design 0012 D7); a 0 en el menú. */
  sprites: SpriteCounts;
  /** Rectángulo visible del último frame pintado, en mundo (0013); null en el menú. */
  readonly camera: CameraView | null;
  /**
   * Mapa de la partida en curso y si `?e2e&map=empty` lo fuerza vacío (0015); null en el menú.
   */
  readonly map: (MapSnapshot & { readonly emptyForced: boolean }) | null;
  /** Tamaño del mundo, constante desde la carga. */
  readonly world: WorldSize;
  /** Ventana y escala de UI del último frame (0017); también en el menú. */
  readonly viewport: ViewportView | null;
  /** Oro y madera que muestra el HUD (0022); null en el menú. */
  readonly hud: { readonly gold: string; readonly wood: string; readonly stone: string } | null;
  /** Overlay de la tienda (0024): si se ve, el oro y, por producto, nivel, precio y si es comprable. */
  readonly shop: ShopPanelView;
  /**
   * Icono de cada carta de la oferta abierta en el último frame pintado (0034, design D7): id de la
   * opción y painted | fallback | none. Vacío sin oferta y en el menú.
   */
  readonly offerIcons: readonly OfferIconView[];
  /** Pantallas vistas desde la carga (0024: el E2E comprueba que Esc en la tienda no pausa). */
  readonly screens: readonly Screen[];
  /**
   * Solares de la partida (0026): por solar, en el orden del snapshot, id, estado, armado, acceso y
   * huellas; recuentos por estado y el panel de obra (visible, solar abierto y opciones). null en
   * el menú.
   */
  readonly sites: SitesProbe | null;
}

/** Sonda de los solares (0026). */
interface SitesProbe {
  readonly list: readonly SiteSnapshot[];
  readonly total: number;
  readonly empty: number;
  readonly house: number;
  readonly tower: number;
  readonly armed: number;
  readonly panel: BuildPanelView;
}

function showContentError(root: HTMLElement, error: DomainError): void {
  const box = document.createElement('div');
  box.className = 'content-error';
  box.setAttribute('role', 'alert');
  box.textContent = `Contenido inválido en ${error.field}: ${error.message}`;
  root.replaceChildren(box);
}

/**
 * Fullscreen API y bloqueo de orientación del navegador (0033, design §4.3). `lock` no está en
 * todos los navegadores (ni en los tipos de `lib.dom`), así que se detecta con `in`.
 */
function browserFullscreen(doc: Document): FullscreenLike {
  const el = doc.documentElement;
  const orientation = screen.orientation as
    { readonly lock?: (orientation: string) => Promise<void> } | undefined;
  const lockLandscape = async (): Promise<void> => {
    await orientation?.lock?.('landscape');
  };
  return {
    get enabled() {
      return doc.fullscreenEnabled;
    },
    get element() {
      return doc.fullscreenElement;
    },
    ...(typeof el.requestFullscreen === 'function'
      ? { request: () => el.requestFullscreen() }
      : {}),
    ...(typeof doc.exitFullscreen === 'function' ? { exit: () => doc.exitFullscreen() } : {}),
    ...(typeof orientation?.lock === 'function' ? { lockLandscape } : {}),
  };
}

/** Semilla aleatoria de 32 bits sin signo; fuera del núcleo, así que puede usar la API del navegador. */
const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;

/**
 * Tamaño de los pools de la escena desde el contenido ya validado: `pulseCapacity` del peor caso
 * de las mejoras (ADR-0008), la suma de los topes de recogibles (0022) y el tope de ovejas (0023).
 */
function sceneCapacity(config: RunConfig, corpses: number, blasts: number): SceneCapacity {
  const rules = buildRunRules(config);
  if (!rules.ok) throw new Error(rules.error.message);
  const { loadout, pulseCapacity, pickups, hazards } = rules.value;
  const visualTicks = new Map<string, number>();
  for (const w of loadout.weapons) {
    if (w.attack.type === 'pulse') visualTicks.set(w.id, w.attack.visualTicks);
  }
  return {
    enemies: config.waves.maxAlive,
    projectiles: loadout.maxProjectiles,
    towerProjectiles: rules.value.buildings.maxTowerProjectiles,
    pulses: pulseCapacity,
    pickups: pickups.capacity,
    sheep: rules.value.sheep.maxAlive,
    corpses,
    visualTicks,
    hazards: { dynamites: hazards.maxDynamites, blasts },
  };
}

function bootstrap(): void {
  const root = document.getElementById('game');
  if (!root) throw new Error('Falta el contenedor #game en index.html');

  // Contenido de juego + datos de aspecto + su cruce, antes de crear el menú o la partida (0012).
  const booted = bootContent(
    {
      content: repositoryContent(),
      appearance: appearanceJson,
      guide: guideJson,
      audio: audioJson,
    },
    (error) => {
      console.error(`Contenido inválido en ${error.field}: ${error.message}`);
      showContentError(root, error);
    },
    registeredPaths(provenanceJson),
    generatedPaths(provenanceJson),
    soundPaths(provenanceJson),
  );
  if (!booted) return;
  const config = { value: booted.config };
  const { appearance } = booted;
  // Fuente pixel (0032, design §6): en paralelo con la carga de Phaser; como mucho FONT_WAIT_MS.
  const fontReady = withDeadline(
    loadUiFont(
      document.fonts,
      (family, source) => new FontFace(family, source),
      appearance.ui.font.family,
      fontUrl(import.meta.env.BASE_URL, appearance.ui.font.file),
    ),
    FONT_WAIT_MS,
    (ms) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      }),
  );
  const menuSprites = emptyCounts(
    Object.keys(appearance.enemies),
    Object.keys(appearance.structures),
  );
  const { seed, warning } = resolveSeed(window.location.search, randomSeed);
  if (warning) console.warn(warning);
  // Una sola vez por carga: los reinicios no releen la URL ni avisan (spec simulation-loop).
  // Manual > speed (change 0014): con el modo manual, speed vale 1 y no se valida.
  const advance = resolveAdvance(window.location.search);
  for (const w of advance.warnings) console.warn(w);
  // Mapa de todas las partidas de la carga (`?e2e&map=empty`, spec procedural-map): 1 aviso máx.
  const mapResolved = resolveMapMode(window.location.search);
  if (mapResolved.warning) console.warn(mapResolved.warning);
  const mapMode = mapModeOf(mapResolved);
  // Modo móvil (0033, ADR-0029): una sola vez por carga, antes de crear el juego. La consulta del
  // puntero se lee una vez y no se escucha su cambio: la ruta de escala no cambia hasta recargar.
  const mobileMode = resolveMobile(
    window.location.search,
    () => window.matchMedia('(pointer: coarse)').matches,
  );
  if (mobileMode.warning) console.warn(mobileMode.warning);
  // Solo con el modo manual: cola de `step(n)` que GameScene atiende frame a frame.
  const stepper = advance.manual ? new ManualStepper() : undefined;
  // Iconos del panel de obra y de la guía: las hojas del HUD con la URL que carga BootScene (0027).
  const sheetUrl = (file: string) => assetUrl(import.meta.env.BASE_URL, file);
  const icons = resourceIcons(appearance, sheetUrl);
  // Antes de crear el juego: el panel queda en el DOM y el progreso cargado (nunca lanza). El menú
  // lleva la guía ya validada e interpolada (0028).
  const progress = wireProgress(root, () => probe.seed, { guide: booted.guide, icons });
  const pause = new PausePanel(document, root);
  // Iconos de mejora (0034, D2/D6): un solo IconBook para cartas (Phaser) y filas (DOM); todo
  // none hasta que BootScene publica las texturas cargadas.
  const iconBook = new IconBook(booted.icons);
  const iconFileUrl = (file: string) => iconUrl(import.meta.env.BASE_URL, file);
  const shopPanel = new ShopPanel(document, root, {
    resolve: (id) => iconBook.resolve(id),
    url: iconFileUrl,
  });
  const buildPanel = new BuildPanel(document, root, icons);
  // Barra táctil, aviso de orientación y dependencias de la escena: solo en modo móvil.
  const mobile = wireMobile(mobileMode.on, booted.mobile, {
    doc: document,
    root,
    classes: document.documentElement.classList,
    fullscreen: browserFullscreen(document),
  });
  const screens: Screen[] = [];
  const e2e = new URLSearchParams(window.location.search).has('e2e');
  // El mundo es la arena del contenido; el lienzo, la vista (0013).
  const world: WorldSize = { width: config.value.arena.width, height: config.value.arena.height };
  // Se conecta a la escena al crearla; leerlo antes da null (sin partida).
  let cameraView = (): CameraView | null => null;
  let mapView = (): MapSnapshot | null => null;
  let viewportView = (): ViewportView | null => null;
  let offerIconsView = (): readonly OfferIconView[] => [];
  let hudView = (): {
    readonly gold: string;
    readonly wood: string;
    readonly stone: string;
  } | null => null;
  const probe: E2EProbe = {
    seed,
    speed: advance.speed,
    manual: advance.manual,
    step: (n) =>
      requestStep(n, stepper, (msg) => {
        console.warn(msg);
      }),
    snapshot: null,
    results: null,
    screen: e2e ? 'playing' : 'menu',
    runs: 0,
    sprites: menuSprites,
    get progress() {
      return progress.probe();
    },
    // Getter y no copia en onRender: onRender corre antes del preRender de la cámara (design D5).
    get camera() {
      return cameraView();
    },
    // Getter: el mapa de la partida en curso (cambia con R y con Jugar), null en el menú.
    get map() {
      const map = mapView();
      return map ? { ...map, emptyForced: mapMode === 'empty' } : null;
    },
    world,
    get viewport() {
      return viewportView();
    },
    get hud() {
      return hudView();
    },
    get shop() {
      return shopPanel.view;
    },
    get offerIcons() {
      return offerIconsView();
    },
    screens,
    get sites() {
      const list = probe.snapshot?.sites;
      if (!list || probe.screen === 'menu') return null;
      const count = (state: SiteSnapshot['state']) => list.filter((s) => s.state === state).length;
      return {
        list,
        total: list.length,
        empty: count('free'),
        house: count('house'),
        tower: count('tower'),
        armed: list.filter((s) => s.armed).length,
        panel: buildPanel.view,
      };
    },
  };
  const started = (s: number): void => {
    probe.seed = s;
    probe.runs += 1;
  };
  // Cada reinicio usa una semilla nueva (también con ?seed=), sin releer la URL ni avisar.
  const nextSeeding = restartRandoms(randomSeed, started, mapMode);
  // La partida se crea al entrar en GameScene: la 1.ª de la carga con la semilla de la URL.
  const launcher = createRunLauncher({
    config: config.value,
    urlSeed: seed,
    randomSeed,
    onStart: started,
    mapMode,
    onContentError: (error) => {
      showContentError(root, error);
    },
  });
  const onScreen = (screen: Screen): void => {
    probe.screen = screen;
    if (screens.at(-1) !== screen) screens.push(screen);
    if (screen !== 'menu') return;
    probe.snapshot = null;
    probe.results = null;
    probe.sprites = menuSprites;
  };
  // Sin ?e2e no hay sonda (spec main-menu, "Sin sonda fuera de E2E").
  if (e2e) Object.defineProperty(window, '__sprint', { value: probe });

  const game = new GameScene({
    launcher,
    restartRun: new RestartRun(config.value, nextSeeding),
    capacity: sceneCapacity(config.value, appearance.maxCorpses, appearance.maxBlastSprites),
    world,
    appearance,
    // Variedad de árboles de la partida en curso (0016): `probe.seed` ya es la de esa partida.
    decorSeed: () => decorSeedOf(probe.seed),
    progress: progress.scene,
    resultsLines: progress.resultsLines,
    pause,
    shop: shopPanel,
    build: buildPanel,
    // Snapshot y sprites en la misma llamada: cualquier lectura ve un par coherente (design D7).
    onRender: (snapshot, results, sprites) => {
      probe.snapshot = snapshot;
      probe.results = results;
      probe.sprites = sprites;
    },
    onScreen,
    simSpeed: advance.speed,
    // Sin modo manual la escena recibe exactamente las deps de antes (tiempo real).
    ...(stepper ? { manual: stepper } : {}),
    // Regla de frame, joystick, barra y retención: solo con el modo móvil (vacío en escritorio).
    ...mobile.sceneDeps,
    iconFor: (id) => iconBook.resolve(id),
  });
  offerIconsView = () => game.offerIconsView();
  cameraView = () => game.cameraView();
  mapView = () => game.mapView();
  hudView = () => {
    const shown = game.hudView();
    return shown ? { gold: shown.gold, wood: shown.wood, stone: shown.stone } : null;
  };
  const menu = new MenuScene({
    ...progress.menu,
    show: () => {
      progress.menu.show();
      onScreen('menu');
    },
  });

  const boot = new BootScene({
    appearance,
    assetUrl: sheetUrl,
    e2e,
    fontReady,
    // Al terminar la carga: variables CSS de las piezas que cargaron (0032, design §4).
    onUiLoaded: (loaded) => {
      applyUiKit(root.style, uiKitVariables(appearance.ui, loaded, sheetUrl));
    },
    // Iconos de mejora (0034, D5): mismo origen bajo la base; los que cargaron, al IconBook.
    iconUrl: iconFileUrl,
    onIconsLoaded: (loaded) => {
      iconBook.setLoaded(loaded);
    },
  });

  // Lienzo a ventana completa con tope (0017, ADR-0014): RESIZE recortado a `maxView`, que no
  // llega al núcleo. La vista mide lo que mide el lienzo (zoom 1). En modo móvil (0033, ADR-0029),
  // EXPAND sobre `minWidth × baseHeight` con el mismo tope y dos punteros táctiles.
  const phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: root,
    scale: { ...scaleConfig(booted.maxView, mobile.on ? booted.mobile : undefined), parent: root },
    ...(mobile.input ? { input: mobile.input } : {}),
    backgroundColor: BACKGROUND,
    // Imágenes con <img> (sin XHR ni blob:): la CSP de index.html no cambia (design D2).
    loader: { imageLoadType: 'HTMLImageElement' },
    // Phaser arranca la primera escena: BootScene carga las hojas y arranca el menú o, con ?e2e,
    // la partida (arranque de antes, ADR-0011).
    scene: [boot, menu, game],
  });
  // Una sola escucha, que vive lo que el juego: escala de UI de los paneles DOM (design D6; en
  // móvil, 1 siempre) y aviso de orientación con el tamaño del padre (0033, solo en móvil).
  const onCanvas = (size: { width: number; height: number }): void => {
    applyUiScale(root.style, mobile.domFrame(size));
    mobile.orient(phaserGame.scale.parentSize);
  };
  onCanvas(phaserGame.scale.gameSize);
  viewportView = () =>
    viewportProbe(
      phaserGame.scale.parentSize,
      phaserGame.scale.gameSize,
      phaserGame.scale.displaySize,
      mobile.viewport,
      game.hintView(),
    );
  phaserGame.scale.on(Phaser.Scale.Events.RESIZE, onCanvas);
  // `step(n)` resuelve con el frame ya pintado: POST_RENDER llega tras pintar todas las escenas,
  // una vez por frame, haya o no partida (Phaser 4.2.1, Game.step; design 0014 §3.6).
  if (stepper) {
    phaserGame.events.on(Phaser.Core.Events.POST_RENDER, () => {
      stepper.afterRender();
    });
  }
}

bootstrap();
