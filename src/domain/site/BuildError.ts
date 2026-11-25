/**
 * Errores tipados de construir en un solar y de salir de la obra (spec build-sites 0026). Ninguno
 * cambia la partida ni consume azar.
 */
export type BuildError =
  | { readonly code: 'not-building' }
  | { readonly code: 'unknown-kind'; readonly kind: string }
  | { readonly code: 'not-affordable'; readonly kind: string };
