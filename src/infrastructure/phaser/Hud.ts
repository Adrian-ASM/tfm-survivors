import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { formatClock, healthFill, healthLabel, killsLabel, remainingSeconds } from './hudFormat';
import type { HudLayout } from './ui/uiLayout';
import type { BarSprite, LabelSprite, XpBar } from './XpBar';

/**
 * Coloca los objetos del motor del HUD según el layout (0017): posiciones y tamaños de barras y
 * textos; con `rescale` también el tamaño de fuente. No crea objetos.
 */
export interface HudPlacement {
  place(layout: HudLayout, rescale: boolean): void;
}

/** Objetos del HUD, creados una vez fuera (la escena, con el motor). */
export interface HudParts {
  readonly xpBar: XpBar;
  readonly healthFill: BarSprite;
  readonly healthLabel: LabelSprite;
  readonly clock: LabelSprite;
  readonly kills: LabelSprite;
  /** Recolocación al redimensionar (opcional: sin ella el HUD no se mueve). */
  readonly placement?: HudPlacement;
}

/**
 * HUD (spec hud): vida (barra y número), tiempo restante, nivel/XP y bajas. Solo depende del último
 * snapshot y solo toca el motor cuando un valor cambia (el reloj, una vez por segundo).
 */
export class Hud {
  private fillWidth = -1;
  private health = '';
  private clock = '';
  private kills = '';
  private layoutKey = '';
  private uiScale = 0;
  private last: RunSnapshot | null = null;

  constructor(
    private readonly parts: HudParts,
    private healthWidth: number,
    private healthHeight: number,
  ) {}

  /**
   * Recoloca el HUD con el layout del lienzo (0017, design D6). Con el mismo layout no hace nada; el
   * texto solo se vuelve a pintar a otro tamaño si cambia el escalón de UI. No crea objetos.
   */
  relayout(layout: HudLayout): void {
    const key = JSON.stringify(layout);
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    const rescale = this.uiScale !== 0 && layout.uiScale !== this.uiScale;
    this.uiScale = layout.uiScale;
    this.parts.placement?.place(layout, rescale);
    this.healthWidth = layout.barWidth;
    this.healthHeight = layout.barHeight;
    this.fillWidth = -1;
    this.parts.xpBar.resize(layout.barWidth, layout.barHeight);
    if (this.last) this.sync(this.last);
  }

  sync(s: RunSnapshot): void {
    this.last = s;
    const { health, maxHealth } = s.player;
    this.parts.xpBar.sync(s.progression);
    const w = this.healthWidth * healthFill(health, maxHealth);
    if (w !== this.fillWidth) {
      this.fillWidth = w;
      this.parts.healthFill.setSize(w, this.healthHeight);
    }
    this.health = write(this.parts.healthLabel, this.health, healthLabel(health, maxHealth));
    const clock = formatClock(remainingSeconds(s.tick, s.durationTicks));
    this.clock = write(this.parts.clock, this.clock, clock);
    this.kills = write(this.parts.kills, this.kills, killsLabel(s.kills));
  }
}

/** Escribe el texto solo si cambia; devuelve el texto vigente. */
function write(label: LabelSprite, current: string, next: string): string {
  if (next !== current) label.setText(next);
  return next;
}
