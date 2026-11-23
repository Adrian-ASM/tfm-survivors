import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  CameraRig,
  type CameraView,
  type FollowCamera,
} from '../../src/infrastructure/phaser/CameraRig';
import { aDefaultConfig } from '../support/builders';
import { advance, startRun } from '../support/runs';

const VIEW = { width: 960, height: 540 };
const WORLD = { width: 1920, height: 1080 };

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

/**
 * Cámara falsa con el contrato de Phaser que usa `CameraRig`: `startFollow` guarda el objetivo y,
 * en `preRender` (fase de render del motor, después de `update`), centra el objetivo y recorta el
 * scroll a los límites de `setBounds`, con lerp 1 (sin retraso).
 */
class FakeCamera implements FollowCamera {
  bounds: number[][] = [];
  follows: { target: { x: number; y: number }; args: unknown[] }[] = [];
  readonly worldView = { x: 0, y: 0, width: VIEW.width, height: VIEW.height };

  setBounds(x: number, y: number, w: number, h: number): this {
    this.bounds.push([x, y, w, h]);
    return this;
  }

  startFollow(target: object, roundPixels: boolean, lerpX: number, lerpY: number): this {
    this.follows.push({
      target: target as { x: number; y: number },
      args: [roundPixels, lerpX, lerpY],
    });
    return this;
  }

  preRender(): void {
    const follow = this.follows.at(-1);
    const [bx = 0, by = 0, bw = 0, bh = 0] = this.bounds.at(-1) ?? [];
    if (!follow) return;
    this.worldView.x = clamp(follow.target.x - VIEW.width / 2, bx, bx + bw - VIEW.width);
    this.worldView.y = clamp(follow.target.y - VIEW.height / 2, by, by + bh - VIEW.height);
  }
}

/** Pinta un frame con el jugador en (x, y) y devuelve el rectángulo visible (x1, y1)–(x2, y2). */
function paint(rig: CameraRig, camera: FakeCamera, x: number, y: number): number[] {
  rig.track({ x, y });
  camera.preRender();
  const v: CameraView = rig.view();
  return [v.x, v.y, v.x + v.width, v.y + v.height];
}

function rigOn(world = WORLD) {
  const camera = new FakeCamera();
  return { camera, rig: new CameraRig(camera, world) };
}

describe('CameraRig (spec world-camera)', () => {
  it('fija los límites del mundo una vez y sigue a un objetivo propio sin suavizado', () => {
    const { camera } = rigOn();

    expect(camera.bounds).toEqual([[0, 0, 1920, 1080]]);
    expect(camera.follows.map((f) => f.args)).toEqual([[false, 1, 1]]);
  });

  it('Scenario: Jugador en el centro del mundo', () => {
    const { camera, rig } = rigOn();

    expect(paint(rig, camera, 960, 540)).toEqual([480, 270, 1440, 810]);
  });

  it.each([
    [16, 16, [0, 0, 960, 540]],
    [1904, 16, [960, 0, 1920, 540]],
    [16, 1064, [0, 540, 960, 1080]],
    [1904, 1064, [960, 540, 1920, 1080]],
  ])('Scenario: Las cuatro esquinas (jugador en (%s, %s))', (x, y, expected) => {
    const { camera, rig } = rigOn();

    expect(paint(rig, camera, x, y)).toEqual(expected);
  });

  it('Scenario: Límite exacto del recorte', () => {
    const { camera, rig } = rigOn();

    expect(paint(rig, camera, 480, 270)).toEqual([0, 0, 960, 540]);
    expect(paint(rig, camera, 1440, 810)).toEqual([960, 540, 1920, 1080]);
  });

  it('Scenario: Recorte en un solo eje', () => {
    const { camera, rig } = rigOn();

    expect(paint(rig, camera, 100, 540)).toEqual([0, 270, 960, 810]);
  });

  it('Scenario: Seguimiento sin retraso', () => {
    const { camera, rig } = rigOn();
    paint(rig, camera, 960, 540);

    expect(paint(rig, camera, 1000, 540)).toEqual([520, 270, 1480, 810]);
  });

  it('Scenario: Mundo igual a la vista', () => {
    const { camera, rig } = rigOn(VIEW);

    expect(paint(rig, camera, 16, 16)).toEqual([0, 0, 960, 540]);
    expect(paint(rig, camera, 944, 524)).toEqual([0, 0, 960, 540]);
  });

  it('view() es una copia: no expone el worldView de la cámara', () => {
    const { camera, rig } = rigOn();
    paint(rig, camera, 960, 540);
    const view = rig.view();

    paint(rig, camera, 16, 16);

    expect(view).toEqual({ x: 480, y: 270, width: 960, height: 540 });
  });

  it('Scenario: Misma partida con y sin pintar (semilla 7, 3.600 ticks)', () => {
    const config = aDefaultConfig();
    const painted = startRun(config, undefined, new Mulberry32RandomGenerator(7));
    const unpainted = startRun(config, undefined, new Mulberry32RandomGenerator(7));
    const { camera, rig } = rigOn();
    const mutated: number[] = [];

    for (let t = 1; t <= 3600; t++) {
      const [snap] = advance(painted, 1) as [RunSnapshot];
      const before = structuredClone(snap);
      paint(rig, camera, snap.player.x, snap.player.y);
      rig.track(snap.player);
      if (JSON.stringify(snap) !== JSON.stringify(before)) mutated.push(t);
      expect(advance(unpainted, 1)[0]).toStrictEqual(snap);
    }

    expect(mutated).toEqual([]);
  });
});
