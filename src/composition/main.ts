// Composition root (AGENTS.md §3.4): el único sitio que conoce las implementaciones concretas.
import Phaser from 'phaser';
import { StartRun } from '../application/StartRun';
import { buildRunRules, type RunConfig } from '../domain/run/RunConfig';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import type { DomainError } from '../domain/shared/Result';
import { loadRunConfig } from '../infrastructure/content/loadRunConfig';
import { GameScene, type SceneCapacity } from '../infrastructure/phaser/GameScene';
import { Mulberry32RandomGenerator } from '../infrastructure/random/Mulberry32RandomGenerator';
import { resolveSeed } from '../infrastructure/url/resolveSeed';

const BACKGROUND = '#14141e';

/** Lectura del último snapshot y de la semilla para los E2E. Solo existe con ?e2e en la URL. */
interface E2EProbe {
  readonly seed: number;
  snapshot: RunSnapshot | null;
}

function showContentError(root: HTMLElement, error: DomainError): void {
  const box = document.createElement('div');
  box.className = 'content-error';
  box.setAttribute('role', 'alert');
  box.textContent = `Contenido inválido en ${error.field}: ${error.message}`;
  root.replaceChildren(box);
}

/** Semilla aleatoria de 32 bits sin signo; fuera del núcleo, así que puede usar la API del navegador. */
const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;

/** Tamaño de los pools de la escena desde el contenido ya validado (`pulseCapacity` del dominio). */
function sceneCapacity(config: RunConfig): SceneCapacity {
  const rules = buildRunRules(config);
  if (!rules.ok) throw new Error(rules.error.message);
  const { loadout } = rules.value;
  const visualTicks = new Map<string, number>();
  for (const w of loadout.weapons) {
    if (w.attack.type === 'pulse') visualTicks.set(w.id, w.attack.visualTicks);
  }
  return {
    enemies: config.waves.maxAlive,
    projectiles: loadout.maxProjectiles,
    pulses: loadout.pulseCapacity,
    visualTicks,
  };
}

function bootstrap(): void {
  const root = document.getElementById('game');
  if (!root) throw new Error('Falta el contenedor #game en index.html');

  const config = loadRunConfig();
  if (!config.ok) {
    showContentError(root, config.error);
    return;
  }
  const { seed, warning } = resolveSeed(window.location.search, randomSeed);
  if (warning) console.warn(warning);
  const started = new StartRun().execute(config.value, new Mulberry32RandomGenerator(seed));
  if (!started.ok) {
    showContentError(root, started.error);
    return;
  }

  const probe: E2EProbe = { seed, snapshot: null };
  if (new URLSearchParams(window.location.search).has('e2e')) {
    Object.defineProperty(window, '__sprint', { value: probe });
  }

  // El canvas tiene el tamaño de la vista (unidades de mundo): una sola fuente para lo que se ve.
  const { view } = config.value.arena;
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: root,
    width: view.width,
    height: view.height,
    backgroundColor: BACKGROUND,
    scene: [
      new GameScene(started.value.tickRun, sceneCapacity(config.value), (snapshot) => {
        probe.snapshot = snapshot;
      }),
    ],
  });
}

bootstrap();
