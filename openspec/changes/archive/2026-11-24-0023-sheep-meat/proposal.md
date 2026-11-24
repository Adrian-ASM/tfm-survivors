# Proposal · 0023-sheep-meat

- **Estado**: aprobada (2026-11-24), tal cual, con las ovejas detrás de las estructuras como objetivo de reserva de
  las armas (enemigos → estructuras → ovejas)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0023-sheep-meat` (`.claude/worktrees/sheep-meat-0023-d717ee`)
- **Origen**: GDD, historia Should 0023 `sheep-meat` (separada de 0022); exploración en `exploration.md`.

## Problema
Hoy el jugador no puede recuperar vida de ninguna forma: `Health` solo baja (daño) o sube su máximo (mejora). Cada
golpe es permanente durante toda la partida, y explorar el mapa solo da oro y madera, que aún no se gastan en nada.
El GDD (pilar "explorar se recompensa") pide ovejas neutrales que deambulan, huyen del jugador y, al abatirlas,
sueltan carne que cura. Es la primera fuente de curación del juego y la primera entidad neutral (ni enemigo ni
estructura).

## Objetivo
En una partida con el mapa generado hay unas pocas ovejas (tope de vivas en contenido, 4–5 por defecto) que
deambulan por celdas caminables y huyen del jugador cuando se acerca. Las armas las apuntan solo cuando no tienen
ningún enemigo en su criterio, y las explosiones también las dañan. Al morir, una oveja suelta una pieza de carne
(recogible nuevo `meat`, con tope). Al recogerla, el jugador recupera una cantidad moderada de vida (en torno al 20 %
de su vida máxima vigente, por contenido), sin pasar de la vida máxima. Las ovejas abatidas reaparecen con el paso
del tiempo en otros puntos del mapa hasta volver al tope. Todo es determinista por semilla y queda fuera de bajas y
resultados.

## Alcance
- **Dentro**:
  - **Entidad oveja propia** (opción B de la exploración), separada de la horda: lista, ids y vista propias en el
    snapshot (`sheep`). No pasa por `Horde`, `WaveDirector`, `maxAlive` ni el presupuesto de oleadas.
  - **Contenido sin números mágicos** (`content/*.json` validado con zod): vida y velocidad de la oveja, radio de
    huida, parámetros del deambular, tope de ovejas vivas (4–5 por defecto), intervalo de reaparición en ticks,
    reglas de colocación inicial y de reaparición (distancia mínima al inicio/jugador y "otro punto"), curación de
    la carne y tope de carne en el suelo.
  - **Colocación inicial** solo en el mapa generado (como estructuras, montones y vetas), sobre celdas caminables
    candidatas y fuera de la zona de inicio. Usa un **flujo de azar propio de ovejas** derivado de la semilla, de modo
    que `MAP_GOLDEN`, `STRUCTURE_GOLDEN` y `RESOURCE_GOLDEN` no cambian, y hay una firma dorada nueva de las ovejas
    iniciales. Los mapas de escenario (`open`/`cells`, `map=empty` en E2E) no tienen ovejas salvo que se declaren.
  - **Deambular**: sin el jugador dentro del radio de huida, la oveja se mueve solo por celdas caminables (respeta
    agua, troncos, castillo y bordes, con el barrido por ejes del jugador). El azar que use es determinista (sin
    `Math.random`) y no consume el generador de oleadas.
  - **Huida solo del jugador**: con el jugador dentro del radio de huida, la oveja se aleja de él sin atravesar celdas
    bloqueadas. Puede quedarse atascada contra una pared (aceptable).
  - **Reaparición**: cuando hay menos ovejas vivas que el tope, cada hueco se rellena al cumplirse el intervalo de
    contenido. La oveja nueva aparece en una celda caminable candidata **distinta** de donde murió la anterior y a una
    distancia mínima del jugador (regla de contenido), elegida con el flujo de azar de ovejas. Mismo orden y
    resultado con la misma semilla y la misma entrada.
  - **Daño**: las armas apuntan a una oveja solo cuando no hay ningún enemigo en su criterio, como con las
    estructuras de 0021. El orden relativo ovejas/estructuras se fija en la spec; se propone **después de las
    estructuras**. Los pulsos y las explosiones (barril, dinamita) dañan a las ovejas que alcanzan.
  - **Carne**: nuevo tipo `meat` en la unión cerrada de recogibles (ADR-0021: un tope más y un valor más), con tope
    propio y el relleno "suma al más antiguo de su tipo". Solo la sueltan las ovejas; ningún enemigo ni estructura.
    Se recoge como el resto (radio de recogida e imán) y no se guarda.
  - **Curación**: primera operación de curar en `Health`. Suma la cantidad de contenido con tope en la vida máxima, y
    no cambia si la vida ya está al máximo. No resucita: la carne se recoge después de aplicar el golpe del tick,
    así que no salva el tick de la muerte.
  - **Fuera de bajas y resultados**: abatir ovejas no suma a `kills`, ni a resultados, récords ni historial.
  - **Render y arte**: sprites animados de la oveja (`HappySheep_Idle`, `HappySheep_Bouncing`) y de la carne
    (`M_Idle`) de Tiny Swords Update 010, CC0, copiados a `public/assets` con su entrada (sha256) en
    `content/asset-provenance.json`, con aspecto de reserva si una hoja no carga y barra de vida de la oveja si el
    patrón de estructuras lo aplica. Sin aviso visual de curación aparte: basta la barra de vida del jugador.
  - **Sonda E2E**: recuentos de ovejas (`sprites.sheep`) y de carne (`sprites.pickups.meat`) y estado de ovejas en
    la sonda del mapa/snapshot. Como máximo 1–2 E2E nuevos (regla `e2e-lite`), preferiblemente ampliando la suite de
    humo.
- **Fuera**:
  - Ovejas que huyen de los enemigos o que reaccionan a explosiones o avisos.
  - Ovejas que cuentan como bajas, o estadísticas de ovejas o carne en resultados, récords o historial.
  - Campamentos de guardianes en zonas ricas (`goblin-guard-camps`) y cualquier vínculo oveja–campamento.
  - Ovejas en rebaños, crías, cercados o pastoreo, y ovejas que atacan o hacen daño de contacto.
  - Que los enemigos ataquen, persigan o esquiven ovejas, o colisiones oveja–enemigo y oveja–oveja.
  - Otras fuentes de curación (castillo, mejoras de regeneración, pociones) o curación por tiempo.
  - Aviso de curación (texto flotante, destello o sonido) y contador de carne en el HUD.
  - Gastar oro o madera (`build-sites`) y separar la progresión (`split-progression-castle`).
  - Recalibrar oleadas, curva de XP o `player.speed`, y cambios en el bot de referencia salvo los imprescindibles
    para medir (el bot no persigue ovejas ni carne).

## Capacidades afectadas
- `openspec/specs/sheep` (nueva): entidad, contenido, colocación, deambular, huida, vida, muerte, reaparición,
  determinismo y exclusión de `kills`.
- `openspec/specs/xp-gems` (modificada): tipo `meat` en la unión de recogibles, tope y pool de Σ topes.
- `openspec/specs/resources` (modificada): fuente de carne (solo ovejas) y valor de la pieza.
- `openspec/specs/player-health` (modificada): curación con tope en la vida máxima.
- `openspec/specs/simulation-loop` (modificada): orden del tick (movimiento de ovejas, daño, reaparición, recogida y
  curación), snapshot `sheep` y determinismo con el flujo nuevo.
- `openspec/specs/auto-weapons` (modificada): ovejas como objetivo de reserva sin enemigos en el criterio, en el
  orden respecto a las estructuras que fije la spec.
- `openspec/specs/enemy-hazards` (modificada): las explosiones dañan a las ovejas.
- `openspec/specs/procedural-map` (modificada): colocación inicial de ovejas en el mapa generado y su firma dorada.
- `openspec/specs/sprite-rendering` (modificada): sprites de oveja y carne, reserva y sonda.
- `openspec/specs/asset-provenance` (modificada): entradas de las hojas nuevas.
- Sin cambios previstos: `run-outcome`, `run-results`, `progress-persistence` (la exclusión de `kills` se especifica
  en `sheep`), `enemy-spawning`, `leveling`, `hud`.

## Riesgos y dudas
- **Riesgo principal: curación total con reaparición.** Como las ovejas vuelven, la curación disponible por partida
  no tiene un límite fijo. Un jugador quieto cuyas armas maten ovejas que deambulan cerca, o que reciba carne al
  alcance del imán, podría curarse lo bastante para sobrevivir y romper "quieto pierde antes de 180 s". Lo mitigan la
  huida, la distancia mínima de aparición y el intervalo, pero hay que medirlo en apply con las 50 semillas. Si el
  quieto sobrevive, se ajustan los parámetros de contenido (intervalo, distancia, curación, tope), no la regla.
- **Balance de armas**: que las armas apunten a ovejas cambia la cadencia de disparo útil semilla a semilla (ya
  pasó con las estructuras). Al ir detrás de enemigos (y de estructuras), el efecto debería ser pequeño, pero no hay
  mediciones previas.
- **Determinismo del flujo de ovejas**: la colocación inicial y la reaparición comparten el flujo de ovejas. La firma
  dorada inicial no puede depender de lo que pase en la partida, así que la reaparición debe consumir el flujo
  **después** de la colocación inicial, o en un subflujo propio. Lo decide el design. Tampoco se toca el generador
  de oleadas.
- **Relleno por tope de carne**: si se llena el tope, la pieza más antigua acumula valor y cura más del ~20 %
  (siempre acotado por la vida máxima). Es aceptable y debe quedar en un escenario.
- **Curación relativa a la vida máxima vigente**: con la mejora de `maxHealth`, la carne cura en proporción al
  máximo actual. La spec fija el redondeo (vida entera) y que la fracción sale del contenido.
- **Huida contra paredes**: una oveja puede quedarse atascada contra el río o el castillo. Es aceptable mientras no
  cruce celdas bloqueadas.
- **Rendimiento**: coste por tick bajo con 4–5 ovejas, pero el pool de recogibles pasa a 4 topes y la retro de 0022
  avisa de +8 % en el lote. Las ovejas son sprites dinámicos y no entran en el plan del mapa (tope de 1.000
  objetos, hoy 701/784).
- **Tamaño**: dominio, contenido, render, sonda, arte y unas 10 specs delta. Los MODIFIED deben copiar completos los
  requisitos vivos que tocan.
- **Duda para el gate**: orden de las ovejas frente a las estructuras como objetivo de reserva (se propone después
  de las estructuras).

## Criterio de éxito
- Todos los escenarios de las specs delta están en verde con tests unitarios o de aplicación. Los E2E nuevos son
  como mucho 1–2, en modo manual, y la suite `logic` sigue en verde. `npm run verify` está en verde.
- **Determinismo**: misma semilla y misma entrada dan ovejas, carne, reapariciones y vida idénticas tick a tick.
  `MAP_GOLDEN`, `STRUCTURE_GOLDEN` y `RESOURCE_GOLDEN` no cambian y hay una firma dorada nueva de las ovejas
  iniciales (semillas 42 y 123).
- **Exclusión**: en una partida en la que se abaten ovejas, `kills`, resultados, récords e historial son idénticos a
  los de una partida igual sin ovejas abatidas.
- **Balance (gate de apply, sin objetivo numérico nuevo)**: sobre las semillas 1..50 con el bot de referencia v3, las
  victorias siguen en la banda viva **25–35/50** (línea base `balanceBaseline.ts`: 27/50; se informa la nueva cifra
  y su diferencia), y el invariante **"quieto pierde antes de 180 s"** se cumple en las 50 semillas (0 quietos que
  ganan). Se informa además la curación total media por partida del bot y del quieto, y las ovejas abatidas.
- **Rendimiento (informativo)**: el bench de recogibles con 4 topes y el lote de balance se miden y se comparan con
  0022 (bench 0,27 ms; lote 28–32 s local). Una subida del lote de más del 5 % se justifica en el verify-report.
  Ninguno bloquea CI.
- **Procedencia**: `guard:all` en verde con las hojas nuevas registradas y nada del Free Pack.
