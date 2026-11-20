# Proposal · 0010-balance-pass

- **Estado**: aprobada (gate humano superado el 2026-11-20; respuestas en "Decisiones del gate")
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0010-balance-pass`

## Problema
- **Ganabilidad (deuda 0006 · W1)**. Con el contenido actual el bot de 0006 (`fleeInput` + opción 0) gana el 5 % de
  las semillas 1..100, y con elección priorizada solo el 34 % (mediciones de `exploration.md`). La partida es
  demasiado dura y la única prueba de que se puede ganar es una semilla suelta (`WIN_SEED` = 2).
- **Tests frágiles (deuda 0007 · S2)**. `balance.test.ts` y dos E2E (`progress.spec.ts`, `menu-progress.spec.ts`)
  dependen de semillas concretas: la 2 (victoria) y la 90 (la que pierde antes sin input, tope 4.560 ticks). Si
  cambia el contenido, esas semillas dejan de cumplir y hay que buscar otras a mano.
- La política de opción 0 elige mejoras al azar y no representa a un jugador con criterio, así que no sirve como
  referencia de dificultad.

## Objetivo
Cuando el change esté hecho:
1. Existe un **bot de referencia** versionado como helper de test: movimiento `fleeInput` y elección priorizada
   (de la oferta, la primera mejora presente según `guardrail` > `strict-rules` > `fast-ci` > `hard-asserts` >
   `watch-mode`; si no hay ninguna, la opción 0).
2. Con el contenido por defecto, el bot de referencia **gana entre el 50 % y el 70 %** de las semillas de un conjunto
   fijo, **1..50** (de 25 a 35 victorias de 50, ambos incluidos).
3. Un **jugador quieto** (input (0, 0) y política de elección fija) **pierde con todas las semillas 1..50** antes de
   **180 s** de partida (T = 10.800 ticks). Es un objetivo de balance, no solo un plazo de test.
4. Ningún test de balance fija una semilla concreta: la victoria de la semilla 2 y la derrota de la semilla 90 se
   sustituyen por la tasa y el invariante anteriores, calculados sobre el conjunto.
5. Los E2E que usaban la semilla 90 dejan de depender de ella: usan la semilla **42**, miembro del conjunto, que
   pierde quieta por el invariante anterior, con un plazo de como mucho 180 s de juego. No se añade ningún parámetro
   de URL nuevo.

N = 50 por coste: se midieron 35–190 ms por partida (el bot priorizado es el más caro), así que la tasa de victoria
cuesta unos 2–10 s y el invariante "quieto pierde" menos (sus partidas acaban antes). Entra en `npm run verify` sin
superar el presupuesto de 10–15 s de la exploración. Con 50 semillas, cada victoria vale 2 puntos porcentuales.

## Alcance
- **Dentro**:
  - Ajuste de números **solo en `content/*.json`** y su espejo en `tests/support/builders.ts`, que debe seguir igual
    al JSON (si falta un test de igualdad JSON-espejo para oleadas, enemigos, mejoras o jugador, se añade).
  - Candidato medido (tras el gate): reducir `budgetPerSecond` de los tramos con `fromSecond` ≥ **180** (×0,7 dio
    34/50 con el bot de referencia sobre 1..50, en el borde superior de la banda). Suavizar desde 60 s o subir la
    vida del jugador rompe "quieto < 180 s" (ver "Medición complementaria tras el gate" en `exploration.md`).
    **El valor final lo fija apply** midiendo sobre 1..50 hasta caer dentro de la banda; puede ser otro factor o
    combinarse con otra palanca de contenido si la medición lo pide, documentándolo.
  - El bot de referencia como helper versionado en `tests/support/`.
  - Test unitario de tasa de victoria (1..50, banda 50–70 %) y de "quieto pierde" (1..50, todas antes de 180 s),
    ambos dentro de `npm run verify`.
  - Reescritura de `balance.test.ts` sin `WIN_SEED` ni semilla 90 fijas; revalidación de los plazos que citan las
    specs archivadas (ver Riesgos) y de los timeouts de los E2E afectados.
  - Actualizar en las specs los escenarios que nombran la semilla 90 o la victoria con semilla documentada.
- **Fuera**:
  - Contenido nuevo (enemigos, armas, mejoras, jefe) y meta-progresión.
  - Cambios de mecánica o de código de `src/` (reglas de spawn, daño, armas, XP): solo se tocan números.
  - Cambiar la convención "política de elección fija" (opción 0) de `simulation-loop`: sigue valiendo para los
    escenarios que no dicen nada de elecciones. El bot de referencia es un concepto aparte, solo para balance.
  - Parámetros de URL nuevos (`?e2e` u otros) para forzar la derrota.
  - Playtest humano (no hay disponible; la dificultad se mide con el bot).
  - E2E de reinicio tras victoria (deuda 0006 · W2): sigue abierta.

## Capacidades afectadas
- `openspec/specs/run-outcome` (modificada): el requisito "Partida ganable y perdible con el contenido por defecto"
  pasa de "existe una semilla ganadora" a la tasa 50–70 % del bot de referencia sobre 1..50, y "jugador quieto
  pierde" pasa de la semilla 42 a todas las semillas 1..50 antes de 180 s. Aquí se define el bot de referencia.
- `openspec/specs/simulation-loop` (modificada): el escenario "Derrota equivalente con la semilla 90" del requisito
  "Mismo resultado con cualquier velocidad" cambia a una semilla del conjunto.
- Modificadas **solo si la medición de apply mueve el número** (no se espera: con el candidato desde 180 s los
  primeros 180 s de partida no cambian; spec no tocada en la fase SPEC):
  - `openspec/specs/player-health`: primer golpe semilla 42 ≤ 4.800 ticks (núcleo) y ≤ 80 s (E2E).
  - `openspec/specs/run-results`: derrota E2E con semilla 42 en ≤ 120 s de juego.
  - `openspec/specs/upgrades`: primera oferta semilla 7 ≤ 3.600 ticks.
  - `openspec/specs/auto-weapons`: pulso de Tests ≤ 1.800 ticks.
  - `openspec/specs/player-movement`: nota "primera oferta ≤ 3.600 ticks" del radio de recogida.
- Sin cambios previstos: `openspec/specs/enemy-spawning` (el escenario "Oleadas que crecen con el contenido por
  defecto" exige `budgetPerSecond` no decreciente y debe seguir en verde; apply comprueba que el factor desde 180 s
  no deja un tramo por debajo del anterior: con ×0,7, 2,5 → 1,75 < 2, ver "Decisiones del gate") y
  `openspec/specs/progress-persistence` (el escenario de almacenamiento bloqueado no nombra semilla).

## Decisiones del gate (2026-11-20)
Respuestas del usuario a las preguntas abiertas (ver "Gate de propuesta" y "Medición complementaria tras el gate"
en `exploration.md`):
- **Banda**: el bot de referencia gana de 25 a 35 de las semillas 1..50 (ambos incluidos) en 36.000 ticks.
- **Quieto pierde** es objetivo de balance: con input (0, 0) y política de elección fija, las 50 semillas 1..50
  terminan en derrota antes de 180 s (tick < 10.800).
- **Coste**: el test de tasa de victoria y el de "quieto pierde" van en `npm run verify`.
- **Plazos archivados** (4.800 ticks, 80 s, 120 s del E2E, 3.600 y 1.800 ticks): se mantienen; apply puede
  reescribirlos en specs delta solo si la medición los mueve, y puede combinar `budgetPerSecond` con otra palanca de
  contenido, documentándolo. Con el candidato desde 180 s no se espera que se muevan.
- **E2E de derrota**: semilla fija 42 (miembro del conjunto, pierde quieta por el invariante), sin parámetro nuevo.
- **Candidato**: suavizar desde 180 s, no desde 60 s (desde 60 s o con más vida la muerte sin input llega a 322 s).
- **Restricción para apply**: el escenario "Oleadas que crecen" exige `budgetPerSecond` no decreciente. Un factor
  común sobre los tramos ≥ 180 s menor que 0,8 deja el tramo de 180 s (2,5) por debajo del de 60 s (2): ×0,7 da
  1,75. Apply debe elegir una combinación que respete el orden (p. ej. ×0,8 en el tramo de 180 s y otro factor en
  los siguientes) y medirla sobre 1..50.

## Riesgos y dudas
- **Plazos de specs archivadas**. Si solo se tocan tramos con `fromSecond` ≥ 60, los primeros 3.600 ticks quedan
  igual, así que la oferta de la semilla 7 (≤ 3.600) y el pulso (≤ 1.800) no deberían moverse. El primer golpe de la
  semilla 42 (≤ 4.800, 80 s) sí cae después de los 60 s y puede retrasarse. Cualquier otra palanca puede mover todos.
- **"Quieto pierde" más lento** (mitigado en el gate). Suavizando desde 60 s la muerte sin input llegaba a p90
  318 s. Con el candidato desde 180 s la muerte quieta máxima medida sobre 1..50 es 94 s y la semilla 42 pierde a
  78 s, así que el E2E de derrota (≤ 120 s de juego) y el plazo de 180 s no deberían moverse. Si apply usa otra
  palanca que toque los primeros 180 s, el riesgo vuelve (tiempo real de la suite E2E, deuda 0008 · W3).
- **Sobreajuste al bot**. La banda se calibra con un bot determinista (huida + prioridad fija) sin playtest humano.
  El techo del 70 % evita que la partida quede trivial para el bot, pero no garantiza la experiencia de un humano.
- **Banda frágil ante cambios futuros**. La tasa sobre 50 semillas fijas es determinista (sin flakiness), pero un
  ajuste de contenido posterior puede sacarla de la banda. Es intencionado: obliga a revisar el balance.
- **Coste en `verify`**. Unos 10 s en el peor caso medido, que depende de la máquina y del CI.
- **Deriva JSON-espejo**. Los tests unitarios miden el espejo de `builders.ts`, no el JSON. Si no hay test de
  igualdad para todos los ficheros, la tasa medida puede no ser la del juego real.
- **Desajuste con el GDD**. El criterio de `docs/gdd.md` (0010) habla de 10 semillas; esta propuesta usa 50. El GDD
  se actualiza al archivar.

## Criterio de éxito
- Con el contenido por defecto y el bot de referencia, las semillas 1..50 dan entre 25 y 35 victorias en 36.000
  ticks (test unitario en verde).
- Con input (0, 0) y política de elección fija, las 50 semillas 1..50 terminan en derrota en un tick < 10.800
  (180 s) (test unitario en verde).
- Ningún test de `tests/` fija las semillas 2 o 90 para balance, y `balance.test.ts` no tiene `WIN_SEED`.
- El JSON de contenido y el espejo de `builders.ts` son iguales (test de igualdad en verde para cada fichero tocado).
- El escenario "Oleadas que crecen con el contenido por defecto" sigue en verde.
- Los plazos que citan las specs (4.800, 3.600, 1.800, 80 s, 120 s) se cumplen tal cual o se actualizan en las specs
  delta con el valor medido.
- `npm run verify` y `npm run test:e2e` en verde, sin parámetros de URL nuevos y sin cambios en `src/`.
