/**
 * Error tipado de una elección de mejora (spec upgrades): sin oferta abierta (partida en curso o
 * terminada) o un índice que no es un entero en [0, size − 1].
 */
export type UpgradeChoiceError =
  | { readonly code: 'no-offer' }
  | { readonly code: 'choice-out-of-range'; readonly index: number; readonly size: number };
