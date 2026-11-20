# GDD-lite · v1.1 (v1 aprobado 2026-11-19; revisado 2026-11-20, tras 0007)

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

### Estado del backlog Must (2026-11-20)
| Estado | Contenido | Change |
|---|---|---|
| Hecho | Movimiento · oleadas con 3 tipos de enemigo · colisiones y vida · 2 armas automáticas | 0001–0004 |
| Hecho | Gemas de XP · subida de nivel con 3 opciones | 0005 |
| Hecho | Temporizador, victoria y derrota · HUD · reinicio | 0006 |
| Hecho | Guardado local (récords + historial de 10 partidas) · exportar/importar con fusión · CSP estricta | 0007 |
| Hecho | Menú de inicio (jugar, exportar, importar, borrar datos) · pausa con Esc | 0009 |
| Hecho | Despliegue público en GitHub Pages · smoke remoto a demanda (`npm run smoke:public`, workflow `smoke-public`) | 0011 |

**Backlog Must completo** (2026-11-20). Siguiente bloque: arte/audio (change 0012 sprite-rendering en curso) y Should.

Los changes 0008 (infraestructura de tests) y 0010 (equilibrio) no añaden Must: habilitan y protegen a los demás.

### Deuda registrada
| Origen | Deuda | Cuándo |
|---|---|---|
| 0006 · W1 | **Saldada en 0010.** Ganabilidad frágil (1 de 10 semillas con el bot sencillo, semilla 2 fija). Ahora el bot de referencia gana 30 de las semillas 1..50 y el test comprueba la banda 25–35. Sigue pendiente un playtest humano. | Change 0010 (hecho) |
| 0006 · W2 | Sin E2E de reinicio tras **victoria** (solo tras derrota); cubierto en tests de aplicación. | Con el change de equilibrio o el de menú |
| 0007 · S2 | **Saldada en 0010.** Semilla frágil 90. Los E2E de derrota usan la 42, que forma parte del conjunto y está cubierta por el invariante "quieto pierde antes de 180 s" sobre las semillas 1..50. | Change 0010 (hecho) |
| 0007 · S4 | La semilla guardada en el historial sale del objeto `probe` de E2E (`wireProgress(root, () => probe.seed)`) en vez de una fuente propia. | Con 0009 o 0010 |
| 0007 · E2E | **Saldada en 0008.** La suite E2E tardaba ~4,2 min (13 tests); cada derrota ~78 s reales. Ahora `?e2e&speed=8` (derrota en ~10 s), progreso sembrado (como mucho 1 derrota por test), 2 workers y `timeout-minutes: 6` en el job `e2e`. | Change 0008 (hecho) |
| 0008 · W2 | `.husky/pre-commit` no ejecuta `typecheck`: un commit local de 0008 entró con un error de `tsc` que solo habría cazado el CI. Añadir `tsc --noEmit` a un pre-push (o al pre-commit si el tiempo lo permite). | Próximo change de tooling o con 0009 |
| 0008 · W3 | El objetivo de suite E2E < 60 s depende de `workers: 2` (con 1 worker ~70 s) y la derrota a `speed=8` (~10 s) tiene poco margen frente al tope de 12 s; `retries: 1` en CI puede enmascarar flakiness. Vigilar los tiempos del job `e2e`. | Revisar si CI da reintentos |
| 0008 · S1/S2 | Sin E2E de `?e2e&speed=<inválido>` aislado ni de `?speed=8` sin `?e2e` avanzando a ritmo normal (cubierto en unitario). | Con 0009 si se tocan los E2E de arranque |
| 0009 · W1 | La sonda E2E no expone la visibilidad del HUD: "HUD en el menú" y "HUD tras Volver al menú" solo se cubren por capas (tests de Node), no en navegador. | Si un change toca el HUD o la sonda |
| 0009 · W2 | Sin E2E que compruebe los sprites tras Volver al menú ni el escenario "Cinco ciclos menú-partida" (la sonda no cuenta sprites); la limpieza depende de que Phaser destruya la escena al apagarla. | Con el change de arte o si aparece una fuga |
| 0009 · W6 | Dos E2E juegan con semilla aleatoria (lo exige la spec tras Volver al menú) a `speed=15`: duración no determinista, timeout holgado. | Vigilar el job `e2e` |
| 0010 · W1 | "Sin semillas sueltas de balance" se comprueba con grep, sin test automático que lo vigile. | Si reaparecen semillas fijas |
| 0010 · W2 | Margen estrecho de la tasa: 30/50 en una banda 25–35, con ±3–4 victorias de ruido entre factores contiguos. Un ajuste pequeño de contenido puede sacarla de la banda: hay que volver a medir. | Cualquier change que toque `content/` |
| 0009 · S5 | El test de "Primer frame tras Jugar" declara 601 frames de menú que no llega a pasar al bucle; la garantía es estructural (bucle nuevo por partida). | Con 0010 si se toca `run-launcher.test.ts` |

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
- **0011 public-deploy**: último Must. **Hecho** (PR #24): el despliegue ya existía en `ci.yml`; el change añadió
  la spec `public-deploy`, el smoke remoto a demanda y la nota de CSP en Pages de ADR-0004.

## Próximos changes

### 0008 e2e-fast-sim (infraestructura de tests)
- **Objetivo**: derrota E2E de ~78 s a ~10 s y suite completa < 1 min.
- **Alcance**: parámetro de URL tipo `?speed=N` que ejecuta varios ticks por frame **solo en el adaptador de Phaser**
  (núcleo intacto, mismo camino que el jugador, determinismo preservado). En los E2E que solo necesitan progreso
  guardado, sembrar `localStorage` en vez de jugar una derrota. Valorar `workers` en Playwright.
- **Fuera de alcance**: un atajo "terminar ya" en el núcleo. Lo descartó el arquitecto en 0007: es una entrada nueva
  al núcleo y prueba un camino distinto del real.
- **Criterios**:
  - Given `?speed=8` y la misma semilla, When se juega hasta la derrota, Then el resultado (tiempo de simulación,
    nivel, kills) es idéntico al de velocidad 1.
  - Given un E2E que solo necesita récords, When se siembra `localStorage` válido, Then no juega ninguna derrota.
  - Given la suite E2E completa, When corre en local, Then tarda < 1 min.
- **Riesgos**: que `?speed` llegue al jugador en producción (decidir si se limita a dev/test o se deja como opción
  inocua); que más ticks por frame degraden el render o la entrada.

### 0009 main-menu
- **Objetivo**: cerrar el Must de menú.
- **Alcance**: menú de inicio (jugar, exportar, importar, borrar datos) y pausa con Esc. Borrar datos queda fuera de
  0007 y exige confirmación. Afecta al arranque, a `?seed=` y a los E2E. Recoge 0006 · W2 (E2E de reinicio tras
  victoria) si encaja.
- **Fuera de alcance**: ajustes de audio y accesibilidad (*Should*), arte definitivo.
- **Criterios**:
  - Given la partida en curso, When se pulsa Esc, Then la simulación se detiene y otra pulsación la reanuda sin
    perder ticks.
  - Given el menú de inicio, When se pulsa "Borrar datos" y se cancela la confirmación, Then el progreso sigue
    intacto.
  - Given `?seed=N` en la URL, When se pulsa "Jugar", Then la partida usa la semilla N.
- **Riesgos**: que el menú rompa el arranque directo con `?seed=` que usan los E2E; estado de pausa que filtre al
  núcleo (debe vivir en el adaptador o en un caso de uso explícito).

### 0010 balance-pass · hecho (PR #20)
- **Resultado**: con el bot de referencia (huida + elección priorizada) gana 30 de las semillas 1..50 (banda
  25–35) y quieto pierde con todas antes de 180 s (máx. ~94 s). Palanca: `budgetPerSecond` ×0,8 en los tramos de
  300 y 480 s. El criterio de "10 semillas" pasó a 50 con banda de tasa; ver spec viva `run-outcome`.
- **Objetivo**: partida ganable y tests de balance que no caduquen.
- **Alcance**: ganabilidad (0006 · W1: 1 de 10 semillas gana con el bot) y semillas frágiles (0007 · S2). Ajustar
  `content/*.json`. **Medir en *explore*, no en *apply*** (lección de 0006).
- **Fuera de alcance**: contenido nuevo (jefe, armas extra), meta-progresión.
- **Criterios**:
  - Given el bot de referencia y 10 semillas, When se simulan 600 s, Then gana al menos el porcentaje objetivo
    acordado en *explore*.
  - Given los tests de balance, When cambia el contenido, Then no dependen de una semilla concreta (o la derivan
    de una medición).
  - Given el E2E que hoy usa la semilla 90, When se actualiza, Then no depende de que esa semilla pierda antes.
- **Riesgos**: sobreajustar al bot; playtest humano escaso; el objetivo de ganabilidad sin definir.

### 0011 public-deploy (hecho, PR #24)
- **Objetivo**: último Must; juego jugable en una URL pública.
- **Alcance**: despliegue en GitHub Pages con base `/tfm-survivors/`; comprobar la CSP en producción.
- **Fuera de alcance**: dominio propio, PWA, analítica, backend.
- **Criterios**:
  - Given un merge a `main` con `quality` verde, When termina el despliegue, Then la URL pública carga el juego.
  - Given la build publicada, When se abre la consola, Then no hay violaciones de CSP.
  - Given la URL pública, When se juega, guarda, exporta e importa, Then funciona igual que en local.
- **Riesgos**: rutas con base distinta de `/` que rompan assets; CSP que bloquee algo que en local no falla;
  consumo de minutos de CI en el plan gratuito.
