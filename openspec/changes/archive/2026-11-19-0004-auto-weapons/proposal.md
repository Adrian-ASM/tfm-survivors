# Proposal · 0004-auto-weapons

- **Estado**: aprobado (2026-11-19, gate humano)
- **Issue**: — (opcional)
- **Rama / worktree**: `change/0004-auto-weapons`
- **Depende de**: 0003-collisions-and-damage (archivado el 2026-11-19).
- **Exploración**: `openspec/changes/0004-auto-weapons/exploration.md`

## Problema
Desde 0003 los enemigos persiguen, golpean y pueden matar al jugador, pero el jugador no tiene ninguna forma de
defenderse: solo esquiva y acaba muriendo (~16 s quieto). El bucle central del GDD ("moverse → esquivar → las armas
matan") está roto por la mitad, y el GDD marca como Must "2 armas automáticas". Además, el modelo de bajas de enemigos
de 0003 solo lo ejercitan los tests (`Run.damageEnemy` por id, O(n), deuda S4), y el director nunca repone bajas en
juego.

## Objetivo
Al empezar la partida el jugador lleva dos armas que atacan solas, cada una con su propio criterio de objetivo y su
propio tipo de ataque y su propio daño base, todo definido en `content/weapons.json` y validado con zod. Los enemigos
no mueren de un toque: cada impacto resta a su vida el daño del arma que lo golpea; los que llegan a vida 0
desaparecen del juego y el director repone huecos sin superar `maxAlive`. El jugador ve en
pantalla los proyectiles y los pulsos de área, y ve cómo los enemigos desaparecen. Todo sigue siendo determinista con
la misma semilla e inputs.

## Alcance

### Dentro
- **Modelo genérico de arma**: cada arma tiene un id, una cadencia en ticks, un **daño base** propio (`damage`, entero
  positivo), un **criterio de objetivo** y un **tipo de ataque**, todos configurables por arma en contenido (uniones discriminadas en zod). Añadir un tercer criterio o tipo
  no debe obligar a tocar las dos armas existentes.
- **Dos armas concretas** (valores provisionales, los concreta el architect):
  1. **Linter** — objetivo `nearest-in-range` (enemigo vivo más cercano al jugador dentro de un alcance máximo, p. ej.
     400 px; empate por orden de la lista de enemigos, sin azar). Ataque `projectile`: lanza un proyectil físico hacia
     la posición del objetivo en el momento del disparo, con velocidad, radio, daño y vida en ticks (p. ej. 480 px/s,
     radio 4, **daño 6**, 60 ticks, cadencia 30 ticks). Se consume al primer enemigo que toca; si agota su vida sin tocar
     a nadie, desaparece. El proyectil no persigue (no es teledirigido).
  2. **Tests** (suite de tests) — objetivo `any-in-radius` (hay al menos un enemigo vivo dentro de un radio alrededor
     del jugador, p. ej. 90 px). Ataque `pulse`: daño instantáneo de área a **todos** los enemigos vivos cuyo círculo
     solape ese radio en el tick del disparo (p. ej. **daño 4**, cadencia 90 ticks).
  Los daños base de ambas armas son distintos y ninguno alcanza la vida del enemigo más débil (bug, 10), así que
  ningún enemigo muere de un solo impacto o pulso. No crea entidades persistentes.
- **Cadencia en ticks enteros** (sin `Clock` ni `Date`): contador por arma. **Retención de carga**: si el arma está
  cargada y no hay objetivo según su criterio, no dispara ni pierde la carga; dispara en el primer tick en que lo
  haya y entonces empieza su intervalo.
- **Proyectiles en el dominio**: colección propia en `Run`, colisión círculo-círculo contra enemigos vivos por fuerza
  bruta (reutilizando `circlesOverlap`), bajas aplicadas una sola vez por tick (patrón de ADR-0006, sin asignar en el
  camino caliente). Tope `maxProjectiles` en contenido: con el tope lleno, el arma de proyectiles retiene la carga.
- **Vida de los enemigos y daño acumulado**: se reutiliza lo que ya existe desde 0003 (`health` por tipo en
  `content/enemies.json`: bug 10, merge-conflict 20, memory-leak 45; `Enemy.takeDamage` recorta a 0). Cada impacto
  de proyectil o pulso resta exactamente el daño base del arma que golpea; un enemigo dañado pero con vida > 0 sigue
  persiguiendo con normalidad. Sin cambios en los valores de `enemies.json`.
- **Bajas en juego**: un enemigo dañado hasta vida 0 por cualquier arma desaparece del snapshot ese mismo tick, deja
  de contar para `maxAlive` y no inflige daño de contacto en ese tick ni después. Varios impactos sobre el mismo
  enemigo en el mismo tick suman daño; la vida no baja de 0.
- **Contenido**: nuevo `content/weapons.json` (armas equipadas al inicio + `maxProjectiles`), esquema zod `strictObject`
  y reglas cruzadas en `buildRunRules` (cadencia, daño, velocidad, radios, alcance y vida enteros/positivos según
  corresponda; ids únicos; criterio de objetivo compatible con el tipo de ataque).
- **Partida terminada**: con el estado terminado, las armas no disparan, los proyectiles no se mueven y no se consume
  azar (se conserva el congelado de 0003).
- **Orden del tick fijado** en el design, incluyendo disparo, movimiento de proyectiles, colisión, pulsos y bajas,
  antes del director para que pueda reponer en el mismo tick. Cambia las partidas de una semilla respecto a 0003; los
  tests de determinismo se actualizan.
- **Snapshot ampliado**: proyectiles vivos (id, posición, radio) y pulsos disparados en el tick (centro, radio). Sigue
  inmutable desde fuera.
- **Vista**: pool de sprites de proyectiles con capacidad `maxProjectiles`, asociados por `id`; pulso pintado como
  anillo breve. Al menos una comprobación E2E o de snapshot de que se dispara y se matan enemigos en el juego real.
- **Rendimiento** revalidado con `npm run bench` en el peor caso (200 enemigos vivos + `maxProjectiles` proyectiles).

### Fuera
- XP, gemas, subida de nivel y mejoras de armas (0005); HUD de armas, contador de bajas, menú (0006).
- Más armas (p. ej. *refactor*), criterios de objetivo no usados por las dos armas (dirección de movimiento, aleatorio)
  y elegir armas al empezar: el modelo los admite, pero no se implementan.
- Extensiones del modelo de daño, para las que queda preparado (daño base por arma, vida por tipo de enemigo) pero
  que no se implementan: modificadores de daño por mejoras o nivel de arma, resistencias o debilidades por tipo de
  enemigo, críticos y tipos de enemigo nuevos con otra vida.
- Perforación (`pierce`), proyectiles teledirigidos, rebotes, *knockback* y efectos de estado.
- Rejilla espacial / *spatial hash* (ver decisión abierta 3).
- Audio, partículas y números de daño flotantes.
- Balance fino: los valores numéricos son provisionales.

## Capacidades afectadas
- `openspec/specs/auto-weapons` (nueva): modelo de arma, criterios de objetivo, tipos de ataque, cadencia y retención,
  proyectiles, pulsos, tope de proyectiles y contenido `weapons.json`.
- `openspec/specs/simulation-loop` (modificada): orden del tick, snapshot con proyectiles y pulsos, determinismo con
  armas, rendimiento.
- `openspec/specs/enemy-behavior` (modificada): daño recibido de armas y baja en juego.
- `openspec/specs/enemy-spawning` (modificada): reposición de bajas causadas por armas; sustitución de la baja por id
  si se aprueba la decisión abierta 2.
- `openspec/specs/run-state` (modificada): sin disparos ni movimiento de proyectiles con la partida terminada.
- `openspec/specs/player-health`, `player-movement`, `architecture-guardrails`: sin cambios previstos.

## Decisiones tomadas (gate de exploración)
1. Dos armas en este change.
2. Cada arma tiene su propia configuración de objetivo, en contenido.
3. Cada arma tiene su propio tipo de ataque: Linter = proyectil físico; Tests = pulso de área.
4. Sin objetivo con la carga lista, el arma retiene la carga y dispara en el primer tick en que haya objetivo.
5. (Feedback del gate de propuesta) Cada arma tiene un daño base distinto en contenido (Linter 6, Tests 4,
   provisionales).
6. (Feedback del gate de propuesta) Los enemigos no mueren de un toque: cada impacto resta el daño del arma que
   golpea y solo mueren al llegar a 0; los valores de contenido garantizan que ninguna arma mata a un bug de un
   impacto.

7. (Hallazgo de equilibrio en apply, tarea 4.7, decidido por el usuario) Medido en el núcleo con el contenido por
   defecto y el jugador quieto: primer golpe en el tick 4.100 (seed 42; partida terminada en 4.815), 4.098 (seed 7;
   terminada en 4.629) y 3.899–4.126 (seeds 1–3); primer pulso en 1.177 (seed 42) y 950 (seed 7). Con seed 7, en
   600 ticks hay 16 proyectiles, 7 bajas y 0 pulsos: el Linter mata a los bugs antes de que entren en el radio de
   Tests. No cambian los valores de contenido; se relajan los plazos de las specs: primer golpe ≤ 4.800 ticks en el
   núcleo y ≤ 80 s en E2E (seguimos en curso tras él); pulso de Tests ≤ 1.800 ticks (30 s) en el núcleo. La E2E de
   seed 7 (15 s) solo exige proyectiles y bajas, no pulsos.

## Decisiones abiertas (a confirmar en este gate; valor por defecto propuesto)
1. **Feedback visual mínimo**: proyectiles como círculos pequeños, pulso como anillo semitransparente durante unos
   pocos ticks (p. ej. 8) y el enemigo muerto simplemente desaparece. Sin flash de impacto, partículas ni contador.
2. **`Run.damageEnemy` por id (S4)**: se elimina de la API pública; el daño de armas va por referencia/índice dentro
   de `Run` y los tests que la usaban pasan a provocar bajas con armas o con un ayudante de test. Alternativa:
   conservarla solo para tests.
3. **Rejilla espacial**: se aplaza; fuerza bruta en 0004 y se decide con datos del bench. Si el peor caso supera
   2 ms/tick, se abre un change específico con su ADR.
4. **Primer disparo**: las armas empiezan cargadas (pueden disparar en el tick 1 si hay objetivo). Alternativa: esperar
   un intervalo completo.
5. **Feedback de "dañado pero vivo"**: como un enemigo ya no muere de un toque, el jugador necesita ver que el
   impacto cuenta. Por defecto: destello claro del enemigo durante 4 ticks tras recibir daño (el snapshot expone si
   el enemigo fue dañado recientemente). Sin barras de vida ni números de daño. Alternativa: sin destello en 0004.

## Riesgos y dudas
- **Determinismo**: el orden de sub-pasos del tick y el desempate del objetivo cambian las partidas de una semilla;
  deben quedar fijados en spec y design, sin azar en la selección de objetivo.
- **Equilibrio**: con los valores provisionales (Linter mata un bug en 2 impactos, un merge-conflict en 4 y un
  memory-leak en 8; Tests un bug en 3 pulsos) el juego puede volverse trivial o seguir siendo imposible; los escenarios largos deben declarar la vida necesaria (lección 0003).
- **Asignaciones**: `snapshot()` ya asigna ~200 objetos por frame (S5); proyectiles y pulsos suman más. Vigilar con el
  bench; los proyectiles del dominio se preasignan o reutilizan (ADR-0003).
- **Pulso y objetivo**: el criterio `any-in-radius` y el área del pulso usan el mismo radio; si se separan en el
  futuro, la validación cruzada debe garantizar que el pulso alcanza al menos al enemigo que lo activó.
- **Firma de configuración**: añadir armas amplía `RunConfig`, `RunRules` y `parseRunConfig` (4 ficheros); riesgo de
  romper tests de contenido existentes.
- **Observabilidad**: el disparo debe verse y comprobarse en el juego real (lección S7 de 0003), no solo en tests.

## Criterio de éxito
- Escenarios de `auto-weapons` y de las specs modificadas en verde; `npm run verify` y CI en verde.
- Con un bug (vida 10) a 100 px del jugador y el Linter cargado, en el tick del disparo aparece 1 proyectil en el
  snapshot; cuando su círculo solapa al bug, el proyectil desaparece y el bug queda con vida 4 (sigue en el
  snapshot); el segundo impacto de Linter lo deja a 0 y desaparece del snapshot ese tick.
- Daño acumulado con Linter 6, Tests 4 y bug de vida 10: 1 impacto de cualquier arma no mata; 2 de Linter matan;
  2 pulsos de Tests dejan vida 2 y el 3.º mata; 1 impacto de Linter + 1 pulso de Tests deja vida 0 y mata. Un
  merge-conflict (20) necesita 4 impactos de Linter y un memory-leak (45), 8.
- Contenido de armas con un `damage` mayor o igual que la vida mínima de los enemigos no rompe la carga (es válido),
  pero los valores entregados en `content/weapons.json` cumplen que ningún arma mata a un bug de un impacto.
- Con el único enemigo a 500 px (fuera del alcance de 400 px), el Linter no dispara durante 120 ticks y dispara en el
  primer tick en que un enemigo entra en alcance (carga retenida).
- Con 3 enemigos dentro del radio de Tests y 1 fuera, un pulso resta exactamente su daño a los 3 y nada al de fuera;
  sin enemigos en el radio, no hay pulso.
- Con `maxProjectiles` proyectiles vivos, el Linter no crea más y retiene la carga.
- Con la partida terminada, 600 ticks más dejan el snapshot idéntico (sin disparos ni proyectiles movidos).
- Contenido de armas inválido (cadencia, daño, velocidad, radio, alcance o vida ≤ 0; ids duplicados; criterio
  incompatible con el tipo; campos desconocidos) se rechaza con un error explícito.
- Misma semilla y mismos 600 inputs → snapshots estrictamente iguales en cada tick, con armas activas.
- En la URL de Pages, el jugador quieto mata enemigos sin pulsar nada y se ven proyectiles y pulsos; al menos una
  prueba E2E o de snapshot lo comprueba.
- `npm run bench`: tick ≤ 2 ms de media con 200 enemigos vivos y `maxProjectiles` proyectiles activos.
