import type { Arena } from '../arena/Arena';
import { contactDamage } from '../collision/contact';
import type { Enemy } from '../enemy/Enemy';
import { Horde } from '../enemy/Horde';
import { HazardField } from '../hazard/HazardField';
import { FlowField } from '../map/FlowField';
import type { GameMap } from '../map/GameMap';
import { toMapSnapshot, type MapSnapshot } from '../map/MapSnapshot';
import { OPEN_TERRAIN, resolveTerrain, type TerrainSource } from '../map/TerrainSource';
import { resolveStructures } from '../structure/resolveStructures';
import { resolveSheep } from '../sheep/resolveSheep';
import type { Flock } from '../sheep/Flock';
import type { Sheep } from '../sheep/Sheep';
import { StructureField } from '../structure/StructureField';
import type { Structure } from '../structure/Structure';
import type { StructureSite } from '../structure/StructureSite';
import type { Player } from '../player/Player';
import type { PlayerInput } from '../player/PlayerInput';
import type { RandomGenerator } from '../shared/RandomGenerator';
import type { Experience } from '../progression/Experience';
import { PickupGain, type PickupField } from '../pickup/PickupField';
import type { Stockpile } from '../resource/Stockpile';
import type { GoldVein } from '../resource/GoldVein';
import { resolveResources, type ResourceSites } from '../resource/resolveResources';
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
  toBlastSnapshot,
  toDynamiteSnapshot,
  toEnemySnapshot,
  toPickupSnapshots,
  toVeinSnapshot,
  toOfferSnapshot,
  toProgressionSnapshot,
  toProjectileSnapshot,
  toStructureSnapshot,
  toPulseSnapshot,
  toSheepSnapshot,
  toUpgradeLevels,
  toWarnings,
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
 * simulación. Contrato de determinismo (spec simulation-loop, "Orden de los pasos del tick"): el
 * orden del tick (1 jugador y, tras él, ovejas en orden de lista: huida o pasto/paseo (ADR-0022) →
 * 2 comportamiento en orden de lista: esperas que terminan, persecución
 * y alerta por el campo de flujo hacia la celda del jugador, patrulla y vuelta hacia su punto fijo, y
 * transiciones tras moverse → 3 armas (estructuras como reserva sin enemigos en el criterio y ovejas
 * sin estructuras) y, si hay bajas, removeDead() con sus gemas, después las estructuras a vida 0
 * quedan destruidas (su oro) y las ovejas a vida 0 mueren (su carne; se encola su reaparición) →
 * 4 peligros (ADR-0019): explosiones caducadas, barriles cuya mecha termina (marcados todos antes,
 * sin dañarse a sí mismos) y dinamitas que llegan, en ese orden, que dañan también a las ovejas,
 * otro removeDead() y las ovejas muertas, y lanzamientos en
 * orden de lista bajo el tope → 5 un solo golpe al jugador, el mayor entre contactos de tipos con
 * daño y explosiones que le alcanzan → victoria en el tick de la duración objetivo → recogibles (XP,
 * oro, madera y la carne, que cura) y vetas → director → nacimiento de guardias en las casas, en
 * orden de lista (ADR-0020) → reaparición de ovejas en orden de cola → apertura de oferta)
 * y el consumo de azar son fijos (colisión con el mapa, campo, línea libre, navegación,
 * comportamientos, peligros, estructuras, nacimientos, recolocación de apariciones, armas, gemas, XP
 * y fin de partida no consumen azar; la oferta y cada intento de aparición sí); cambiarlos cambia las
 * partidas de una semilla. El mapa es parte del estado inicial y sale de un flujo de azar propio
 * (ADR-0013), y sus casas y torres de otro (ADR-0020); no cambia durante la partida. Las ovejas
 * consumen solo su flujo (ADR-0022), en este orden: colocación (1 valor por oveja), primer pasto (1 por
 * oveja colocada), y en partida 1 por paseo aleatorio (paso 1) y 1 por reaparición con candidatas
 * (paso 9.2); nunca el azar de la partida. La navegación
 * (ADR-0017): BFS 4-vecina con orden izquierda, derecha, arriba, abajo, campo solo función de (mapa,
 * celda del jugador) y empates por ese orden.
 */
export class Run {
  private tickCount = 0;
  private phase: RunPhase = RUNNING;
  private readonly arena: Arena;
  private readonly director: WaveDirector;
  private readonly arsenal: Arsenal;
  private player: Player;
  private readonly horde: Horde;
  private readonly pickups: PickupField;
  /** Lo recogido en el paso 7.1 (reutilizado: sin asignar por tick). */
  private readonly gain = new PickupGain();
  private readonly stock: Stockpile;
  private readonly experience: Experience;
  private readonly board: UpgradeBoard;
  private readonly mapView: MapSnapshot;
  private readonly field: FlowField;
  private readonly hazards: HazardField;
  private readonly structures: StructureField;
  /** Vetas en su orden fijo (ADR-0021): ni se crean ni se retiran durante la partida. */
  private readonly veins: readonly GoldVein[];
  /** Ovejas neutrales (ADR-0022): fuera de `Horde`, del director y de las bajas. */
  private readonly flock: Flock;

  private constructor(
    private readonly rules: RunRules,
    private readonly random: RandomGenerator,
    private readonly terrain: GameMap,
    initial: InitialState,
    sites: readonly StructureSite[],
    resources: ResourceSites,
  ) {
    this.arena = rules.arena;
    this.mapView = toMapSnapshot(
      terrain,
      sites.map((s) => ({ ...s, type: s.type.id })),
      { ...resources, veinRadius: rules.resources.goldVeins.radius },
    );
    this.field = new FlowField(terrain);
    this.player = initial.player;
    this.horde = new Horde(initial.enemies, rules.arena, initial.kills);
    this.pickups = initial.pickups;
    this.stock = initial.stock;
    this.experience = initial.experience;
    this.board = initial.board;
    this.director = new WaveDirector(rules.table, rules.spawn, random);
    this.arsenal = new Arsenal(rules.loadout, rules.pulseCapacity);
    this.hazards = new HazardField(rules.hazards, initial.dynamites);
    this.structures = new StructureField(initial.structures);
    this.veins = initial.veins;
    this.flock = initial.flock;
    for (const w of rules.loadout.weapons) this.retune(w.id);
    const bonus = maxHealthBonus(rules.upgrades, this.board.levels);
    this.player = this.player.withRules(this.effectivePlayer(), bonus);
    if (initial.playerHealth !== null) this.player = this.player.withHealth(initial.playerHealth);
  }

  /**
   * Crea una partida. `random` es el azar de la partida (oleadas y ofertas); el mapa sale de
   * `terrain`, que si se genera trae su propio generador (ADR-0013): generar el mapa no consume
   * `random`. Sin `terrain`, el mapa vacío (escenarios sin mapa declarado).
   */
  static start(
    config: RunConfig,
    random: RandomGenerator,
    setup: RunSetup = {},
    terrain: TerrainSource = OPEN_TERRAIN,
  ): Result<Run, DomainError> {
    const rules = buildRunRules(config);
    if (!rules.ok) return rules;
    const map = resolveTerrain(terrain, rules.value.map);
    if (!map.ok) return map;
    const sites = resolveStructures(terrain, map.value, rules.value.structures);
    if (!sites.ok) return sites;
    const resources = resolveResources(terrain, map.value, rules.value.resources, sites.value);
    if (!resources.ok) return resources;
    const { veins, woodPiles } = resources.value;
    const sheep = resolveSheep(terrain, map.value, rules.value.sheep, sites.value);
    if (!sheep.ok) return sheep;
    const initial = initialState(
      rules.value,
      setup,
      map.value,
      sites.value,
      woodPiles,
      veins,
      sheep.value,
    );
    if (!initial.ok) return initial;
    return ok(new Run(rules.value, random, map.value, initial.value, sites.value, resources.value));
  }

  /** Mapa de la partida (spec procedural-map): la misma vista congelada durante toda la partida. */
  get map(): MapSnapshot {
    return this.mapView;
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
    this.player = this.player.move(input, TICK_SECONDS, this.arena, this.terrain);
    const { x, y } = this.player.position;
    this.flock.step(n, x, y, this.terrain, this.arena);
    this.field.retarget(this.terrain.colAt(x), this.terrain.rowAt(y));
    this.horde.act(n, x, y, TICK_SECONDS, this.field);
    const { horde, structures, flock } = this;
    if (this.arsenal.step(n, x, y, horde.alive, structures.all, flock.all) > 0) {
      horde.removeDead(this.onDeath);
    }
    structures.settle(this.onRuin);
    flock.settle(n, this.onSheepDeath);
    this.stepHazards(n, x, y);
    if (this.applyHit(n) || this.reachedEnd(n)) {
      this.tickCount = n;
      return;
    }
    this.collect(x, y);
    this.director.step(n, horde.alive.length, this.place);
    structures.spawnGuards(n, horde, this.rules.spawn.maxAlive);
    this.flock.respawn(n, x, y);
    this.tickCount = n;
    this.openNextOffer();
  }

  /**
   * Paso 7 (spec simulation-loop): 7.1 recogibles de los cuatro tipos en una pasada, en orden de
   * creación; la XP sube de nivel, el oro y la madera van a sus contadores y la carne cura; 7.2 vetas en el orden
   * de su lista: cada una activa en contacto suma su oro y queda agotada.
   */
  private collect(x: number, y: number): void {
    const { gain } = this;
    this.pickups.step(x, y, this.player.radius, this.player.pickupRadius, gain);
    if (gain.xp > 0) this.experience.gain(gain.xp);
    this.stock.add(gain.gold, gain.wood);
    if (gain.meat > 0) this.heal(gain.meat);
    for (const v of this.veins) this.stock.add(v.tap(x, y, this.player.radius), 0);
  }

  /**
   * Curación por carne (spec player-health 0023): `valor × max(1, ⌊% × máx / 100⌋)` con la vida
   * máxima efectiva de este momento y tope en ella. Sumar las piezas del paso y curar una vez es lo
   * mismo que curar pieza a pieza (el tope es monótono). No consume azar.
   */
  private heal(meat: number): void {
    const max = this.player.health.max;
    const perUnit = Math.max(1, Math.floor((this.rules.resources.meat.healPercent * max) / 100));
    this.player = this.player.heal(meat * perUnit);
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
   * Paso 4 (spec simulation-loop): explosiones caducadas, explosiones del tick (barriles y luego
   * dinamitas), bajas con su gema tras las de las armas y lanzamientos con el jugador ya movido.
   */
  private stepHazards(n: number, x: number, y: number): void {
    const { hazards, horde, flock } = this;
    hazards.expire(n);
    if (hazards.explode(n, horde.alive, flock.all, x, y, this.player.radius)) {
      horde.removeDead(this.onDeath);
    }
    flock.settle(n, this.onSheepDeath);
    hazards.launch(n, horde.alive, x, y);
  }

  /**
   * Un solo golpe por tick con el mayor daño entre los contactos (tipos con daño por contacto) y
   * las explosiones del paso 4 que alcanzan al jugador, si no es invulnerable (spec player-health).
   * Devuelve true si el golpe deja la vida en 0 (la partida termina en este tick).
   */
  private applyHit(n: number): boolean {
    const { x, y } = this.player.position;
    const contact = contactDamage(x, y, this.player.radius, this.horde.alive);
    const damage = Math.max(contact, this.hazards.playerHit);
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
   * Cada muerto suelta su gema en su posición, en orden de la lista (spec xp-gems), y después su
   * madera si su tipo la suelta y no ha explotado por su mecha (spec enemy-hazards 0022); un
   * guardia deja libre su hueco en el tope de su casa. Se crea una sola vez: no asigna por tick.
   */
  private readonly onDeath = (dead: Enemy): void => {
    const { x, y, type } = dead;
    this.pickups.drop('xp', x, y, type.xp);
    const wood = dead.detonated ? 0 : this.rules.resources.woodFor(type.id);
    if (wood > 0) this.pickups.drop('wood', x, y, wood);
    dead.post?.release();
  };

  /** Una estructura que queda en ruina suelta su oro en su posición (spec goblin-structures). */
  private readonly onRuin = (ruin: Structure): void => {
    const gold = this.rules.resources.goldFor(ruin.site.type.id);
    if (gold > 0) this.pickups.drop('gold', ruin.x, ruin.y, gold);
  };

  /** Una oveja muerta suelta su carne en su posición (spec resources 0023), sin gema ni baja. */
  private readonly onSheepDeath = (dead: Sheep): void => {
    this.pickups.drop('meat', dead.x, dead.y, this.rules.resources.meat.perSheep);
  };

  /** Los enemigos nuevos van al final de la lista y no se mueven en el tick en que aparecen. */
  private readonly place: SpawnAttempt = (type) => {
    const at = placeSpawn(
      this.player.position,
      type.radius,
      this.rules.spawn,
      this.arena,
      this.terrain,
      this.random,
    );
    if (!at) return false;
    this.horde.spawn(type, at.x, at.y, this.tickCount + 1);
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
    const { pickups, gems } = toPickupSnapshots(this.pickups.pickups, this.pickups.radius);
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
      sheep: Object.freeze(this.flock.all.map((o) => toSheepSnapshot(o, o.damagedAt(k, flash)))),
      projectiles: Object.freeze(this.arsenal.projectiles.map(toProjectileSnapshot)),
      pulses: Object.freeze(this.arsenal.pulses.map(toPulseSnapshot)),
      dynamites: Object.freeze(
        this.hazards.dynamites.map((d) =>
          toDynamiteSnapshot(d, k, this.rules.hazards.dynamiteRadius),
        ),
      ),
      warnings: toWarnings(this.horde.alive, this.hazards.dynamites),
      blasts: Object.freeze(this.hazards.blasts.map(toBlastSnapshot)),
      structures: Object.freeze(this.structures.all.map(toStructureSnapshot)),
      weapons: Object.freeze(
        this.arsenal.weapons.map((w) => Object.freeze({ id: w.type.id, ready: w.isChargedAt(k) })),
      ),
      pickups,
      gems,
      resources: Object.freeze({ gold: this.stock.gold, wood: this.stock.wood }),
      veins: Object.freeze(this.veins.map(toVeinSnapshot)),
      progression: toProgressionSnapshot(this.experience),
      offer: toOfferSnapshot(this.board),
      upgrades: toUpgradeLevels(this.rules.upgrades, this.board),
    });
  }
}
