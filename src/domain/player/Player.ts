import type { Arena } from '../arena/Arena';
import type { PlayerRules } from './PlayerRules';
import { Health } from '../shared/Health';
import { Vector2 } from '../shared/Vector2';
import type { GameMap } from '../map/GameMap';
import type { PlayerInput } from './PlayerInput';

/**
 * Jugador (entidad). Inmutable: cada movimiento o golpe devuelve un Player nuevo.
 * La invulnerabilidad se guarda como tick absoluto (`invulnerableUntil`, el último tick protegido),
 * así que no hay contador que decrementar por tick.
 */
export class Player {
  private constructor(
    readonly position: Vector2,
    private readonly rules: PlayerRules,
    readonly health: Health,
    readonly invulnerableUntil: number,
  ) {
    Object.freeze(this);
  }

  /** Crea un jugador con la vida llena; las reglas ya validadas por `buildRunRules`. */
  static spawn(position: Vector2, rules: PlayerRules): Player {
    return new Player(position, rules, Health.full(rules.maxHealth), 0);
  }

  get radius(): number {
    return this.rules.radius;
  }

  get speed(): number {
    return this.rules.speed;
  }

  get pickupRadius(): number {
    return this.rules.pickupRadius;
  }

  /**
   * Jugador con reglas efectivas nuevas (mejora, camino frío): conserva posición e
   * invulnerabilidad y sube la vida máxima y la actual en `maxHealthGain` (ver `Health.raise`).
   */
  withRules(rules: PlayerRules, maxHealthGain: number): Player {
    const health = maxHealthGain === 0 ? this.health : this.health.raise(maxHealthGain);
    return new Player(this.position, rules, health, this.invulnerableUntil);
  }

  /**
   * Avanza dt segundos sin inercia, sin salir de la arena y sin solapar celdas no caminables del
   * mapa (spec player-movement, "Colisión con el mapa"): por ejes, primero x y luego y con la x ya
   * resuelta, cada uno tangente al primer obstáculo. Conserva vida e invulnerabilidad.
   */
  move(input: PlayerInput, dtSeconds: number, arena: Arena, map: GameMap): Player {
    const step = this.rules.speed * dtSeconds;
    const { x: x0, y: y0 } = this.position;
    const r = this.rules.radius;
    const x = map.limitMoveX(x0, arena.clampX(x0 + input.direction.x * step, r), y0, r);
    const y = map.limitMoveY(y0, arena.clampY(y0 + input.direction.y * step, r), x, r);
    return new Player(Vector2.of(x, y), this.rules, this.health, this.invulnerableUntil);
  }

  /** ¿Un contacto en el tick n le haría daño? */
  canBeHitAt(tick: number): boolean {
    return tick > this.invulnerableUntil;
  }

  /** Golpe en el tick n: resta el daño (mínimo 0) y protege los ticks n + 1 … n + N. */
  hit(damage: number, tick: number): Player {
    const until = tick + this.rules.invulnerabilityTicks;
    return new Player(this.position, this.rules, this.health.damage(damage), until);
  }

  /**
   * Curación (spec player-health 0023): sube la vida con tope en la máxima efectiva y conserva
   * posición e invulnerabilidad (ni la inicia ni la cambia). Sin cambio, el mismo jugador.
   */
  heal(amount: number): Player {
    const health = this.health.heal(amount);
    if (health === this.health) return this;
    return new Player(this.position, this.rules, health, this.invulnerableUntil);
  }

  /**
   * La misma posición, reglas e invulnerabilidad con la vida actual `current` (`RunSetup`, ya
   * validada en [1, máx]).
   */
  withHealth(current: number): Player {
    const health = Health.full(this.health.max).damage(this.health.max - current);
    return new Player(this.position, this.rules, health, this.invulnerableUntil);
  }

  /** Lo que marca el snapshot del tick k: un contacto en k + 1 no dañaría. */
  isInvulnerableAfter(tick: number): boolean {
    return tick < this.invulnerableUntil;
  }
}
