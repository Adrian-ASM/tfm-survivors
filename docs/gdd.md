# GDD-lite · v1 (aprobado 2026-11-19)

> Borrador generado a partir de la hoja de ruta. Lo refina el agente `game-designer`; las decisiones son del autor.

## Concepto
*Survivors-like* 2D para navegador, partidas de ~10 minutos. El jugador solo se mueve; las armas atacan solas;
las oleadas crecen; al subir de nivel elige 1 de 3 mejoras.

**Temática — "Sprint Survivors"** (decidida 2026-11-19; se descartó "Bug Survivors" por parecido con
*Bug Bane Survivors* en Steam): una dev
atrapada en un sprint infinito. Enemigos: *bugs*, *memory leaks*, *merge conflicts*. Armas: linter, tests, refactor.
Jefe: "el incidente en producción a las 3 a. m.". Mejoras: *Spec*, *Skill*, *Guardrail*… Metáfora del propio TFM.

## Core loop
Moverse → esquivar → las armas matan → recoger gemas de XP → subir de nivel → elegir mejora → sobrevivir más tiempo.

## Controles
Teclado (WASD / flechas). Pausa con Esc. Táctil y gamepad: *Should/Could*.

## Victoria y derrota
- Victoria: sobrevivir hasta el final del temporizador (valor por balancear).
- Derrota: la vida llega a 0. Pantalla de resultados con tiempo, nivel y enemigos eliminados.

## Backlog MoSCoW (alcance reducido)
| Prioridad | Contenido |
|---|---|
| **Must** | Movimiento · 2 armas automáticas · 3 tipos de enemigo con oleadas · colisiones y vida · gemas de XP · subida de nivel con 3 opciones · temporizador, victoria y derrota · HUD · menú · guardado local + exportar/importar · despliegue público |
| **Should** | Meta-progresión guardada · un jefe final · opciones de audio y accesibilidad (reducir *screen shake*) · controles táctiles |
| **Could** | Login con Google + Supabase (sincronizar progreso) · reto diario con seed compartida · i18n ES/EN · PWA |
| **Won't** | Multijugador · mapas procedurales complejos · monetización · leaderboard con re-simulación |

### Deuda registrada
| Origen | Deuda | Cuándo |
|---|---|---|
| 0006 · W1 | Ganabilidad frágil: con un bot sencillo solo gana 1 de 10 semillas en 600 s (`balance.test.ts` fija la semilla 2). Revisar curva de oleadas y mejoras con playtest humano y más estrategias. | Change de equilibrio antes del despliegue público |
| 0006 · W2 | Sin E2E de reinicio tras **victoria** (solo tras derrota); cubierto en tests de aplicación. | Con el change de equilibrio o el de menú |

## Orden tentativo de changes
0001 walking-skeleton → 0002 enemy-spawning → 0003 collisions-and-damage → 0004 auto-weapons →
0005 xp-and-level-up → 0006 run-lifecycle + HUD → 0007 local-save-export → 0008 e2e-fast-sim →
0009 main-menu → 0010 balance-pass → 0011 public-deploy → (arte/audio) → Should.

Notas sobre el orden (revisado 2026-11-20, tras 0007):
- **0008 e2e-fast-sim**: la suite E2E tarda ~4,2 min porque cada derrota espera ~78 s reales. Acelerar la
  simulación solo en el adaptador (p. ej. `?speed=N`, varios ticks por frame, núcleo intacto) y no jugar
  derrotas que no aportan (sembrar `localStorage`). Va primero porque abarata los E2E de todo lo que sigue.
- **0009 main-menu**: menú de inicio y pausa (Esc), Must pendiente. Incluye "borrar datos", fuera de 0007.
- **0010 balance-pass**: deuda de ganabilidad de 0006 (W1: 1 de 10 semillas gana con el bot) y semillas
  frágiles en tests de 0007 (S2: la 90 caduca si cambia el balance). Antes de publicar.
- **0011 public-deploy**: último Must.
