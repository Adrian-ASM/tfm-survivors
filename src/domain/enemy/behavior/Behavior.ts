import { assertNever } from '../../shared/assertNever';
import { err, invalidConfig, ok, type DomainError, type Result } from '../../shared/Result';
import {
  GUARD_KINDS,
  STATE_KINDS,
  type BehaviorConfig,
  type ExitConfig,
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
export const BEHAVIOR_GUARD_NEEDS_PATROL =
  'Un tipo con estados de patrulla, alerta o vuelta debe empezar en un estado de patrulla';
export const BEHAVIOR_LOSE_NOT_ABOVE_DETECT =
  'El radio de abandono debe ser mayor que todos los radios de detección del tipo';

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
  patrolRadius: number[];
  detectDistSq: number[];
  detectTo: number[];
  loseDistSq: number[];
  loseTo: number[];
  arriveTo: number[];
}

/** Fila de un estado: valores no aplicables a 0 (magnitudes) o −1 (distancias² y destinos). */
interface Row {
  ticks: number;
  exitDistSq: number;
  to: number;
  blastRadius: number;
  blastDamage: number;
  flightTicks: number;
  patrolRadius: number;
  detectDistSq: number;
  detectTo: number;
  loseDistSq: number;
  loseTo: number;
  arriveTo: number;
}

const emptyRow = (): Row => ({
  ticks: 0,
  exitDistSq: NONE,
  to: NONE,
  blastRadius: 0,
  blastDamage: 0,
  flightTicks: 0,
  patrolRadius: 0,
  detectDistSq: NONE,
  detectTo: NONE,
  loseDistSq: NONE,
  loseTo: NONE,
  arriveTo: NONE,
});

/**
 * Comportamiento de un tipo de enemigo (value object, ADR-0019 y ADR-0020): estados de una clase
 * cerrada compilados a arrays por índice para el camino caliente (ninguna búsqueda por nombre por
 * tick). `to` es el índice del destino (−1 si no hay); `exitDistSq` la distancia de salida al
 * cuadrado de una persecución o del lanzamiento de una alerta (−1 sin salida);
 * `blastRadius`/`blastDamage` los de la mecha o los de la dinamita de la carga; `flightTicks` el
 * vuelo de esa dinamita. Guardia: `patrolRadius` (patrulla), `detectDistSq`/`detectTo` (patrulla y
 * vuelta), `loseDistSq`/`loseTo` (alerta) y `arriveTo` (vuelta). Los valores no aplicables a una
 * clase valen 0 (magnitudes) o −1 (distancias al cuadrado y destinos).
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
    readonly patrolRadius: readonly number[],
    readonly detectDistSq: readonly number[],
    readonly detectTo: readonly number[],
    readonly loseDistSq: readonly number[],
    readonly loseTo: readonly number[],
    readonly arriveTo: readonly number[],
  ) {
    Object.freeze(this);
  }

  /** ¿Tiene algún estado de esta clase? (aspectos obligatorios por clase, spec sprite-rendering). */
  hasKind(kind: StateKind): boolean {
    return this.kinds.includes(kind);
  }

  /** ¿Empieza en patrulla? Es un guardia: necesita un puesto y no va en las oleadas (0021). */
  get isGuard(): boolean {
    return this.kinds[this.initial] === 'patrol';
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
      patrolRadius: [],
      detectDistSq: [],
      detectTo: [],
      loseDistSq: [],
      loseTo: [],
      arriveTo: [],
    };
    for (const [i, s] of config.states.entries()) {
      const fail = compileState(s, index, t, `${path}.states.${String(i)}`, typeId);
      if (fail) return err(fail);
    }
    const guardError = checkGuard(config, t, initial, typeId, path);
    if (guardError) return err(guardError);
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
        f(t.patrolRadius),
        f(t.detectDistSq),
        f(t.detectTo),
        f(t.loseDistSq),
        f(t.loseTo),
        f(t.arriveTo),
      ),
    );
  }
}

/**
 * Reglas del tipo con estados de guardia (spec enemy-behavior 0021): empieza en patrulla y cada
 * abandono supera todas sus detecciones (comparadas al cuadrado, todas positivas).
 */
function checkGuard(
  config: BehaviorConfig,
  t: Tables,
  initial: number,
  typeId: string,
  path: string,
): DomainError | null {
  if (!t.kinds.some((k) => GUARD_KINDS.includes(k))) return null;
  if (t.kinds[initial] !== 'patrol') {
    const message = `${BEHAVIOR_GUARD_NEEDS_PATROL}: ${config.initial} (${typeId})`;
    return invalidConfig(`${path}.initial`, message);
  }
  const detect = Math.max(...t.detectDistSq);
  const at = t.loseDistSq.findIndex((lose) => lose !== NONE && lose <= detect);
  if (at < 0) return null;
  const name = config.states[at]?.name ?? '';
  const message = `${BEHAVIOR_LOSE_NOT_ABOVE_DETECT} (${typeId}, ${name})`;
  return invalidConfig(`${path}.states.${String(at)}.lose.distance`, message);
}

/** Compila un estado en su fila y la añade a las tablas; devuelve el error o null. */
function compileState(
  s: StateConfig,
  index: ReadonlyMap<string, number>,
  t: Tables,
  at: string,
  typeId: string,
): DomainError | null {
  const bad = (field: string, base: string, value: unknown): DomainError =>
    invalidConfig(`${at}.${field}`, `${base}: ${String(value)} (${typeId}, ${s.name})`);
  if (!(STATE_KINDS as readonly string[]).includes(s.kind)) {
    return bad('kind', BEHAVIOR_KIND_UNKNOWN, s.kind);
  }
  const read = new StateReader(index, bad);
  const row = compileRow(s, read);
  if (read.error) return read.error;
  t.kinds.push(s.kind);
  for (const key of Object.keys(row) as (keyof Row)[]) t[key].push(row[key]);
  return null;
}

type Bad = (field: string, base: string, value: unknown) => DomainError;

/**
 * Lectura validada de los campos de un estado: guarda el primer campo inválido en `error` (en el
 * orden de lectura) y devuelve el valor tal cual, sin excepciones.
 */
class StateReader {
  error: DomainError | null = null;

  constructor(
    private readonly index: ReadonlyMap<string, number>,
    private readonly bad: Bad,
  ) {}

  private fail(field: string, base: string, value: unknown): void {
    this.error ??= this.bad(field, base, value);
  }

  target(field: string, name: string): number {
    const i = this.index.get(name);
    if (i === undefined) this.fail(field, BEHAVIOR_TARGET_UNKNOWN, name);
    return i ?? NONE;
  }

  positive(field: string, v: number): number {
    if (!isPositive(v)) this.fail(field, BEHAVIOR_VALUE_MUST_BE_POSITIVE, v);
    return v;
  }

  ticks(field: string, v: number): number {
    if (!isCount(v)) this.fail(field, BEHAVIOR_TICKS_MUST_BE_INTEGER, v);
    return v;
  }

  /** Salida por distancia `field` (`exit`, `detect`, `lose`): [distancia², destino]. */
  exit(field: string, e: ExitConfig | undefined): [number, number] {
    const d = this.positive(`${field}.distance`, e?.distance ?? NaN);
    return [d * d, this.target(`${field}.to`, e?.to ?? '')];
  }
}

function compileRow(s: StateConfig, read: StateReader): Row {
  const row = emptyRow();
  switch (s.kind) {
    case 'chase':
      if (s.exit) [row.exitDistSq, row.to] = read.exit('exit', s.exit);
      break;
    case 'fuse':
      row.ticks = read.ticks('ticks', s.ticks);
      row.blastRadius = read.positive('radius', s.radius);
      row.blastDamage = read.positive('damage', s.damage);
      break;
    case 'charge':
      row.ticks = read.ticks('ticks', s.ticks);
      row.flightTicks = read.ticks('dynamite.flightTicks', s.dynamite.flightTicks);
      row.blastRadius = read.positive('dynamite.radius', s.dynamite.radius);
      row.blastDamage = read.positive('dynamite.damage', s.dynamite.damage);
      row.to = read.target('to', s.to);
      break;
    case 'wait':
      row.ticks = read.ticks('ticks', s.ticks);
      row.to = read.target('to', s.to);
      break;
    case 'patrol':
      row.patrolRadius = read.positive('radius', s.radius);
      [row.detectDistSq, row.detectTo] = read.exit('detect', s.detect);
      break;
    case 'alert':
      [row.exitDistSq, row.to] = read.exit('exit', s.exit);
      [row.loseDistSq, row.loseTo] = read.exit('lose', s.lose);
      break;
    case 'return':
      [row.detectDistSq, row.detectTo] = read.exit('detect', s.detect);
      row.arriveTo = read.target('to', s.to);
      break;
    default:
      return assertNever(s);
  }
  return row;
}
