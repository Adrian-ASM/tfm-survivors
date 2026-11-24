# Tasks · 0021-goblin-camps

<!-- Cada tarea dura ≤ ~30 min, tiene su test y cita los escenarios que cubre. ADR-0018: TDD estricto (rojo comprobado
     antes del código) en domain y application; test-after en infraestructura, composición y contenido.
     En cada tarea: `npm run verify:fast`. Al cerrar cada grupo: `npm run verify` completo en verde, un commit
     (Conventional Commits, `refs: 0021-goblin-camps`, `Assisted-by`), `git fetch` y rebase sobre `origin/main` si ha
     avanzado (y `verify` otra vez tras el rebase). No se cierra un grupo en rojo.
     Abreviaturas de spec: GS goblin-structures · EB enemy-behavior · ES enemy-spawning · EH enemy-hazards ·
     AW auto-weapons · PM procedural-map · RS run-state · SL simulation-loop · RO run-outcome ·
     SR sprite-rendering · AP asset-provenance. Referencia de diseño: design.md (§n). -->

## 1. Dominio · contenido de estructuras y comportamiento de guardia (TDD estricto)
- [x] 1.1 `StructureType`/`StructureRules.create` con sus invariantes (§2.4): huella entera ≥ 1 que cabe en la
  rejilla, vida y radio > 0, `count` entero ≥ 0, `max`/`everyTicks` enteros ≥ 1, distancias de colocación enteras
  ≥ 0, y el guardia existe en el catálogo con inicial `patrol`. Los errores nombran el tipo y el campo.
  — GS: "Valores fuera de rango", "Límites válidos", "Guardia inválido" (con el dominio; la forma la cubre 5.1).
- [x] 1.2 Clases `patrol`, `alert` y `return` en `BehaviorConfig`/`Behavior` (arrays `patrolRadius`, `detect*`,
  `lose*`, `arriveTo`) con `assertNever`. Validación: valores > 0, destinos existentes, inicial `patrol` si hay estados
  de guardia y abandono mayor que todas las detecciones del tipo.
  — EB: "Parámetros de guardia inválidos", "Estados de guardia sin patrulla inicial".
- [x] 1.3 `WaveTable` rechaza los tipos cuyo inicial es `patrol`, con un error que nombra el tipo.
  — ES: "Guardia citado en una oleada".

## 2. Dominio · colocación y mapa (TDD estricto)
- [x] 2.1 `StructureSite`: posición = centro de la huella; puerta = centro de la celda (c0 + ⌊cols/2⌋, r0 + rows);
  torre sin puerta. — GS: "Puerta de una casa".
- [x] 2.2 `placeStructures` (§3.2): rejillas de distancia y de ocupación, 2 valores por intento, orden casa → torre,
  parar un tipo cuando agota sus intentos. — GS: "Reglas de colocación con las semillas del conjunto" (1..1000, 0 y
  2³² − 1), "Contenido sin hueco suficiente".
- [x] 2.3 `TerrainSource` (`generated` con `structureRandom`; `open`/`cells` con `structures` declaradas),
  `resolveStructures` y `MapSnapshot.structures`. — PM: "Mapa explícito con estructuras declaradas", "Estructura
  declarada fuera de la rejilla", "Partida con mapa vacío"; GS: "Mapa vacío sin estructuras".
- [x] 2.4 Independencia del azar. — GS: "Las estructuras no cambian las celdas", "Misma semilla, mismas estructuras",
  "Colocar no consume el azar de la partida"; SL: "Mapa intacto" (con `MAP_GOLDEN` sin tocar).

## 3. Dominio · estructuras en la partida y armas (TDD estricto)
- [x] 3.1 Entidad `Structure` y `StructureField` en `Run`. `RunSnapshot.structures` congelado, con la huella y en un
  orden y una longitud estables. — GS: "Lista inicial", "Orden estable tras destruir", "Lista no mutable"; SL:
  "Estructuras en el snapshot del motor", "Snapshot no mutable desde fuera" (parte de estructuras), "Partida recién
  creada" (lista de estructuras).
- [x] 3.2 `Arsenal`: el criterio `nearest-in-range` usa estructuras como reserva solo sin enemigos en alcance; las
  ruinas no son objetivo. — AW: "Estructura sin enemigos en alcance", "El enemigo gana aunque esté más lejos",
  "Límite del alcance con una estructura", "Empate entre estructuras", "Una ruina no es objetivo"; SL: "Carga de las
  armas en el snapshot".
- [x] 3.3 `Projectile.atStructure`: primero los enemigos y, solo si iba a una estructura, las estructuras. Las bajas
  devueltas son solo de enemigos. — AW: "Impacto en una casa", "Un proyectil dirigido a un enemigo atraviesa la casa",
  "Un proyectil dirigido a la casa da antes a un enemigo"; GS: "Daño que no destruye", "Daño mayor que la vida".
- [x] 3.4 El pulso se dispara con una estructura y daña a enemigos y estructuras que solapa. — AW: "Pulso sobre una
  casa", "Pulso sobre un enemigo y una casa", "Pulso sobre una ruina", "Sin enemigos en el radio, sin pulso".
- [x] 3.5 Destrucción sin recompensa, ruina permanente y lugar en el tick. Incluye los escenarios que ya deberían
  pasar en verde (explosiones y no colisión), juntos para que la tarea arranque en rojo con la destrucción. — GS:
  "Destrucción sin recompensa", "Ruina hasta el final", "Las explosiones no dañan estructuras", "El jugador atraviesa
  una casa", "Un enemigo cruza una torre"; EH: "Explosión sobre una casa y una torre"; SL: "Las estructuras se
  destruyen tras las bajas", "Las estructuras no consumen azar".

## 4. Dominio · guardias (TDD estricto)
- [x] 4.1 `GuardPost`: campos por punto (compartiendo los códigos) y "Navegación hacia un punto fijo" en
  `Horde.act`. `Enemy.post`/`waypoint` y `RunSetup.enemies[i].post`/`.house` con su validación (§2.4). — EB: "Línea
  recta hasta el punto", "Rodeo de un muro hasta el puesto".
- [x] 4.2 Patrulla: 4 esquinas en orden y en bucle, recolocadas con `nearestWalkable`, avance al llegar exactamente.
  — EB: "Patrulla en el mapa vacío", "Punto de patrulla recolocado", "El daño no saca de la patrulla".
- [x] 4.3 Transiciones después de moverse (`detect`, `exit`, `lose`, llegada) y ciclo de carga y espera desde la
  alerta. — EB: "Detección justo en el límite", "Alerta, lanzamiento y vuelta a la alerta", "Abandono de la alerta",
  "Llegada al puesto", "Detección durante la vuelta"; SL: "Estado de comportamiento en el snapshot"; EH: "Guardia
  alcanzado por una explosión".
- [x] 4.4 `StructureField.spawnGuards`: tope por casa, intervalo desde el último nacimiento (o desde el tick 0),
  `maxAlive`, `release` al morir, y casa destruida. — ES: "Nacimientos hasta el tope", "Reposición tras una baja",
  "Intervalo mínimo", "El tope de vivos frena el nacimiento", "Casa destruida", "Baja de un guardia"; EB: "Guardia que
  nace en la puerta".
- [x] 4.5 El nacimiento en el orden del tick y congelado. — ES: "El director va antes que las casas", "Sin
  nacimientos en el tick final", "Nacer no consume azar"; SL: "Una casa destruida no hace nacer en ese tick", "El
  guardia nacido no se mueve en su tick"; RS: "Estructuras congeladas al terminar", "Nacimiento en pausa durante la
  oferta"; EB: "Estado inicial al aparecer".
- [x] 4.6 Azar de los estados de guardia. — EB: "Los estados de guardia no consumen azar"; SL: "Los comportamientos
  no consumen azar" (con alerta, vuelta y patrulla).

## 5. Contenido, validación y composición (test-after)
- [x] 5.1 `content/structures.json` y `StructuresSchema` (objeto estricto por id) en `loadRunConfig`; los errores
  nombran el tipo de estructura. — GS: "Contenido por defecto", "Campos ausentes o desconocidos", "Valores fuera de
  rango" y "Guardia inválido" (con el cargador).
- [x] 5.2 `enemies.json`: `goblin-tnt-guard` (§2.2) y barril A3 (§2.3); clases nuevas en el `discriminatedUnion`
  de zod. — EB: "Comportamientos del contenido por defecto", "Cotas del contenido por defecto", "Parámetros del barril
  por defecto", "Esquiva con el contenido por defecto"; ES: "Contenido por defecto", "Stats por defecto", "XP por
  defecto de cada tipo", "Vida por defecto de cada tipo", "Oleadas por defecto sin guardias"; RO: "Presupuesto de
  oleadas y stats intactos".
- [x] 5.3 `STRUCT_STREAM` 3 y `seededRun` con `structureRandom` (composición). `STRUCTURE_GOLDEN` para 42 y 123 en
  `tests/support/mapGolden.ts` y su test. — GS: "Firma de referencia de las estructuras"; PM: "Sonda coherente con el
  núcleo" (lista de estructuras, con el núcleo).
- [x] 5.4 Tests de integración con el contenido por defecto y el mapa generado. — GS: "Sin casas ni torres"; ES:
  "Guardias en el mapa generado", "Guardias junto a la oleada"; PM: "Mismos spawns con y sin mapa" (solo las
  apariciones del director) y "Primera oferta en plazo con y sin mapa" (anotar ticks); EB: "Guardias en celdas
  caminables" (1..50 × 7.200 ticks); SL: "Partida con estructuras y guardias reproducible", "Posiciones de enemigos
  reproducibles con el mapa generado".

## 6. Infraestructura de render y arte (test-after)
- [ ] 6.1 Datos de aspecto: `structures.<tipo>.{intact, ruin}` con `idle`, colores `goblin-house`/`goblin-tower`/
  `ruin` y aspecto `goblin-tnt-guard` (`TNT_Red` con `throw`). — SR: "Datos del repositorio", "Colores de
  estructuras inválidos", "Tipos de estructura y aspectos desalineados", "Tipos de enemigo y aspectos desalineados",
  "Valores fuera de rango" (escala de ruina), "Animaciones obligatorias y campos desconocidos", "Rutas de hoja no
  admitidas" (torre).
- [ ] 6.2 Copiar las 4 hojas del pack local, añadir sus entradas sha256/bytes, reducir la prohibición de
  `appearance-hazards.test.ts` y pasar `guard:all`. — AP: "Hojas de estructuras registradas", "Hoja de estructura sin
  entrada", "Hojas de edificios no usadas", "Ninguna hoja de más", "Hojas nuevas registradas"; SR: "Hoja de cada
  elemento", "Solo las hojas usadas".
- [ ] 6.3 `planMapArt`: partes baja y alta por aspecto, reserva sin parte alta e índices por estructura;
  `plan-map-fallback.test.ts` con ≤ 1.000. — SR: "Casa en su sitio", "Reserva de las estructuras", "Presupuesto de
  objetos con estructuras", "Totales del mapa con estructuras" (regenerar 667/750 + estructuras).
- [ ] 6.4 `MapCuller.setEnabled` (máscara × recorte) y `StructureArt` (cambio a ruina en la transición) con
  `FakeSprite`. — SR: "Ruina tras la destrucción", "`drawn` igual al recorte", "Sin estructuras en el mapa vacío ni
  tras R", "Guardia ante la casa".
- [ ] 6.5 `EnemyLayer`/`renderCounts`: clases nuevas en `enemyStates`, `sprites.structures` y `map.structures` en la
  sonda (0 o `null` en el menú). — SR: "Guardia que patrulla y lanza", "Recuento coherente con el snapshot", "Sonda
  en el menú"; PM: "Sonda con el mapa vacío", "Sonda en el menú".
- [ ] 6.6 El render no cambia la simulación. — SR: "Pintar no cambia la simulación", "Los aspectos no cambian la
  simulación" (escalas de estructura ×2 y colores cambiados).

## 7. Balance por pasos (tests/support y contenido; design §11)
- [ ] 7.1 Instrumentación de `measureBalance`: mechas y explosiones de barril por partida, tiempo del lote en local y
  firma W3 (daño de dinamita de guardia con v3 en `NONE` y ≥ 1 aviso amenazante). Test de "Mechas por partida"
  (> 16,3). — RO: "Mechas por partida".
- [ ] 7.2 **Paso 1 · barril**: medir con el barril A3, sin estructuras (config de test con `count` 0). Anotar
  victorias, quietos, mechas, explosiones, s7 y lote. Se espera 29/50 y 0/0. Si no se reproduce, parar y avisar.
- [ ] 7.3 **Paso 2 · estructuras sin guardias** (config de test con `everyTicks` > 36.000): medir y anotar. Se espera
  ±1 victoria respecto al paso 1. Si cae más de 2, revisar §5 antes de seguir.
- [ ] 7.4 **Paso 3 · guardias** (contenido final): medir y anotar, incluido el lote en local (≤ 32 s, unos 90 s en CI
  con ×2,8, frente al timeout de 180 s, que no se sube). Recalibrar en este orden: guardias, barril dentro de A3 y
  cotas, y estructuras. Si ninguna combinación da la banda con 0 quietos, parar y volver al gate. — RO: "Tasa de
  victoria del bot de referencia", "Toda partida del bot termina", "Jugador quieto pierde con todas las semillas",
  "Jugador quieto pierde también con el mapa vacío", "Muerte quieta en el límite de 180 s", "Plazos del jugador quieto
  con el contenido final".
- [ ] 7.5 **Condicional (A2): solo si 7.4 da < 25 victorias y la firma W3 es > 0 en semillas que el paso 2 ganaba.**
  Bot v4 "flee-nearest" en `tests/support/policies.ts` (diff de la medición 4) con su test, y volver a medir 7.4.
- [ ] 7.6 **Condicional, bloquea verify si se hizo 7.5**: devolver al spec-writer el MODIFIED de "Bot de referencia
  para el balance" en `specs/run-outcome` (regla v4 y sus escenarios) y que "Tasa de victoria del bot de referencia"
  pase a citar v4. El implementer no edita specs.
- [ ] 7.7 **Condicional, si 7.4 recalibró valores citados en specs**: devolver al spec-writer los escenarios con
  valores explícitos (barril: EB "Parámetros del barril por defecto", ES "Stats por defecto" y "Vida por defecto de
  cada tipo"; guardias: EB, si se citan). Antes de verify.

## 8. Bench, E2E y documentación
- [ ] 8.1 Bench "peor caso con estructuras y guardias" en `tests/bench/run.bench.ts` (§12): anotar la media frente a
  2 ms y frente a 0,25 ms. — SL: "Peor caso con estructuras y guardias".
- [ ] 8.2 E2E nuevo (1, modo manual, `map: 'real'`, `step(n)`, sin fps ni tiempo real), ampliando un test de humo
  del proyecto `logic`. Actualizar las cifras de objetos del mapa en los E2E existentes. — SR: "Estructuras y guardias
  en el navegador [E2E]", "Objetos dibujados con la cámara [E2E]" (sin cambio de regla); PM: "Sonda con castillo y
  salida [E2E]" (sin cambios, debe seguir verde).
- [ ] 8.3 Documentación: addendum de ADR-0020 con las cifras de §11 (y estado "aceptada" tras verify), estado del
  proyecto en AGENTS.md §1 y entrada en `docs/ai-log/`, incluidos los incidentes de hooks si los hay.
