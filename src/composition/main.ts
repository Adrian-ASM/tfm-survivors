// Composition root (AGENTS.md §3.4): el único sitio que conoce las implementaciones concretas.
import Phaser from 'phaser';
import { RestartRun } from '../application/RestartRun';
import { StartRun } from '../application/StartRun';
import { buildRunRules, type RunConfig } from '../domain/run/RunConfig';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import type { DomainError } from '../domain/shared/Result';
import { loadRunConfig } from '../infrastructure/content/loadRunConfig';
import { GameScene, type SceneCapacity } from '../infrastructure/phaser/GameScene';
import { Mulberry32RandomGenerator } from '../infrastructure/random/Mulberry32RandomGenerator';
import type { ResultsView } from '../infrastructure/phaser/resultsText';
import { resolveSeed } from '../infrastructure/url/resolveSeed';
import { restartRandoms } from './seedSource';

const BACKGROUND = '#14141e';

/**
 * Lectura del último snapshot, de la semilla de la partida actual y de los resultados mostrados
 * para los E2E. Solo existe con ?e2e en la URL.
 */
interface E2EProbe {
  seed: number;
  snapshot: RunSnapshot | null;
  results: ResultsView | null;
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

/**
 * Tamaño de los pools de la escena desde el contenido ya validado: `pulseCapacity` del peor caso
 * de las mejoras (ADR-0008) y `maxGems`.
 */
function sceneCapacity(config: RunConfig): SceneCapacity {
  const rules = buildRunRules(config);
  if (!rules.ok) throw new Error(rules.error.message);
  const { loadout, pulseCapacity, gems } = rules.value;
  const visualTicks = new Map<string, number>();
  for (const w of loadout.weapons) {
    if (w.attack.type === 'pulse') visualTicks.set(w.id, w.attack.visualTicks);
  }
  return {
    enemies: config.waves.maxAlive,
    projectiles: loadout.maxProjectiles,
    pulses: pulseCapacity,
    gems: gems.maxGems,
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

  const probe: E2EProbe = { seed, snapshot: null, results: null };
  // Cada reinicio usa una semilla nueva (también con ?seed=), sin releer la URL ni avisar.
  const nextRandom = restartRandoms(randomSeed, (s) => {
    probe.seed = s;
  });
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
      new GameScene(
        started.value,
        new RestartRun(config.value, nextRandom),
        sceneCapacity(config.value),
        (snapshot, results) => {
          probe.snapshot = snapshot;
          probe.results = results;
        },
      ),
    ],
  });
}

bootstrap();
