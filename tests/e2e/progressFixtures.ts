import type { Page } from '@playwright/test';
import type { Progress } from '../../src/domain/progress/Progress';
import { PROGRESS_STORAGE_KEY } from '../../src/infrastructure/progress/LocalStorageProgressRepository';
import { decodeProgress, encodeProgress } from '../../src/infrastructure/progress/progressCodec';

// Progreso sembrado de los E2E (design 0008, "Siembra"). Se construye con el codec de producción y
// se comprueba con su esquema zod: si el esquema cambia, el builder falla al cargar el test, no a
// mitad de partida. Corre en Node (lado de Playwright); no entra en el bundle.

/**
 * Texto v1 del progreso dado, con el mismo formato que guarda y exporta el juego. Lanza si el
 * resultado no es un progreso válido.
 */
export function progressText(progress: Progress): string {
  const text = encodeProgress(progress);
  const check = decodeProgress(text);
  if (!check.ok) throw new Error(`fixture de progreso inválido: ${check.error.message}`);
  return text;
}

/** P0: progreso previo del bucle export/import (1 entrada; aporta el mejor tiempo). */
export const P0: Progress = {
  records: { bestTimeSeconds: 300, bestLevel: 2, maxKills: 10 },
  history: [
    {
      playedAt: 1763596800000,
      seed: 7,
      outcome: 'lost',
      timeSeconds: 300,
      level: 2,
      kills: 10,
    },
  ],
};

/** F: fichero importado en el bucle (1 entrada; aporta el mejor nivel). */
export const F: Progress = {
  records: { bestTimeSeconds: 60, bestLevel: 20, maxKills: 5 },
  history: [
    {
      playedAt: 1763683200000,
      seed: 123,
      outcome: 'lost',
      timeSeconds: 60,
      level: 20,
      kills: 5,
    },
  ],
};

/** Clave de `sessionStorage` que marca la pestaña como ya sembrada. */
const SEEDED_FLAG = 'e2e/progress-seeded';

/**
 * Guarda `text` en el `localStorage` del juego antes de que carguen los scripts de la página, una
 * sola vez por pestaña: `addInitScript` se repite en cada `reload` y, sin la guarda en
 * `sessionStorage`, volvería a sembrar y ocultaría lo que el juego guardó. Llamar antes de `goto`.
 */
export async function seedProgress(page: Page, text: string): Promise<void> {
  await page.addInitScript(
    ([key, flag, value]) => {
      if (window.sessionStorage.getItem(flag) !== null) return;
      window.sessionStorage.setItem(flag, '1');
      window.localStorage.setItem(key, value);
    },
    [PROGRESS_STORAGE_KEY, SEEDED_FLAG, text] as const,
  );
}
