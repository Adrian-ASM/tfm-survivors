import type { Arena } from '../arena/Arena';
import { contactDamage } from '../collision/contact';
import { Enemy } from '../enemy/Enemy';
import type { Player } from '../player/Player';
import type { PlayerInput } from '../player/PlayerInput';
import type { RandomGenerator } from '../shared/RandomGenerator';
import type { Experience } from '../progression/Experience';
import type { GemField } from '../progression/GemField';
import type { PlayerRules } from '../player/PlayerRules';
import { err, ok, type DomainError, type Result } from '../shared/Result';
import type { UpgradeChoiceError } from '../upgrade/UpgradeChoiceError';
import { upgradedPlayer, upgradedWeapon } from '../upgrade/upgradeStats';
import { WeaponType } from '../weapon/WeaponType';
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
import type { UpgradeBoard } from '../upgrade/UpgradeBoard';
import type { RunSnapshot } from './RunSnapshot';
import {
  toEnemySnapshot,
  toGemSnapshot,
  toOfferSnapshot,
  toProgressionSnapshot,
  toProjectileSnapshot,
  toPulseSnapshot,
  toUpgradeLevels,
} from './snapshotParts';
import type { RunStatus } from './RunStatus';
import {
  SETUP_HEALTH_OUT_OF_RANGE,
  SETUP_POSITION_MUST_BE_FINITE,
  initialEnemies,
  initialExperience,
  initialBoard,
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
  private player: Player;
  private readonly enemies: Enemy[];
  private readonly gems: GemField;
  private readonly experience: Experience;
  private readonly board: UpgradeBoard;

  private constructor(
    private readonly rules: RunRules,
    private readonly random: RandomGenerator,
    initial: InitialState,
  ) {
    this.arena = rules.arena;
    this.player = initial.player;
    this.enemies = initial.enemies;
    this.gems = initial.gems;
    this.experience = initial.experience;
    this.board = initial.board;
    this.nextEnemyId = this.enemies.length;
    this.director = new WaveDirector(rules.table, rules.spawn, random);
    this.arsenal = new Arsenal(rules.loadout, rules.pulseCapacity);
    for (const w of rules.loadout.weapons) this.retune(w.id);
    this.player = this.player.withRules(this.effectivePlayer(), maxHealthBonus(rules, this.board));
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
    const board = initialBoard(rules.value, setup);
    if (!board.ok) return board;
    return ok(
      new Run(rules.value, random, {
        player: player.value,
        enemies: enemies.value,
        gems: gems.value,
        experience: experience.value,
        board: board.value,
      }),
    );
  }

  /** Estado de la partida (lectura barata, sin snapshot). */
  get status(): RunStatus {
    return this.state;
  }

  /**
   * Elige la opción `index` de la oferta abierta (spec upgrades): sube su nivel, aplica su efecto
   * (rige desde el siguiente tick), cierra la oferta y abre la siguiente encolada sin ejecutar
   * ticks; si no queda ninguna, la partida vuelve a en curso. Sin oferta o con un índice que no es
   * un entero en [0, k − 1] devuelve un error y no cambia nada (ni consume azar).
   */
  chooseUpgrade(index: number): Result<void, UpgradeChoiceError> {
    if (this.state !== 'choosing') return err({ code: 'no-offer' });
    const picked = this.board.pick(index);
    if (!picked.ok) return picked;
    const { target, stat, perLevel } = picked.value;
    if (target.kind === 'weapon') {
      this.retune(target.weapon);
    } else {
      this.player = this.player.withRules(
        this.effectivePlayer(),
        stat === 'maxHealth' ? perLevel : 0,
      );
    }
    this.experience.resolveOne();
    this.state = 'running';
    this.openNextOffer();
    return ok(undefined);
  }

  /** Reglas efectivas del jugador desde la base de contenido (ADR-0008). */
  private effectivePlayer(): PlayerRules {
    return upgradedPlayer(this.rules.player, this.rules.upgrades, this.board.levels);
  }

  /**
   * Tipo efectivo de un arma desde la base. La build de peor caso ya validó cualquier combinación
   * alcanzable, así que un fallo aquí es un error de programación.
   */
  private retune(weaponId: string): void {
    const base = this.rules.loadout.weapons.find((w) => w.id === weaponId);
    if (!base) throw new Error(`Invariante rota: arma desconocida ${weaponId}`);
    const config = upgradedWeapon(base, this.rules.upgrades, this.board.levels);
    const type = WeaponType.create(config, weaponId);
    if (!type.ok) throw new Error(`Invariante rota: ${type.error.message}`);
    this.arsenal.retune(weaponId, type.value);
  }

  /**
   * Tick n = tickCount + 1 (el que mostrará el snapshot). Con la partida terminada o eligiendo
   * mejora no hace nada: ni pasos, ni azar, ni contador (spec run-state).
   * El tick de la muerte cuenta, pero el director no actúa en él (spec run-state).
   */
  tick(input: PlayerInput): void {
    if (this.state !== 'running') return;
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
      progression: toProgressionSnapshot(this.experience),
      offer: toOfferSnapshot(this.board),
      upgrades: toUpgradeLevels(this.rules.upgrades, this.board),
    });
  }
}

interface InitialState {
  readonly player: Player;
  readonly enemies: Enemy[];
  readonly gems: GemField;
  readonly experience: Experience;
  readonly board: UpgradeBoard;
}

/** Vida máxima que suman las mejoras de `maxHealth` con los niveles actuales. */
function maxHealthBonus(rules: RunRules, board: UpgradeBoard): number {
  return rules.upgrades.upgrades.reduce(
    (sum, u, i) => (u.stat === 'maxHealth' ? sum + u.perLevel * board.levelOf(i) : sum),
    0,
  );
}
