# Tasks · 0019-flow-field

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     Abreviaturas de spec: EB enemy-behavior, ES enemy-spawning, PM procedural-map, SL simulation-loop,
     RO run-outcome, XG xp-gems. Design: openspec/changes/0019-flow-field/design.md; ADR-0017. -->

## 1. Dominio: campo de distancias y línea libre
- [x] 1.1 `distancesFrom` en `src/domain/map/connectivity.ts` (BFS con distancias, orden izquierda, derecha, arriba,
  abajo; exportar `codesOf`) y `FlowField` (`src/domain/map/FlowField.ts`) con `retarget` + `distanceAt` perezoso
  y buffers preasignados (design §2). Test `tests/domain/map/flow-field.test.ts`. Escenarios PM: "Mapa vacío",
  "Río con un único puente", "Celda encerrada", "Objetivo no caminable", "Toda celda caminable con distancia en el
  mapa generado" y "Mismo campo, misma celda" (los dos últimos se juntan aquí porque pasan en verde con la BFS).
- [x] 1.2 `FlowField.hasClearLine` con recorrido de rejilla, regla floor y esquinas exactas (design §2.4). Tests
  unitarios sobre `GameMap.fromCells`. Escenarios EB: "Obstáculo que corta el segmento", "Agua y castillo también
  cortan la línea" y "Sin cortar por una esquina", más un caso unitario de "Segmento sobre el borde de una celda
  bloqueada" (sin línea libre para y = 300) y "Con el mapa vacío todo enemigo tiene siempre línea libre".
- [x] 1.3 `FlowField.steer` (celda del jugador → jugador; línea libre → jugador; primer vecino con distancia − 1 en
  el orden fijo → centro del rectángulo recortado; sin distancia → jugador; atajo sin celdas bloqueadas), en tests
  unitarios con `out` reutilizado. Escenarios EB: el empate de "Empate resuelto igual siempre" (unitario: desde
  (32, 14) gana el vecino izquierdo) y "Celda sin distancia en el campo" (objetivo = jugador).

## 2. Dominio: persecución y aparición en `Run`
- [x] 2.1 Cablear el campo: `Run` crea el `FlowField`, llama a `retarget` tras `player.move` y `Horde.chase(x, y, dt,
  field)` usa `steer` (sin asignar). Se actualiza el comentario del contrato de determinismo de `Run`. Se retiran de
  `tests/domain/map-independence.test.ts` "Los enemigos ignoran el mapa" y "Misma trayectoria con mapa generado y
  vacío" (EB REMOVED). Test `tests/domain/run-navigation.test.ts` con los escenarios EB "Cruce del río por el único
  puente", "Rodeo de un muro de troncos", "Rodeo del castillo", "Paso por tick con el campo", "Obstáculo fuera del
  segmento", "Segmento sobre el borde de una celda bloqueada", "Ataque directo en la celda del jugador" y "Celda sin
  distancia en el campo". Las escenas vigentes de "Persecución en línea recta" y "Enemigos dentro de la arena" siguen
  en verde.
- [x] 2.2 Determinismo de la navegación, en el mismo fichero (estos tests pasan en verde tras 2.1: si es así, se
  juntan en el commit de 2.1). Escenarios EB: "Empate resuelto igual siempre" (tres partidas), "El campo solo depende
  de la celda del jugador" y "La navegación no consume azar". Escenarios SL: "La persecución usa la celda del jugador
  ya movido" y "La persecución por el mapa no consume azar".
- [x] 2.3 Recolocación en `placeSpawn(…, map, random)`: `nearestWalkable`, comprobación de celda caminable y luego
  `minDistance`, 1 valor por intento (design §4). `Run.place` pasa el mapa. Tests en `place-spawn.test.ts` y en uno
  nuevo, `run-spawn-map.test.ts`. Escenarios ES: "Aparición sobre agua recolocada", "1 valor de azar por intento con y sin
  recolocación", "Recolocación que queda demasiado cerca" y "Mapa sin celdas caminables". Escenario EB "Aparición
  recolocada". Se ajusta PM "Mismos spawns con y sin mapa" en `map-independence.test.ts` (posiciones iguales salvo
  las recolocadas, que valen `nearestWalkable` de la posición del mapa vacío).

## 3. Contenido e invariantes con el mapa generado
- [x] 3.1 `content/waves.json` `maxAlive` 300 y tests de tope: `run-config.test.ts`, `content.test.ts` si fija el
  valor, `long-run.test.ts` (200 → 300). Escenarios ES: "Tope por defecto" y "Se alcanza el tope por defecto".
  Escenario EB: "Partida larga" (≤ 300 vivos). Escenario RO: "Presupuesto de oleadas intacto" (literal de los tramos,
  `maxBudget`, `ringRadius` y `player.speed` de antes del change).
- [x] 3.2 Barridos sobre las semillas 1..50 en `tests/domain/map-navigation-sweep.test.ts` (un `beforeAll` por
  barrido y *timeout* propio, design §9). Escenarios EB: "Semillas del conjunto" (7.200 ticks, input aleatorio) y
  "Jugador quieto junto al castillo". Escenarios ES: "Recolocación con castillo y río", "Jugador ante la puerta del
  castillo" (vistas de 1.280 × 720 y 960 × 540 para todas; tope `maxView` solo para las no recolocadas) y "Partida
  larga sin spawns ilegales". Escenario SL: "Posiciones de enemigos reproducibles con el mapa generado". Escenario XG:
  "Ninguna gema en reposo en celda no caminable" (sigue en verde). Si este fichero pasa de ~20 s en local, se
  reducen los barridos a lo que pide la spec y se anota.
- [x] 3.3 `tests/support/builders.ts`: `DEFAULT_ENEMY_TYPES`, `DEFAULT_PROGRESSION` y `DEFAULT_UPGRADE_LIST` pasan a
  leerse de `content/*.json`, como `DEFAULT_WAVES`, para que la calibración tenga una sola fuente. Test: los tests
  existentes siguen en verde y uno nuevo comprueba la igualdad con el contenido cargado por `loadRunConfig`.
  Prerrequisito de 4.1.

## 4. Balance y rendimiento
- [ ] 4.1 **Calibración** (design §6). (a) Medir la base con el contenido final de 3.1 (`maxAlive` 300): bot v2
  sobre 1..50, quietos con mapa generado y vacío y plazos de la semilla 7. (b) Barrer P1…P5 en orden, una palanca
  cada vez y por pasos, con un script **no versionado** en el directorio temporal que use `tests/support/runs.ts`
  (máximo 15 lotes). Aceptación: 27–33 victorias, 0 quietos en los dos mapas y plazos ≤ 4.800/900; si solo se llega
  a 25–26 o 34–35, se elige el valor más cercano a 30. (c) **Parada obligatoria antes de fijar**: si la configuración
  elegida cambia algún stat de enemigo (rompe ES "Stats heredados sin cambios"), o cualquier otro valor que fije una
  spec viva (columna "Delta necesario" de §6: leveling, upgrades, auto-weapons), el implementer **para y avisa al
  orquestador** con la tabla de lotes, para que se añada ese delta de spec antes de seguir. (d) **Parada ante el
  usuario**: si ninguna configuración da 25–35 con 0 quietos, o si cumplir la banda rompe un plazo, se para la apply
  y la decisión vuelve al usuario (RO "Partida ganable y perdible"); no se tocan oleadas ni `player.speed`. (e) Con
  el delta aprobado: se actualizan `content/`, los tests de los valores cambiados y `balance.test.ts`. Escenarios RO:
  "Tasa de victoria del bot de referencia", "Toda partida del bot termina", "Jugador quieto pierde con todas las
  semillas", "Jugador quieto pierde también con el mapa vacío", "Muerte quieta en el límite de 180 s" y "Plazos del
  jugador quieto con el contenido final" (test nuevo con la semilla 7 para el primer golpe). Escenarios SL "Partida
  con contactos/armas/progresión reproducible" (revalidar los plazos). Escenario PM "Primera oferta en plazo con y
  sin mapa". La tabla de lotes y los ticks medidos van al diario de IA (`docs/ai-log/`) y al design (§6, resultado).
- [ ] 4.2 Bench a 300 (design §7): `CAP` 300 en `run.bench.ts`, "Tope de vivos alcanzado" con mapa generado, "300
  enemigos encima del jugador", "Peor caso con proyectiles/gemas", "300 enemigos sin línea libre" y "Jugador que
  cambia de celda en cada tick". En `map.bench.ts`: "Cálculo del campo" (1..50, salida y (0, 0)). Escenarios SL de
  "Rendimiento con el tope de enemigos". El test sin navegador de "Contacto con cualquier tamaño de mundo"
  (`piled-contact.test.ts`) pasa a 300. El bench es informativo y está fuera de `verify`, pero se ejecuta con
  `npm run bench` y sus medias se anotan en el design.

## 5. E2E y documentación
- [ ] 5.1 E2E: no hay ninguno nuevo (ningún escenario exige navegador; regla `e2e-lite`). Se ejecuta
  `npm run test:e2e` una vez. Si falla un test con `map: 'real'` por tiempos o posiciones (los enemigos ya no
  atraviesan el mapa), se ajusta su número de ticks en modo manual, sin añadir esperas de reloj.
- [ ] 5.2 Renumeración del GDD (`docs/gdd.md`, design §10): 0018 map-culling como hecho; flow-field de 0018 a 0019;
  Should de 0019–0023 a 0020–0024 (incluidas las referencias sueltas: "comportamientos… en 0019", "tienda con 0022");
  el criterio "Given un edificio nuevo…" pasa a build-sites (0024); la deuda "sin separación" pasa a "pendiente,
  change propio". Antes de editar se buscan "0018"–"0023". Comprobación: `grep` sin números antiguos fuera de su
  sitio y `npm run verify` en verde.
- [ ] 5.3 Cierre de documentación: addendum de resultados en ADR-0017 (balance final, palancas usadas, medias del
  bench) y pasar su estado a "aceptada" al archivar; entrada en el diario de IA de la apply. AGENTS.md se toca solo
  al archivar. Comprobación: `npm run verify` en verde.
