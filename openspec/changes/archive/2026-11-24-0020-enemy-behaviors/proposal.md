# Proposal · 0020-enemy-behaviors

- **Estado**: aprobada (2026-11-24, por el autor, tal cual, incluidas D1–D7 y los criterios de éxito)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0020-enemy-behaviors`
- **Entradas**: `exploration.md` y `measurements.md` de este change; decisiones del autor del 2026-11-24.

## Problema

Los tres goblins se comportan igual: todos persiguen al jugador por el campo de flujo (ADR-0017) y solo se
distinguen por sus stats y su arte. El único daño posible es el contacto. El resultado es una horda homogénea en la
que el jugador no tiene que leer ni esquivar nada: basta con alejarse de la masa. Según `measurements.md`:

- El Goblin Barril aporta hoy ~70 % del daño recibido (85,9 de 124,8 por partida) solo por contacto, aunque el GDD
  lo describe como kamikaze.
- El Goblin TNT es un perseguidor más con más daño de contacto (15). No lanza dinamita y solo aparece en la mitad de
  las partidas (desde el tick ~10.850).
- No hay daño de área, ni avisos en el suelo, ni interacción entre enemigos.

Desde el proyecto, `Enemy` no tiene estado y `EnemyType` no tiene noción de comportamiento. Cualquier mecánica de
enemigos posterior (casas, campamentos, guardias) necesita antes esa base.

## Objetivo

Al terminar, cada tipo de goblin tiene un comportamiento propio, descrito en `content/` y reconocible en partida:

1. **Comportamiento por tipo en contenido**: cada tipo declara su comportamiento (estados y transiciones con sus
   parámetros: distancias, duraciones, radios, daños) en `content/enemies.json`, validado con zod. Sin números
   mágicos en el código.
2. **Goblin Antorcha**: sin cambios observables. Sigue persiguiendo como en 0019.
3. **Goblin Barril (kamikaze)**: va directo hacia el jugador. Al llegar a una distancia de activación enciende la
   mecha (aviso visible durante un tiempo fijo) y explota con **daño de área**. El barril que explota **cuenta
   como baja** (suma al contador de eliminados) y **suelta su gema de XP**. No suelta madera.
4. **Goblin TNT (artillero provisional)**: persigue hasta una distancia de lanzamiento, se detiene y lanza
   dinamita hacia donde está el jugador en ese momento. Antes de explotar, el punto de impacto muestra un **aviso
   en el suelo** durante un tiempo fijo. La explosión es de área.
5. **Fuego amigo**: las explosiones (barril y dinamita) dañan a todo lo que esté en su radio: al jugador y a
   cualquier goblin.
6. **Esquivable**: un jugador que sale del radio avisado antes de la explosión no recibe daño.

## Alcance

- **Dentro**:
  - Comportamiento por tipo declarado y validado en contenido. El contenido inválido (estado desconocido,
    duraciones o radios no positivos, transiciones a estados que no existen) se rechaza al cargar.
  - Estados del Barril (acercarse → mecha → explotar) y del TNT (acercarse → detenerse → lanzar → enfriamiento).
    Antorcha: un único estado de persecución equivalente al actual.
  - Peligros de área en el núcleo: dinamita en vuelo, aviso en el suelo y explosión, con duración, radio y daño de
    contenido, y un **tope de dinamitas en vuelo** en contenido (aclarado tras design rev. 2).
  - Daño al jugador por explosión, compatible con la invulnerabilidad temporal existente.
  - Daño de explosión a goblins (fuego amigo), bajas resultantes con gema y suma de eliminados.
  - Peligros visibles en el estado observable de la partida (snapshot) y en la sonda E2E.
  - Arte CC0 del pack local Update 010: fila de lanzamiento de `TNT_Red` (7 fotogramas), fila de mecha de
    `Barrel_Red` (3 fotogramas), `Dynamite.png` (6 fotogramas) y `Explosions.png` (9 fotogramas), con sus entradas
    en `content/asset-provenance.json` y aspecto de reserva si una hoja no carga. El aviso en el suelo se pinta sin
    arte nuevo (forma de color de `appearance.json`).
  - Bot de referencia **v3** que esquiva los avisos, y recalibración del balance con él.
  - Determinismo: misma semilla y mismas entradas, misma partida (los comportamientos no usan `Math.random` ni
    reloj; si necesitan azar, sin alterar el flujo del mapa).
- **Fuera (No-objetivos)**:
  - **Parte B, en un change propio con número por decidir**: casas y torres goblin destruibles generadas con el
    mapa, TNT que nace en ellas, patrulla, alerta y vuelta a su puesto, y campamentos de guardianes. Este change
    **no toca el generador de mapas** ni su firma dorada.
  - Madera, oro y cualquier recompensa distinta de la gema de XP (0022/0023). El barril no suelta madera.
  - Separación o colisión entre enemigos y colisión de enemigos con el mapa (siguen aplazadas desde 0019).
  - Proyectiles enemigos que no sean la dinamita, jefes y nuevos tipos de enemigo.
  - Cambios en la economía del director de oleadas (costes, tramos, `maxAlive`). Si el balance obliga a tocarlos,
    se vuelve a este gate.
  - Daño de explosión a estructuras (no existen hasta la parte B).
  - Sonido.

## Decisiones propuestas (requieren aprobación en el gate)

- **D1. Baja por explosión de otro goblin**: cuenta para el contador de eliminados y suelta gema, igual que una
  baja por arma y que el barril que explota (coherente con la decisión del autor). Afecta a los récords
  (`run-results`, `progress-persistence`) solo en el valor, no en el formato.
- **D2. Barril abatido antes de explotar**: si un arma o una explosión lo mata durante la aproximación o la mecha,
  muere como cualquier enemigo (baja y gema) y **no explota**. Así no hay reacciones en cadena y matar el barril a
  tiempo tiene recompensa. *Aclaración (autor, 2026-11-24, tras design rev. 2)*: un barril cuya mecha acaba en el
  mismo tick en que otra explosión lo deja a 0 **sí explota** (estalla por su mecha, no por la otra explosión).
- **D3. El barril deja de hacer daño por contacto**: su daño es solo el de la explosión. El TNT y la Antorcha
  conservan su daño por contacto.
- **D4. Invulnerabilidad**: una explosión que alcanza al jugador durante su invulnerabilidad no le hace daño. Si en
  un mismo tick coinciden contacto y explosiones, el jugador recibe un solo golpe, el de mayor daño (misma regla
  que el contacto actual).
- **D5. Objetivo de la dinamita**: el punto de impacto se fija al lanzarla (posición del jugador en ese tick) y no
  la sigue. El aviso ocupa exactamente el radio de la explosión.
- **D6. Sin fuego amigo entre explosiones**: una explosión no detona dinamitas ni barriles en mecha. Solo les quita
  vida.
- **D7. TNT provisional**: el artillero sustituye por ahora al "TNT de guardia" del GDD. La parte B lo cambiará.

## Capacidades afectadas

- `openspec/specs/enemy-behavior` (modificada): persecución condicionada por el estado. Estados por tipo, parada a
  distancia y explosión del barril.
- `openspec/specs/enemy-spawning` (modificada): catálogo y validación de contenido con el comportamiento por tipo.
  Vida y baja de enemigos por explosión.
- `openspec/specs/enemy-hazards` (nueva): dinamita, aviso en el suelo, explosión de área, tope de peligros y fuego
  amigo.
- `openspec/specs/player-health` (modificada): daño por explosión además del contacto, con invulnerabilidad y un
  solo golpe por tick.
- `openspec/specs/xp-gems` (modificada): suelta de gema por baja también en bajas por explosión.
- `openspec/specs/run-state` (modificada): peligros activos en el estado observable de la partida.
- `openspec/specs/simulation-loop` (modificada): lugar de los estados y peligros en el orden del tick (contrato
  determinista).
- `openspec/specs/sprite-rendering` (modificada): animaciones de lanzamiento y mecha, dinamita, explosión, aviso
  en el suelo y aspectos de reserva. Recuentos en la sonda.
- `openspec/specs/asset-provenance` (modificada): nuevas hojas con su procedencia.
- Previsto: un ADR nuevo sobre comportamientos en contenido. Lo decide `sdd-architect`.

## Riesgos y dudas

- **Balance con poco margen**: hoy 26/50 (banda 25–35). El barril pasa del daño por contacto continuo a una
  explosión esquivable y el TNT empieza a lanzar dinamita. La dificultad puede moverse mucho en cualquier sentido.
  Un bot v3 que esquiva demasiado bien inflaría las victorias. Mitigación: el bot v3 tiene reglas simples y
  documentadas, y se calibra primero con parámetros de comportamiento y, solo si no basta, con curva de XP.
- **Cambia la XP por partida**: los barriles que explotan dan gema, pero los que se abaten a distancia ya la daban.
  El ritmo de subida y la primera oferta (hoy tick 2.082, semilla 7) pueden moverse.
- **El TNT solo aparece en ~la mitad de las partidas** (tick ≥ 10.850). Su comportamiento casi no pesará en las
  derrotas tempranas: 15 de las 24 derrotas ocurren antes de que entre. El balance lo dominará el barril.
- **Rendimiento**: estado por enemigo con 300 vivos, peligros simultáneos y daño de área a todos los goblins
  (fuego amigo) en el mismo tick. Peor caso actual 0,206 ms/tick.
- **Determinismo y orden del tick**: el orden entre comportamientos, armas, explosiones y bajas es un contrato
  nuevo. Una baja simultánea por arma y por explosión debe resolverse de una sola forma.
- **Legibilidad**: el aviso debe verse sobre el suelo, el agua y el arte del mapa, y no taparse con el HUD.
- **Arte**: copiar 2 hojas nuevas (`Dynamite.png`, `Explosions.png`; `TNT_Red` y `Barrel_Red` ya están desde 0012) exige sus entradas con sha256. El barril no tiene fotogramas de explosión propios (se
  usa `Explosions.png`).
- **Tests existentes**: los escenarios que suponen que el barril persigue y golpea por contacto cambian (D3) y
  deberán actualizarse como MODIFIED en las specs.

## Criterio de éxito

- Todos los escenarios de las specs delta del change en verde y `npm run verify` en verde.
- **Balance** con el bot v3 sobre `BALANCE_SEEDS` 1..50: **entre 25 y 35 victorias**.
- **Quieto pierde**: con las 50 semillas, el jugador quieto ha perdido antes del tick 10.800 (180 s), tanto en el
  mapa generado como en el vacío (**0 quietos vivos**).
- Primera oferta de la semilla 7 (quieto) dentro del plazo vigente de 4.800 ticks. El valor nuevo se registra en el
  verify-report.
- **Rendimiento**: `npm run bench`, peor caso (300 vivos + 32 proyectiles) **≤ 0,25 ms/tick** (+20 % sobre 0,206).
  Un caso nuevo con 300 vivos y el tope de dinamitas activas también **≤ 0,25 ms/tick**. *Informativo* (autor,
  2026-11-24): se anota en el verify-report y no bloquea, como el resto del bench. Deuda aceptada: el render pinta
  como máximo 64 explosiones a la vez (`maxBlastSprites`); por encima la sonda no coincidiría con el snapshot.
- **Esquiva verificable**: en un escenario de test, un jugador fuera del radio avisado en el tick de la explosión
  recibe 0 de daño, y uno dentro recibe exactamente el daño de contenido.
- **Fuego amigo verificable**: una explosión con un goblin dentro de su radio le quita exactamente su daño. Si lo
  mata, el contador de eliminados sube en 1 y aparece 1 gema.
- **Determinismo**: dos partidas con la misma semilla y las mismas entradas producen el mismo snapshot final.
- **Mapa intacto**: la firma dorada de `tests/support/mapGolden.ts` no cambia.
- **Procedencia**: `npm run guard:all` en verde, con las 2 hojas nuevas registradas y nada del Free Pack.
- **E2E**: como máximo **2 E2E nuevos o ampliados**, en modo manual (`?e2e&manual` + `step(n)`), sin umbrales de fps
  ni de tiempo real. Preferiblemente ampliando la suite de humo para comprobar que la dinamita, el aviso y la
  explosión se pintan.
