/**
 * Errores tipados de comprar y salir de la tienda (spec castle-shop 0024). Ninguno cambia la
 * partida ni consume azar.
 */
export type ShopError =
  | { readonly code: 'not-shopping' }
  | { readonly code: 'unknown-product'; readonly id: string }
  | { readonly code: 'max-level'; readonly id: string }
  | { readonly code: 'not-enough-gold'; readonly price: number; readonly gold: number }
  | { readonly code: 'health-full' };
