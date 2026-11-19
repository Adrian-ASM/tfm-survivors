# Tasks · 0005-xp-and-level-up

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: medición → dominio → aplicación →
     infraestructura → composición → E2E → docs. TDD: en cada tarea, primero el test en rojo, después el código.
     El implementer marca [x] y hace un commit por tarea (`refs: 0005-xp-and-level-up`). `npm run verify` en verde
     al cerrar cada tarea. Todos los números de equilibrio son provisionales: si uno cambia, buscarlo en todas las
     specs del change (y en las vivas que lo citen) y en este fichero. -->

## 0. Medición de equilibrio y plazos (primero, lección de 0004)
- [x] 0.1 Línea base con el código actual (0004, sin progresión): medir en el núcleo con un test temporal el tick del
  primer golpe (semilla 42, input (0, 0)), de la primera baja y del primer pulso (semilla 7) y anotarlos en
  `design.md` § "Desviaciones del apply" — escenarios de referencia: "Primer golpe en el núcleo con armas activas",
  "Jugador quieto con el contenido por defecto"
- [ ] 0.2 Escribir ya los tests de aceptación de plazos en `tests/domain/balance.test.ts`, marcados `.skip` con
  referencia a la tarea 0.3: primera oferta ≤ 3.600 ticks (semilla 7, input (0, 0), política de elección fija),
  primer golpe ≤ 4.800 (semilla 42), ≥ 1 baja en 600 y ≥ 1 pulso en 1.800 (semilla 7), ≥ 1 gema recogida y ≥ 1
  oferta en 3.600 (semilla 7) — escenarios: "Primera subida en el núcleo", "Primer golpe en el núcleo con armas
  activas", "Jugador quieto con el contenido por defecto", "Partida con progresión reproducible"
- [ ] 0.3 **Punto de control, se ejecuta en cuanto 1.25 esté en verde y antes del grupo 3**: quitar los `.skip` de
  0.2, medir ticks reales (y frecuencia de ofertas en los primeros 5 min con semilla 7) y ajustar los valores
  provisionales de contenido si hace falta, actualizando todas las specs que los citan. Medir también un primer
  bench del peor caso con gemas (tarea 3.9 adelantada en borrador). Si un plazo no se cumple con valores
  razonables, **parar y volver a la spec** (hallazgo de equilibrio, no test relajado)

## 1. Dominio
- [x] 1.1 `EnemyType.xp` (entero ≥ 1) y su mensaje; `xp: 1` en los tipos de `tests/support/builders.ts` — escenarios:
  "XP inválida o ausente" (dominio), "XP mínima válida", "Contenido por defecto" (enemy-spawning)
- [x] 1.2 `PlayerRules.pickupRadius` y su invariante en `checkPlayer`; builders con `pickupRadius` 64 — escenarios:
  "Radio de recogida inválido o ausente" (dominio), "Radio de recogida por defecto"
- [x] 1.3 `progression/XpCurve` (VO, `toNext`) — escenarios: "Curva por defecto" (xpToNext 5, 10, 15, 250),
  "Valores inválidos" (leveling, dominio), "Curva plana"
- [x] 1.4 `progression/Experience` (`gain`, `resolveOne`, `clearPending`) — escenarios: "Por debajo del umbral",
  "Umbral exacto", "Arrastre del sobrante", "Una gema que da dos niveles", "Varias gemas que dan varios niveles",
  "Nivel 50"
- [x] 1.5 `progression/GemRules` (VO) y `XpGem` (`set`, `pull` sin sobrepasar) — escenarios: "Valores no positivos"
  (dominio), "Tope mínimo válido", "No sobrepasa al jugador" (unidad de `pull`)
- [x] 1.6 `GemField.drop`: pool de `maxGems`, ids sin reutilizar, tope con suma a la más antigua — escenarios: "Tope
  lleno", "Varias bajas con el tope lleno", "Las gemas no consumen azar" (unidad)
- [x] 1.7 `GemField.step` imán: atracción inclusiva, atraída para siempre, avance `magnetSpeed / 60` — escenarios:
  "Límite exacto del radio", "Recorrido hasta la recogida", "Una gema atraída no se suelta", "Gema fuera del radio"
- [x] 1.8 `GemField.step` recogida estricta, suma de XP y compactación estable — escenarios: "Recogida de una gema",
  "Tangencia tras el imán no es recogida", "Varias gemas en el mismo tick", "Plaza liberada por una recogida",
  "Gemas en el snapshot" (orden g1, g3, g4)
- [x] 1.9 `upgrade/UpgradeType` y `UpgradeCatalog`: ids únicos, arma existente, compatibilidad `stat` ↔ objetivo
  (`TARGETING_STAT`), mensajes con el id — escenarios: "Identificador repetido o lista vacía" (repetido),
  "Arma inexistente", "Estadística incompatible"
- [x] 1.10 `UpgradeCatalog`: `perLevel` entero en `damage`/`cooldownTicks` y build de peor caso con `WeaponType.create`
  y `checkPlayer`; `pulseCapacity` de peor caso — escenarios: "Nivel máximo que saca la cadencia de rango", "Límite
  exacto de la cadencia", "Suma de varias mejoras sobre la misma estadística", "Valores inválidos" (`perLevel` 1,5
  en `damage`)
- [x] 1.11 `upgrade/upgradeStats` (`upgradedWeapon`, `upgradedPlayer`, siempre desde la base) — escenarios: "Más daño
  del Linter" (damage 9), "Más alcance" (range 460), "Más radio del pulso" (radius 105), "Más velocidad" (220),
  "Más radio de recogida" (96), "El contenido base no cambia" (unidad)
- [x] 1.12 `UpgradeBoard`: niveles, disponibilidad y `open` (Fisher–Yates parcial, `k = min(3, m)` valores de azar,
  arrays preasignados) con un `RandomGenerator` guionizado — escenarios: "Ninguna adquirida al empezar", "Dos
  disponibles", "Una disponible", "Mejora en su nivel máximo"
- [x] 1.13 `UpgradeBoard.pick` y `UpgradeChoiceError` — escenarios: "Elección válida" (unidad), "Índice fuera de
  rango" (3, −1, 1,5; 2 con 2 opciones)
- [x] 1.14 `Health.raise` y `Player.withRules` (conserva posición e invulnerabilidad; recorte a `[1, max]` con
  incremento negativo) — escenarios: "Con la vida llena", "Con la vida a medias", "Nivel máximo" (player-health)
- [x] 1.15 `Weapon.retune` y `Arsenal.retune` sin tocar `readyAt`; el proyectil y el eco conservan daño y radio —
  escenarios: "Mejora de cadencia a mitad de recarga" (unidad de `Weapon`), "Proyectil en vuelo durante una mejora
  de daño" (unidad), "Pulso visible durante una mejora de radio" (unidad)
- [ ] 1.16 `RunConfig` / `buildRunRules`: `progression`, `upgrades`, `RunRules.curve/gems/upgrades/pulseCapacity`;
  `DEFAULT_PROGRESSION`, `NO_UPGRADES`, `DEFAULT_UPGRADES` y `withUpgrades` en builders — escenarios:
  `run-config.test.ts` por regla; todos los tests existentes siguen en verde con `NO_UPGRADES`
- [ ] 1.17 `RunStatus` `'choosing'`; `RunSetup.gems` y `RunSetup.experience` con su validación; `Run` posee
  `GemField`, `Experience` y `UpgradeBoard` — escenarios: "Partida recién creada" (leveling y simulation-loop, nivel 1,
  XP 0, xpToNext 5, listas vacías, sin oferta)
- [ ] 1.18 `Run.removeDead` suelta una gema por muerto en orden de la lista — escenarios: "Un bug abatido suelta una
  gema", "Valor según el tipo", "Varias bajas en el mismo tick", "Sin baja no hay gema", "Una baja en el tick de la
  muerte deja su gema", "Valores de cada tipo llegan al dominio" (gema de 3 XP)
- [ ] 1.19 Paso de gemas tras el contacto y XP del tick — escenarios: "Gema de una baja junto al jugador", "El imán usa
  la posición del jugador ya movido", "Enemigos encima de una gema", "Muerte y subida de nivel en el mismo tick",
  "Gemas congeladas al terminar"
- [ ] 1.20 Apertura de oferta como último paso del tick y `pendingLevelUps` en `Experience` — escenarios: "Primera
  oferta", "El director actúa antes de abrir la oferta", "Ninguna disponible", "Sin pasar por eligiendo si no hay
  mejoras disponibles", "Eligiendo mejora y vuelta a en curso" (primera mitad)
- [ ] 1.21 Congelado en `'choosing'`; ayudante `advance(run, ticks, input)` con la política de elección fija en
  `tests/support/runs.ts` — escenarios: "600 ticks con una oferta abierta", "La pausa no consume azar", "La
  invulnerabilidad no corre durante la pausa", "Input ignorado mientras se elige", "La pausa no adelanta la recarga"
- [ ] 1.22 `Run.chooseUpgrade`: validación, efecto de arma, cola de ofertas y vuelta a en curso — escenarios:
  "Elección válida", "Sin oferta abierta", "La segunda oferta tras la primera elección", "La disponibilidad se
  recalcula entre ofertas encoladas", "Continuación tras elegir", "Mejora de cadencia a mitad de recarga", "Cadencia
  mejorada sin reiniciar la carga", "Cadencia de Tests mejorada"
- [ ] 1.23 Efectos de arma a través de `Run` — escenarios: "Más daño del Linter", "Mejoras acumuladas que matan de un
  impacto", "Más alcance", "Alcance mejorado", "Más radio del pulso", "Pulso mejorado", "Un pulso mejorado mata a un
  bug de un golpe", "Más daño de Tests", "Daño efectivo con mejoras", "Proyectil en vuelo durante una mejora de
  daño", "Pulso visible durante una mejora de radio", "El contenido base no cambia"
- [ ] 1.24 Efectos de jugador a través de `Run` — escenarios: "Más velocidad", "Velocidad mejorada", "Velocidad en el
  nivel máximo", "Más radio de recogida", "Con la vida a medias" (vía `Run`), "La mejora no altera la
  invulnerabilidad", "Golpe letal tras la mejora"
- [ ] 1.25 Snapshot ampliado y congelado (`gems`, `progression`, `offer`, `upgrades`) — escenarios: "Gemas en el
  snapshot", "Oferta en el snapshot", "Snapshot no mutable desde fuera" (con gemas y con oferta), "XP acumulada hasta
  el nivel 3"
- [ ] 1.26 Determinismo con elecciones — escenarios: "Dos partidas idénticas", "Partida con progresión reproducible",
  "Elecciones distintas divergen", "Partida larga reproducible", "Oferta reproducible", "Todas las mejoras pueden
  salir", "Partida con contactos reproducible", "Partida con armas reproducible"
- [ ] 1.27 Revisar tests heredados con contenido por defecto (`long-run`, escenarios largos de armas y spawning) para
  usar `advance` con la política fija y los plazos medidos en 0.3 — escenarios: "Jugador quieto con el contenido por
  defecto", "Ningún arma mata a un bug de un impacto sin mejoras", "Una partida terminada no vuelve a en curso"

## 2. Aplicación
- [ ] 2.1 `FixedStepLoop.advance` con `step: () => boolean` y `reset()` — escenario: "Oferta a mitad de frame"
- [ ] 2.2 `TickRun` no avanza ni acumula con la partida eligiendo o terminada — escenarios: "Frames durante la
  elección", "Primer frame tras elegir"
- [ ] 2.3 `ChooseUpgrade` y `StartRun` devolviendo `{ tickRun, chooseUpgrade }` — escenarios: "Elección válida" e
  "Índice fuera de rango" a través del caso de uso (snapshot y azar sin cambios en el error)

## 3. Infraestructura y composición
- [ ] 3.1 `EnemiesSchema.xp` y `PlayerSchema.pickupRadius`; `xp` en `content/enemies.json` y `pickupRadius` en
  `content/player.json` — escenarios: "XP por defecto de cada tipo", "XP inválida o ausente", "Radio de recogida
  inválido o ausente", "Radio de recogida por defecto"
- [ ] 3.2 `ProgressionSchema` y `content/progression.json` en el loader — escenarios: "Contenido por defecto"
  (xp-gems), "Curva por defecto", "Valores no positivos", "Tope de gemas no entero", "Campo desconocido o ausente",
  "Valores inválidos" (leveling)
- [ ] 3.3 `UpgradesSchema` y `content/upgrades.json` (9 mejoras) en el loader, reglas cruzadas vía `superRefine` —
  escenarios: "Catálogo por defecto", "Identificador repetido o lista vacía", "Valores inválidos" (upgrades), y los
  de 1.9–1.10 a través del loader
- [ ] 3.4 `GemLayer` sobre `SlotPool` — escenarios: "Recogidas y nuevas", "Tope de gemas pintado", "Todas recogidas"
- [ ] 3.5 `xpBarFill` (pura) y `XpBar` (repinta solo si cambian valores) — escenarios: "Barra vacía al empezar",
  "Relleno parcial", "Tras subir de nivel"
- [ ] 3.6 `cardLayout` (pura) y `UpgradeOverlay` con dobles (relleno al cambiar la oferta, visibilidad, índice
  clicado) — escenarios: "Tres cartas", "Menos cartas" (2 cartas), "Sin oferta" (no visible)
- [ ] 3.7 `ChoiceKeys` y elección en `GameScene.update` (solo con oferta e índice < nº de cartas) — escenarios:
  "Elegir con tecla", "Elegir con clic", "Menos cartas" (tecla 3 no hace nada), "Sin oferta" (teclas sin efecto)
- [ ] 3.8 `main.ts`: `SceneCapacity.gems`, `pulses` desde `rules.pulseCapacity`, `chooseUpgrade` a la escena;
  comprobación manual con `npm run dev` (gemas, barra, overlay, teclas y clic)
- [ ] 3.9 Bench: caso "Peor caso con gemas" (300 atraídas a ≥ 400 px, 60 ticks) y política de elección 0 en los
  casos existentes; anotar resultados — escenarios: "Peor caso con gemas", "Tope de vivos alcanzado", "200 enemigos
  encima del jugador", "Peor caso con proyectiles"

## 4. E2E y documentación
- [ ] 4.1 `tests/e2e/probe.ts`: `SnapshotView` ampliado y ayudante que pulsa `1` cada vez que hay oferta; adaptar
  los E2E existentes de semilla 42 y 7 — escenarios: "Primer golpe en el navegador", "Comprobación en el navegador"
- [ ] 4.2 E2E `level-up.spec.ts` con `?e2e&seed=7` sin input — escenario: "Recorrido en el navegador" (nivel 1 antes
  del overlay; tras pulsar 1, overlay oculto, nivel 2 y ticks avanzando)
- [ ] 4.3 ADR-0003 y ADR-0006: sección "Aplicación (0005)" con datos del bench; ADR-0008 a "aceptada" si el apply la
  confirma; `design.md` § "Desviaciones del apply" con las mediciones de 0.1 y 0.3
- [ ] 4.4 Cierre: `npm run verify`, `npm run test:e2e` y `npm run bench` en verde; revisar que ningún número
  provisional cambiado quedó sin actualizar en las specs
