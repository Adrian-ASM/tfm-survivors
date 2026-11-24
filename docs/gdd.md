# Greentide Vanguard · GDD-lite · v2.0 (v1 aprobado 2026-11-19; v1.1 tras 0007; v2.0 "medieval" decidida 2026-11-22, tras 0011)

> Borrador que mantiene el agente `game-designer`; las decisiones son del autor. La v2.0 cambia la visión
> (temática, género, mapa, recursos); lo construido en 0001–0011 se conserva y se reutiliza.

## Concepto
Juego 2D para navegador, partidas de 5 a 10 minutos (que inviten a echar otra; 10 min como máximo):
**survivors-like + exploración + toques de tower defense**.
Un caballero de la facción (arquetipo inicial: Arquero) contra hordas de goblins en un mapa medieval generado por
semilla. El jugador solo se mueve; las armas
atacan solas; al subir de nivel elige 1 de 3 mejoras; explorar el mapa se recompensa con recursos que se gastan en
mejorar el arma y en construir defensas.

**Temática** (v2.0, 2026-11-22): caballeros contra goblins. Título: **"Greentide Vanguard"** (decidido 2026-11-22),
que sustituye a "Sprint Survivors" (dev en un sprint infinito; v1 la había elegido para no parecerse a
*Bug Bane Survivors*). Los ids de enemigo pasan a `goblin-torch` (antes `bug`), `goblin-tnt` (`memory-leak`) y
`goblin-barrel` (`merge-conflict`), con los mismos stats; sus comportamientos propios siguen en 0020. El nombre del
repo, la URL de Pages y las claves técnicas `sprint-survivors` (localStorage, nombre del export, `window.__sprint`)
se mantienen; renombrarlos es una posible tarea futura, no decidida.

**Arte base**: Tiny Swords "Update 010" de Pixel Frog (versión antigua, **CC0**: se puede versionar y publicar).
El Free Pack actual **no** es CC0 (prohíbe redistribuir): solo uso local, nunca en el repo ni en Pages.
El autor **confirmó (2026-11-22) que Update 010 es CC0**, lo que desbloquea 0012. Conviene guardar en el repo
una nota de procedencia y licencia junto a los assets.

## Pilares
1. **El jugador solo se mueve; las armas disparan solas** (se mantiene de v1).
2. **Explorar se recompensa**: cofres, vetas, ovejas y campamentos están lejos del punto de partida.
3. **Tres monedas, tres papeles**: XP mejora al personaje, Oro mejora el arma, Madera construye defensas.

## Core loop
Moverse y explorar → esquivar → las armas matan → recoger XP, oro, madera y carne → subir de nivel (mejora de
personaje) → gastar oro en el castillo (mejora de arma) → gastar madera en solares de obra (casa o torre) →
sobrevivir más tiempo y destruir objetivos goblin.

## Controles
Teclado (WASD / flechas). Pausa con Esc. Táctil y gamepad: *Should/Could*.

## Victoria y derrota
- Derrota: la vida llega a 0. Pantalla de resultados con tiempo, nivel y enemigos eliminados.
- **Modos de partida** (candidatos; Supervivencia es el modo por defecto de los Must):
  - **Supervivencia** (*Must*, el actual): sobrevivir hasta el final del temporizador. Hay que revisar la duración,
    porque explorar para mejorar consume tiempo (pregunta abierta).
  - **Objetivos** (*Should*): p. ej. destruir N casas goblin o campamentos.
  - **Infinito** (*Could*): hasta morir, con máxima puntuación.
  - Variante *Could*: defender el castillo.

## Diseño de la nueva visión

### Mapa
- **Procedural por semilla** y determinista (misma semilla → mismo mapa; usa el puerto `RandomGenerator`, no
  `Math.random`). Rejilla de 60 px (32×18 en el mundo de 1.920×1.080; decidido en 0015): hierba, bosques (manchas), árboles sueltos, agua/ríos y puentes.
- **Conectividad garantizada**: toda zona relevante es alcanzable (puentes sobre el agua).
- Mundo de varias pantallas, cámara que sigue al jugador, **límites duros** (borde de agua). **Sin desniveles.**
- Colisión del jugador contra troncos (no contra la copa) y agua.
- **El castillo ya viene en el mapa**, uno por partida, en el punto de inicio del jugador: el generador reserva la
  zona de inicio con el castillo (0015 reserva la zona; el castillo sólido llega con 0016 y la tienda con 0023).
- Genera también: zonas ricas en recursos con campamentos de guardianes, casas goblin, torres goblin, solares de obra
  y montones de leña aleatorios.

### Navegación de enemigos
Campo de flujo (*flow field*) desde la celda del jugador; los enemigos usan los puentes. Los edificios propios
bloquean celdas y obligan a recalcular el campo al construirse. Encaja con la deuda "sin separación entre enemigos
la horda se amontona".

### Personajes (`content/characters.json`)
Se elige al inicio:
- **Arquero**: arco (el arma de proyectil actual, reconvertida).
- **Guerrero**: tajo en arco hacia donde mira (parte del pulso actual `tests`, un área circular alrededor del jugador, y pasa a un arco frontal) + pasiva de
  bloqueo "Guard"; más vida y menos velocidad.
- Decidido: las armas actuales se reconvierten en arco y tajo; no se crean armas nuevas por ahora.

### Enemigos y comportamientos
Máquina de estados por tipo, definida en contenido:
- **Goblin Barril** (kamikaze): aparece alrededor de la pantalla, va directo, explota, suelta madera.
- **Goblin TNT** (de guardia): nace en casas goblin, patrulla un radio; al entrar el jugador en su radio de alerta
  lanza dinamita con aviso en el suelo; vuelve a su puesto si el jugador se aleja.
- **Goblin Antorcha**: cuerpo a cuerpo, perseguidor.
- **Campamentos de guardianes** en zonas ricas en recursos (generados con el mapa).
- **Casas y torres de madera goblin**: generadores/defensas **destruibles** (única excepción a "edificios
  indestructibles"). Destruirlas da recompensa: oro por objetivos.

**Bestiario solo con el pack** (no se dibujan enemigos nuevos con IA; el Enemy Pack de pago queda descartado por
licencia): caballeros rivales de otro color (arqueros, guerreros, peones), variantes de élite por color de goblin,
jefes por escala (p. ej. Antorcha 1,6×), TNT lanzabarriles, torres goblin. Recoloreado por script como opción.
Objetivo ~8–10 tipos.

### Recursos
- **Oro**: cofres y vetas al explorar, objetivos destruidos, casas propias.
- **Madera**: barriles goblin y montones aleatorios por el mapa. **Talar árboles: no por ahora** (sigue *Could*;
  un árbol destruible obligaría a recalcular el campo de flujo).
- **Carne**: ovejas neutrales que deambulan y huyen; curan.
- Las gemas de XP (0005) se generalizan a **recogibles con tipo**.

### Progresión separada
- **XP → mejoras de personaje** (salud, velocidad, velocidad de ataque…): pausa y 1 de 3, como hoy.
- **Oro → mejoras del arma** (daño, alcance…) en el **castillo-tienda**: entrar abre la tienda con pausa; dentro
  cura despacio.
- **Madera → construir** en **solares de obra** del mapa: al pasar con madera suficiente se elige casa o torre
  (pausa breve; sprites `*_Construction` del pack). Colocación libre = *Could*.
- El `upgrades.json` actual mezcla personaje y arma: se separa.

### Edificios propios (indestructibles)
- **Casa**: da oro cada X s. **Torre**: dispara flechas a enemigos cercanos (reutiliza el arma de proyectil con
  origen fijo). **Castillo**: tienda única de mejoras de arma + curación; uno por partida, ya en el mapa, en el punto de inicio.

### UI con el pack (*Could*, al final)
Barras, cintas, papel/mesa para las cartas, botones; nine-slice; fuente pixel local (la CSP estricta impide cargarla
de fuera).

## Backlog MoSCoW (v2.0, tentativo)
Propuesta de alcance para el TFM; los changes concretos están en "Orden tentativo". Un Must nuevo exige bajar otro a
Should.

| Prioridad | Contenido |
|---|---|
| **Must** (hecho) | Movimiento · 2 armas automáticas · oleadas · colisiones y vida · gemas de XP · subida de nivel con 3 opciones · temporizador, victoria y derrota · HUD · menú · guardado local + exportar/importar · despliegue público (0001–0011) |
| **Must** (nuevo) | Arte con sprites del pack CC0 y tema medieval (0012) · mundo grande con cámara y límites (0013) · mapa procedural por semilla con colisión (0015) · arte del mapa (0016) · vista a pantalla completa (0017) · recorte del arte del mapa fuera de cámara (0018) · navegación por campo de flujo (0019) |
| **Should** | Comportamientos de enemigos, casas goblin y campamentos (0020) · elección de personaje y Guerrero (0021) · recursos y ovejas (0022) · progresión separada y castillo-tienda (0023) · solares de obra: casa y torre (0024) · modo Objetivos · meta-progresión guardada · un jefe final · opciones de audio y accesibilidad · controles táctiles |
| **Could** | UI del pack · ciclo día/noche · minimapa/niebla de guerra · modo Infinito · victoria "defender el castillo" · talar árboles · colocación libre de edificios · jefes por escala · audio · login con Google + Supabase · reto diario con semilla compartida · i18n ES/EN · PWA |
| **Won't** | Multijugador · desniveles/terreno multinivel · monetización · leaderboard con re-simulación · enemigos dibujados con IA |

Nota: v1 tenía "mapas procedurales complejos" en Won't. Se acota a un mapa de rejilla sin desniveles y entra como
Must (0015); lo que baja a Should es todo el bloque de contenido 0020–0024.

Renumeración (2026-11-23): 0014 acabó siendo `e2e-manual-step` (infraestructura de tests), así que el mapa
procedural pasa a 0015. Al aprobar 0015 se partió en mapa puro (0015) y arte del mapa (0016), y se añadió la vista
a pantalla completa (0017); el campo de flujo pasa a 0018 y el bloque Should, a 0019–0023.

Renumeración (2026-11-24): 0018 acabó siendo `map-culling` (recorte del arte del mapa fuera de cámara), así que el
campo de flujo pasa a 0019 y el bloque Should, a 0020–0024.

### Historias Must nuevas (criterios clave)

**0012 · Como jugador quiero ver caballeros y goblins con sprites del pack para que el juego tenga identidad
medieval.**
- Given el repo, When se hace `git ls-files`, Then solo hay assets cuya licencia CC0 está registrada (no el Free Pack).
- Given una partida, When se renderiza, Then jugador y enemigos usan sprites animados y el núcleo no cambia.

**0013 · Como jugador quiero explorar un mundo más grande que la pantalla para tener algo que descubrir.**
- Given el jugador en el borde del mundo, When sigue empujando, Then no sale de los límites.
- Given el jugador moviéndose, When avanza, Then la cámara lo sigue y los enemigos aparecen alrededor de la vista.

**0015 · Como jugador quiero un mapa distinto por semilla, con bosques y ríos, para que cada partida se sienta
nueva.**
- Given la misma semilla, When se genera dos veces, Then los mapas son idénticos celda a celda.
- Given cualquier semilla de 1..50, When se genera, Then el jugador alcanza todas las zonas clave.
- Given un tronco o una celda de agua, When el jugador se mueve contra ella, Then no la atraviesa; la copa sí
  (la copa llega con el arte de 0016; en 0015 el mapa se pinta con colores de reserva).

**0016 · Como jugador quiero ver agua, orillas, árboles y puentes con el arte del pack para que el mapa se lea de
un vistazo.**
- Given el repo, When se hace `git ls-files`, Then los tiles nuevos tienen su entrada CC0 en la nota de procedencia.
- Given un mapa generado, When se renderiza, Then las orillas usan autotile y el agua tiene espuma animada.
- Given el mapa real, When empieza la partida, Then hay un castillo Blue sólido (huella de ~5 × 4 celdas) que el
  jugador no atraviesa y el jugador nace ante su puerta; con `map=empty` no hay castillo y nace en el centro.
- Given un árbol o el tejado del castillo, When una entidad pasa por detrás, Then la copa y el tejado se pintan por
  encima de jugador, enemigos y proyectiles; el tronco bloquea y la copa no.
- Given las semillas 1..50 con el castillo, When se mide con el bot de referencia, Then el balance sigue en banda
  (`player.speed` 215) y el mapa es idéntico celda a celda por semilla.
- Nota: el castillo cambia el núcleo (dominio, generador, firma dorada, bot de referencia y punto de salida). Los
  enemigos lo atraviesan hasta 0019 (deuda aceptada).

**0017 · Como jugador quiero que el juego ocupe todo el monitor para ver más mapa a mi alrededor.**
- Given cualquier tamaño de ventana, When se juega, Then la vista ocupa la ventana completa y la cámara sigue al
  jugador hasta los bordes del mundo.
- Given la misma semilla en dos monitores distintos, When se simula, Then la partida es idéntica (la distancia de
  aparición de enemigos no depende del tamaño de la pantalla).

**0019 · Como jugador quiero que los enemigos rodeen obstáculos y usen puentes para que la horda no se quede
atascada.**
- Given un río con un puente, When el jugador está al otro lado, Then los enemigos cruzan por el puente.
- Given 300 enemigos, When se simula el campo de flujo, Then el tick se mantiene dentro del presupuesto fijado en el
  spike previo.
- Nota: el criterio del recálculo por edificios nuevos pasa a 0024 build-sites (en 0019 el mapa no cambia durante
  la partida). Se acepta el apilamiento en los puentes (sin separación entre enemigos).

**0024 · build-sites (criterio movido desde el campo de flujo).**
- Given un edificio nuevo, When se construye, Then el campo se recalcula y los enemigos lo rodean.

## Estado del backlog Must hecho (2026-11-20, sin cambios)
| Estado | Contenido | Change |
|---|---|---|
| Hecho | Movimiento · oleadas con 3 tipos de enemigo · colisiones y vida · 2 armas automáticas | 0001–0004 |
| Hecho | Gemas de XP · subida de nivel con 3 opciones | 0005 |
| Hecho | Temporizador, victoria y derrota · HUD · reinicio | 0006 |
| Hecho | Guardado local (récords + historial de 10 partidas) · exportar/importar con fusión · CSP estricta | 0007 |
| Hecho | Menú de inicio (jugar, exportar, importar, borrar datos) · pausa con Esc | 0009 |
| Hecho | Despliegue público en GitHub Pages · smoke remoto a demanda (`npm run smoke:public`, workflow `smoke-public`) | 0011 |

Los changes 0008 (infraestructura de tests) y 0010 (equilibrio) no añaden Must: habilitan y protegen a los demás.

## Orden tentativo de changes (v2.0; tentativo, se revisa tras cada spike)
Hechos: 0001 walking-skeleton → 0002 enemy-spawning → 0003 collisions-and-damage → 0004 auto-weapons →
0005 xp-and-level-up → 0006 run-lifecycle + HUD → 0007 local-save-export → 0008 e2e-fast-sim →
0009 main-menu → 0010 balance-pass → 0011 public-deploy → 0012 sprite-rendering → 0013 world-camera →
0014 e2e-manual-step → 0015 procedural-map → 0016 map-art → 0017 fullscreen-view → 0018 map-culling.

Pendientes:
| Change | Contenido | Prioridad | Spike previo |
|---|---|---|---|
| 0015 procedural-map | **Hecho (PR #36)**: mapa por semilla (hierba, troncos, río con puentes) puro y determinista, colisión del jugador, gemas recolocadas, colores de reserva, bot de referencia que esquiva y balance recalibrado; reserva la zona de inicio (ADR-0013) | Must | Sustituido por mediciones previas en explore |
| 0016 map-art | Arte del mapa: agua con espuma, orillas con autotile, árboles (copa), puente y castillo sólido (núcleo, generador, firma dorada, bot, punto de salida; `player.speed` 215), con su procedencia CC0 | Must | Autotiling de orillas y si el mapa se ve bien (puerta visual al inicio del apply) |
| 0017 fullscreen-view | **Hecho (PR #41)**: la vista ocupa toda la ventana (tope 2.560 × 1.440); aparición de enemigos desacoplada del tamaño de pantalla (anillo 1.500); mundo 3.840 × 2.160 (64 × 36); HUD y overlays anclados y escalados ×1/×2; balance recalibrado por oleadas (25/50) | Must | |
| 0018 map-culling | **Hecho (PR #43)**: recorte del arte del mapa fuera de cámara | Must | |
| 0019 flow-field | Navegación por campo de flujo (4 vecinos + línea libre, recolocación de apariciones, `maxAlive` 300) | Must | Con cientos de enemigos |
| 0020 enemy-behaviors | **Parte A hecha**: comportamiento por tipo en contenido (persecución, mecha, carga y espera), barril kamikaze con aviso y explosión de área, TNT artillero provisional con dinamita y aviso, fuego amigo, bot v3 que esquiva y balance 27/50 (ADR-0018). **Parte B pendiente** (change propio): casas y torres goblin destruibles, TNT de guardia con patrulla y alerta, campamentos | Should | |
| 0021 characters | Elección de personaje y Guerrero | Should | ¿Es divertido el Guerrero? |
| 0022 resources-sheep | Recursos recogibles con tipo y ovejas | Should | |
| 0023 split-progression-castle | Progresión separada + castillo-tienda (castillo ya en el mapa) | Should | |
| 0024 build-sites | Solares de obra: casa y torre (incluye el recálculo del campo de flujo por edificios) | Should | |
| Resto | UI del pack, día/noche, minimapa, jefes, audio | Could | |

Notas:
- **Marcado Must/Should/Could es una propuesta para el TFM, no un compromiso.** Si el tiempo aprieta, se corta por
  el final de la lista.
- Cualquier change que toque `content/` (0015 en adelante) obliga a **volver a medir** la banda de victorias de 0010
  (ver 0010 · W2). Con personajes y recursos el bot de referencia deberá adaptarse.
- El mapa, el campo de flujo y las colisiones deben vivir en `domain`/`application` (puros y deterministas); Phaser
  solo dibuja.

## Preguntas abiertas
Decididas (2026-11-22, ya recogidas arriba): castillo en el punto de inicio del mapa; no talar árboles por ahora;
Update 010 es CC0; armas actuales reconvertidas en arco y tajo; Supervivencia por defecto, Objetivos *Should*,
Infinito *Could*.

Cerrada (2026-11-22): **Título** = "Greentide Vanguard" (ver Temática). Renombrar repo, URL de Pages y claves
`sprint-survivors` queda como posible tarea futura, no decidida.

Siguen abiertas:
1. **Duración del temporizador** en Supervivencia: objetivo de 5 a 10 minutos por partida (que invite a echar otra),
   con 10 min como máximo. Hoy dura 600 s. Se fija con playtests cuando estén el mapa y la exploración; cambiarla
   obliga a volver a medir el balance.
2. **Equilibrio**: sin criterio nuevo. La banda 25–35 de 0010 no se da por válida con el nuevo mapa y los recursos;
   se decidirá iterando con playtests y el bot tras cada change de contenido.

## Deuda registrada
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
| 0009 · W2 | **Saldada con 0012.** Sin E2E que compruebe los sprites tras Volver al menú ni el escenario "Cinco ciclos menú-partida" (la sonda no cuenta sprites); la limpieza depende de que Phaser destruya la escena al apagarla. | Change 0012 (hecho) |
| 0009 · W6 | Dos E2E juegan con semilla aleatoria (lo exige la spec tras Volver al menú) a `speed=15`: duración no determinista, timeout holgado. | Vigilar el job `e2e` |
| 0010 · W1 | "Sin semillas sueltas de balance" se comprueba con grep, sin test automático que lo vigile. | Si reaparecen semillas fijas |
| 0010 · W2 | Margen estrecho de la tasa: 30/50 en una banda 25–35, con ±3–4 victorias de ruido entre factores contiguos. Un ajuste pequeño de contenido puede sacarla de la banda: hay que volver a medir. | Cualquier change que toque `content/` (todos los de 0015 en adelante) |
| 0009 · S5 | El test de "Primer frame tras Jugar" declara 601 frames de menú que no llega a pasar al bucle; la garantía es estructural (bucle nuevo por partida). | Con 0010 si se toca `run-launcher.test.ts` |
| v2.0 | Sin separación entre enemigos la horda se amontona. | Pendiente, change propio (0019 la mantiene: apilamiento en puentes aceptado) |
| v2.0 | `upgrades.json` mezcla mejoras de personaje y de arma. | Con 0023 |

## Historial de changes hechos (resumen)

### 0008 e2e-fast-sim · hecho
Derrota E2E de ~78 s a ~10 s: `?speed=N` ejecuta varios ticks por frame solo en el adaptador (núcleo intacto,
determinismo preservado) y los E2E siembran `localStorage`. Descartado un atajo "terminar ya" en el núcleo (0007).

### 0009 main-menu · hecho
Menú de inicio (jugar, exportar, importar, borrar datos con confirmación) y pausa con Esc; `?seed=` y `?e2e` siguen
funcionando (ADR-0011).

### 0010 balance-pass · hecho (PR #20)
Con el bot de referencia (huida + elección priorizada) gana 30 de las semillas 1..50 (banda 25–35) y quieto pierde
con todas antes de 180 s (máx. ~94 s). Palanca: `budgetPerSecond` ×0,8 en los tramos de 300 y 480 s. Ver spec viva
`run-outcome`. Lección: medir en *explore*, no en *apply*.

### 0011 public-deploy · hecho (PR #24)
El despliegue ya existía en `ci.yml`; el change añadió la spec `public-deploy`, el smoke remoto a demanda y la nota
de CSP en Pages de ADR-0004. Aviso v2.0: lo que se publique en Pages debe ser solo CC0 (ver Concepto).

### 0012 sprite-rendering · hecho
Sprites animados del pack Update 010 (CC0) para el jugador (Arquero) y los goblins, con nota de procedencia en
`content/asset-provenance.json`; ids de enemigo `goblin-torch`, `goblin-tnt`, `goblin-barrel` con los mismos stats.
Núcleo sin cambios. Salda la deuda 0009 · W2.

### 0013 world-camera · hecho
Mundo de 1.920×1.080 con vista de 960×540, cámara que sigue al jugador recortada al mundo y textos medievales de
las mejoras. Balance 25/50 con el mundo 2x.

### 0014 e2e-manual-step · hecho
Avance manual en E2E (`?e2e&manual` y `window.__sprint.step(n)`) y proyectos Playwright `logic` y `realtime`.
Infraestructura de tests: no añade Must. Desplaza un número el resto del orden.
