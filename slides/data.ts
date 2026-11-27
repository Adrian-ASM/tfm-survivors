// Cifras de la presentación en un solo sitio. Se actualizan a mano al archivar cada change
// (fuente: AGENTS.md §1, openspec/changes/archive, docs/adr y git).

export const LINKS = {
  game: 'https://adrian-asm.github.io/tfm-survivors/',
  repo: 'https://github.com/Adrian-ASM/tfm-survivors',
  slides: 'https://adrian-asm.github.io/tfm-survivors/slides/',
} as const;

export interface Figure {
  readonly value: string;
  readonly label: string;
}

export const FIGURES: readonly Figure[] = [
  { value: '36', label: 'changes SDD archivados' },
  { value: '31', label: 'ADRs' },
  { value: '371', label: 'ficheros de tests unitarios' },
  { value: '6', label: 'subagentes con rol propio' },
  { value: '3', label: 'capas de guardarraíles' },
  { value: '50', label: 'semillas en el test de balance' },
];

/** Etapas del proyecto por bloques de changes (sin fechas a propósito). */
export interface Stage {
  readonly name: string;
  readonly sprite: string;
  readonly scale: number;
  readonly ids: readonly string[];
  readonly summary: string;
}

export const STAGES: readonly Stage[] = [
  {
    name: 'Bucle de partida',
    sprite: 'archer',
    scale: 0.8,
    ids: ['0001', '0002', '0003', '0004', '0005', '0006', '0007'],
    summary: 'Movimiento, oleadas, daño, armas, XP, HUD y guardado',
  },
  {
    name: 'Calidad y despliegue',
    sprite: 'castle',
    scale: 0.3,
    ids: ['0008', '0009', '0010', '0011'],
    summary: 'E2E rápidos, menú, balance medido y GitHub Pages',
  },
  {
    name: 'Arte y mundo',
    sprite: 'tree',
    scale: 0.48,
    ids: ['0012', '0013', '0014', '0015', '0016', '0017', '0018'],
    summary: 'Sprites, cámara, mapa procedural, castillo y vista completa',
  },
  {
    name: 'Enemigos con cabeza',
    sprite: 'tnt',
    scale: 0.8,
    ids: ['0019', '0020', '0021'],
    summary: 'Campo de flujo, barril y TNT, casas y torres goblin',
  },
  {
    name: 'Economía y construcción',
    sprite: 'house-blue',
    scale: 0.55,
    ids: ['0022', '0023', '0024', '0025', '0026', '0027'],
    summary: 'Oro, madera, piedra, ovejas, tienda del castillo y solares de obra',
  },
  {
    name: 'Pulido y plataformas',
    sprite: 'sheep-bounce',
    scale: 0.8,
    ids: ['0028', '0029', '0030', '0031', '0032', '0033', '0034', '0035', '0036'],
    summary: 'Guía, mapa vivo, daño visible, kit de UI, móvil, iconos y sonido',
  },
];

/** Victorias del bot de referencia sobre las semillas 1..50 tras cada change que tocó el balance. */
export const BALANCE: readonly {
  readonly change: string;
  readonly wins: number;
  readonly note: string;
}[] = [
  { change: '0010', wins: 30, note: 'Primera calibración (banda 25–35)' },
  { change: '0013', wins: 25, note: 'Mundo 2x con cámara' },
  { change: '0015', wins: 29, note: 'Mapa procedural, bot v2' },
  { change: '0016', wins: 27, note: 'Castillo y arte del mapa' },
  { change: '0017', wins: 25, note: 'Mundo 3.840 × 2.160' },
  { change: '0019', wins: 26, note: 'Campo de flujo, curva de XP' },
  { change: '0020', wins: 27, note: 'Barril y TNT, bot v3' },
  { change: '0021', wins: 27, note: 'Casas y torres goblin' },
  { change: '0023', wins: 28, note: 'Ovejas y carne que cura' },
  { change: '0024', wins: 30, note: 'Tienda del castillo, bot v4 que compra' },
  { change: '0026', wins: 29, note: 'Solares de obra, bot v5 que construye' },
  { change: '0027', wins: 34, note: 'Solar bloqueante y oferta por contacto' },
];

export const BALANCE_BAND = { min: 25, max: 35, seeds: 50 } as const;
