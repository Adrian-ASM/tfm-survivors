import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  CameraRig,
  followView,
  type CameraView,
  type FollowCamera,
  type WorldSize,
} from '../../src/infrastructure/phaser/CameraRig';
import { screenFrame, type ScreenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { DEFAULT_MAX_VIEW, aDefaultConfig } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec world-camera (0017): vista del tamaño del lienzo (ventana recortada al tope), mundo de
// content/arena.json. Salvo que se diga otra cosa, ventana de 1.280 × 720.
const CONFIG = aDefaultConfig();
const WORLD: WorldSize = CONFIG.arena;
const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);
/** Lienzo de una ventana: el ScaleManager lo recorta al tope (`max`) y lo sanea (`screenFrame`). */
const canvasFor = (w: number, h: number): ScreenFrame =>
  screenFrame(Math.min(w, DEFAULT_MAX_VIEW.width), Math.min(h, DEFAULT_MAX_VIEW.height));

/**
 * Cámara falsa con el contrato de Phaser que usa `CameraRig`: `setSize` fija la vista, y en
 * `preRender` (fase de render, después de `update`) centra el objetivo y recorta el scroll a los
 * límites de `setBounds`, con lerp 1 (sin retraso).
 */
class FakeCamera implements FollowCamera {
  bounds: number[][] = [];
  sizes: number[][] = [];
  follows: { target: { x: number; y: number }; args: unknown[] }[] = [];
  readonly worldView = { x: 0, y: 0, width: 1, height: 1 };
  width = 1;
  height = 1;

  setBounds(x: number, y: number, w: number, h: number): this {
    this.bounds.push([x, y, w, h]);
    return this;
  }

  setSize(width: number, height: number): this {
    this.sizes.push([width, height]);
    this.width = width;
    this.height = height;
    this.worldView.width = width;
    this.worldView.height = height;
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
    const { width, height } = this.worldView;
    this.worldView.x = clamp(follow.target.x - width / 2, bx, bx + bw - width);
    this.worldView.y = clamp(follow.target.y - height / 2, by, by + bh - height);
  }
}

/** Pinta un frame con el jugador en (x, y) y devuelve el rectángulo visible (x1, y1)–(x2, y2). */
function paint(rig: CameraRig, camera: FakeCamera, x: number, y: number): number[] {
  rig.track({ x, y });
  camera.preRender();
  const v: CameraView = rig.view();
  return [v.x, v.y, v.x + v.width, v.y + v.height];
}

function rigOn(window = canvasFor(1280, 720), world = WORLD) {
  const camera = new FakeCamera();
  const rig = new CameraRig(camera, world);
  rig.resize(window);
  return { camera, rig };
}

describe('CameraRig (spec world-camera 0017)', () => {
  it('fija los límites del mundo una vez y sigue a un objetivo propio sin suavizado', () => {
    const { camera } = rigOn();

    expect(camera.bounds).toEqual([[0, 0, 3840, 2160]]);
    expect(camera.follows.map((f) => f.args)).toEqual([[false, 1, 1]]);
  });

  it('Scenario: Jugador en el centro del mundo', () => {
    const { camera, rig } = rigOn();

    expect(paint(rig, camera, 1920, 1080)).toEqual([1280, 720, 2560, 1440]);
  });

  it.each([
    [16, 16, [0, 0, 1280, 720]],
    [3824, 16, [2560, 0, 3840, 720]],
    [16, 2144, [0, 1440, 1280, 2160]],
    [3824, 2144, [2560, 1440, 3840, 2160]],
  ])('Scenario: Las cuatro esquinas (jugador en (%s, %s))', (x, y, expected) => {
    const { camera, rig } = rigOn();

    expect(paint(rig, camera, x, y)).toEqual(expected);
  });

  it('Scenario: Límite exacto del recorte', () => {
    const { camera, rig } = rigOn();

    expect(paint(rig, camera, 640, 360)).toEqual([0, 0, 1280, 720]);
    expect(paint(rig, camera, 3200, 1800)).toEqual([2560, 1440, 3840, 2160]);
  });

  it('Scenario: Recorte en un solo eje', () => {
    const { camera, rig } = rigOn();

    expect(paint(rig, camera, 100, 1080)).toEqual([0, 720, 1280, 1440]);
  });

  it('Scenario: Seguimiento sin retraso', () => {
    const { camera, rig } = rigOn();
    paint(rig, camera, 1920, 1080);

    expect(paint(rig, camera, 1960, 1080)).toEqual([1320, 720, 2600, 1440]);
  });

  it('Scenario: Ventana en el tope (ventana 3.840 × 2.160: vista 2.560 × 1.440)', () => {
    const { camera, rig } = rigOn(canvasFor(3840, 2160));

    expect(paint(rig, camera, 1920, 1080)).toEqual([640, 360, 3200, 1800]);
    expect(paint(rig, camera, 16, 16)).toEqual([0, 0, 2560, 1440]);
  });

  it('Scenario: Ventana de 960 × 540', () => {
    const { camera, rig } = rigOn(canvasFor(960, 540));

    expect(paint(rig, camera, 1920, 1080)).toEqual([1440, 810, 2400, 1350]);
  });

  it('Scenario: Mundo igual al tope (2.560 × 1.440)', () => {
    const { camera, rig } = rigOn(canvasFor(2560, 1440), { width: 2560, height: 1440 });

    expect(paint(rig, camera, 16, 16)).toEqual([0, 0, 2560, 1440]);
    expect(paint(rig, camera, 2544, 1424)).toEqual([0, 0, 2560, 1440]);
  });

  it('Scenario: Redimensionado en mitad de la partida (800 × 450: esquina (1.520, 855))', () => {
    const { camera, rig } = rigOn();
    paint(rig, camera, 1920, 1080);

    rig.resize(canvasFor(800, 450));

    expect(paint(rig, camera, 1920, 1080)).toEqual([1520, 855, 2320, 1305]);
  });

  it('Scenario: Ventana minimizada (0 × 0 → vista 1 × 1; al volver a 1.280 × 720, correcta)', () => {
    const { camera, rig } = rigOn();

    rig.resize(screenFrame(0, 0));
    const tiny = paint(rig, camera, 1920, 1080);
    rig.resize(canvasFor(1280, 720));

    expect(tiny.every(Number.isFinite)).toBe(true);
    expect(camera.sizes.at(-2)).toEqual([1, 1]);
    expect(paint(rig, camera, 1920, 1080)).toEqual([1280, 720, 2560, 1440]);
  });

  it('Scenario: Mismo tamaño (resize repetido no vuelve a tocar la cámara)', () => {
    const { camera, rig } = rigOn();

    rig.resize(canvasFor(1280, 720));

    expect(camera.sizes).toEqual([[1280, 720]]);
  });

  it('Scenario: Partida nueva tras acabar en una esquina ((3.824, 2.144) → (1.280, 720)–(2.560, 1.440))', () => {
    const { camera, rig } = rigOn();
    paint(rig, camera, 3824, 2144);

    const fresh = startSeededRun(CONFIG, 42, 'empty').snapshot().player;

    expect(paint(rig, camera, fresh.x, fresh.y)).toEqual([1280, 720, 2560, 1440]);
  });

  it('view() es una copia: no expone el worldView de la cámara', () => {
    const { camera, rig } = rigOn();
    paint(rig, camera, 1920, 1080);
    const view = rig.view();

    paint(rig, camera, 16, 16);

    expect(view).toEqual({ x: 1280, y: 720, width: 1280, height: 720 });
  });
});

// Spec sprite-rendering (0018), rectángulo visible del frame que se va a pintar (design D1): la
// misma fórmula que aplica la cámara en su preRender, calculada antes de él.
const corners = (v: CameraView): number[] => [v.x, v.y, v.x + v.width, v.y + v.height];
const size = (w: number, h: number) => ({ width: w, height: h });

describe('followView (0018, design D1)', () => {
  it('centrada: jugador en (1.920, 1.080) a 1.280 × 720 → (1.280, 720)–(2.560, 1.440)', () => {
    const view = followView({ x: 1920, y: 1080 }, size(1280, 720), WORLD);

    expect(view).toEqual({ x: 1280, y: 720, width: 1280, height: 720 });
  });

  it.each([
    [16, 16, [0, 0, 1280, 720]],
    [3824, 16, [2560, 0, 3840, 720]],
    [16, 2144, [0, 1440, 1280, 2160]],
    [3824, 2144, [2560, 1440, 3840, 2160]],
  ])('Scenario: Vista recortada al mundo en una esquina (jugador en (%s, %s))', (x, y, rect) => {
    expect(corners(followView({ x, y }, size(1280, 720), WORLD))).toEqual(rect);
  });

  it.each([
    [960, 540, [1440, 810, 2400, 1350]],
    [1280, 720, [1280, 720, 2560, 1440]],
    [2560, 1440, [640, 360, 3200, 1800]],
  ])('Scenario: Vista que crece con la ventana (vista %s × %s)', (w, h, rect) => {
    expect(corners(followView({ x: 1920, y: 1080 }, size(w, h), WORLD))).toEqual(rect);
  });

  it('Scenario: Vista que cubre el mundo entero (mundo 2.560 × 1.440, vista igual)', () => {
    const world = size(2560, 1440);

    expect(corners(followView({ x: 16, y: 16 }, size(2560, 1440), world))).toEqual([
      0, 0, 2560, 1440,
    ]);
  });

  it('posición inicial del E2E de Cámara (jugador en (1.950, 1.170) → (1.310, 810))', () => {
    const view = followView({ x: 1950, y: 1170 }, size(1280, 720), WORLD);

    expect([view.x, view.y]).toEqual([1310, 810]);
  });

  it('coincide con el worldView que deja el preRender de la cámara', () => {
    const { camera, rig } = rigOn();
    const painted = paint(rig, camera, 3000, 400);

    expect(corners(followView({ x: 3000, y: 400 }, size(1280, 720), WORLD))).toEqual(painted);
  });
});

describe('CameraRig.nextView (0018)', () => {
  it('usa el objetivo de track y el tamaño de la cámara tras resize', () => {
    const { rig } = rigOn();
    rig.track({ x: 1920, y: 1080 });

    expect(rig.nextView()).toEqual({ x: 1280, y: 720, width: 1280, height: 720 });

    rig.resize(canvasFor(3840, 2160));

    expect(rig.nextView()).toEqual({ x: 640, y: 360, width: 2560, height: 1440 });

    rig.track({ x: 16, y: 16 });
    rig.resize(canvasFor(960, 540));

    expect(rig.nextView()).toEqual({ x: 0, y: 0, width: 960, height: 540 });
  });

  it('antes del preRender: el worldView sigue siendo el del frame anterior', () => {
    const { camera, rig } = rigOn();
    paint(rig, camera, 1920, 1080);
    rig.track({ x: 2000, y: 1080 });

    expect(rig.view().x).toBe(1280);
    expect(rig.nextView().x).toBe(1360);
  });
});

/** Partida pintada: en cada tick cambia (si toca) la ventana, avanza y pinta con la cámara. */
function playPainted(
  seed: number,
  ticks: number,
  windowAt: (tick: number) => ScreenFrame,
  inputs = randomInputs(ticks, 2026),
): RunSnapshot[] {
  const run: Run = startSeededRun(CONFIG, seed);
  const { camera, rig } = rigOn(windowAt(0));
  return inputs.map((input, i) => {
    rig.resize(windowAt(i));
    chooseFirstWhileOpen(run);
    run.tick(input);
    const snap = run.snapshot();
    paint(rig, camera, snap.player.x, snap.player.y);
    return snap;
  });
}

const CYCLE = [canvasFor(320, 180), canvasFor(1280, 720), canvasFor(3840, 2160)];

describe('La cámara no cambia la simulación (0017)', () => {
  it('Scenario: Misma partida con y sin pintar (semilla 7, 3.600 ticks)', () => {
    const inputs = randomInputs(3600, 2026);
    const painted = playPainted(7, 3600, () => canvasFor(1280, 720), inputs);
    const plain = startSeededRun(CONFIG, 7);
    const unpainted = inputs.map((input) => {
      chooseFirstWhileOpen(plain);
      plain.tick(input);
      return plain.snapshot();
    });

    expect(painted).toStrictEqual(unpainted);
  });

  it('Scenario: Misma partida con ventanas distintas (960 × 540, 2.560 × 1.440 y cambiante)', () => {
    const small = playPainted(7, 3600, () => canvasFor(960, 540));
    const big = playPainted(7, 3600, () => canvasFor(2560, 1440));
    const changing = playPainted(
      7,
      3600,
      (t) => CYCLE[Math.floor(t / 60) % CYCLE.length] ?? canvasFor(1280, 720),
    );

    expect(big).toStrictEqual(small);
    expect(changing).toStrictEqual(small);
  });

  it('Scenario: Mismas apariciones con cualquier ventana (semilla 42, 1.200 ticks)', () => {
    const still = Array.from({ length: 1200 }, () => PlayerInput.NONE);
    const births = (snaps: RunSnapshot[]) =>
      snaps.map((s) => s.enemies.map((e) => `${String(e.id)}:${e.type}`).join('|'));
    const a = playPainted(42, 1200, () => canvasFor(960, 540), still);
    const b = playPainted(
      42,
      1200,
      (t) => (t < 600 ? canvasFor(2560, 1440) : canvasFor(1280, 720)),
      still,
    );

    expect(births(b)).toEqual(births(a));
    expect(b).toStrictEqual(a);
  });
});
