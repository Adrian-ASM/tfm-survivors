import type { Arena } from '../arena/Arena';
import type { GameMap } from '../map/GameMap';
import type { RandomGenerator } from '../shared/RandomGenerator';
import { Vector2 } from '../shared/Vector2';
import type { SpawnRules } from './SpawnRules';

const FULL_TURN = 2 * Math.PI;

/**
 * Posición de aparición fuera de la vista (spec enemy-spawning). Por intento, y consumiendo
 * exactamente 1 valor del generador: ángulo aleatorio → punto del anillo alrededor del jugador →
 * recorte a la arena → recolocación en la celda caminable más cercana si cae en una no caminable
 * (`GameMap.nearestWalkable`, sin azar; 0019) → se acepta si la celda final es caminable y queda a
 * ≥ minDistance. Devuelve null si se agotan los maxAttempts intentos.
 */
export function placeSpawn(
  player: Vector2,
  radius: number,
  rules: SpawnRules,
  arena: Arena,
  map: GameMap,
  random: RandomGenerator,
): Vector2 | null {
  const at = { x: 0, y: 0 };
  for (let attempt = 0; attempt < rules.maxAttempts; attempt++) {
    const angle = random.next() * FULL_TURN;
    const clamped = arena.clampCircle(
      Vector2.of(
        player.x + Math.cos(angle) * rules.ringRadius,
        player.y + Math.sin(angle) * rules.ringRadius,
      ),
      radius,
    );
    map.nearestWalkable(clamped.x, clamped.y, at);
    if (!map.isWalkable(map.colAt(at.x), map.rowAt(at.y))) continue;
    const candidate = at.x === clamped.x && at.y === clamped.y ? clamped : Vector2.of(at.x, at.y);
    if (candidate.distanceTo(player) >= rules.minDistance) return candidate;
  }
  return null;
}
