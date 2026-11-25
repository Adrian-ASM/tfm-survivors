import type { RunConfig } from '../../domain/run/RunConfig';
import { err, ok, type Result } from '../../domain/shared/Result';
import { TICKS_PER_SECOND } from '../../domain/shared/Tick';
import { OFFER_SIZE } from '../../domain/upgrade/UpgradeBoard';
import { formatClock } from '../phaser/hudFormat';

// Cifras de la guía tomadas del contenido (change 0028, design §2). Funciones puras, sin DOM.

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;
/** Una decimal como mucho en los segundos. */
const TENTHS = 10;

/** Entero con punto de miles fijo (1800 → `1.800`), igual en cualquier navegador (sin `Intl`). */
export function formatCount(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.trunc(Math.abs(n))).replace(THOUSANDS, '.');
}

/** Segundos de unos ticks, con una decimal como mucho y coma (1800 → `30`, 1350 → `22,5`). */
export function formatSeconds(ticks: number): string {
  const tenths = Math.round((ticks / TICKS_PER_SECOND) * TENTHS);
  const whole = formatCount(Math.trunc(tenths / TENTHS));
  const decimal = tenths % TENTHS;
  return decimal === 0 ? whole : `${whole},${String(decimal)}`;
}

type Marker = (c: RunConfig) => string | undefined;

/** Catálogo cerrado de marcadores (spec menu-guide, "Cifras de la guía tomadas del contenido"). */
export const GUIDE_MARKERS: Readonly<Record<string, Marker>> = Object.freeze({
  'run.duration': (c) => formatClock(c.run.durationSeconds),
  'upgrades.offerSize': () => formatCount(OFFER_SIZE),
  'upgrades.characterCount': (c) => formatCount(c.upgrades.character.length),
  'upgrades.weaponCount': (c) => formatCount(c.upgrades.weapons.length),
  'progression.levelUpHealPercent': (c) => formatCount(c.progression.levelUpHealPercent),
  'resources.meat.healPercent': (c) => formatCount(c.resources.meat.healPercent),
  'shop.heal.price': (c) => formatCount(c.shop.heal.price),
  'buildings.house.wood': (c) => formatCount(c.buildings.house.cost.wood),
  'buildings.house.incomeGold': (c) => formatCount(c.buildings.house.income.gold),
  'buildings.house.incomeSeconds': (c) => formatSeconds(c.buildings.house.income.everyTicks),
  'buildings.tower.wood': (c) => formatCount(c.buildings.tower.cost.wood),
  'buildings.tower.stone': (c) => formatCount(c.buildings.tower.cost.stone),
  'structures.houseCount': (c) => count(c.structures.types['goblin-house']?.count),
  'structures.towerCount': (c) => count(c.structures.types['goblin-tower']?.count),
});

const count = (n: number | undefined): string | undefined =>
  n === undefined ? undefined : formatCount(n);

/** Valor de cada marcador del catálogo con una config (se evalúa una sola vez al arrancar). */
export function markerValues(config: RunConfig): ReadonlyMap<string, string | undefined> {
  return new Map(Object.entries(GUIDE_MARKERS).map(([key, of]) => [key, of(config)]));
}

/** Fallo al interpolar: marcador fuera del catálogo, sin valor, o llave que no forma marcador. */
export type InterpolationIssue =
  { readonly kind: 'unknown' | 'unresolved'; readonly marker: string } | { readonly kind: 'brace' };

const MARKER = /\{([^{}]*)\}/g;

/** Marcadores `{clave}` de un texto crudo, en orden de aparición. */
export function markersOf(text: string): string[] {
  return [...text.matchAll(MARKER)].map((m) => m[1] ?? '');
}

/**
 * Sustituye cada `{clave}` por su valor (design §2): una clave fuera del catálogo o sin valor es un
 * fallo, y si tras sustituir queda una llave suelta también. No hay escape de llaves.
 */
export function interpolate(
  text: string,
  values: ReadonlyMap<string, string | undefined>,
): Result<string, InterpolationIssue> {
  for (const marker of markersOf(text)) {
    if (!values.has(marker)) return err({ kind: 'unknown', marker });
    if (values.get(marker) === undefined) return err({ kind: 'unresolved', marker });
  }
  const shown = text.replace(MARKER, (_, key: string) => values.get(key) ?? '');
  return /[{}]/.test(shown) ? err({ kind: 'brace' }) : ok(shown);
}
