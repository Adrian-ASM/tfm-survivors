# Exploración · 0003-collisions-and-damage

Intención (GDD, "colisiones y vida" Must): contacto jugador-enemigo, daño, vida del jugador y muerte de
enemigos y del jugador. Armas = 0004; XP/gemas = 0005; temporizador, victoria/derrota y HUD = 0006.

## Contexto actual (con rutas)
- `src/domain/run/Run.ts`: aggregate root. `tick`: jugador → persecución → `director.step(...)`. Guarda
  `enemies: Enemy[]` (array que solo crece: no hay baja de enemigos), `nextEnemyId` (nunca se reutiliza) y
  `Player` inmutable. No hay vida, ni estado de partida (en curso / terminada), ni cola de eventos de dominio.
- `src/domain/enemy/Enemy.ts`: posición escalar mutable (ADR-0003); `radius` viene del tipo. Sin vida.
  `EnemyType` (`EnemyType.ts`) = `{id, speed, radius, cost}`; `content/enemies.json` y `EnemiesSchema`
  (`src/infrastructure/content/schemas.ts`, `strictObject`) no tienen `health` ni daño. Hay que añadirlos a
  `EnemyTypeConfig`, al schema y a `buildRunRules` (las invariantes viven en dominio, zod reutiliza los mensajes).
- `src/domain/player/Player.ts`: solo posición, radio y velocidad. `content/player.json` = `{speed, radius}`;
  no hay vida máxima.
- `src/domain/wave/WaveDirector.ts`: `step(tick, alive, place)`; con `alive >= maxAlive` retorna sin acumular
  presupuesto ni consumir azar. El comentario deja explícito que "la política al bajar del tope es de 0003".
  Ahora el tope solo se alcanza y nunca se baja; con muertes empieza a oscilar.
- `src/domain/run/RunSnapshot.ts`: `{tick, player{x,y,radius}, enemies[]}`; sin vida ni estado de partida.
  El snapshot se congela y se copia por frame (`Run.snapshot()`).
- `src/infrastructure/phaser/EnemyLayer.ts`: pool de `maxAlive` sprites; el hueco *i* pinta al enemigo *i* del
  snapshot, oculta los sobrantes y recolorea solo si cambia el tipo. `GameScene.ts` pinta al jugador, no hay HUD.
- `Vector2` es VO; `Arena.clampCircle/clampX/clampY` existen. No hay utilidad de colisión círculo-círculo.
- Specs vivas: `enemy-behavior` (persecución; "sin separación entre enemigos"; el enemigo termina **en el
  centro** del jugador si le alcanza), `enemy-spawning` (tope de vivos; deja abierta la política al bajar del
  tope), `simulation-loop` (snapshot, determinismo, rendimiento ≤ 2 ms/tick con 200 enemigos),
  `player-movement`, `architecture-guardrails`.
- ADR-0002 prevé "círculos + *spatial hash*" para colisiones; ADR-0003 pide volver a medir tras añadir
  colisiones (benchmark actual: 0,0069 ms/tick, margen ~290x). `tests/bench/run.bench.ts` y `tests/domain/*`
  (run-enemies, run-spawning, determinism, long-run) fijan el orden del tick: cambiarlo cambia las partidas.

## Capacidades/specs afectadas
- NUEVAS: `collision-damage` (contacto, daño, vida del jugador) y `player-health`/`run-state` (muerte, fin de
  partida) o una sola; decidir en propose.
- `enemy-spawning` (MODIFIED): política de presupuesto al bajar del tope; "tope de vivos" ahora dinámico.
- `enemy-behavior` (MODIFIED): hoy el enemigo llega al centro y se queda superpuesto; con daño por contacto
  conviene revisar si sigue así. Contrato de orden del tick.
- `simulation-loop` (MODIFIED): snapshot con vida del jugador y estado; determinismo; rendimiento con colisiones.
- `player-movement` (posible): ¿se mueve el jugador tras morir? Contenido del jugador validado ampliado (vida).
- `architecture-guardrails`: sin cambios previstos.

## Pendientes heredados de 0002
1. **Presupuesto al bajar del tope**: hoy no acumula con `alive >= maxAlive`. Al morir enemigos, con el
   presupuesto congelado no hay ráfaga, pero con "acumular siempre" sí (al abrir un hueco se gastaría de golpe
   el presupuesto de minutos, varios spawns en un tick, hasta `maxAlive`).
2. **Vida de los enemigos**: no existe `health` en `enemies.json`. 0003 necesita al menos el modelo de vida y
   la muerte; sin armas (0004) nada mata a un enemigo salvo el propio contacto o un mecanismo provisional.
3. **Huecos del pool y repintado**: `Run.enemies` pasará a tener bajas (splice / swap-remove / marca de muerto).
   `EnemyLayer` asigna hueco por índice, así que un swap-remove reordena enemigos entre huecos y fuerza
   recolorear/redimensionar (sin errores, coste menor); el spec dice "orden de aparición", que el swap-remove rompe.
   El `id` estable permitiría asociar hueco↔id en vez de índice.

## Opciones (sin elegir)
**A. Detección jugador-enemigo**
1. Fuerza bruta O(n): un círculo (jugador) contra todos los vivos por tick. Pros: trivial, determinista,
   encaja con 200 enemigos (≈200 comparaciones/tick, coste despreciable frente al margen medido). Contras: no
   sirve para enemigo-enemigo ni para armas con muchos proyectiles (0004).
2. Rejilla espacial / *spatial hash* (ADR-0002). Pros: escala para armas y proyectiles futuros. Contras: más
   código y estado mutable que mantener cada tick, sin beneficio medible con un solo círculo del jugador.
3. Fuerza bruta ahora, aislada tras una función pura reemplazable. Pros: se adelanta poco. Contras: la
   abstracción puede quedar mal dimensionada para armas.

**B. Modelo de daño al jugador**
1. Contacto continuo (daño por segundo mientras solapan). Pros: sin estado extra, simple. Contras: con 200
   enemigos superpuestos (no hay separación) el daño es enorme; difícil de balancear.
2. Golpe discreto con invulnerabilidad temporal del jugador (*i-frames*) tras recibir daño. Pros: estándar del
   género, acota el daño máximo. Contras: estado y contador de ticks en el jugador, valor de invulnerabilidad
   por balancear y por mostrar.
3. Golpe discreto con enfriamiento por enemigo. Pros: más justo con enemigos escalonados. Contras: estado por
   enemigo, más memoria y complejidad por tick.

**C. Muerte de enemigos y huecos del pool**
1. Swap-remove en `Run.enemies`. Pros: O(1), sin huecos. Contras: rompe el orden de aparición y obliga a
   revisar `EnemyLayer` y las specs que lo prometen.
2. Filtrado estable (compactar el array preservando el orden). Pros: conserva el orden. Contras: O(n) y
   asignaciones si no se hace con cuidado (ADR-0003).
3. Pool con marca `alive` y huecos reutilizables. Pros: sin asignaciones. Contras: el snapshot debe saltarse
   muertos, `alive` pasa a contarse aparte.

**D. Política de presupuesto al bajar del tope**
1. Mantener congelado (como hoy). Pros: sin ráfagas, ya probado. Contras: la dificultad deja de crecer en la
   práctica mientras se está en el tope.
2. Acumular con tope máximo de presupuesto guardado. Pros: recupera ritmo con cota de ráfaga. Contras: otro
   parámetro de contenido.
3. Acumular y limitar spawns por tick. Pros: suaviza la ráfaga. Contras: otro parámetro; retrasa la reposición.

**E. Fin de partida**
1. Estado en `Run` (`status`) y el tick deja de simular tras morir; el snapshot lo expone. Pros: simple,
   consultable, determinista. Contras: el motor decide por sondeo; mezcla con 0006.
2. Cola de eventos de dominio (ADR-0002: "cola vaciada en cada tick"): `PlayerDied`, `EnemyDied`. Pros: encaja
   con la arquitectura prevista y con sonido/partículas. Contras: infraestructura de eventos aún inexistente.

## Riesgos e incógnitas
- Determinismo: el orden jugador → persecución → colisión → director cambia las semillas; hay que fijarlo.
- Los enemigos terminan en el centro del jugador (spec) y se solapan entre sí: contacto casi garantizado y
  masivo; sin separación el daño depende de la densidad.
- Vida del jugador y de enemigos, daño por golpe e invulnerabilidad: sin números en el GDD ("por balancear").
  Deben ir a `content/*.json` (AGENTS.md §3.5).
- Sin armas (0004), los enemigos no mueren por nada del juego: ¿qué mecanismo prueba la muerte de enemigos?
  Riesgo de implementar código no ejercitable por el jugador (solo por tests).
- Solapamiento de alcance con 0006 (derrota, pantalla de resultados, HUD): 0003 solo debería llegar a "vida 0".
- Rendimiento: volver a medir (`npm run bench`, ≤ 2 ms/tick con 200 vivos) según ADR-0003.
- `EnemyLayer`: dimensionado `maxAlive`; el hueco por índice y la visibilidad deben revisarse tras bajas.
- Estado de `tick` tras la muerte: el snapshot de partida terminada, `TickRun`/`FixedStepLoop` y la escena.

## Preguntas para el usuario
1. ¿Alcance del jugador muerto: solo vida 0 y estado `terminada`, o también pantalla/reinicio mínimo
   (resto en 0006)?
2. ¿Cómo mueren los enemigos en 0003 sin armas: daño al contacto del jugador (los enemigos se "estrellan"),
   solo por tests, o un mecanismo provisional (p. ej. una arma mínima)?
3. ¿Preferencia de daño: contacto continuo, golpe con invulnerabilidad temporal del jugador, o enfriamiento por
   enemigo? ¿El enemigo desaparece o sigue vivo tras golpear?
4. ¿Valores iniciales de balance (vida del jugador, daño y vida por tipo de enemigo, duración de la
   invulnerabilidad), o los fija el architect a modo provisional?
5. ¿Los enemigos deben seguir llegando al centro del jugador, o se acepta modificar `enemy-behavior`
   (parar al tocar el borde, empuje, separación)?
6. ¿Política deseada al bajar del tope: congelar, acumular con cota o limitar spawns por tick?
7. ¿Fin de partida como estado en `Run` o con eventos de dominio (que también servirán a 0004-0006)?
8. ¿Se acepta fuerza bruta O(n) ahora y rejilla espacial al llegar las armas (0004), siempre que el benchmark
   siga bajo 2 ms?
