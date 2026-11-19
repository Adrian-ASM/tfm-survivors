import type { Arena } from '../arena/Arena';
import type { PlayerRules } from './PlayerRules';
import { Health } from '../shared/Health';
import type { Vector2 } from '../shared/Vector2';
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

  /** Avanza dt segundos sin inercia y sin salir de la arena; conserva vida e invulnerabilidad. */
  move(input: PlayerInput, dtSeconds: number, arena: Arena): Player {
    const next = this.position.add(input.direction.scale(this.rules.speed * dtSeconds));
    const position = arena.clampCircle(next, this.rules.radius);
    return new Player(position, this.rules, this.health, this.invulnerableUntil);
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

  /** Lo que marca el snapshot del tick k: un contacto en k + 1 no dañaría. */
  isInvulnerableAfter(tick: number): boolean {
    return tick < this.invulnerableUntil;
  }
}
