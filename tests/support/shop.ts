import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import type { DeclaredSheep } from '../../src/domain/map/TerrainSource';
import { withShop } from './builders';

// Escenarios de la tienda (spec castle-shop 0024): mapa vacío con la puerta declarada en
// (1.000, 1.000), radio 40 y re-armado 300 (valores de escenario).

export const SHOP_DOOR = { x: 1000, y: 1000 } as const;
/** Justo dentro del radio: con la tienda armada, el tick 1 la abre. */
export const INSIDE_DOOR = { x: 1039, y: 1000 } as const;

/** El contenido dado con la puerta de escenario (radio 40, re-armado 300). */
export const withScenarioDoor = (config: RunConfig): RunConfig =>
  withShop(config, { radius: 40, rearmDistance: 300 });

/**
 * Partida en el mapa vacío con la puerta de escenario y la tienda armada; por defecto, el jugador
 * en `INSIDE_DOOR` (la tienda se abre en el tick 1).
 */
export function startAtDoor(
  config: RunConfig,
  setup: RunSetup = {},
  random: RandomGenerator = new Mulberry32RandomGenerator(42),
  sheep?: DeclaredSheep,
): Run {
  const terrain = { kind: 'open' as const, door: SHOP_DOOR, ...(sheep ? { sheep } : {}) };
  const r = Run.start(
    withScenarioDoor(config),
    random,
    { player: INSIDE_DOOR, shop: { armed: true }, ...setup },
    terrain,
  );
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Ejecuta ticks hasta que la partida está en tienda (como mucho `limit`); devuelve el tick. */
export function untilShopping(run: Run, limit = 1000, input = PlayerInput.NONE): number {
  for (let i = 0; i < limit && run.status === 'running'; i++) run.tick(input);
  if (run.status !== 'shopping') throw new Error(`sin tienda (estado ${run.status})`);
  return run.snapshot().tick;
}

/** Compra los productos dados en orden; falla si alguna compra se rechaza. */
export function buyAll(run: Run, ids: readonly string[]): RunSnapshot {
  for (const id of ids) {
    const r = run.buy(id);
    if (!r.ok) throw new Error(`compra rechazada (${id}): ${r.error.code}`);
  }
  return run.snapshot();
}

/** Política de tienda fija (spec simulation-loop 0024): si la tienda está abierta, salir sin comprar. */
export function leaveShopIfOpen(run: Run): boolean {
  if (run.status !== 'shopping') return false;
  const r = run.leaveShop();
  if (!r.ok) throw new Error(`salida rechazada: ${r.error.code}`);
  return true;
}
