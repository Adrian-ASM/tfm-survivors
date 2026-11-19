import type { Arena } from '../arena/Arena';
import type { RandomGenerator } from '../shared/RandomGenerator';
import { Vector2 } from '../shared/Vector2';
import type { SpawnRules } from './SpawnRules';

const FULL_TURN = 2 * Math.PI;

/**
 * Posición de aparición fuera de la vista (spec enemy-spawning). Por intento, y consumiendo exactamente
 * 1 valor del generador: ángulo aleatorio → punto del anillo alrededor del jugador → recorte a la arena →
 * se acepta si queda a ≥ minDistance. Devuelve null si se agotan los maxAttempts intentos.
 */
export function placeSpawn(
  player: Vector2,
  radius: number,
  rules: SpawnRules,
  arena: Arena,
  random: RandomGenerator,
): Vector2 | null {
  for (let attempt = 0; attempt < rules.maxAttempts; attempt++) {
    const angle = random.next() * FULL_TURN;
    const candidate = arena.clampCircle(
      Vector2.of(
        player.x + Math.cos(angle) * rules.ringRadius,
        player.y + Math.sin(angle) * rules.ringRadius,
      ),
      radius,
    );
    if (candidate.distanceTo(player) >= rules.minDistance) return candidate;
  }
  return null;
}
