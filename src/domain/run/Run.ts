import type { Arena } from '../arena/Arena';
import { contactDamage } from '../collision/contact';
import { Enemy } from '../enemy/Enemy';
import type { Player } from '../player/Player';
import type { PlayerInput } from '../player/PlayerInput';
import type { RandomGenerator } from '../shared/RandomGenerator';
import type { Experience } from '../progression/Experience';
import type { GemField } from '../progression/GemField';
import type { XpGem } from '../progression/XpGem';
import { ok, type DomainError, type Result } from '../shared/Result';
import { TICK_SECONDS } from '../shared/Tick';
import { WaveDirector, type SpawnAttempt } from '../wave/WaveDirector';
import { placeSpawn } from '../wave/placeSpawn';
import {
  RADIUS_MUST_FIT,
  SPEED_MUST_BE_POSITIVE,
  buildRunRules,
  type RunConfig,
  type RunRules,
} from './RunConfig';
import { Arsenal } from '../weapon/Arsenal';
import type { Projectile } from '../weapon/Projectile';
import type { PulseEcho } from '../weapon/PulseEcho';
import { UpgradeBoard } from '../upgrade/UpgradeBoard';
import type {
  EnemySnapshot,
  GemSnapshot,
  OfferSnapshot,
  ProjectileSnapshot,
  PulseSnapshot,
  RunSnapshot,
  UpgradeLevelSnapshot,
} from './RunSnapshot';
import type { RunStatus } from './RunStatus';
import {
  SETUP_HEALTH_OUT_OF_RANGE,
  SETUP_POSITION_MUST_BE_FINITE,
  initialEnemies,
  initialExperience,
  initialGems,
  initialPlayer,
  type RunSetup,
} from './RunSetup';

export {
  TICK_SECONDS,
  RADIUS_MUST_FIT,
  SPEED_MUST_BE_POSITIVE,
  SETUP_HEALTH_OUT_OF_RANGE,
  SETUP_POSITION_MUST_BE_FINITE,
  type RunConfig,
  type RunSetup,
  type RunStatus,
};

/**
 * Partida en curso (aggregate root). Único punto de entrada para cambiar el estado de la
 * simulación. Contrato de determinismo: el orden del tick (jugador → persecución → armas, con un
 * único removeDead() si hay bajas que suelta sus gemas → contacto con los vivos → gemas y XP →
 * director → apertura de oferta) y el consumo de azar son fijos (armas, gemas y XP no consumen
 * azar; la oferta sí); cambiarlos cambia las partidas de una semilla.
 */
export class Run {
  private tickCount = 0;
  private state: RunStatus = 'running';
  private nextEnemyId: number;
  private readonly arena: Arena;
  private readonly director: WaveDirector;
  private readonly arsenal: Arsenal;
  private readonly board: UpgradeBoard;

  private constructor(
    private readonly rules: RunRules,
    private readonly random: RandomGenerator,
    private player: Player,
    private readonly enemies: Enemy[],
    private readonly gems: GemField,
    private readonly experience: Experience,
  ) {
    this.arena = rules.arena;
    this.nextEnemyId = enemies.length;
    this.director = new WaveDirector(rules.table, rules.spawn, random);
    this.arsenal = new Arsenal(rules.loadout, rules.pulseCapacity);
    this.board = new UpgradeBoard(rules.upgrades);
  }

  static start(
    config: RunConfig,
    random: RandomGenerator,
    setup: RunSetup = {},
  ): Result<Run, DomainError> {
    const rules = buildRunRules(config);
    if (!rules.ok) return rules;
    const player = initialPlayer(rules.value, setup);
    if (!player.ok) return player;
    const enemies = initialEnemies(setup, rules.value.catalog, rules.value.arena);
    if (!enemies.ok) return enemies;
    const gems = initialGems(rules.value, setup);
    if (!gems.ok) return gems;
    const experience = initialExperience(rules.value, setup);
    if (!experience.ok) return experience;
    const { value } = rules;
    return ok(new Run(value, random, player.value, enemies.value, gems.value, experience.value));
  }

  /**
   * Tick n = tickCount + 1 (el que mostrará el snapshot). Con la partida terminada no hace nada.
   * El tick de la muerte cuenta, pero el director no actúa en él (spec run-state).
   */
  tick(input: PlayerInput): void {
    if (this.state === 'over') return;
    const n = this.tickCount + 1;
    this.player = this.player.move(input, TICK_SECONDS, this.arena);
    const { x, y } = this.player.position;
    for (const enemy of this.enemies) enemy.chase(x, y, TICK_SECONDS, this.arena);
    if (this.arsenal.step(n, x, y, this.enemies) > 0) this.removeDead();
    if (this.applyContact(n)) {
      this.tickCount = n;
      return;
    }
    const xp = this.gems.step(x, y, this.player.radius, this.player.pickupRadius);
    if (xp > 0) this.experience.gain(xp);
    this.director.step(n, this.enemies.length, this.place);
    this.tickCount = n;
    this.openNextOffer();
  }

  /**
   * Último paso del tick (y tras cada elección): con subidas pendientes y sin oferta abierta,
   * sortea la siguiente (único consumo de azar nuevo) y pasa a eligiendo. Sin mejoras disponibles
   * las subidas quedan registradas, sin oferta ni pausa y sin consumir azar.
   */
  private openNextOffer(): void {
    if (this.experience.pendingLevelUps === 0 || this.board.isOpen) return;
    if (this.board.open(this.random)) {
      this.state = 'choosing';
    } else {
      this.experience.clearPending();
    }
  }

  /**
   * Un solo golpe por tick con el mayor daño en contacto, si el jugador no es invulnerable.
   * Devuelve true si el golpe deja la vida en 0 (la partida termina en este tick).
   */
  private applyContact(n: number): boolean {
    const { x, y } = this.player.position;
    const damage = contactDamage(x, y, this.player.radius, this.enemies);
    if (damage === 0 || !this.player.canBeHitAt(n)) return false;
    this.player = this.player.hit(damage, n);
    if (!this.player.health.isDepleted) return false;
    this.state = 'over';
    return true;
  }

  /**
   * Compactación estable en el sitio (ADR-0006): O(n), sin asignar y conservando el orden de
   * aparición de los vivos. Cada muerto suelta su gema en su posición, en orden de la lista
   * (spec xp-gems); el muerto conserva posición y tipo hasta este pase.
   */
  private removeDead(): void {
    let w = 0;
    for (let r = 0; r < this.enemies.length; r++) {
      const e = this.enemies[r];
      if (!e) continue;
      if (e.alive) {
        if (w !== r) this.enemies[w] = e;
        w++;
      } else {
        this.gems.drop(e.x, e.y, e.type.xp);
      }
    }
    this.enemies.length = w;
  }

  /** Los enemigos nuevos van al final de la lista y no se mueven en el tick en que aparecen. */
  private readonly place: SpawnAttempt = (type) => {
    const at = placeSpawn(
      this.player.position,
      type.radius,
      this.rules.spawn,
      this.arena,
      this.random,
    );
    if (!at) return false;
    this.enemies.push(Enemy.spawn(this.nextEnemyId, type, at.x, at.y, this.arena));
    this.nextEnemyId += 1;
    return true;
  };

  /**
   * Copia congelada del estado (array y cada elemento): el adaptador puede leerla pero no alterar
   * la partida. Se llama una vez por frame, no por tick.
   */
  snapshot(): RunSnapshot {
    const { position, radius, health } = this.player;
    const k = this.tickCount;
    const flash = this.rules.loadout.hitFlashTicks;
    const enemies = this.enemies.map((e) => toEnemySnapshot(e, e.damagedAt(k, flash)));
    return Object.freeze({
      tick: this.tickCount,
      status: this.state,
      player: Object.freeze({
        x: position.x,
        y: position.y,
        radius,
        health: health.current,
        maxHealth: health.max,
        invulnerable: this.player.isInvulnerableAfter(k),
      }),
      enemies: Object.freeze(enemies),
      projectiles: Object.freeze(this.arsenal.projectiles.map(toProjectileSnapshot)),
      pulses: Object.freeze(this.arsenal.pulses.map(toPulseSnapshot)),
      weapons: Object.freeze(
        this.arsenal.weapons.map((w) => Object.freeze({ id: w.type.id, ready: w.isChargedAt(k) })),
      ),
      gems: Object.freeze(this.gems.gems.map((g) => toGemSnapshot(g, this.gems.radius))),
      progression: Object.freeze({
        level: this.experience.level,
        xp: this.experience.xp,
        xpToNext: this.experience.xpToNext,
        pendingLevelUps: this.experience.pendingLevelUps,
      }),
      offer: Object.freeze(this.offerSnapshot()),
      upgrades: Object.freeze(this.upgradeLevels()),
    });
  }

  private offerSnapshot(): OfferSnapshot[] {
    const { offer, offerIndices } = this.board;
    return offer.map((u, k) => {
      const level = this.board.levelOf(offerIndices[k] ?? -1);
      const { id, name, description } = u;
      return Object.freeze({ id, name, description, level, nextLevel: level + 1 });
    });
  }

  private upgradeLevels(): UpgradeLevelSnapshot[] {
    const out: UpgradeLevelSnapshot[] = [];
    this.rules.upgrades.upgrades.forEach((u, i) => {
      const level = this.board.levelOf(i);
      if (level >= 1) out.push(Object.freeze({ id: u.id, level }));
    });
    return out;
  }
}

function toEnemySnapshot(e: Enemy, damaged: boolean): EnemySnapshot {
  return Object.freeze({
    id: e.id,
    type: e.type.id,
    x: e.x,
    y: e.y,
    radius: e.radius,
    health: e.hp,
    damaged,
  });
}

function toGemSnapshot(g: XpGem, radius: number): GemSnapshot {
  return Object.freeze({ id: g.id, x: g.x, y: g.y, radius });
}

function toProjectileSnapshot(p: Projectile): ProjectileSnapshot {
  return Object.freeze({ id: p.id, x: p.x, y: p.y, radius: p.radius });
}

function toPulseSnapshot(e: PulseEcho): PulseSnapshot {
  return Object.freeze({
    weapon: e.weaponId,
    firedAt: e.firedAt,
    x: e.x,
    y: e.y,
    radius: e.radius,
  });
}
