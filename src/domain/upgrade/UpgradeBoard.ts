import type { RandomGenerator } from '../shared/RandomGenerator';
import { err, ok, type Result } from '../shared/Result';
import type { UpgradeCatalog } from './UpgradeCatalog';
import type { UpgradeChoiceError } from './UpgradeChoiceError';
import type { UpgradeType } from './UpgradeType';

/** Opciones por oferta: la regla del juego "1 de 3" (no es un número de equilibrio). */
export const OFFER_SIZE = 3;

/**
 * Estado de las mejoras de una partida (servicio de dominio con estado; lo posee `Run`). Los
 * niveles por índice del catálogo son la fuente de verdad (ADR-0008). Arrays de trabajo y de oferta
 * preasignados: sortear no asigna.
 */
export class UpgradeBoard {
  private readonly lv: number[];
  private readonly work: number[];
  private readonly picks: number[] = [];
  private readonly options: UpgradeType[] = [];

  /** `levels` iniciales (tests): por defecto, todas a 0. */
  constructor(
    private readonly catalog: UpgradeCatalog,
    levels: readonly number[] = [],
  ) {
    const n = catalog.size;
    this.lv = Array.from({ length: n }, (_, i) => levels[i] ?? 0);
    this.work = Array.from({ length: n }, () => 0);
  }

  /** Nivel de cada mejora en el orden del catálogo (vista interna de solo lectura). */
  get levels(): readonly number[] {
    return this.lv;
  }

  levelOf(index: number): number {
    return this.lv[index] ?? 0;
  }

  /** Opciones de la oferta abierta, en el orden sorteado ([] sin oferta). */
  get offer(): readonly UpgradeType[] {
    return this.options;
  }

  /** Índices del catálogo de las opciones de la oferta abierta. */
  get offerIndices(): readonly number[] {
    return this.picks;
  }

  get isOpen(): boolean {
    return this.options.length > 0;
  }

  /**
   * Abre una oferta con `k = min(OFFER_SIZE, m)` mejoras distintas de las m de personaje
   * disponibles (nivel < maxLevel; las de arma nunca, ADR-0023), por Fisher–Yates parcial:
   * `j = i + ⌊random · (m − i)⌋`. Consume exactamente k valores de azar; con m = 0 devuelve false
   * sin consumir ninguno.
   */
  open(random: RandomGenerator): boolean {
    const { upgrades, levelIndices } = this.catalog;
    let m = 0;
    for (const i of levelIndices) {
      const u = upgrades[i];
      if (u && (this.lv[i] ?? 0) < u.maxLevel) {
        this.work[m] = i;
        m++;
      }
    }
    if (m === 0) return false;
    const k = Math.min(OFFER_SIZE, m);
    this.picks.length = 0;
    this.options.length = 0;
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(random.next() * (m - i));
      const chosen = this.work[j] ?? 0;
      this.work[j] = this.work[i] ?? 0;
      this.work[i] = chosen;
      const u = upgrades[chosen];
      if (u) {
        this.picks.push(chosen);
        this.options.push(u);
      }
    }
    return true;
  }

  /**
   * Sube 1 nivel la mejora `index` del catálogo (compra en la tienda, 0024): sin azar ni oferta. Las
   * comprobaciones (en tienda, nivel máximo, oro) son de `Run`.
   */
  raise(index: number): void {
    this.lv[index] = (this.lv[index] ?? 0) + 1;
  }

  /** Elige la opción `index`: sube su nivel y cierra la oferta. Sin efectos si es un error. */
  pick(index: number): Result<UpgradeType, UpgradeChoiceError> {
    if (!this.isOpen) return err({ code: 'no-offer' });
    const size = this.options.length;
    const chosen = Number.isInteger(index) ? this.picks[index] : undefined;
    const type = Number.isInteger(index) ? this.options[index] : undefined;
    if (chosen === undefined || type === undefined) {
      return err({ code: 'choice-out-of-range', index, size });
    }
    this.lv[chosen] = (this.lv[chosen] ?? 0) + 1;
    this.picks.length = 0;
    this.options.length = 0;
    return ok(type);
  }
}
