// Reloj de prueba para plazos (0032): `timer(ms)` resuelve cuando `advance` llega a ese instante.
export class TestTimer {
  private now = 0;
  private readonly pending: { at: number; resolve: () => void }[] = [];

  readonly timer = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      this.pending.push({ at: this.now + ms, resolve });
    });

  /** Avanza `ms` y resuelve los plazos vencidos; espera a que corran sus continuaciones. */
  async advance(ms: number): Promise<void> {
    this.now += ms;
    for (const p of this.pending.filter((q) => q.at <= this.now)) p.resolve();
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }

  get elapsed(): number {
    return this.now;
  }
}

/** Deja correr las microtareas pendientes (promesas ya resueltas). */
export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
