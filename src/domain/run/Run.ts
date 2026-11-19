import type { Arena } from '../arena/Arena';
import { Enemy } from '../enemy/Enemy';
import type { EnemyCatalog } from '../enemy/EnemyCatalog';
import { Player } from '../player/Player';
import type { PlayerInput } from '../player/PlayerInput';
import type { RandomGenerator } from '../shared/RandomGenerator';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { TICK_SECONDS } from '../shared/Tick';
import { Vector2 } from '../shared/Vector2';
import { WaveDirector, type SpawnAttempt } from '../wave/WaveDirector';
import { UNKNOWN_ENEMY_TYPE } from '../wave/WaveTable';
import { placeSpawn } from '../wave/placeSpawn';
import {
  RADIUS_MUST_FIT,
  SPEED_MUST_BE_POSITIVE,
  buildRunRules,
  type RunConfig,
  type RunRules,
} from './RunConfig';
import type { EnemySnapshot, RunSnapshot } from './RunSnapshot';

export { TICK_SECONDS, RADIUS_MUST_FIT, SPEED_MUST_BE_POSITIVE, type RunConfig };

export const SETUP_POSITION_MUST_BE_FINITE = 'La posición inicial debe ser finita.';

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Estado inicial opcional (tests y futuros editores; la composición no lo usa): posición del
 * jugador y enemigos ya presentes. Los tipos se validan contra el catálogo y las posiciones se
 * recortan a la arena.
 */
export interface RunSetup {
  readonly player?: Point;
  readonly enemies?: readonly (Point & { readonly type: string })[];
}

const isFinitePoint = (p: Point): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

function initialPlayer(rules: RunRules, setup: RunSetup): Result<Player, DomainError> {
  const { arena, player } = rules;
  const at = setup.player;
  if (at && !isFinitePoint(at)) {
    return err(invalidConfig('setup.player', SETUP_POSITION_MUST_BE_FINITE));
  }
  const position = at ? arena.clampCircle(Vector2.of(at.x, at.y), player.radius) : arena.center;
  return ok(Player.spawn(position, player.radius, player.speed));
}

function initialEnemies(
  setup: RunSetup,
  catalog: EnemyCatalog,
  arena: Arena,
): Result<Enemy[], DomainError> {
  const enemies: Enemy[] = [];
  for (const [i, entry] of (setup.enemies ?? []).entries()) {
    const path = `setup.enemies.${String(i)}`;
    const type = catalog.get(entry.type);
    if (!type) return err(invalidConfig(`${path}.type`, `${UNKNOWN_ENEMY_TYPE}: ${entry.type}`));
    if (!isFinitePoint(entry)) return err(invalidConfig(path, SETUP_POSITION_MUST_BE_FINITE));
    enemies.push(Enemy.spawn(i, type, entry.x, entry.y, arena));
  }
  return ok(enemies);
}

/**
 * Partida en curso (aggregate root). Único punto de entrada para cambiar el estado de la
 * simulación. Contrato de determinismo: el orden del tick (jugador → persecución → director) y el
 * consumo de azar son fijos; cambiarlos cambia las partidas de una semilla.
 */
export class Run {
  private tickCount = 0;
  private nextEnemyId: number;
  private readonly arena: Arena;
  private readonly director: WaveDirector;

  private constructor(
    private readonly rules: RunRules,
    private readonly random: RandomGenerator,
    private player: Player,
    private readonly enemies: Enemy[],
  ) {
    this.arena = rules.arena;
    this.nextEnemyId = enemies.length;
    this.director = new WaveDirector(rules.table, rules.spawn, random);
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
    return ok(new Run(rules.value, random, player.value, enemies.value));
  }

  tick(input: PlayerInput): void {
    this.player = this.player.move(input, TICK_SECONDS, this.arena);
    const { x, y } = this.player.position;
    for (const enemy of this.enemies) enemy.chase(x, y, TICK_SECONDS, this.arena);
    this.director.step(this.tickCount + 1, this.enemies.length, this.place);
    this.tickCount += 1;
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
    const { position, radius } = this.player;
    return Object.freeze({
      tick: this.tickCount,
      player: Object.freeze({ x: position.x, y: position.y, radius }),
      enemies: Object.freeze(this.enemies.map(toSnapshot)),
    });
  }
}

function toSnapshot(e: Enemy): EnemySnapshot {
  return Object.freeze({ id: e.id, type: e.type.id, x: e.x, y: e.y, radius: e.radius });
}
