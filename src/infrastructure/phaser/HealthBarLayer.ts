import type { StructureSnapshot } from '../../domain/run/RunSnapshot';
import { barRects, type BarSpec } from './art/combatFeedback';

/**
 * Lo mínimo que la capa necesita de un `Phaser.GameObjects.Graphics` (MCP phaser-docs, API de
 * Graphics: `clear()`, `fillStyle(color, alpha)` y `fillRect(x, y, width, height)`). Costura sin motor.
 */
export interface BarCanvas {
  clear(): unknown;
  fillStyle(color: number, alpha: number): unknown;
  fillRect(x: number, y: number, width: number, height: number): unknown;
}

/** Barra de los datos de aspecto: medidas y colores (`#RRGGBB` ya numéricos). */
export interface BarLooks extends BarSpec {
  readonly fill: number;
  readonly back: number;
}

/**
 * Barras de vida de las casas y torres goblin (change 0031, spec sprite-rendering "Barras de vida de
 * las estructuras"): un solo `Graphics` que se redibuja solo cuando cambia la vida o la ruina de
 * alguna estructura (el resultado es el mismo que redibujar cada frame). Una ruina no tiene barra.
 * 0036 (design D3): solo las estructuras **dañadas** alguna vez en la partida (vida < máxima en un
 * snapshot pintado) tienen barra, aunque vuelvan a la vida máxima; la memoria es de la vista y se
 * olvida con una partida nueva (`clear` y `setCellSize`), no con un RESIZE. Fuera del plan del mapa
 * y del recorte por cámara.
 */
export class HealthBarLayer {
  /** Barras dibujadas: estructuras dañadas y no en ruina (sonda `sprites.healthBars`). */
  drawn = 0;
  /** Ids de las estructuras dañadas alguna vez en la partida (0036). */
  private readonly damaged = new Set<number>();
  private cellSize = 0;
  private readonly lastHealth: number[] = [];
  private readonly lastRuin: boolean[] = [];
  private readonly rects = {
    back: { x: 0, y: 0, w: 0, h: 0 },
    fill: { x: 0, y: 0, w: 0, h: 0 },
  };

  constructor(
    private readonly canvas: BarCanvas,
    private readonly bar: BarLooks,
  ) {
    canvas.clear();
  }

  /** Lado de la celda del mapa de la partida (al pintar su plan): el borde superior de la huella. */
  setCellSize(cellSize: number): void {
    this.cellSize = cellSize;
    this.forget();
  }

  sync(structures: readonly StructureSnapshot[]): void {
    // El primer daño siempre llega con un cambio de vida: la caché de `changed` sigue valiendo.
    for (const s of structures) {
      if (!s.destroyed && s.health < s.maxHealth) this.damaged.add(s.id);
    }
    if (!this.changed(structures)) return;
    const { canvas, bar, rects } = this;
    canvas.clear();
    let drawn = 0;
    for (const s of structures) {
      if (s.destroyed || !this.damaged.has(s.id)) continue;
      barRects(s, bar, this.cellSize, rects);
      canvas.fillStyle(bar.back, 1);
      canvas.fillRect(rects.back.x, rects.back.y, rects.back.w, rects.back.h);
      canvas.fillStyle(bar.fill, 1);
      canvas.fillRect(rects.fill.x, rects.fill.y, rects.fill.w, rects.fill.h);
      drawn++;
    }
    this.drawn = drawn;
  }

  /** R y Volver al menú: sin barras hasta el siguiente snapshot pintado. */
  clear(): void {
    this.canvas.clear();
    this.drawn = 0;
    this.forget();
  }

  /** ¿Ha cambiado la vida o la ruina de alguna estructura (o la lista) desde el último dibujo? */
  private changed(structures: readonly StructureSnapshot[]): boolean {
    const { lastHealth, lastRuin } = this;
    let changed = structures.length !== lastHealth.length;
    for (let i = 0; i < structures.length; i++) {
      const s = structures[i];
      if (!s) continue;
      if (lastHealth[i] !== s.health || lastRuin[i] !== s.destroyed) changed = true;
      lastHealth[i] = s.health;
      lastRuin[i] = s.destroyed;
    }
    lastHealth.length = structures.length;
    lastRuin.length = structures.length;
    return changed;
  }

  private forget(): void {
    this.lastHealth.length = 0;
    this.lastRuin.length = 0;
    this.damaged.clear();
  }
}
