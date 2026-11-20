/** `Storage` falso en memoria (Vitest corre en node, sin jsdom), con fallos programables. */
export class FakeStorage {
  readonly values = new Map<string, string>();
  getError: Error | null = null;
  setError: Error | null = null;
  removeError: Error | null = null;
  writes = 0;
  removals = 0;

  getItem(key: string): string | null {
    if (this.getError) throw this.getError;
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.setError) throw this.setError;
    this.values.set(key, value);
    this.writes += 1;
  }

  removeItem(key: string): void {
    if (this.removeError) throw this.removeError;
    this.values.delete(key);
    this.removals += 1;
  }
}

/** Excepción del navegador con el `name` dado (`SecurityError`, `QuotaExceededError`…). */
export const domException = (name: string): DOMException => new DOMException(name, name);
