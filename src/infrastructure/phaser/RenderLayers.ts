import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { AnimClock } from './art/animation';
import type { Looks } from './art/looks';
import { CorpseLayer } from './CorpseLayer';
import { EnemyLayer } from './EnemyLayer';
import { GemLayer } from './GemLayer';
import { PlayerView, type SpriteCount } from './PlayerView';
import { ProjectileLayer } from './ProjectileLayer';
import { PulseLayer, type RingSprite } from './PulseLayer';
import type { SpriteCounts } from './renderCounts';
import type { SpriteKit } from './SpriteLike';

/** Tamaño de los pools: el de la escena más el tope de cadáveres de los datos de aspecto. */
export interface LayerCapacity {
  readonly enemies: number;
  readonly projectiles: number;
  readonly pulses: number;
  readonly gems: number;
  readonly corpses: number;
  readonly visualTicks: ReadonlyMap<string, number>;
}

export interface RenderParts {
  readonly kit: SpriteKit;
  readonly ring: () => RingSprite;
  readonly looks: Looks;
  readonly capacity: LayerCapacity;
}

/**
 * Capas de la partida sobre el reloj de render (design "Flujo de un frame"), sin Phaser como valor.
 * El orden de creación es el de pintado: anillos, gemas, cadáveres, enemigos, proyectiles y jugador
 * (el suelo, debajo, lo crea la escena). Una baja (salida del snapshot) deja un cadáver; `clear()`
 * (R o Volver al menú) no.
 */
export class RenderLayers {
  readonly counts: SpriteCounts;
  private readonly clock = new AnimClock();
  private readonly pulses: PulseLayer;
  private readonly gems: GemLayer;
  private readonly corpses: CorpseLayer;
  private readonly enemies: EnemyLayer;
  private readonly projectiles: ProjectileLayer;
  private readonly player: PlayerView;
  private status: RunSnapshot['status'] = 'running';

  constructor(parts: RenderParts, ground: SpriteCount) {
    const { kit, looks, capacity } = parts;
    this.pulses = new PulseLayer(capacity.pulses, capacity.visualTicks, parts.ring);
    this.gems = new GemLayer(capacity.gems, kit, looks.gem);
    this.corpses = new CorpseLayer(capacity.corpses, kit, looks.corpse);
    this.enemies = new EnemyLayer(capacity.enemies, kit, looks.enemies, this.corpses);
    this.projectiles = new ProjectileLayer(capacity.projectiles, kit, looks.projectile);
    this.player = new PlayerView(kit, looks.player);
    this.counts = {
      ground,
      player: this.player.counts,
      enemies: this.enemies.counts,
      corpses: this.corpses.counts,
      projectiles: this.projectiles.counts,
      pulses: this.pulses.counts,
      gems: this.gems.counts,
      enemyPlaceholders: this.enemies.placeholdersByType,
    };
  }

  /**
   * Una vez por `update` del motor: avanza el reloj salvo con el mundo detenido (pausa, elección o
   * partida terminada, según el último snapshot pintado).
   */
  advance(deltaMs: number, paused: boolean): void {
    this.clock.advance(deltaMs, paused || this.status !== 'running');
  }

  render(snapshot: RunSnapshot): void {
    const ms = this.clock.ms;
    this.status = snapshot.status;
    this.pulses.sync(snapshot.pulses, snapshot.tick);
    this.gems.sync(snapshot.gems);
    this.enemies.sync(snapshot.enemies, snapshot.tick, ms);
    this.corpses.sync(ms);
    this.projectiles.sync(snapshot.projectiles);
    this.player.render(snapshot, ms);
  }

  /** Cambio de partida: vacía las capas sin cadáveres y el jugador no hereda nada. */
  clear(): void {
    this.enemies.clear();
    this.corpses.clear();
    this.projectiles.clear();
    this.pulses.clear();
    this.gems.clear();
    this.player.reset();
    this.status = 'running';
  }
}
