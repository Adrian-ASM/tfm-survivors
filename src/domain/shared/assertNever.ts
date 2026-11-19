/**
 * Cierre de un `switch` exhaustivo sobre una unión discriminada (ADR-0007): si se añade una variante
 * y no se trata, el compilador falla aquí. En ejecución solo se alcanza con datos sin validar.
 */
export function assertNever(value: never): never {
  throw new Error(`Variante no contemplada: ${JSON.stringify(value)}`);
}
