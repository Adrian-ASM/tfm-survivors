import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { aDefaultConfig } from './builders';
import { chooseFirstWhileOpen, startSeededRun } from './runs';

// Firma dorada de las piedras (spec simulation-loop 0025, "Azar de la piedra"; design §10): con el
// contenido por defecto, el mapa generado de la semilla, el jugador quieto y la política de elección
// y de tienda fijas, las primeras piedras soltadas y los totales tras `STONE_GOLDEN_TICKS`. Se
// regenera solo si cambian `stoneChance`, `STONE_STREAM`, la regla de consumo o la secuencia de ids.

/** Ticks de la partida de la firma (o hasta que termine). */
export const STONE_GOLDEN_TICKS = 3600;
/** Piedras de la firma, en orden de aparición. */
export const STONE_GOLDEN_FIRST = 12;

export interface StoneSignature {
  /** Las primeras piedras como `<id>@<tick>:<source>:<round(x)>,<round(y)>`. */
  readonly first: readonly string[];
  /** Piedras soltadas (recogibles `stone` nuevos) en toda la partida de la firma. */
  readonly dropped: number;
  /** `resources.stone` al final. */
  readonly stone: number;
}

/** Recogibles `stone` de `s` con id mayor que `after`, en orden de la lista. */
export function newStones(s: RunSnapshot, after: number): RunSnapshot['pickups'] {
  return s.pickups.filter((p) => p.kind === 'stone' && p.id > after);
}

/** Juega la partida de la firma sobre `run` y devuelve la firma de sus piedras. */
export function stoneSignatureOf(run: Run, maxTicks = STONE_GOLDEN_TICKS): StoneSignature {
  const first: string[] = [];
  let dropped = 0;
  let last = Math.max(-1, ...run.snapshot().pickups.map((p) => p.id));
  for (let t = 0; t < maxTicks && run.status !== 'over'; t++) {
    chooseFirstWhileOpen(run);
    run.tick(PlayerInput.NONE);
    const s = run.snapshot();
    for (const p of newStones(s, last)) {
      dropped += 1;
      if (first.length < STONE_GOLDEN_FIRST) {
        const at = `${String(Math.round(p.x))},${String(Math.round(p.y))}`;
        first.push(`${String(p.id)}@${String(s.tick)}:${p.source ?? '-'}:${at}`);
      }
    }
    last = Math.max(last, ...s.pickups.map((p) => p.id));
  }
  return { first, dropped, stone: run.snapshot().resources.stone };
}

/** Firma de la semilla con el contenido por defecto y su mapa generado. */
export const stoneSignatureForSeed = (seed: number): StoneSignature =>
  stoneSignatureOf(startSeededRun(aDefaultConfig(), seed));

/**
 * Regenerada en el apply de 0027 (antes, 0025): las huellas de los solares libres bloquean desde el
 * tick 0 (ADR-0026) y cambian qué bajas ocurren y en qué orden, y con ellas la secuencia de tiradas
 * del flujo `STONE_STREAM`. Las otras cinco firmas (MAP, STRUCTURE, RESOURCE, SHEEP y SITE) no
 * cambian (quieto: pocas bajas antes de morir o del tick 3.600).
 */
export const STONE_GOLDEN: Readonly<Record<42 | 123, StoneSignature>> = {
  42: {
    first: [
      '10@853:goblin-torch:1667,1272',
      '13@950:goblin-torch:1654,1119',
      '22@1331:goblin-torch:1727,1132',
    ],
    dropped: 3,
    stone: 1,
  },
  123: {
    first: ['28@1588:goblin-torch:2007,1303', '107@3537:goblin-torch:1811,1190'],
    dropped: 2,
    stone: 0,
  },
};
