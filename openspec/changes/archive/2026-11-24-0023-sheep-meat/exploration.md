# Exploración · 0023-sheep-meat

Intención: ovejas neutrales que deambulan y huyen del jugador; al abatirlas sueltan **carne** (recogible nuevo que
cura, solo de ovejas). Viene de 0022 (retro: curación fija con tope en la vida máxima, solo ovejas).

## Contexto actual
- **Recogibles** (ADR-0021): `src/domain/pickup/{PickupKind,PickupRules,PickupField,Pickup}.ts`. Unión cerrada
  `xp | gold | wood`, lista única con ids de una secuencia, pool de `Σ topes` y relleno "suma al más antiguo de su
  tipo". `PickupGain` tiene un campo por tipo. Topes en `content/progression.json` (`maxGems/maxGold/maxWood`);
  fuentes en `content/resources.json` (`drops.enemies/structures`, montones, vetas). ADR-0021 ya prevé `meat` como
  "un tope más y un valor más en la unión". Render: `PickupLayer` (pool de Σ topes).
- **Vida**: `Health` (`src/domain/shared/Health.ts`) solo tiene `damage` y `raise` (mejora de `maxHealth`). **No existe
  curación**. Vida 100, invulnerabilidad 30 ticks (`content/player.json`). `Run.collect` (paso 7) suma XP, oro y
  madera tras `applyHit`: curar ahí no puede salvar el tick de la muerte.
- **Enemigos**: `Horde`/`Enemy`; ignoran el mapa; persecución por `FlowField` (ADR-0017) hacia el jugador. El jugador sí
  colisiona (`Player.move` con `terrain`, barrido por ejes).
- **Armas** (`Arsenal`): objetivo = enemigo según criterio; **solo si no hay ninguno**, estructura (`WeaponTarget`
  de 0021). Pulsos dañan a todo solapado. Explosiones (`HazardField.strike`) dañan a todo `Enemy` vivo (fuego amigo).
- **Azar**: oleadas `Mulberry32(seed)`; mapa `MAP_STREAM` 1, decoración 2, estructuras `STRUCT_STREAM` 3, recursos
  `RESOURCE_STREAM` 4 (`src/infrastructure/random/deriveSeed.ts`, `src/composition/seedSource.ts`). Goldens:
  `MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`; línea base `tests/support/balanceBaseline.ts` (27/50, 0 quietos).
- **Arte**: en el pack local (`C:\Users\Adri\TFM\Tiny Swords (Update 010)\Resources\`) existen `Sheep/HappySheep_Idle.png`,
  `HappySheep_Bouncing.png`, `HappySheep_All.png` y `Resources/M_Idle.png` (carne). **Ninguno está aún** en
  `public/assets` ni en `content/asset-provenance.json`: copiar + entrada con sha256 en la misma tarea (guard-assets).
  GDD: Idle 8 fotogramas de 128, Bouncing 6 de 128.
- **Sonda E2E**: `window.__sprint` (`src/composition/main.ts`, `e2e/`): `sprites.pickups` por tipo, `hud`, `map`.
  Habría que añadir `sprites.sheep` y `pickups.meat`.

## Capacidades / specs afectadas
`xp-gems` (recogibles: tipo `meat`, tope), `resources` (fuente: oveja), `player-health` (primera curación, tope en
max), `simulation-loop` (orden del tick, snapshot, determinismo con flujo nuevo), `auto-weapons` (¿objetivo oveja?),
`enemy-hazards` (¿explosiones dañan ovejas?), `procedural-map` (colocación de ovejas), `sprite-rendering`,
`asset-provenance`, `hud` (solo si hay aviso de curación). Nueva: `sheep`. Sin cambios probables: `enemy-spawning`,
`run-outcome` (salvo si las ovejas cuentan como baja), `progress-persistence`, `leveling`.

## Opciones
**Modelo de la oveja**
- **A. Enemigo neutral** (`enemies.json` con `behavior` nuevo `wander`/`flee`, daño de contacto 0): reutiliza `Horde`,
  `removeDead`, `WeaponTarget`, fuego amigo y `EnemyLayer`. Pro: poco código nuevo. Contra: contamina todo lo
  construido sobre `Horde.alive`: `kills` (resultados/récords), presupuesto y `maxAlive` del `WaveDirector`, selección
  de objetivo (las armas disparan a ovejas antes que a estructuras, y a veces antes que a goblins lejanos: mueve el
  balance), `contactDamage`, sondas y tests de enemigos; los enemigos ignoran el mapa pero la oveja debe respetarlo.
- **B. Entidad propia `Sheep` + `Flock`** (como `StructureField`/`PickupField`, lo posee `Run`, pool fijo): lista y
  snapshot (`sheep`) separados; movimiento con el barrido por ejes del jugador (respeta agua/troncos/castillo); huida
  sin `FlowField` (alejarse en recta con deslizamiento); implementa `WeaponTarget` como nivel de reserva. Pro: aísla
  `kills`, director y balance; encaja con el patrón de 0021/0022. Contra: más superficie nueva (dominio, render, sonda,
  spec) y decidir explícitamente armas y explosiones.
- **C. Carne por contacto, sin matar** (la oveja suelta carne al tocarla): sin tocar armas. Contra: contradice el GDD
  ("al abatirlas") y la historia; solo como descarte.

**Objetivo de armas con B**: (i) fallback tras enemigos y antes/después de estructuras (hay que fijar el orden;
una oveja que huye gasta proyectiles y mueve el balance); (ii) no apuntadas, solo daño colateral de pulsos y
explosiones (cazar exige acercar el pulso; menos tiempo de arma perdido, pero puede no matarse nunca); (iii) apuntadas
solo si el jugador está "quieto"... descartable (complica).

**Azar y aparición**: (a) `SHEEP_STREAM` 5 con `Mulberry32(deriveSeed(seed, 5))` en `seedSource`, 1 valor por oveja
sobre celdas candidatas como `placeResources` (misma lección de ADR-0021; `MAP_/STRUCTURE_/RESOURCE_GOLDEN` intactas,
nueva `SHEEP_GOLDEN`); (b) ampliar `RESOURCE_STREAM` tras montones (mantiene los valores previos, pero acopla el
orden). Deambular: (x) generador de runtime propio (un 3.er `RandomGenerator` en `Run`; no tocar el de oleadas) o (y)
hash entero de (id, tick/periodo) sin estado ni puerto. Reaparición: ninguna (finito, premia explorar) o temporizada
(más estado, riesgo de granja de curación).

## Riesgos e incógnitas
- **Quieto + curación**: un jugador quieto con ovejas que deambulan hacia él (o con pulsos que las alcanzan) podría
  curarse y romper "quieto pierde antes de 180 s" (0 quietos). La huida y `minStartCells` lo mitigan; se mide.
- **Balance**: con armas apuntando ovejas, el fallback altera la cadencia de disparo semilla a semilla (ya pasó con
  estructuras). El bot v3 no busca recogibles, así que la curación solo cambia victorias si pasa por la carne.
- **Determinismo/rendimiento**: orden de ovejas = orden de creación; sin `Math.random`/`Date.now`; pool preasignado;
  coste por tick (la retro de 0022 avisa de +8 % en el lote; separar arnés y núcleo al medir). Objetos del mapa
  (tope 1.000 en 42/123, hoy 701/784): las ovejas son sprites dinámicos, no entran en el plan del mapa.
- Huida contra paredes (río, castillo): oveja atrapada sin salida (aceptable si no atraviesa celdas bloqueadas).
- Tamaño: dominio + contenido + render + sonda + arte + 5–6 specs delta. Pedir MODIFIED que citen escenarios vivos.
- Cantidad de curación: sin número mágico (en `content/resources.json`, p. ej. `meat.heal`), tope en `maxHealth`;
  el relleno por tope suma valor a la pieza más antigua (curación mayor, acotada por la vida máxima).

## Mediciones previas
Solo el balance es un objetivo (sin recalibrar). No hace falta medir **antes** de la propuesta si se elige B, sin
oveja como objetivo prioritario y curación moderada. Sí fijar en la propuesta el gate de apply, comparando con
`balanceBaseline.ts` en semillas 1..50: bot v3 27/50 (o la banda 25–35 justificada), invariante quieto pierde antes de
180 s en todas, mechas/lote sin crecer > 5 %, bench de pool con 4 topes. Si el usuario quiere ovejas apuntadas por las
armas o curación grande, medir antes (bot y quieto, 50 semillas) para no descubrirlo en apply.

## Recomendación
Opción **B** + (a) `SHEEP_STREAM` 5 con deambular por hash (y) sin puerto nuevo, huida solo del jugador, sin
reaparición, ovejas como objetivo de reserva de las armas **después** de estructuras (o solo daño de área, ver
pregunta 2), fuego amigo de explosiones sí (un paso extra en `HazardField`), no cuentan en `kills`.

## Preguntas para el usuario
1. ¿Cuántas ovejas por mapa y a qué distancia mínima del inicio? ¿Sin reaparición?
2. ¿Las armas apuntan a las ovejas (en qué prioridad) o solo las alcanza el daño de área?
3. ¿Las explosiones (barril, dinamita) matan ovejas (fuego amigo)? ¿Huyen también de los enemigos?
4. ¿Cuánta vida cura una pieza (en % o en puntos de 100) y cuánta vida/velocidad tiene la oveja?
5. ¿Las ovejas abatidas cuentan en `kills`/resultados? (recomendado: no).
6. ¿Aviso visual de curación (texto flotante o destello) o basta la barra de vida?
