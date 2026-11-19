import { TICKS_PER_SECOND } from '../../domain/shared/Tick';

/** Segundos en un minuto (formato del reloj). */
const SECONDS_PER_MINUTE = 60;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** `mm:ss` con `ss` de 2 cifras y `mm` de al menos 2, sin acotar a 59 (spec hud y run-results). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad2(Math.floor(s / SECONDS_PER_MINUTE))}:${pad2(s % SECONDS_PER_MINUTE)}`;
}

/**
 * Segundos restantes redondeados hacia arriba (spec hud): ⌈(duración − tick) / 60⌉, nunca < 0. Con
 * 36.000 ticks se ve 10:00 en los ticks 0 a 59 y 00:00 solo en el 36.000.
 */
export function remainingSeconds(tick: number, durationTicks: number): number {
  return Math.max(0, Math.ceil((durationTicks - tick) / TICKS_PER_SECOND));
}

/** Relleno de la barra de vida: vida / vida máxima efectiva, en [0, 1]. */
export function healthFill(health: number, maxHealth: number): number {
  if (!(maxHealth > 0)) return 0;
  return Math.min(1, Math.max(0, health / maxHealth));
}

/** `actual/máxima` con enteros redondeados hacia arriba: con vida > 0 nunca se ve 0. */
export const healthLabel = (health: number, maxHealth: number): string =>
  `${String(Math.ceil(health))}/${String(Math.ceil(maxHealth))}`;

/** Bajas como entero completo, sin abreviar. */
export const killsLabel = (kills: number): string => `Bajas: ${String(kills)}`;
