import type { Arena } from '../arena/Arena';
import { contactDamage } from '../collision/contact';
import type { Enemy } from '../enemy/Enemy';
import { Horde } from '../enemy/Horde';
import { GameMap } from '../map/GameMap';
import type { Player } from '../player/Player';
import type { PlayerInput } from '../player/PlayerInput';
import type { RandomGenerator } from '../shared/RandomGenerator';
import type { Experience } from '../progression/Experience';
import type { GemField } from '../progression/GemField';
import type { PlayerRules } from '../player/PlayerRules';
import { err, ok, type DomainError, type Result } from '../shared/Result';
import type { UpgradeChoiceError } from '../upgrade/UpgradeChoiceError';
import { maxHealthBonus, upgradedPlayer, upgradedWeapon } from '../upgrade/upgradeStats';
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
import { CHOOSING, LOST, RUNNING, WON, type RunOutcome, type RunPhase } from './RunPhase';
import {
  SETUP_HEALTH_OUT_OF_RANGE,
  SETUP_POSITION_MUST_BE_FINITE,
  initialState,
  type InitialState,
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
 * único removeDead() si hay bajas que suelta sus gemas → contacto con los vivos → victoria en el
 * tick de la duración objetivo → gemas y XP → director → apertura de oferta) y el consumo de azar
 * son fijos (armas, gemas, XP y fin de partida no consumen azar; la oferta sí); cambiarlos cambia
 * las partidas de una semilla.
 */
export class Run {
  private tickCount = 0;
  private phase: RunPhase = RUNNING;
  private readonly arena: Arena;
  private readonly map: GameMap;
  private readonly director: WaveDirector;
  private readonly arsenal: Arsenal;
  private player: Player;
  private readonly horde: Horde;
  private readonly gems: GemField;
  private readonly experience: Experience;
  private readonly board: UpgradeBoard;

  private constructor(
    private readonly rules: RunRules,
    private readonly random: RandomGenerator,
    initial: InitialState,
  ) {
    this.arena = rules.arena;
    this.map = GameMap.open(rules.map);
    this.player = initial.player;
    this.horde = new Horde(initial.enemies, rules.arena, initial.kills);
    this.gems = initial.gems;
    this.experience = initial.experience;
    this.board = initial.board;
    this.director = new WaveDirector(rules.table, rules.spawn, random);
    this.arsenal = new Arsenal(rules.loadout, rules.pulseCapacity);
    for (const w of rules.loadout.weapons) this.retune(w.id);
    const bonus = maxHealthBonus(rules.upgrades, this.board.levels);
    this.player = this.player.withRules(this.effectivePlayer(), bonus);
  }

  static start(
    config: RunConfig,
    random: RandomGenerator,
    setup: RunSetup = {},
  ): Result<Run, DomainError> {
    const rules = buildRunRules(config);
    if (!rules.ok) return rules;
    const initial = initialState(rules.value, setup);
    if (!initial.ok) return initial;
    return ok(new Run(rules.value, random, initial.value));
  }

  /** Estado de la partida (lectura barata, sin snapshot). */
  get status(): RunStatus {
    return this.phase.status;
  }

  /** Resultado: definido si y solo si la partida está terminada (spec run-outcome). */
  get outcome(): RunOutcome | null {
    return this.phase.outcome;
  }

  /**
   * Elige la opción `index` de la oferta abierta (spec upgrades): sube su nivel, aplica su efecto
   * (rige desde el siguiente tick), cierra la oferta y abre la siguiente encolada sin ejecutar
   * ticks; si no queda ninguna, la partida vuelve a en curso. Sin oferta o con un índice que no es
   * un entero en [0, k − 1] devuelve un error y no cambia nada (ni consume azar).
   */
  chooseUpgrade(index: number): Result<void, UpgradeChoiceError> {
    if (this.phase.status !== 'choosing') return err({ code: 'no-offer' });
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
    this.phase = RUNNING;
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
   * El tick de la muerte o de la victoria cuenta, pero sin gemas ni director (spec run-outcome).
   */
  tick(input: PlayerInput): void {
    if (this.phase.status !== 'running') return;
    const n = this.tickCount + 1;
    this.player = this.player.move(input, TICK_SECONDS, this.arena, this.map);
    const { x, y } = this.player.position;
    this.horde.chase(x, y, TICK_SECONDS);
    if (this.arsenal.step(n, x, y, this.horde.alive) > 0) this.horde.removeDead(this.dropGem);
    if (this.applyContact(n) || this.reachedEnd(n)) {
      this.tickCount = n;
      return;
    }
    const xp = this.gems.step(x, y, this.player.radius, this.player.pickupRadius);
    if (xp > 0) this.experience.gain(xp);
    this.director.step(n, this.horde.alive.length, this.place);
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
      this.phase = CHOOSING;
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
    const damage = contactDamage(x, y, this.player.radius, this.horde.alive);
    if (damage === 0 || !this.player.canBeHitAt(n)) return false;
    this.player = this.player.hit(damage, n);
    if (!this.player.health.isDepleted) return false;
    this.phase = LOST;
    return true;
  }

  /**
   * Victoria (spec run-outcome): si el jugador sigue vivo tras el contacto del tick de la duración
   * objetivo, la partida termina con victoria y el tick acaba aquí, como el de la muerte.
   */
  private reachedEnd(n: number): boolean {
    if (!this.rules.duration.endsAt(n)) return false;
    this.phase = WON;
    return true;
  }

  /**
   * Cada muerto suelta su gema en su posición, en orden de la lista (spec xp-gems). Se crea una
   * sola vez: no asigna por tick.
   */
  private readonly dropGem = (dead: Enemy): void => {
    this.gems.drop(dead.x, dead.y, dead.type.xp);
  };

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
    this.horde.spawn(type, at.x, at.y);
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
    const enemies = this.horde.alive.map((e) => toEnemySnapshot(e, e.damagedAt(k, flash)));
    return Object.freeze({
      tick: this.tickCount,
      ...this.phase,
      durationTicks: this.rules.duration.ticks,
      kills: this.horde.kills,
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
