# Exploración · 0002-enemy-spawning

Intención: que aparezcan enemigos en oleadas que crecen con el tiempo y que persigan al jugador.

## Contexto actual (con rutas)
- `src/domain/run/Run.ts`: aggregate root. `Run.start(config)` y `tick(input)`. El único estado es `Player` más
  `tickCount`. `RunConfig` = `{arena, player}`. `TICK_SECONDS = 1/60`.
- `src/domain/run/RunSnapshot.ts`: solo `tick` y `player`. No hay lista de enemigos.
- `src/domain/arena/Arena.ts`: 960x540, fija, sin scroll ni cámara. `clampCircle` mantiene círculos dentro.
- `src/domain/shared/Vector2.ts`: VO inmutable. Solo tiene `add`, `scale` y `length`. No tiene `normalize` ni `sub`.
- `src/application/{StartRun,TickRun,FixedStepLoop}.ts`: casos de uso. Reciben `RunConfig`; no reciben puertos.
- `src/infrastructure/content/loadRunConfig.ts`: zod `strictObject` para `player.json` y `arena.json`.
  El `parseRunConfig` está acoplado a 2 ficheros.
- `src/infrastructure/phaser/GameScene.ts`: pinta 1 círculo. Habría que pintar N, con pool de objetos.
- `src/composition/main.ts`: composition root. Es el único sitio donde se puede crear una implementación concreta
  de `RandomGenerator` con semilla.
- `content/`: solo `arena.json` y `player.json`. No hay `enemies.json` ni `waves.json`.
- **Los puertos `RandomGenerator` y `Clock` NO existen en `src/`.** AGENTS.md §3.3 los exige y el diseño del 0001
  los difirió. Solo existe `seededRandom` (mulberry32) en `tests/support/builders.ts`.
- ADR-0003 (propuesta): el camino caliente de `Run` puede usar arrays mutables internos y no expuestos. Se validará
  con un benchmark en el change de colisiones.

## Requisitos derivados del GDD
- Must: "3 tipos de enemigo con oleadas". Temática: *bug*, *memory leak*, *merge conflict*. Orden tentativo:
  0002 enemy-spawning, 0003 collisions-and-damage, 0004 auto-weapons. Partidas de ~10 min, "oleadas que crecen".
- El GDD no fija números de balance, ni si hay colas de spawn, ni cómo se comportan los 3 tipos.
- Spec `simulation-loop`: determinismo estricto, mismo snapshot con la misma secuencia de inputs. Hay que ampliarlo
  para incluir la semilla. El snapshot es lo único que ve el motor.

## Capacidades/specs afectadas
- `simulation-loop` (MODIFIED): el snapshot incluye enemigos. El determinismo cubre la semilla.
- `architecture-guardrails`: probablemente sin cambios. Hay que comprobar que el hook/ESLint aceptan el puerto nuevo.
- NUEVAS: `enemy-spawning` (oleadas, posiciones, límite) y quizá `enemy-behavior` (persecución).

## Alcance propuesto
- DENTRO: puerto `RandomGenerator` (más una implementación con semilla en infraestructura o composición);
  `content/enemies.json` y `content/waves.json` con zod; agregado/entidad `Enemy`; planificador de oleadas en `Run`;
  persecución recta al jugador; límite de enemigos vivos; snapshot con enemigos; pintado en `GameScene`.
- FUERA: colisiones, daño, vida del jugador y muerte de enemigos (0003). Armas (0004). XP/gemas (0005). Temporizador,
  victoria/derrota y HUD (0006). Jefe. Arte/audio. Guardado de semilla (0007).
- Dudoso: la persecución. El GDD no la asigna a ningún change. Sin ella, los enemigos quedan estáticos y 0003 no
  tiene qué probar. Se propone incluirla en su forma más simple.

## Opciones de diseño (sin elegir)
**A. Modelo de oleadas**
1. Por tiempo (tabla): `waves.json` lista `{desde_s, tipo, intervalo_s, cantidad}`. Pros: simple, legible, fácil de
   balancear y de testear. Contras: crecimiento solo por tramos, y sube a mano.
2. Por presupuesto (director): cada segundo se concede un presupuesto que crece, y se "compra" enemigos con coste por
   tipo. Pros: curva suave, escala con pocos parámetros, añade tipos sin reescribir. Contras: más abstracto, más
   difícil de prever y de probar.
3. Híbrido: tabla de tramos que fija `presupuesto/s` y los tipos permitidos. Pros: legible y escalable. Contras:
   dos conceptos que explicar.

**B. Posición de spawn** (arena fija 960x540, sin cámara móvil; todo está siempre a la vista)
1. Fuera del borde de la arena, y que entren andando. Pros: parece natural. Contras: `clampCircle` los metería de
   golpe; hace falta un estado "entrando" o una excepción al clamp. Cambia la invariante de Arena.
2. Dentro de la arena, en un anillo a distancia mínima del jugador. Pros: no toca invariantes de Arena; simple.
   Contras: aparecen "de la nada" en pantalla y pueden salir ya pegados al jugador en esquinas.
3. Dentro, pegados al borde (margen = radio) y con distancia mínima al jugador. Pros: parece entrada por los bordes y
   respeta Arena. Contras: con el jugador en una esquina puede no haber hueco válido, y necesita reintentos acotados.

**C. Límite de enemigos**: tope duro (`maxAlive` en JSON; se difiere el spawn al llegar) o tope con "recuperación"
(se reubican los lejanos). Duro es simple y determinista. La reubicación mantiene la presión pero complica. Sin tope
hay riesgo de rendimiento (ADR-0003).

**D. Determinismo**: PRNG con semilla inyectado como `RandomGenerator` (mulberry32 u otro) en `StartRun/Run.start`.
Semilla: fija en contenido, o de la composición con `?seed=` y por defecto aleatoria (la composición puede usar
`Math.random`/`Date.now`, y el dominio no). Alternativa: un PRNG por flujo (posición, tipo) para que un cambio en un
flujo no desordene los otros.

**E. Persecución**: dirección recta hacia el jugador a velocidad constante por tipo (pros: simple y determinista;
contras: se apelotonan), o con separación suave entre enemigos (pros: mejor aspecto; contras: O(n²) sin rejilla
espacial, y pisa el terreno de 0003).

## Riesgos e incógnitas
- Rendimiento: `Vector2` inmutable asigna un objeto por operación. Con cientos de enemigos a 60 Hz presiona al GC
  (ADR-0003 lo anticipa). Hace falta decidir si este change ya usa arrays mutables internos y un presupuesto en ms.
- La spec de 0001 ya fija el determinismo; el snapshot pasa a ser mayor (copias congeladas por tick por enemigo).
- El render con N círculos requiere reutilizar objetos de Phaser en vez de crear y destruir.
- Deriva del tamaño de pantalla: el spawn depende de 960x540 fijos. Si más adelante hay cámara móvil, habrá rehacerlo.
- `parseRunConfig` está acoplado a 2 ficheros y `RunConfig` crecerá. Validación cruzada nueva: los tipos citados en
  `waves.json` existen en `enemies.json`; velocidad y radio positivos; el radio cabe en la arena.
- Los 3 tipos del GDD (bug, leak, merge conflict) no tienen comportamiento definido. Si difieren solo en números
  (velocidad, radio, vida) es sencillo; si difieren en comportamiento, el alcance crece.
- `Vector2` carece de `normalize`/`sub`: se añade API al value object compartido.

## Preguntas para el usuario
1. ¿Persecución en este change? Se recomienda sí, en su forma simple (línea recta).
2. ¿Cuántos tipos ahora: 1 (el *bug*) para validar el mecanismo, o los 3 con distintos números de velocidad y radio?
3. ¿Modelo de oleadas: tabla por tiempo, presupuesto o híbrido?
4. ¿Spawn fuera del borde con entrada andando (cambia `Arena`) o dentro, junto al borde?
5. ¿Límite de enemigos vivos? ¿Qué valor orientativo (p. ej. 200, 300)? ¿Se hace un benchmark ya, o en 0003?
6. ¿La semilla es fija en `content/`, por URL `?seed=` o aleatoria por partida? ¿Se muestra o se guarda (reto diario)?
7. ¿La vida del enemigo se define ya en el contenido (se usa en 0003/0004) o se deja fuera?
