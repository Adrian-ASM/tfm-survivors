// Composition root (AGENTS.md §3.4): el único sitio que conoce las implementaciones concretas.
import Phaser from 'phaser';
import { StartRun } from '../application/StartRun';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import type { DomainError } from '../domain/shared/Result';
import { loadRunConfig } from '../infrastructure/content/loadRunConfig';
import { GameScene } from '../infrastructure/phaser/GameScene';
import { Mulberry32RandomGenerator } from '../infrastructure/random/Mulberry32RandomGenerator';

const BACKGROUND = '#14141e';

/** Lectura del último snapshot para el smoke E2E. Solo existe con ?e2e en la URL. */
interface E2EProbe {
  snapshot: RunSnapshot | null;
}

function showContentError(root: HTMLElement, error: DomainError): void {
  const box = document.createElement('div');
  box.className = 'content-error';
  box.setAttribute('role', 'alert');
  box.textContent = `Contenido inválido en ${error.field}: ${error.message}`;
  root.replaceChildren(box);
}

function bootstrap(): void {
  const root = document.getElementById('game');
  if (!root) throw new Error('Falta el contenedor #game en index.html');

  const config = loadRunConfig();
  if (!config.ok) {
    showContentError(root, config.error);
    return;
  }
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  const started = new StartRun().execute(config.value, new Mulberry32RandomGenerator(seed));
  if (!started.ok) {
    showContentError(root, started.error);
    return;
  }

  const probe: E2EProbe = { snapshot: null };
  if (new URLSearchParams(window.location.search).has('e2e')) {
    Object.defineProperty(window, '__sprint', { value: probe });
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: root,
    width: config.value.arena.width,
    height: config.value.arena.height,
    backgroundColor: BACKGROUND,
    scene: [
      new GameScene(started.value, (snapshot) => {
        probe.snapshot = snapshot;
      }),
    ],
  });
}

bootstrap();
