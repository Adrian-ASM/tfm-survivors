# Exploración · 0021-goblin-camps

Intención: parte B de 0020. Casas y torres goblin destruibles generadas con el mapa; el Goblin TNT nace en ellas,
patrulla un radio, se alerta al ver al jugador y vuelve a su puesto; campamentos de guardianes en "zonas ricas".
Prerrequisito de proceso: las specs de 0020 (`enemy-hazards`, deltas de `enemy-behavior`, `run-outcome`...) siguen
en `openspec/changes/0020-enemy-behaviors/specs/`; no están en `openspec/specs/` hasta archivar 0020. Los deltas
de 0021 no pueden modificarlas hasta entonces.

## 1. Contexto actual
- Mapa: `src/domain/map/generateMap.ts` (ríos, puentes, `placeTrunks`; azar solo `MAP_STREAM`, orden: orientación,
  lado, ríos, puentes, troncos). `CellType.ts`: grass/trunk/water/bridge/castle (códigos 0-4). `GameMap` es inmutable
  durante la partida (spec "Mapa de la partida de solo lectura"); `FlowField` copia los códigos una vez.
  Rejilla 64 × 36 (2.304 celdas, 60 px), troncos 12 %, `startRadius` 180, castillo 5 × 4.
- Enemigos: `Enemy` (escalares; `state`, `since`), `Horde.act` (espera, persecución por `FlowField.steer`, salida por
  distancia), `HazardField` (dinamitas, barril). `behavior` en `content/enemies.json` con clases cerradas
  `chase|fuse|charge|wait` (ADR-0019, que ya prevé `patrol|alert|return`). Invariante de spec: el centro de todo
  enemigo vivo está en celda caminable (la patrulla debe respetarlo; los enemigos ignoran la colisión del mapa).
- Aparición: `WaveDirector` + `placeSpawn` (anillo 1.500 px; 1 valor de azar por intento). TNT entra en la oleada a
  los 180 s (coste 3); ~225 apariciones en una partida completa y ~16 de daño medio (medición 0020). Picos de vivos
  < 150: `maxAlive` 300 no es hoy limitante.
- Armas: `Arsenal.step(n, x, y, targets: readonly WeaponTarget[])` recibe `horde.alive`; `WeaponTarget` es
  estructural (`x,y,radius,alive,takeDamage`). Puntería `nearest-in-range`; pulso por solape. Las bajas se retiran
  con `Horde.removeDead` (gema).
- Arte: pack local `C:\Users\Adri\TFM\Tiny Swords (Update 010)\Factions\Goblins\Buildings\` existe:
  `Wood_House/Goblin_House.png` y `_Destroyed` (128 × 192, 1 fotograma), `Wood_Tower/Wood_Tower_{Red,Blue,Purple,
  Yellow}.png` (1.024 × 192, 4 × 256 × 192), `_Destroyed` y `_InConstruction` (256 × 192). Hoy en el repo no hay
  ninguna (`content/asset-provenance.json`, 15 ficheros). Hay un test y dos escenarios de 0020 que exigen lo
  contrario: `tests/infrastructure/appearance-hazards.test.ts:208` (prohíbe `Goblin_House|Wood_Tower|Fire`) y los
  deltas `asset-provenance`/`sprite-rendering` de 0020: habrá que modificarlos.
- Culling y presupuesto: 667 y 750 objetos del mapa pintados (totales, 0018) en las semillas 42 y 123 frente a un
  tope de 1.000; casas y torres suman ~1-2 objetos cada una (hueco ~250).

## 2. Puntos obligatorios
**W3 (esquive del bot v3).** `tests/support/policies.ts:165-179` (`dodgeInput`): se salta el aviso si `d === 0`; con
suma de esquive (0, 0) cae a `fleeInput` (l.124), que solo repele enemigos a < `FLEE_ENEMY_RANGE` 150 (l.38), paredes
y celdas cercanas; sin ninguno devuelve (0, 0) y `steer` (l.147) da `PlayerInput.NONE`. Caso: jugador quieto, TNT que
lanza desde > 150 px (fuera del rango de huida), la dinamita se fija en la posición exacta del jugador (`launch` usa
(px, py)): la suma es nula y el bot recibe todas. Con salida 260 el bot perdió 50/50 (ADR-0019, addendum). Opciones:
(a) desempate fijo cuando la suma es nula o `d === 0` (octante por defecto, p. ej. el opuesto al lanzador o +x);
(b) si hay avisos amenazantes y la suma es nula, huir del enemigo más cercano sin límite de rango;
(c) ampliar `FLEE_ENEMY_RANGE` > distancia de lanzamiento (cambia toda la huida, rebaja el bot en general).
Es una regla del bot (spec `run-outcome`, "bot v4") y solo toca `tests/support/`; un jugador humano no está afectado.

**Distancia de lanzamiento del TNT (hoy 100).** Dependen de ella: `content/enemies.json` (`approach.exit.distance`);
cotas "38 < 100 ≤ 360, vuelo 45 ≥ 21" de ADR-0019 y de `design.md` §5 de 0020; test de contenido
`tests/content/enemies.test.ts`; balance 27/50 y 0 quietos (`balance.test.ts`, `policies-dodge.test.ts`); la curva de
XP 9/4 (`xpGrowth` 4 se subió *para* compensar el lanzamiento a 100; con 140 daba 19/50 con 4 y 29 con 3). Los
escenarios de comportamiento de 0020 usan tipos de prueba (distancia 200), así que no dependen. Con TNT de guardia la
alerta da un alcance natural largo (> 150) y W3 pasa a ser bloqueante si el bot lo ha de sufrir.

**Mapa, celdas y flujo.** Casas y torres = estructuras destruibles; el generador necesita huella, "puerta" (celda
caminable de nacimiento) y exclusión de zona de inicio/castillo/ríos.
Opciones: (A) **entidades sin celda**: la rejilla no cambia, el jugador las atraviesa (o no hay colisión), `FlowField`
y conectividad intactos; firma dorada de celdas sin cambios, hace falta una firma de estructuras. (B) **celdas
sólidas nuevas** (`house`, `tower`, códigos 5-6): colisionan con el jugador, la BFS las trata como bloqueo y la
conectividad exige rechazo (patrón de `placeTrunks`); al destruirse la rejilla muta: `GameMap`, `MapSnapshot`,
`FlowField` (copia de códigos y `blocked`) y mapa pintado dejan de ser inmutables y hay que recalcular el campo. Ese
recálculo por edificios estaba **reservado a 0025 build-sites** (GDD); B lo adelanta. (C) **sólidas mientras viven**:
la estructura bloquea al jugador vía una máscara aparte del mapa (colisión), pero el campo de flujo de enemigos las
ignora (los goblins no las usan para navegar); al destruirse solo cambia la máscara, sin tocar `GameMap`.
Azar: colocar tras los troncos con `MAP_STREAM` conserva ríos y troncos de cada semilla (solo se añaden valores al
final) pero cambia las posteriores de ese flujo; alternativa, un `STRUCT_STREAM` derivado (3er generador en
`seedSource.ts` y `TerrainSource`). `DECOR_STREAM` solo si hay variedad visual. Golden: `mapGolden.ts` y
`map-golden.test.ts` se regeneran (B: letras nuevas en `CELL_CODE`, spec "Composición del mapa" y `mapStats`; A/C:
nueva firma de estructuras). Zona de inicio y castillo: vetar su vecindad (`noTrunk`/`protectAround`).

**Armas y daño.** `Structure` puede cumplir `WeaponTarget`, pero `targets` es un solo array (concatenarlo asigna por
tick). Opciones: pasar una segunda lista al `Arsenal` con prioridad (estructura solo si no hay enemigo en alcance) o
mezclarla (las flechas se gastan en casas). El pulso (solape) las dañaría. Faltan: bajas de estructura (sin gema, o
recompensa pendiente de 0023/0024), explosiones (¿el barril y la dinamita las dañan? en 0020 se excluyó) y
`removeDead` propio. Snapshot: `structures` congelado (id, tipo, x, y, radio, vida, destruida) y las destruidas siguen
como ruina. Sonda E2E: `sprites.structures` (vivas/destruidas por tipo y reserva); máximo 1-2 E2E nuevos, ampliando
la suite de humo en manual.

**Arte.** Copiar `Goblin_House`, `Goblin_House_Destroyed`, `Wood_Tower_<color>` y `Wood_Tower_Destroyed` (4 ficheros)
con sha256 y bytes en `asset-provenance.json`, entradas en `content/appearance.json`, reserva de color por elemento
y anclaje en la capa alta (casa de 192 px de alto ≈ 3 celdas, copa/tejado sobre el jugador).

**Aparición del TNT.** Opciones: (1) los guardias se suman al TNT de oleada (más presión; pero el bot de referencia
no explora y puede no pasar nunca cerca de una casa: la presión real sería casi nula); (2) quitar `goblin-tnt` de
`waves.json` y que solo nazca en casas (mueve la presión a un lugar que el bot no visita: victorias previsiblemente
> 35 y balance sin sentido); (3) tipo nuevo `goblin-tnt-guard` (mismos stats, comportamiento patrulla/alerta/vuelta) y
el `goblin-tnt` de oleada se queda como artillero. Cuestiones comunes: reposición (tope por casa, intervalo, nace
mientras la casa vive), ¿cuenta contra `maxAlive` y el presupuesto?, sin azar nuevo (nace en la puerta, orden de
lista; entra en el orden del tick de `simulation-loop`). Patrulla: puntos fijos derivados del puesto (sin azar) o
flujo propio; la vuelta al puesto necesita un campo desde el puesto (BFS por casa, calculado una vez si el mapa no
cambia: 2.304 celdas × 4 B) o línea libre con radios cortos. Estados nuevos: ampliar la unión cerrada con `assertNever`
y `discriminatedUnion` en zod; cada enemigo guarda su puesto (2 escalares) y `RunSetup` debe validarlo.

**Campamentos.** "Zona rica" hoy solo puede ser un criterio del generador sobre troncos: p. ej. ventana de k × k
celdas con ≥ N troncos (densidad), lejos de la zona de inicio y con celdas caminables libres, ≥ d de otro
campamento. Sin madera ni oro, un campamento solo es un grupo de TNT/antorchas quietos sin premio por explorarlo; los
criterios se redefinirían en 0023/0024.

## 3. Riesgos e incógnitas
- Balance: margen 2 sobre el mínimo (27/50, banda 25-35, 0 quietos) y el bot no recorre el mapa: la influencia de
  casas/campamentos sobre él puede ser ≈ 0 (balance "no medible") o disparar la tasa. Cambiar el bot (W3) y el mapa en el
  mismo change impide aislar la causa (lección de 0020).
- Tiempo del lote: `BOT_BATCH_TIMEOUT_MS` 180 s, ya "≈ 70 s en CI, ~25 s en local" tras 0020; casas, patrullas y
  campos por puesto aumentan el trabajo por tick.
- Rendimiento: ≤ 0,25 ms/tick en el peor caso (hoy 0,206 con proyectiles); estructuras y listas deben ir en pools.
- Determinismo: el orden del tick y el azar del mapa son contrato; cualquier cambio reordena las 50 semillas.
- Incógnitas: qué hace la torre (¿dispara, genera, solo decorado?), recompensa al destruir, huella exacta de la casa
  sobre la rejilla, fotogramas útiles de la torre (4 × 256) y su uso.
- Tamaño: toca dominio, mapa, azar, armas, snapshot, render, arte, bot y balance a la vez.

## 4. Mediciones previas (las lanza el orquestador antes de la propuesta)
1. **Tiempo del lote de balance** (`balance.test.ts`, 50 semillas × 36.000 ticks) en local, y estimación en CI
   (factor ~2,8 observado en 0020) frente al timeout de 180 s. Umbral: ≤ 90 s equivalentes en CI (margen 2×); si no,
   subir el timeout o acortar el lote antes de añadir trabajo por tick.
2. Línea base actual: victorias (esperado 27/50), quietos vivos en 10.799 (0 con mapa generado y vacío), primera
   oferta semilla 7 (2.082).
3. Reparto de la presión del TNT: daño del TNT sobre el total y apariciones por semilla (ganadas y perdidas), para
   decidir 1/2/3 de aparición.
4. Ocupación del bot: celdas visitadas por el bot (50 semillas) y distancia mínima a cada celda del mapa; sirve para
   saber si casas/campamentos a distancia D del inicio llegan a alertar a un guardia.
5. Hueco libre del mapa: por semilla, número de huellas libres de casa (2 × 2 y 2 × 3) y torre a ≥ R celdas de la zona
   de inicio, castillo y agua, y distribución de la densidad de troncos por ventana (k = 7-9) para fijar el umbral de
   "zona rica" (umbral: ≥ 1 campamento y ≥ N casas en ≥ 99 % de las semillas 1..1000). Con B, % de semillas que
   rechazan por conectividad.
6. **TNT a > 100 px**: con el desempate de W3 aplicado solo en el bot (bot v4), barrer la distancia de lanzamiento
   {100, 140, 200, 260} con `xpGrowth` 3 y 4: victorias (banda 25-35), quietos (0) y semilla 43 con mapa vacío; umbral:
   ≥ 25 victorias con la curva 9/3 o 9/4 documentada y 0 quietos.
7. `npm run bench` con 300 vivos + estructuras y N guardias en patrulla/alerta (umbral ≤ 0,25 ms/tick; hoy 0,206).
8. Objetos del mapa pintados y dibujados por semilla (1..50), con casas y torres simuladas en el plan (umbral ≤ 1.000;
   hoy 750 máx. en 42/123) y bbox útil de las hojas de casa y torre.

## 5. Recorte de alcance (recomendación)
Es demasiado grande para un change. Recomiendo, por orden:
1. **Chore previo** (sin mapa ni goldens): bot v4 (W3) + recuperar la distancia de lanzamiento del TNT > 100 y, si hace
   falta, devolver `xpGrowth`; solo `tests/support/`, `content/` y specs de `run-outcome`. Baseline limpia para 0021.
2. **0021** = casas y torres destruibles + TNT de guardia (patrulla, alerta, vuelta), con la opción de mapa A o C
   (evita adelantar el recálculo de 0025). Torre: solo estructura destruible sin ataque propio.
3. **Campamentos fuera**, a un change posterior o a 0023 (recursos), cuando "zona rica" tenga significado.

## 6. Preguntas para el usuario
1. ¿Aceptas separar el chore (W3 + distancia del TNT) y sacar los campamentos de 0021?
2. ¿Casas y torres bloquean al jugador? ¿Bloquean a los enemigos y al campo de flujo (adelantaría 0025)?
3. ¿Qué hace una torre (nada, dispara, genera enemigos)? ¿Basta con una casa que genera TNT?
4. ¿El TNT de guardia sustituye al de oleada, se suma o es un tipo nuevo (opciones 1/2/3)?
5. ¿Las armas apuntan a estructuras (con prioridad menor que enemigos)? ¿Las explosiones las dañan?
6. ¿Destruir una casa da algo (gema de XP) o nada hasta 0023/0024?
7. ¿Patrulla determinista (puntos fijos) o con flujo de azar propio?
8. ¿Se acepta recalibrar `xpGrowth` si hace falta, y subir `BOT_BATCH_TIMEOUT_MS`?
