// Capas de Clean Architecture para el diagrama interactivo de la presentación.
// Resumen de AGENTS.md §3; las reglas reales viven en .claude/hooks/guard-architecture.mjs.

export type LayerId = 'domain' | 'application' | 'infrastructure' | 'composition';

export interface Layer {
  readonly id: LayerId;
  readonly name: string;
  readonly path: string;
  readonly role: string;
  readonly mayImport: readonly LayerId[];
  readonly rules: readonly string[];
}

export const LAYERS: readonly Layer[] = [
  {
    id: 'composition',
    name: 'Composición',
    path: 'src/composition/',
    role: 'Composition root: el único sitio que conoce las implementaciones concretas y las conecta.',
    mayImport: ['domain', 'application', 'infrastructure'],
    rules: ['Crea los adaptadores y los inyecta en los casos de uso.'],
  },
  {
    id: 'infrastructure',
    name: 'Infraestructura',
    path: 'src/infrastructure/',
    role: 'Adaptadores: Phaser (render, input, cámara), localStorage, reloj y azar reales.',
    mayImport: ['domain', 'application'],
    rules: [
      'Único sitio donde se puede importar el motor.',
      'Valida con zod toda entrada externa.',
    ],
  },
  {
    id: 'application',
    name: 'Aplicación',
    path: 'src/application/',
    role: 'Casos de uso (StartRun, ChooseUpgrade…) y puertos (Clock, RandomGenerator, repositorios).',
    mayImport: ['domain'],
    rules: ['Sin motor ni APIs del navegador.', 'Habla con el exterior solo a través de puertos.'],
  },
  {
    id: 'domain',
    name: 'Dominio',
    path: 'src/domain/',
    role: 'Simulación pura y determinista: Run, oleadas, armas, campo de flujo, peligros…',
    mayImport: [],
    rules: [
      'No importa ninguna otra capa ni el motor.',
      'Sin Math.random, Date.now, window, document ni localStorage.',
      'Misma semilla y mismas entradas ⇒ misma partida.',
    ],
  },
];
