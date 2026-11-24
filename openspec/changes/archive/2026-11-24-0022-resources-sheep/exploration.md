# Exploración · 0022-resources-sheep

Intención: generalizar las gemas a recogibles con tipo (XP, oro, madera, carne) y añadir ovejas neutrales que huyen y
sueltan carne. Gastar oro y madera queda fuera (0023 y 0024).

## Contexto actual
- **Gemas**: `src/domain/progression/GemField.ts` (pool de `maxGems` 300, `XpGem`, imán inclusivo a `pickupRadius`,
  recogida por solape, `drop` recoloca con `map.nearestWalkable`, con el tope lleno suma la XP a la gema más
  antigua). Solo lleva `value` de XP; `step()` devuelve la XP y `Run.tick` la pasa a `experience.gain`. Sin azar.
  Se sueltan en `Run.dropGem` (bajas de armas y de peligros). `GemSnapshot` y `toGemSnapshot` en
  `src/domain/run/RunSnapshot.ts` y `snapshotParts.ts`; `RunSetup.gems` y `initialGems` en `RunSetup.ts`.
- **Contenido**: `content/progression.json` (`gemRadius` 5, `magnetSpeed` 360, `maxGems` 300), zod en
  `src/infrastructure/content/schemas.ts`; `RunConfig`/`RunRules` en `src/domain/run/`.
- **Render**: `GemLayer` (pool de `maxGems`, aspecto único `gem` en `content/appearance.json`, que **usa
  `G_Idle.png`, la bolsa dorada**), `renderCounts.ts` (sonda `sprites.gems`), `Hud.ts`/`hudFormat.ts`/`hudLayout`.
- **Salud**: `Health` solo tiene `damage` y `raise` (sube el máximo). **No existe curar.**
- **Azar**: `deriveSeed.ts` define `MAP_STREAM` 1, `DECOR_STREAM` 2, `STRUCT_STREAM` 3 (`seedSource.ts`).
  `placeStructures.ts` tiene ya rejillas de distancia (a inicio, castillo, agua) y ocupación reutilizables.
  Un `RESOURCE_STREAM` 4 dejaría `MAP_GOLDEN` y `STRUCTURE_GOLDEN` intactas (patrón de ADR-0020).
- **Estructuras 0021**: `StructureField.settle()` marca la destrucción tras armas; `Structure` expone vida y ruina.
  El barril muere en `Horde.removeDead` (no hay ganchos de "recompensa" por tipo; solo `xp`).
- **Bot v3** (`tests/support/policies.ts`): esquiva, nunca busca gemas (solo el imán). No recogería ovejas ni
  recursos lejanos salvo de paso.
- **Retro 0021**: el aviso de "demasiado grande" no se respetó y apply tardó ~100 min; las mediciones previas
  evitaron otro 0006; pedir decisiones de alcance antes de lanzar mediciones; registrar procedencia en la misma
  tarea que copia el PNG; el lote de balance va a ~30 s local (~85 s CI, tope 90 s): medir antes si se añade
  trabajo por tick.

## Specs afectadas (`openspec/specs/`)
`xp-gems` (se generaliza; reescritura grande), `hud` (contadores), `simulation-loop` (orden del tick, snapshot,
determinismo, rendimiento), `leveling` (la XP sigue igual), `player-health` (curación), `goblin-structures` (oro al
destruir), `enemy-hazards`/`enemy-behavior` (madera del barril, ovejas con comportamiento propio),
`procedural-map` (recursos y ovejas colocados por semilla), `sprite-rendering` y `asset-provenance` (arte nuevo),
`enemy-spawning` (las ovejas no son oleada ni cuentan para `maxAlive`), `run-outcome` (¿bajas?).

## Arte (Tiny Swords Update 010)
Pack en `C:\Users\Adri\TFM\Tiny Swords (Update 010)\` (fuera del repo). En `public/` solo hay `G_Idle.png` y `Tree.png`;
el resto exige copiarlo y añadir entrada en `content/asset-provenance.json` (sha256, bytes) en la misma tarea.
Tamaños leídos a ojo del PNG; confirmar al copiar.
- Ovejas (`Resources/Sheep/`): `HappySheep_Idle.png` (8 frames de 128 px), `HappySheep_Bouncing.png` (6 frames de 128, saltito),
  `HappySheep_All.png` (8 × 2). Sin animación de huida propia: la de salto sirve de "mover/huir". Una sola dirección (mirando a la derecha; flip).
- Recursos (`Resources/Resources/`): `G_Idle.png` (bolsa de oro), `W_Idle.png` (tronco), `M_Idle.png` (carne), todos
  128 × 128 un frame; versiones `_(NoShadow)` y `G/W/M_Spawn.png` (7 frames de 128, anillo de aparición y bote).
- Veta: `Resources/Gold Mine/GoldMine_Active/Inactive/Destroyed.png` (~190 × 128, 3 estados). **No hay cofre.**
- Madera suelta: troncos `W_*`; `Tree.png` ya está en uso (no se talan).
- Conflicto: hoy la gema de XP **es** la bolsa dorada. Oro y XP necesitan aspectos distintos (tinte, cambiar el de
  XP o una reserva de color). El pack no trae gema azul.

## Opciones de alcance (sin elegir)
- **A. Un change completo** (recogibles + fuentes + ovejas + HUD). Pros: una sola recalibración y una spec. Contras:
  mismo riesgo de tamaño que 0021; toca dominio, contenido, render, arte, HUD y bot.
- **B. Dos changes**: 0022 = recogibles con tipo + fuentes (barril → madera, estructuras → oro, montones y vetas por
  mapa con `RESOURCE_STREAM`) + curación + HUD; 0022b = ovejas (comportamiento de huida, drop de carne).
  Pros: la oveja es un comportamiento nuevo (como `patrol/alert`) y se aísla; el balance se mide dos veces con
  menos incógnitas. Contras: la carne y la curación quedan sin fuente hasta 0022b (o con carne en el suelo
  provisional); renumeración del GDD.
- **C. Mínimo vertical**: recogibles con tipo, oro y madera de fuentes existentes (estructuras y barriles, sin
  nuevo azar ni mapa), y ovejas + carne; los montones y las vetas por mapa pasan al backlog. Pros: sin tocar
  colocación. Contras: se pierde "explorar se recompensa" (pilar 2), que es lo que justifica el change.

## Riesgos e incógnitas
- **Balance**: la carne cura; el bot v3 no busca ovejas, así que la tasa 27/50 probablemente no cambia, pero el
  modelo de partida humana sí. Cuánto cura y cuántas ovejas hay son números de diseño sin medir. Una curación
  de gran tamaño rompería "quieto pierde antes de 180 s" solo si el quieto recogiera carne: con ovejas lejos del
  inicio no ocurre, pero conviene un test.
- **Determinismo**: ovejas deambulando necesitan azar (flujo propio por oveja o `hash(seed, id, tick)`, no el de
  oleadas) para no desplazar las partidas de las semillas 1..50. Huir de enemigos y del jugador añade O(ovejas × enemigos) por tick si no se limita.
- **Rendimiento**: ≤ 1.000 objetos del mapa y el culling de 0018 (`MapCuller`) cubren el arte estático; los
  montones y vetas deberían entrar en el plan y el culling. Ovejas y recogibles van por pools
  (`maxGems` se renombra/amplía; tope aparte para las ovejas). Lote de balance ya en 30 s local.
- **Interacción con el tope de gemas**: el relleno "suma a la más antigua" no vale entre tipos distintos.
- **Colocación**: hay que decidir las zonas ricas (lejos del inicio y cerca de estructuras) sin invadir el
  castillo, el agua ni las casas; de ahí sale "goblin-guard-camps".
- **E2E**: máximo 1–2 nuevos; mejor ampliar "Mapa real" que crear uno aparte.
- Las ovejas bloquean o no (¿solo el jugador colisiona con el mapa, ellas lo ignoran? ¿pueden entrar en agua?).
  Con el campo de flujo actual no huyen con inteligencia.

## Mediciones previas (lanzar antes de propose)
1. Con el bot v3, semillas 1..50, mapa real y las ovejas colocadas: victorias (banda 25–35, hoy 27), quietos
   (0 pierden en ≥ 180 s), y cuántas ovejas se cruzan en el camino del bot, con curación 0 (referencia) y con la
   que se proponga (p. ej. 10 y 25 de vida).
2. Bot v4 "recolector" opcional (va a por la oveja más cercana a ≤ 300 px): tasa de victorias con carne, como
   techo del efecto; umbral de aceptación: ≤ 35.
3. Coste por tick: lote de balance ≤ 35 s local (hoy ~30 s) y bench con 30 ovejas + 300 gemas.

## Preguntas para el usuario
1. ¿Alcance A, B o C? Recomiendo **B** (corte por ovejas), siguiendo la lección de 0021.
2. ¿Cuánto cura la carne (fija o % de vida máxima) y puede superar el máximo?
3. ¿Solo las ovejas dan carne, o también un porcentaje de bajas (consumiría azar)?
4. HUD: ¿contadores de oro y madera (icono + número, `hudLayout` y E2E) ahora aunque aún no se gasten? ¿Curación
   visible (número flotante o destello)? Recomiendo contadores sí, curación con destello sin texto flotante.
5. Oro: ¿vetas = `GoldMine` (sin cofre en el pack)? ¿Cuánto oro por casa, por torre y por veta?
6. Aspectos: ¿cambiamos el de la gema de XP (hoy la bolsa dorada) para dejar la bolsa al oro?
7. ¿Las ovejas huyen también de los enemigos o solo del jugador, y mueren por fuego amigo/explosiones?
8. ¿Los recursos se guardan en récords/historial (afecta a `progress-persistence`)? Recomiendo no por ahora.
