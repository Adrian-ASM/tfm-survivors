import { assertNever } from '../../shared/assertNever';
import { err, invalidConfig, ok, type DomainError, type Result } from '../../shared/Result';
import {
  STATE_KINDS,
  type BehaviorConfig,
  type StateConfig,
  type StateKind,
} from './BehaviorConfig';

export type { BehaviorConfig, StateKind };

// Mensajes de las invariantes del comportamiento; zod (infraestructura) reutiliza los de valores.
export const BEHAVIOR_KIND_UNKNOWN = 'Clase de estado de comportamiento desconocida';
export const BEHAVIOR_INITIAL_UNKNOWN = 'Estado inicial ausente o que el tipo no declara';
export const BEHAVIOR_TARGET_UNKNOWN = 'Estado de destino que el tipo no declara';
export const BEHAVIOR_STATE_REPEATED = 'Nombre de estado de comportamiento repetido';
export const BEHAVIOR_VALUE_MUST_BE_POSITIVE =
  'Las distancias, radios y daños de un comportamiento deben ser positivos';
export const BEHAVIOR_TICKS_MUST_BE_INTEGER =
  'Las duraciones y tiempos de vuelo de un comportamiento deben ser enteros ≥ 1 (ticks)';

const NONE = -1;

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;
const isCount = (v: number): boolean => Number.isInteger(v) && v >= 1;

/** Arrays paralelos por índice de estado, en construcción. */
interface Tables {
  kinds: StateKind[];
  ticks: number[];
  exitDistSq: number[];
  to: number[];
  blastRadius: number[];
  blastDamage: number[];
  flightTicks: number[];
}

/**
 * Comportamiento de un tipo de enemigo (value object, ADR-0018): estados de una clase cerrada
 * compilados a arrays por índice para el camino caliente (ninguna búsqueda por nombre por tick).
 * `to` es el índice del destino (−1 si no hay); `exitDistSq` la distancia de salida al cuadrado
 * (−1 sin salida); `blastRadius`/`blastDamage` los de la mecha o los de la dinamita de la carga;
 * `flightTicks` el vuelo de esa dinamita. Los valores no aplicables a una clase valen 0.
 */
export class Behavior {
  private constructor(
    readonly initial: number,
    readonly names: readonly string[],
    readonly kinds: readonly StateKind[],
    readonly ticks: readonly number[],
    readonly exitDistSq: readonly number[],
    readonly to: readonly number[],
    readonly blastRadius: readonly number[],
    readonly blastDamage: readonly number[],
    readonly flightTicks: readonly number[],
  ) {
    Object.freeze(this);
  }

  /** ¿Tiene algún estado de esta clase? (aspectos obligatorios por clase, spec sprite-rendering). */
  hasKind(kind: StateKind): boolean {
    return this.kinds.includes(kind);
  }

  /**
   * Valida y compila. `typeId` y el nombre del estado van en el mensaje; `path` es la ruta del
   * comportamiento en el contenido (p. ej. `enemies.types.2.behavior`) para nombrar el campo.
   */
  static create(
    config: BehaviorConfig,
    typeId: string,
    path: string,
  ): Result<Behavior, DomainError> {
    const index = new Map<string, number>();
    for (const [i, s] of config.states.entries()) {
      if (index.has(s.name)) {
        const message = `${BEHAVIOR_STATE_REPEATED}: ${s.name} (${typeId})`;
        return err(invalidConfig(`${path}.states.${String(i)}.name`, message));
      }
      index.set(s.name, i);
    }
    const initial = index.get(config.initial);
    if (initial === undefined) {
      const message = `${BEHAVIOR_INITIAL_UNKNOWN}: ${config.initial} (${typeId})`;
      return err(invalidConfig(`${path}.initial`, message));
    }
    const t: Tables = {
      kinds: [],
      ticks: [],
      exitDistSq: [],
      to: [],
      blastRadius: [],
      blastDamage: [],
      flightTicks: [],
    };
    for (const [i, s] of config.states.entries()) {
      const fail = compileState(s, index, t, `${path}.states.${String(i)}`, typeId);
      if (fail) return err(fail);
    }
    const f = <T>(a: T[]): readonly T[] => Object.freeze(a);
    return ok(
      new Behavior(
        initial,
        f(config.states.map((s) => s.name)),
        f(t.kinds),
        f(t.ticks),
        f(t.exitDistSq),
        f(t.to),
        f(t.blastRadius),
        f(t.blastDamage),
        f(t.flightTicks),
      ),
    );
  }
}

function compileState(
  s: StateConfig,
  index: ReadonlyMap<string, number>,
  t: Tables,
  at: string,
  typeId: string,
): DomainError | null {
  const bad = (field: string, base: string, value: unknown): DomainError =>
    invalidConfig(`${at}.${field}`, `${base}: ${String(value)} (${typeId}, ${s.name})`);
  const target = (field: string, name: string): number | DomainError =>
    index.get(name) ?? bad(field, BEHAVIOR_TARGET_UNKNOWN, name);
  if (!(STATE_KINDS as readonly string[]).includes(s.kind)) {
    return bad('kind', BEHAVIOR_KIND_UNKNOWN, s.kind);
  }
  let ticks = 0;
  let exit = NONE;
  let to = NONE;
  let radius = 0;
  let damage = 0;
  let flight = 0;
  switch (s.kind) {
    case 'chase': {
      if (s.exit) {
        if (!isPositive(s.exit.distance)) {
          return bad('exit.distance', BEHAVIOR_VALUE_MUST_BE_POSITIVE, s.exit.distance);
        }
        const dest = target('exit.to', s.exit.to);
        if (typeof dest !== 'number') return dest;
        exit = s.exit.distance * s.exit.distance;
        to = dest;
      }
      break;
    }
    case 'fuse': {
      if (!isCount(s.ticks)) return bad('ticks', BEHAVIOR_TICKS_MUST_BE_INTEGER, s.ticks);
      if (!isPositive(s.radius)) return bad('radius', BEHAVIOR_VALUE_MUST_BE_POSITIVE, s.radius);
      if (!isPositive(s.damage)) return bad('damage', BEHAVIOR_VALUE_MUST_BE_POSITIVE, s.damage);
      ({ ticks, radius, damage } = s);
      break;
    }
    case 'charge': {
      if (!isCount(s.ticks)) return bad('ticks', BEHAVIOR_TICKS_MUST_BE_INTEGER, s.ticks);
      const d = s.dynamite;
      if (!isCount(d.flightTicks)) {
        return bad('dynamite.flightTicks', BEHAVIOR_TICKS_MUST_BE_INTEGER, d.flightTicks);
      }
      if (!isPositive(d.radius)) {
        return bad('dynamite.radius', BEHAVIOR_VALUE_MUST_BE_POSITIVE, d.radius);
      }
      if (!isPositive(d.damage)) {
        return bad('dynamite.damage', BEHAVIOR_VALUE_MUST_BE_POSITIVE, d.damage);
      }
      const dest = target('to', s.to);
      if (typeof dest !== 'number') return dest;
      ({ ticks } = s);
      to = dest;
      radius = d.radius;
      damage = d.damage;
      flight = d.flightTicks;
      break;
    }
    case 'wait': {
      if (!isCount(s.ticks)) return bad('ticks', BEHAVIOR_TICKS_MUST_BE_INTEGER, s.ticks);
      const dest = target('to', s.to);
      if (typeof dest !== 'number') return dest;
      ({ ticks } = s);
      to = dest;
      break;
    }
    default:
      return assertNever(s);
  }
  t.kinds.push(s.kind);
  t.ticks.push(ticks);
  t.exitDistSq.push(exit);
  t.to.push(to);
  t.blastRadius.push(radius);
  t.blastDamage.push(damage);
  t.flightTicks.push(flight);
  return null;
}
