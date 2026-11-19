# Proposal · 0005-xp-and-level-up

- **Estado**: aprobada (2026-11-19)
- **Issue**: — (opcional)
- **Rama / worktree**: `change/0005-xp-and-level-up`
- **Depende de**: 0004-auto-weapons (archivado el 2026-11-19).
- **Exploración**: `openspec/changes/0005-xp-and-level-up/exploration.md`

## Problema
Desde 0004 el jugador mata enemigos con dos armas automáticas, pero matar no da nada: no hay progresión dentro de la
partida y las armas y el jugador son iguales en el segundo 5 que en el minuto 5. Falta la otra mitad del bucle del GDD
("matar → recoger gemas → subir de nivel → elegir 1 de 3 mejoras"), que es Must. Sin él no hay decisiones del jugador
más allá de moverse, ni motivo para acercarse a los enemigos en lugar de huir.

## Objetivo
Cada enemigo abatido suelta una gema de XP en el lugar donde murió. Las gemas que entran en el radio de recogida del
jugador vuelan hacia él y, al tocarlo, suman su XP. Al llenar la barra de XP el jugador sube de nivel, la simulación se
congela por completo y aparece un overlay con 3 mejoras distintas, elegidas al azar con la semilla de la partida. El
jugador elige una (tecla 1/2/3 o clic), su efecto se aplica en el acto a un arma o al jugador, y la partida continúa
donde se quedó. Una barra mínima muestra XP y nivel. Todo es determinista: misma semilla, mismos inputs y mismas
elecciones dan la misma partida.

## Alcance

### Dentro
- **XP por tipo de enemigo en contenido**: nuevo campo `xp` (entero positivo) en cada tipo de `content/enemies.json`.
  Valores **provisionales, a medir en apply**: bug 1, merge-conflict 2, memory-leak 4.
- **Gemas de XP** (entidad con altas/bajas frecuentes, ADR-0003 y ADR-0006):
  - Cada baja por arma suelta exactamente **una** gema en la posición del enemigo en el tick de su muerte, con el
    valor `xp` de su tipo. Las bajas siguen sin consumir azar.
  - Las gemas **se quedan en el suelo** sin caducidad y no se mueven hasta que entran en el radio de recogida.
  - **Imán**: una gema cuya distancia al jugador es ≤ radio de recogida pasa a "atraída" y vuela hacia el jugador a
    velocidad constante; una vez atraída lo sigue siendo aunque el jugador se aleje. Se **recoge** cuando su círculo
    solapa el del jugador: desaparece y suma su XP ese tick.
  - **Tope de gemas en el suelo** (`maxGems` en contenido). Con el tope lleno, la nueva baja no crea gema: su XP se
    **suma a la gema más antigua** que siga en el suelo (no se pierde XP ni se asigna memoria).
  - Contenido nuevo en `content/player.json` (radio de recogida base) y en un fichero de progresión (velocidad del
    imán, radio de gema, `maxGems`). Valores **provisionales, a medir en apply**: radio de recogida 128 px (subido de 64 tras medir en apply), velocidad
    del imán 360 px/s, radio de gema 5, `maxGems` 300.
- **Nivel y curva de XP**:
  - El jugador empieza en nivel 1 con 0 XP. Para pasar del nivel *n* al *n+1* hace falta
    `xpToNext(n) = baseXp + xpGrowth · (n − 1)` (lineal creciente). Valores **provisionales, a medir en apply**:
    `baseXp` 5, `xpGrowth` 5 (nivel 2 a los 5 XP, nivel 3 a los 15 acumulados…). Parámetros en contenido.
  - Al alcanzar el umbral la XP sobrante se arrastra al siguiente nivel (no se pierde).
  - **Varias subidas en un tick** (p. ej. muchas gemas a la vez o una gema grande): se encolan y se resuelven una
    detrás de otra; cada una abre su propia oferta tras elegir la anterior.
  - **Sin nivel máximo** en 0005 (el fin de partida por victoria llega en 0006).
- **Catálogo de mejoras** en nuevo `content/upgrades.json`, validado con zod (`strictObject`) y reglas cruzadas en
  `buildRunRules` (ids únicos, arma objetivo existente, estadística compatible con el tipo de arma, que el nivel
  máximo no deje ninguna estadística fuera de rango, p. ej. cadencia < 1 tick). Cada mejora tiene id, nombre,
  descripción, objetivo (un arma por id o el jugador), estadística, incremento por nivel y **nivel máximo**.
  Catálogo mínimo temático; nombres, incrementos y nivel máximo **provisionales, a medir en apply** (nivel máximo 5
  en todas):

  | id | Nombre | Objetivo · estadística | Por nivel |
  |---|---|---|---|
  | `strict-rules` | *Skill*: reglas estrictas | Linter · daño | +3 |
  | `fast-ci` | *Skill*: CI rápido | Linter · cadencia | −4 ticks |
  | `wide-analysis` | *Spec*: análisis amplio | Linter · alcance | +60 px |
  | `hard-asserts` | *Skill*: aserciones duras | Tests · daño | +2 |
  | `watch-mode` | *Skill*: modo watch | Tests · cadencia | −12 ticks |
  | `coverage` | *Spec*: más cobertura | Tests · radio del pulso | +15 px |
  | `guardrail` | *Guardrail* | Jugador · vida máxima | +20 |
  | `shortcuts` | *Skill*: atajos de teclado | Jugador · velocidad | +20 px/s |
  | `context-window` | *Spec*: ventana de contexto | Jugador · radio de recogida | +32 px |

  Sin mejoras que añadan armas nuevas.
- **Aplicación de mejoras**: se aplican en el tick de la elección y afectan desde el siguiente tick. Los datos base
  de contenido no cambian (las estadísticas efectivas son base + mejoras; el mecanismo concreto lo decide el design y
  probablemente una ADR que matice ADR-0007). Reglas:
  - Cadencia: el arma conserva su estado de carga; el nuevo intervalo rige desde el siguiente disparo.
  - Vida máxima: sube la vida máxima y **la vida actual sube en la misma cantidad** (no cura el resto).
  - Velocidad, alcance, radio de pulso y radio de recogida: efecto inmediato desde el siguiente tick.
  - Cada mejora lleva su nivel (0..máximo); una mejora en su nivel máximo deja de estar disponible.
- **Oferta de mejoras**:
  - Al resolverse una subida de nivel se ofrecen **3 mejoras distintas** elegidas al azar entre las disponibles con el
    `RandomGenerator` de la partida (sin `Math.random`), sin repetir dentro de la oferta. Sin cancelar ni reroll.
  - **Menos de 3 disponibles**: se ofrecen las que queden (2 o 1). **Ninguna disponible**: la subida de nivel se
    registra sin oferta ni pausa y la partida sigue.
  - El consumo de azar de la oferta tiene un punto fijo en el orden del tick (lo fija el design); cambia las partidas
    de una semilla respecto a 0004 y los tests de determinismo se actualizan.
- **Estado "eligiendo mejora"** en `run-state`: mientras hay una oferta abierta la simulación se **congela por
  completo** (no avanzan ticks; jugador, enemigos, proyectiles, gemas, cadencias, invulnerabilidad y director quietos;
  no se consume azar; el input de movimiento se ignora). El bucle de paso fijo no acumula tiempo durante la pausa: al
  reanudar no hay ráfaga de ticks de recuperación. Si el jugador muere en el mismo tick en que sube de nivel, gana el
  fin de partida y no se abre oferta.
- **Elección como input del dominio**: caso de uso de elegir mejora por índice (0..n−1 de la oferta). Elegir fuera de
  rango o sin oferta abierta es un error tipado (`Result`), sin efectos.
- **Snapshot ampliado**: gemas vivas (id, posición, radio), nivel, XP actual, XP para el siguiente nivel, oferta
  abierta (id, nombre, descripción, nivel actual → siguiente de cada opción) y niveles de las mejoras adquiridas.
- **Vista (Phaser)**:
  - Pool de sprites de gemas con capacidad `maxGems`, asociados por `id` (como `EnemyLayer`).
  - **Overlay de elección**: 3 cartas (o las que haya) con nombre, descripción y nivel; teclas 1/2/3 y clic.
  - **Barra mínima de XP** y número de nivel. El HUD completo es de 0006.
- **E2E**: al menos un recorrido en el juego real matar → recoger → subir de nivel → overlay → elegir → partida sigue.
- **Rendimiento** revalidado con `npm run bench` en el peor caso (200 enemigos vivos + `maxProjectiles` +
  `maxGems` gemas).

### Fuera
- Armas nuevas o mejoras que añadan armas (p. ej. *Refactor*), evoluciones/fusiones de armas, sinergias.
- Mejoras de estadísticas no listadas (perforación, nº de proyectiles, velocidad del proyectil, regeneración,
  armadura, críticos) y mejoras porcentuales.
- Cancelar la oferta, reroll, descartar (*banish*), elegir con mando, y pausa manual del jugador.
- Caducidad de gemas, fusión de gemas cercanas, gemas de distinto tamaño visual, cofres y otros objetos.
- HUD completo (vida, tiempo, inventario de mejoras, bajas), menú, pantalla de fin y victoria (0006); guardado (0007).
- Nivel máximo de partida y escalado de enemigos con el nivel del jugador.
- Audio, partículas y animaciones del overlay. Balance fino: todos los números son provisionales.

## Capacidades afectadas
- `openspec/specs/xp-gems` (nueva): suelta de gema por baja, tope y acumulación en la más antigua, imán, recogida.
- `openspec/specs/leveling` (nueva): XP, curva, arrastre de sobrante, cola de subidas, sin nivel máximo.
- `openspec/specs/upgrades` (nueva): catálogo en contenido validado, nivel máximo, oferta de 3 determinista, casos
  de < 3 y 0 disponibles, elección y efectos.
- `openspec/specs/run-state` (modificada): estado "eligiendo mejora", congelado total, prioridad del fin de partida.
- `openspec/specs/simulation-loop` (modificada): pasos nuevos en el orden del tick, consumo de azar de la oferta,
  determinismo con elecciones como input, pausa sin tiempo acumulado, snapshot ampliado, rendimiento con gemas.
- `openspec/specs/enemy-spawning` (modificada): `xp` en el catálogo y contenido de enemigos; la baja suelta gema
  ("Vida y baja de enemigos").
- `openspec/specs/auto-weapons` (modificada): daño, cadencia, alcance y radio de pulso efectivos (base + mejoras).
- `openspec/specs/player-health` (modificada): vida máxima mejorable y efecto sobre la vida actual.
- `openspec/specs/player-movement` (modificada): velocidad mejorable; radio de recogida en el contenido del jugador.

## Riesgos y dudas
- `Arsenal.step` solo devuelve el número de bajas: hace falta posición y tipo de cada baja para soltar gemas, sin
  asignar por tick ni romper el orden determinista.
- Pausa: el `FixedStepLoop` acumula tiempo real; hay que garantizar que la pausa no deja ticks en cola.
- Las mejoras de daño pueden romper escenarios vivos que suponen "ningún arma mata de un golpe a un bug" (vida 10):
  revisar y acotar esos escenarios a "sin mejoras".
- Cambio de semilla: insertar consumo de azar en el tick altera las partidas de 0004; actualizar los tests de
  determinismo y documentar el nuevo orden.
- Rendimiento con 300 gemas atraídas a la vez más 200 enemigos (bench de ADR-0003).
- ADR-0007 anticipaba mejoras como "transformaciones de `WeaponType`"; el design debe decidir y, si cambia el
  enfoque, dejarlo en una ADR.
- Equilibrio sin medir: la curva puede dar subidas cada pocos segundos al principio (muchas pausas) o demasiado
  lentas; se mide en apply con una tarea al inicio de `tasks.md` y se busca cada valor en todas las specs al cambiarlo.

## Decisiones por confirmar (defaults propuestos, revisar en el gate)
1. **XP por enemigo** en `enemies.json`: bug 1, merge-conflict 2, memory-leak 4. *Provisional, a medir en apply.*
2. **Curva** lineal creciente `5 + 5·(n−1)`, con arrastre de XP sobrante. *Provisional, a medir en apply.*
3. **Varias subidas en un tick**: se encolan y se ofrecen una a una.
4. **Sin nivel máximo** de partida en 0005.
5. **Radio de recogida** 128 px (64 en la aprobación; subido tras medir en apply), **imán** 360 px/s, gema atraída no se "suelta", radio de gema 5.
   *Provisional, a medir en apply.*
6. **Tope `maxGems` 300**; al llenarse, la XP de la nueva baja se suma a la gema más antigua. *Tope provisional.*
7. **Catálogo** de 9 mejoras (6 de arma, 3 de jugador) con los incrementos de la tabla y **nivel máximo 5** en todas.
   *Provisional, a medir en apply.*
8. **Vida máxima**: la mejora sube también la vida actual en la misma cantidad.
9. **Menos de 3 disponibles**: se ofrecen las que queden; con 0, subida sin oferta ni pausa.
10. **Muerte y subida en el mismo tick**: gana el fin de partida, sin oferta.
11. **Cadencia mejorada**: no reinicia la carga actual; rige desde el siguiente disparo.
12. Mejoras **aditivas** sobre la base de contenido (sin porcentajes); mecanismo concreto y ADR en el design.

## Criterio de éxito
- Todos los escenarios de las specs nuevas y modificadas en verde con `npm run verify`.
- Test de determinismo: misma semilla + mismos inputs + mismas elecciones ⇒ snapshots idénticos tick a tick,
  incluidas las ofertas de mejora.
- Test de congelado: N ticks solicitados con una oferta abierta no cambian el snapshot ni consumen azar.
- E2E en verde: en el juego real se recogen gemas, sube el nivel, aparece el overlay, se elige con tecla y la partida
  continúa con el efecto aplicado.
- `npm run bench` con 200 enemigos + `maxProjectiles` + `maxGems` gemas atraídas dentro del presupuesto del tick de
  ADR-0003, sin asignaciones nuevas por tick en el camino caliente.
- Contenido de mejoras, XP y progresión 100 % en `content/*.json` validado con zod; sin números mágicos ni
  dependencias nuevas.
