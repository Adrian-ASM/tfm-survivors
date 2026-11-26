/** Clase del objetivo de un golpe de combate (spec simulation-loop 0031, ADR-0027). */
export type HitKind = 'enemy' | 'structure' | 'sheep' | 'player';

/** Clases que dañan las armas y las explosiones (el jugador solo lo registra `Run`, paso 5). */
export type TargetHitKind = Exclude<HitKind, 'player'>;
