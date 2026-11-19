# Proposal · 0003-collisions-and-damage

- **Estado**: aprobada (2026-11-19)
- **Issue**: — (opcional)
- **Rama / worktree**: `change/0003-collisions-and-damage`
- **Depende de**: 0002-enemy-spawning (archivado el 2026-11-19).
- **Exploración**: `openspec/changes/0003-collisions-and-damage/exploration.md`

## Problema
Desde 0002 los enemigos persiguen al jugador y lo alcanzan, pero no pasa nada: no hay contacto, ni daño, ni vida,
así que no se puede perder y no hay tensión. El GDD lo marca como Must ("colisiones y vida"). Además, el modelo
actual no admite bajas de enemigos (la lista solo crece y el director no sabe qué hacer cuando los vivos bajan del
tope), lo que bloquea las armas de 0004.

## Objetivo
Cuando un enemigo toca al jugador, este pierde vida y queda invulnerable un tiempo breve. Si su vida llega a 0, la
partida pasa a estado terminada y la simulación deja de avanzar. Los enemigos tienen vida y un modelo de baja probado
por tests, listo para que 0004 lo use. Todo sigue siendo determinista con la misma semilla e inputs.

## Alcance

### Dentro
- **Vida del jugador**: vida máxima en `content/player.json`, validada con zod. La partida empieza con vida máxima.
- **Detección de contacto** jugador-enemigo como círculos que se solapan, por fuerza bruta (el jugador contra todos
  los vivos), aislada en una función pura reemplazable.
- **Daño discreto con invulnerabilidad**: un contacto resta el daño del tipo de enemigo; después el jugador es
  invulnerable durante una duración de contenido y no recibe más daño, aunque haya varios enemigos encima. Varios
  contactos en el mismo tick cuentan como un solo golpe. La vida no baja de 0.
- **El enemigo sigue vivo tras golpear**: no se autodestruye y sigue persiguiendo hasta el centro del jugador.
- **Vida de los enemigos**: `health` y `damage` por tipo en `content/enemies.json`, positivos y validados con zod.
  Modelo de daño y baja de enemigos en el dominio, ejercitado solo por tests: en juego ningún enemigo muere hasta 0004.
- **Fin de partida**: `Run` tiene un estado (en curso / terminada). Al llegar a vida 0 pasa a terminada y los ticks
  siguientes no cambian nada (ni jugador, ni enemigos, ni spawns, ni contador de ticks de simulación).
- **Presupuesto al bajar del tope**: mientras se está en el tope, el presupuesto sigue acumulándose hasta un máximo
  guardado (parámetro de contenido). Al abrirse huecos se gasta como hasta ahora, sin superar nunca `maxAlive`.
- **Snapshot ampliado**: vida actual y máxima del jugador, si está invulnerable y el estado de la partida. Sigue
  inmutable desde fuera y solo lista enemigos vivos.
- **Vista**: el adaptador sigue pintando exactamente los enemigos vivos del snapshot, con su tipo y posición
  correctos, también después de bajas (cómo se asocian los sprites es decisión del architect).
- **Orden del tick fijado** (jugador → persecución → contacto/daño → director, o el que fije el diseño) y
  rendimiento revalidado con el benchmark.

### Fuera
- Pantalla de derrota, reinicio y HUD de vida o invulnerabilidad (0006). Temporizador y victoria (0006).
- Armas y cualquier mecanismo de juego que mate enemigos (0004). XP y gemas al morir (0005).
- Rejilla espacial / *spatial hash* (llegará con los proyectiles de 0004).
- Separación, empuje o *knockback* entre enemigos o con el jugador.
- Cola de eventos de dominio (`PlayerDied`, `EnemyDied`): se aplaza hasta que 0004-0006 la necesiten.
- Balance fino: los valores iniciales son provisionales.

## Capacidades afectadas
- `openspec/specs/player-health` (nueva): vida del jugador, contacto, daño discreto, invulnerabilidad y vida 0.
- `openspec/specs/run-state` (nueva): estado de la partida y detención de la simulación al terminar.
- `openspec/specs/enemy-spawning` (modificada): catálogo con vida y daño; contenido validado; tope de vivos con
  bajas y política de presupuesto acumulado con máximo; baja de enemigos.
- `openspec/specs/enemy-behavior` (modificada): los enemigos dados de baja dejan de perseguir; se confirma que
  siguen llegando al centro del jugador.
- `openspec/specs/simulation-loop` (modificada): snapshot ampliado, orden del tick, determinismo con colisiones y
  rendimiento.
- `openspec/specs/player-movement` (modificada): contenido del jugador con vida máxima validada.
- `openspec/specs/architecture-guardrails`: sin cambios.

## Decisiones tomadas
1. Muerte del jugador: solo vida 0 → partida terminada y simulación detenida. Derrota, reinicio y HUD en 0006.
2. Enemigos con vida en contenido y modelo de baja probado por tests; no se autodestruyen al golpear. En juego no
   mueren hasta 0004.
3. Daño al jugador: golpe discreto con invulnerabilidad temporal (*i-frames*).
4. Vida del jugador, daño y vida por tipo y duración de la invulnerabilidad: provisionales, en `content/*.json`
   con zod; los concreta el architect.
5. Los enemigos siguen llegando al centro del jugador; sin separación.
6. Al bajar del tope: acumular presupuesto con un máximo guardado en contenido, para evitar ráfagas.
7. Fin de partida como estado en `Run` expuesto en el snapshot; eventos de dominio aplazados.
8. Detección por fuerza bruta en una función pura; rejilla espacial en 0004; benchmark ≤ 2 ms/tick con 200 vivos.

## Riesgos y dudas
- **Orden del tick y determinismo**: añadir colisiones y cambiar la política del director altera las partidas con
  la misma semilla; los tests de determinismo y de larga duración deben reflejar el nuevo orden.
- **Orden de aparición en el snapshot**: la spec viva lo promete; con bajas, mantenerlo o relajarlo depende de cómo
  se den de baja los enemigos (lo decide el diseño y se refleja en la spec delta).
- **Contacto masivo**: sin separación, los enemigos se amontonan sobre el jugador; las *i-frames* acotan el daño a
  1 golpe por periodo, pero la partida puede durar poco con los valores provisionales.
- **Código no ejercitable en juego**: la baja de enemigos solo la usan los tests hasta 0004.
- **Máximo de presupuesto guardado**: debe ser ≥ el coste del tipo más caro, o ese tipo nunca aparecería; hay que
  validarlo en contenido.

## Criterio de éxito
- Escenarios de `player-health`, `run-state` y de las specs modificadas en verde; `npm run verify` y CI en verde.
- Con un enemigo de daño D solapando al jugador desde el tick t, la vida baja exactamente D en t y no vuelve a bajar
  hasta que pasan los ticks de invulnerabilidad configurados; con 200 enemigos encima, el daño por tick es como
  máximo el de un golpe.
- Con vida que llega a 0, el estado pasa a terminada en ese tick; tras 600 ticks más el snapshot es idéntico.
- Un enemigo dañado hasta vida 0 desaparece del snapshot y deja de contar para `maxAlive`; el director lo repone
  sin superar el tope ni guardar más presupuesto que el máximo configurado.
- Contenido inválido (vida, daño, invulnerabilidad o máximo de presupuesto ≤ 0, o máximo menor que el coste más
  alto) se rechaza con un error explícito.
- Misma semilla y mismos 600 inputs → snapshots estrictamente iguales en cada tick, con contactos incluidos.
- En la URL de Pages, el jugador recibe daño al ser alcanzado y la partida se congela al llegar a vida 0.
- `npm run bench`: tick ≤ 2 ms de media con 200 enemigos vivos y colisiones activas.
