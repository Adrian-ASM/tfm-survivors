import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { seededRun } from '../../src/composition/seedSource';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  CONTENT_SHEEP,
  LONG_RUN_HEALTH,
  aDefaultConfig,
  aDynamite,
  aSegment,
  aWavesConfig,
  withPlayer,
  withoutSheep,
} from '../support/builders';
import { randomInputs } from '../support/inputs';
import { CountingRandom } from '../support/random';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';
import { aSheepConfig, declaredSheep, sheepRandom } from '../support/sheep';

const TOUGH = withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH });

/** Juega con la política de elección fija y `inputFor(snapshot)`; `each` ve cada snapshot. */
function play(
  run: Run,
  n: number,
  inputFor: (s: RunSnapshot, t: number) => PlayerInput,
  each: (s: RunSnapshot, t: number) => unknown = () => false,
): void {
  for (let t = 1; t <= n && run.status !== 'over'; t++) {
    chooseFirstWhileOpen(run);
    run.tick(inputFor(run.snapshot(), t));
    if (each(run.snapshot(), t) === true) return;
  }
}

/** Política de los escenarios con ovejas: hacia la carne más antigua o, si no hay, a la primera oveja. */
function shepherd(s: RunSnapshot): PlayerInput {
  const meat = s.pickups.find((p) => p.kind === 'meat');
  const goal = meat ?? s.sheep[0];
  if (!goal) return PlayerInput.NONE;
  const dx = goal.x - s.player.x;
  const dy = goal.y - s.player.y;
  const sx = Math.abs(dx) < 4 ? 0 : Math.sign(dx);
  const sy = Math.abs(dy) < 4 ? 0 : Math.sign(dy);
  return PlayerInput.of(sx, sy);
}

// Spec sheep (0023), "Ovejas de la partida", "Deambular", "Movimiento" y "Reaparición" con el mapa
// generado y el contenido por defecto.
describe('Ovejas en el mapa generado (spec sheep)', () => {
  it('Scenario: Ovejas al crear la partida (semilla 42: el tope, vida, pasto y origen; sin enemigos)', () => {
    const s = startSeededRun(aDefaultConfig(), 42).snapshot();
    expect(s.sheep).toHaveLength(CONTENT_SHEEP.maxAlive);
    expect(new Set(s.sheep.map((o) => o.id)).size).toBe(CONTENT_SHEEP.maxAlive);
    for (const o of s.sheep) {
      expect(o).toMatchObject({ health: CONTENT_SHEEP.health, state: 'graze', damaged: false });
      expect(o.origin).toEqual({ x: o.x, y: o.y });
    }
    expect([s.enemies, s.kills]).toEqual([[], 0]);
  });

  it('Scenario: Partida recién creada (mapa generado: ovejas colocadas, todas en pasto)', () => {
    const s = startSeededRun(aDefaultConfig(), 7).snapshot();
    expect(s.sheep.length).toBe(CONTENT_SHEEP.maxAlive);
    expect(s.sheep.every((o) => o.state === 'graze')).toBe(true);
    expect(s.pickups.every((p) => p.kind === 'wood')).toBe(true);
  });

  it('Scenario: Primer pasto de las ovejas colocadas (cada una se mueve primero en [2, g + 1])', () => {
    const firstMoves = () => {
      const run = startSeededRun(aDefaultConfig(), 42);
      const start = run.snapshot().sheep.map((o) => [o.x, o.y]);
      const first: number[] = start.map(() => 0);
      play(run, CONTENT_SHEEP.graze.ticks + 1, () => PlayerInput.NONE, (s, t) => {
        s.sheep.forEach((o, i) => {
          const [x, y] = start[i] ?? [];
          if (!first[i] && (o.x !== x || o.y !== y)) first[i] = t;
        });
      });
      return first;
    };
    const a = firstMoves();
    expect(a.every((t) => t >= 2 && t <= CONTENT_SHEEP.graze.ticks + 1)).toBe(true);
    expect(new Set(a).size).toBeGreaterThan(1);
    expect(firstMoves()).toEqual(a);
  });

  it('Scenario: Nunca más que el tope · Ninguna oveja solapa el mapa (semilla 7, 36.000 ticks)', () => {
    const run = startSeededRun(TOUGH, 7);
    const inputs = randomInputs(36_000, 2026);
    const owner = new Map<number, string>();
    let over = 0;
    let overlaps = 0;
    let repeated = 0;
    const { map } = run;
    const blocked = (x: number, y: number, r: number) => {
      for (let row = Math.floor((y - r) / 60); row <= Math.floor((y + r - 1e-9) / 60); row++) {
        for (let c = Math.floor((x - r) / 60); c <= Math.floor((x + r - 1e-9) / 60); c++) {
          const type = map.cells[row * 64 + c];
          if (type === 'grass' || type === 'bridge') continue;
          const nx = Math.max(c * 60, Math.min(x, c * 60 + 60));
          const ny = Math.max(row * 60, Math.min(y, row * 60 + 60));
          // Tolerancia de 0,001 px (error de coma flotante al deslizar por una esquina).
          if (Math.hypot(x - nx, y - ny) < r - 0.001) return true;
        }
      }
      return false;
    };
    play(run, 36_000, (_, t) => inputs[t - 1] ?? PlayerInput.NONE, (s) => {
      if (s.sheep.length > CONTENT_SHEEP.maxAlive) over++;
      for (const o of s.sheep) {
        const key = `${String(o.origin.x)},${String(o.origin.y)}`;
        if (owner.has(o.id) && owner.get(o.id) !== key) repeated++;
        owner.set(o.id, key);
        const r = o.radius;
        const out = o.x < r || o.y < r || o.x > 3840 - r || o.y > 2160 - r;
        if (out || blocked(o.x, o.y, r)) overlaps++;
      }
    });
    expect(run.snapshot().tick).toBe(36_000);
    expect([over, overlaps, repeated]).toEqual([0, 0, 0]);
  }, 60_000);

  it('Scenario: Vuelta al tope con el contenido por defecto (2 muertas en n: el tope en n + intervalo)', () => {
    const probe = startSeededRun(TOUGH, 42).snapshot().sheep;
    const [o1, o2] = probe;
    if (!o1 || !o2) throw new Error('la semilla 42 tiene ovejas');
    const n = 5;
    const run = startSeededRun(TOUGH, 42, 'generated', {
      dynamites: [aDynamite({ x: o1.x, y: o1.y }, n), aDynamite({ x: o2.x, y: o2.y }, n)],
    });
    const due = n + CONTENT_SHEEP.respawn.everyTicks;
    const counts = new Map<number, number>();
    const seen = new Set<number>();
    play(run, due, () => PlayerInput.NONE, (s, t) => {
      counts.set(t, s.sheep.length);
      for (const o of s.sheep) seen.add(o.id);
    });
    expect(counts.get(n)).toBe(CONTENT_SHEEP.maxAlive - 2);
    expect(counts.get(due - 1)).toBe(CONTENT_SHEEP.maxAlive - 2);
    // Condición del escenario: ninguna otra ha muerto entretanto (solo las 2 reapariciones nuevas).
    expect(seen.size).toBe(CONTENT_SHEEP.maxAlive + 2);
    expect(counts.get(due)).toBe(CONTENT_SHEEP.maxAlive);
  });
});

// Spec sheep (0023), "Ovejas deterministas", y simulation-loop, "Determinismo".
describe('Ovejas deterministas (spec sheep y simulation-loop)', () => {
  it('Scenario: Partida con ovejas reproducible · Partida con ovejas y carne reproducible (semilla 42)', () => {
    const config = withPlayer(aDefaultConfig(), { maxHealth: 1000 });
    const trace = () => {
      const run = startSeededRun(config, 42);
      const snaps: RunSnapshot[] = [];
      const facts = { fled: false, died: false, respawned: false, healedAt: 0, healedTo: 0 };
      const ids = new Set(run.snapshot().sheep.map((o) => o.id));
      let prev = run.snapshot();
      play(run, 14_400, shepherd, (s, t) => {
        snaps.push(s);
        if (s.sheep.some((o) => o.state === 'flee')) facts.fled = true;
        if (s.sheep.length < prev.sheep.length) facts.died = true;
        if (s.sheep.some((o) => !ids.has(o.id))) facts.respawned = true;
        const healed = s.player.health > prev.player.health && s.player.maxHealth === prev.player.maxHealth;
        if (healed && !facts.healedAt) [facts.healedAt, facts.healedTo] = [t, s.player.health];
        prev = s;
        return facts.respawned && facts.healedAt > 0;
      });
      return { snaps, facts };
    };
    const a = trace();
    const b = trace();
    expect(a.facts).toMatchObject({ fled: true, died: true, respawned: true });
    expect(a.facts.healedAt).toBeGreaterThan(0);
    expect(b.facts).toEqual(a.facts);
    expect(b.snaps.length).toBe(a.snaps.length);
    for (let i = 0; i < a.snaps.length; i++) expect(b.snaps[i]).toStrictEqual(a.snaps[i]);
  }, 60_000);

  it('Scenario: Dos partidas idénticas (semilla 42, 600 inputs: ovejas incluidas)', () => {
    const inputs = randomInputs(600, 2026);
    const snaps = () => {
      const run = startSeededRun(aDefaultConfig(), 42);
      const out: RunSnapshot[] = [];
      play(run, 600, (_, t) => inputs[t - 1] ?? PlayerInput.NONE, (s) => void out.push(s));
      return out;
    };
    const a = snaps();
    expect(a.at(-1)?.sheep.length).toBeGreaterThan(0);
    expect(snaps()).toStrictEqual(a);
    expect(startSeededRun(aDefaultConfig(), 42).map).toEqual(startSeededRun(aDefaultConfig(), 42).map);
  });

  it('Scenario: Partida larga reproducible (semilla 7, 36.000 inputs: ovejas, oro y madera)', () => {
    const inputs = randomInputs(36_000, 99);
    const last = () => {
      const run = startSeededRun(aDefaultConfig(), 7);
      play(run, 36_000, (_, t) => inputs[t - 1] ?? PlayerInput.NONE);
      return run.snapshot();
    };
    const a = last();
    expect(a.status).toBe('over');
    expect(last()).toStrictEqual(a);
  }, 60_000);

  it('Scenario: Las ovejas no consumen el azar de la partida (5 ovejas que pasean, huyen, mueren y reaparecen)', () => {
    const config: RunConfig = {
      ...aSheepConfig({ respawn: { everyTicks: 10, minPlayerDistance: 0 } }),
      waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 5)] }).waves,
    };
    const P = { x: 1000, y: 1000 };
    const herd = [P, { x: 1100, y: 1000 }, { x: 2000, y: 1500 }, { x: 600, y: 600 }, { x: 3000, y: 400 }];
    const busy = new CountingRandom(new Mulberry32RandomGenerator(7));
    const idle = new CountingRandom(new Mulberry32RandomGenerator(7));
    const sheepDice = new CountingRandom(sheepRandom(7));
    const a = Run.start(config, busy, { player: P, dynamites: [aDynamite({ x: 2000, y: 1500 }, 3)] }, declaredSheep(herd, { random: sheepDice }));
    const b = Run.start(config, idle, { player: P }, declaredSheep([]));
    if (!a.ok || !b.ok) throw new Error('partidas');
    const states = new Set<string>();
    for (let t = 0; t < 400; t++) {
      a.value.tick(PlayerInput.NONE);
      b.value.tick(PlayerInput.NONE);
      for (const o of a.value.snapshot().sheep) states.add(o.state);
    }
    expect([...states].sort()).toEqual(['flee', 'graze', 'wander']);
    expect(a.value.snapshot().sheep.some((o) => o.id >= herd.length)).toBe(true);
    expect(sheepDice.calls).toBeGreaterThan(0);
    expect(busy.calls).toBeGreaterThan(0);
    expect(busy.calls).toBe(idle.calls);
    expect(busy.next()).toBe(idle.next());
  });

  it('Scenario: Mismas oleadas con y sin ovejas (semilla 7, hasta la primera oferta o el 1.200)', () => {
    const spawns = (config: RunConfig) => {
      const run = startSeededRun(config, 7);
      const seen = new Set<number>();
      const out: string[] = [];
      for (let t = 1; t <= 1200 && run.status === 'running'; t++) {
        run.tick(PlayerInput.NONE);
        for (const e of run.snapshot().enemies) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          out.push(`${e.type}@${String(t)}:${String(e.x)},${String(e.y)}`);
        }
      }
      return out;
    };
    const withSheep = spawns(aDefaultConfig());
    expect(withSheep.length).toBeGreaterThan(0);
    expect(spawns(withoutSheep(aDefaultConfig()))).toEqual(withSheep);
  });

  // Spec xp-gems (0023), "Recogibles con tipo".
  it('Scenario: Ningún enemigo ni estructura suelta carne (tope 0, semilla 7, 36.000 ticks)', () => {
    const run = startSeededRun(withoutSheep(TOUGH), 7);
    const inputs = randomInputs(36_000, 2026);
    let meat = 0;
    let kills = 0;
    play(run, 36_000, (_, t) => inputs[t - 1] ?? PlayerInput.NONE, (s) => {
      meat += s.pickups.filter((p) => p.kind === 'meat').length;
      kills = s.kills;
    });
    expect(kills).toBeGreaterThan(0);
    expect(run.snapshot().structures.some((x) => x.destroyed)).toBe(true);
    expect(meat).toBe(0);
  }, 60_000);

  it('el azar de las ovejas sale de su flujo (SHEEP_STREAM) y no del de la partida', () => {
    const { terrain } = seededRun(42);
    expect(terrain.kind).toBe('generated');
    if (terrain.kind === 'generated') expect(terrain.sheepRandom.next()).toBe(sheepRandom(42).next());
  });
});
