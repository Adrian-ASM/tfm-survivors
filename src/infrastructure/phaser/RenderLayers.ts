import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { AnimClock, frameAt, type AnimSpec } from './art/animation';
import type { Looks } from './art/looks';
import { CorpseLayer } from './CorpseLayer';
import { EnemyLayer } from './EnemyLayer';
import { GemLayer } from './GemLayer';
import { PlayerView, type SpriteCount } from './PlayerView';
import { ProjectileLayer } from './ProjectileLayer';
import { PulseLayer, type RingSprite } from './PulseLayer';
import type { SpriteCounts } from './renderCounts';
import type { SpriteKit } from './SpriteLike';
import type { MapArtPlan } from './map/planMapArt';
import { paintMapArt, zeroCells, zeroMapArt, type MapArtCanvas } from './TerrainView';

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
  /** Lienzo y animación de la espuma del mapa pintado (0016), y último frame aplicado. */
  private foamCanvas: MapArtCanvas | null = null;
  private foamAnim: AnimSpec | null = null;
  private foamFrame = -1;

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
      cells: zeroCells(),
      mapArt: zeroMapArt(),
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
    this.animateFoam(ms);
  }

  /** Espuma del mapa en bucle con el reloj de render: `setFrame` solo cuando cambia (0016). */
  private animateFoam(ms: number): void {
    if (!this.foamCanvas || !this.foamAnim) return;
    const frame = frameAt(this.foamAnim, ms);
    if (frame === this.foamFrame) return;
    this.foamFrame = frame;
    this.foamCanvas.foam(frame);
  }

  /**
   * Pinta el plan del mapa de la partida (al crearla y tras R; 0015, arte desde 0016) y guarda las
   * celdas y los elementos pintados para la sonda. Una vez por partida, no por frame.
   */
  paintMap(canvas: MapArtCanvas, plan: MapArtPlan): void {
    const painted = paintMapArt(canvas, plan);
    Object.assign(this.counts.cells, painted.cells);
    const { mapArt } = this.counts;
    for (const key of ['water', 'shore', 'foam', 'tree', 'canopy', 'bridge', 'castle'] as const) {
      mapArt[key] = { ...painted.mapArt[key] };
    }
    mapArt.objects = painted.mapArt.objects;
    this.foamCanvas = canvas;
    this.foamAnim = plan.foam ? { frames: plan.foam.frames, fps: plan.foam.fps, loop: true } : null;
    this.foamFrame = -1;
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
