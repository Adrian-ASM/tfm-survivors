/** Resultado de una operación que puede fallar de forma esperable (AGENTS.md §4: Result en vez de excepciones). */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Error de dominio tipado: qué campo del contenido o de la configuración es inválido y por qué. */
export interface DomainError {
  readonly code: 'invalid-config';
  readonly field: string;
  readonly message: string;
}

export const invalidConfig = (field: string, message: string): DomainError => ({
  code: 'invalid-config',
  field,
  message,
});
