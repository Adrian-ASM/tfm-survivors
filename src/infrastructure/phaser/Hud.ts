import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { formatClock, healthFill, healthLabel, killsLabel, remainingSeconds } from './hudFormat';
import type { BarSprite, LabelSprite, XpBar } from './XpBar';

/** Objetos del HUD, creados una vez fuera (la escena, con el motor). */
export interface HudParts {
  readonly xpBar: XpBar;
  readonly healthFill: BarSprite;
  readonly healthLabel: LabelSprite;
  readonly clock: LabelSprite;
  readonly kills: LabelSprite;
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

  constructor(
    private readonly parts: HudParts,
    private readonly healthWidth: number,
    private readonly healthHeight: number,
  ) {}

  sync(s: RunSnapshot): void {
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
