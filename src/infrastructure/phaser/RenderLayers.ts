import type { RunSnapshot, VeinSnapshot } from '../../domain/run/RunSnapshot';
import { AnimClock, frameAt, type AnimSpec } from './art/animation';
import type { Looks } from './art/looks';
import { CorpseLayer } from './CorpseLayer';
import { EnemyLayer } from './EnemyLayer';
import { PickupLayer } from './PickupLayer';
import { SheepLayer } from './SheepLayer';
import { HazardLayer, type HazardCapacity, type WarningCanvas } from './HazardLayer';
import { PlayerView, type SpriteCount } from './PlayerView';
import { ProjectileLayer } from './ProjectileLayer';
import { PulseLayer, type RingSprite } from './PulseLayer';
import { VEIN_KEY, veinCounts, type SpriteCounts } from './renderCounts';
import type { SpriteKit } from './SpriteLike';
import { MapCuller } from './map/mapCulling';
import type { Box, MapArtPlan } from './map/planMapArt';
import { paintMapArt, zeroCells, zeroMapArt, type MapArtCanvas } from './TerrainView';
import { StructureArt } from './StructureArt';

/** Tamaño de los pools: el de la escena más el tope de cadáveres de los datos de aspecto. */
export interface LayerCapacity {
  readonly enemies: number;
  readonly projectiles: number;
  readonly pulses: number;
  /** Recogibles de los cuatro tipos: la suma de los topes (0022, 0023). */
  readonly pickups: number;
  /** Ovejas vivas como mucho (tope del contenido, 0023); 0 por defecto. */
  readonly sheep?: number;
  readonly corpses: number;
  readonly visualTicks: ReadonlyMap<string, number>;
  /** Tope de dinamitas del contenido y de explosiones pintadas de los datos de aspecto (0020). */
  readonly hazards: HazardCapacity;
}

export interface RenderParts {
  readonly kit: SpriteKit;
  readonly ring: () => RingSprite;
  /** `Graphics` de los avisos (se crea al crear la capa de peligros, tras la capa alta del mapa). */
  readonly warnings: () => WarningCanvas;
  readonly looks: Looks;
  readonly capacity: LayerCapacity;
  /** Tipos de estructura del contenido (0021): claves de `sprites.structures`, también a 0. */
  readonly structureTypes?: readonly string[];
}

/**
 * Capas de la partida sobre el reloj de render (design "Flujo de un frame"), sin Phaser como valor.
 * El orden de creación es el de pintado: anillos, recogibles, ovejas (0023), cadáveres, enemigos,
 * proyectiles y jugador
 * (el suelo, debajo, lo crea la escena). Una baja (salida del snapshot) deja un cadáver; `clear()`
 * (R o Volver al menú) no.
 */
export class RenderLayers {
  readonly counts: SpriteCounts;
  private readonly clock = new AnimClock();
  private readonly pulses: PulseLayer;
  private readonly pickups: PickupLayer;
  /** Ovejas (0023): sobre los recogibles y bajo jugador y enemigos (capa 6 de sprite-rendering). */
  private readonly sheep: SheepLayer;
  private readonly corpses: CorpseLayer;
  private readonly enemies: EnemyLayer;
  private readonly projectiles: ProjectileLayer;
  private readonly player: PlayerView;
  /** Capa de peligros (0020): se crea después de la capa alta del mapa con `createHazards`. */
  private hazards: HazardLayer | null = null;
  private readonly parts: RenderParts;
  private status: RunSnapshot['status'] = 'running';
  /** Lienzo del mapa pintado, animación de la espuma (0016) y último frame aplicado. */
  private mapCanvas: MapArtCanvas | null = null;
  /** Recorte por cámara del mapa pintado (0018). */
  private readonly culler = new MapCuller();
  /** Aspecto vigente (intacto o ruina) de cada estructura del mapa pintado (0021). */
  private readonly structureArt: StructureArt;
  /** Aspecto vigente (activa o agotada) de cada veta del mapa pintado (0022). */
  private readonly veinArt = new StructureArt<VeinSnapshot>([VEIN_KEY], (v) => v.depleted);
  private foamAnim: AnimSpec | null = null;
  private foamFrame = -1;

  constructor(parts: RenderParts, ground: SpriteCount) {
    const { kit, looks, capacity } = parts;
    this.parts = parts;
    this.pulses = new PulseLayer(capacity.pulses, capacity.visualTicks, parts.ring);
    this.pickups = new PickupLayer(capacity.pickups, kit, looks.pickups);
    this.sheep = new SheepLayer(capacity.sheep ?? 0, kit, looks.sheep);
    this.corpses = new CorpseLayer(capacity.corpses, kit, looks.corpse);
    this.enemies = new EnemyLayer(capacity.enemies, kit, looks.enemies, this.corpses);
    this.projectiles = new ProjectileLayer(capacity.projectiles, kit, looks.projectile);
    this.player = new PlayerView(kit, looks.player);
    this.structureArt = new StructureArt(parts.structureTypes ?? []);
    this.counts = {
      ground,
      player: this.player.counts,
      enemies: this.enemies.counts,
      corpses: this.corpses.counts,
      projectiles: this.projectiles.counts,
      pulses: this.pulses.counts,
      pickups: this.pickups.counts,
      gems: this.pickups.counts.xp,
      sheep: this.sheep.counts,
      enemyPlaceholders: this.enemies.placeholdersByType,
      enemyStates: this.enemies.states,
      warnings: { visible: 0, placeholder: 0 },
      dynamites: { visible: 0, placeholder: 0 },
      explosions: { visible: 0, placeholder: 0 },
      cells: zeroCells(),
      mapArt: zeroMapArt(),
      structures: this.structureArt.counts,
      veins: veinCounts(this.veinArt.counts[VEIN_KEY]),
    };
  }

  /**
   * Crea la capa de peligros (capa 8 de sprite-rendering): avisos, dinamitas y explosiones, en ese
   * orden, encima de la capa alta del mapa y debajo del HUD porque se crea entre ambos. Una vez.
   */
  createHazards(): void {
    if (this.hazards) return;
    const { kit, looks, capacity, warnings } = this.parts;
    const layer = new HazardLayer(kit, warnings(), looks, capacity.hazards);
    this.hazards = layer;
    Object.assign(this.counts, {
      warnings: layer.counts.warnings,
      dynamites: layer.counts.dynamites,
      explosions: layer.counts.explosions,
    });
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
    this.pickups.sync(snapshot.pickups);
    this.sheep.sync(snapshot.sheep, snapshot.tick, ms);
    this.enemies.sync(snapshot.enemies, snapshot.tick, ms);
    this.corpses.sync(ms);
    this.projectiles.sync(snapshot.projectiles);
    this.player.render(snapshot, ms);
    this.hazards?.sync(snapshot.warnings, snapshot.dynamites, snapshot.blasts, ms);
    // Antes del recorte del frame (`cullMap`): la ruina se ve desde el frame en que figura destruida.
    this.structureArt.sync(snapshot.structures);
    this.veinArt.sync(snapshot.veins);
    this.animateFoam(ms);
  }

  /** Espuma del mapa en bucle con el reloj de render: `setFrame` solo cuando cambia (0016). */
  private animateFoam(ms: number): void {
    if (!this.mapCanvas || !this.foamAnim) return;
    const frame = frameAt(this.foamAnim, ms);
    if (frame === this.foamFrame) return;
    this.foamFrame = frame;
    this.mapCanvas.foam(frame);
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
    this.mapCanvas = canvas;
    this.culler.reset(plan);
    this.structureArt.reset(plan.structures, this.culler);
    this.veinArt.reset(plan.veins, this.culler);
    mapArt.drawn = this.culler.drawn;
    this.foamAnim = plan.foam ? { frames: plan.foam.frames, fps: plan.foam.fps, loop: true } : null;
    this.foamFrame = -1;
  }

  /**
   * Recorte del mapa pintado con el rectángulo visible del frame que se va a pintar (0018, design
   * §8): tras `rig.track`, con `rig.nextView()`. Solo cambia la visibilidad de lo que entra o sale.
   * Deja en la sonda (`mapArt.drawn`) los objetos del mapa que se dibujan en este frame.
   */
  cullMap(view: Box): void {
    if (!this.mapCanvas) return;
    this.culler.apply(view, this.mapCanvas);
    this.counts.mapArt.drawn = this.culler.drawn;
  }

  /** Cambio de partida: vacía las capas sin cadáveres y el jugador no hereda nada. */
  clear(): void {
    this.enemies.clear();
    this.corpses.clear();
    this.projectiles.clear();
    this.pulses.clear();
    this.pickups.clear();
    this.sheep.clear();
    this.hazards?.clear();
    this.player.reset();
    this.status = 'running';
  }
}
