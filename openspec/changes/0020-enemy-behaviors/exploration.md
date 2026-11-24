# Exploración · 0020-enemy-behaviors

Intención (GDD, "Enemigos y comportamientos"): máquina de estados por tipo definida en contenido; Barril kamikaze,
TNT de guardia (nace en casas, patrulla, alerta, dinamita con aviso, vuelve al puesto), Antorcha perseguidor;
campamentos de guardianes y casas/torres goblin destruibles generadas con el mapa.

## 1. Contexto actual
- `Enemy` (`src/domain/enemy/Enemy.ts`) no tiene estado: solo posición, vida y `chase`. `Horde.chase` aplica a todos la misma
  orden: `FlowField.steer` + `chase` (ADR-0017). No hay noción de tipo de comportamiento.
- `EnemyType` (`EnemyType.ts`, `content/enemies.json`): solo `speed, radius, cost, damage, health, xp`. Los tres goblins se
  comportan igual (persecución); solo cambian stats y arte.
- Único daño al jugador: contacto (`Run.applyContact`, `contact.ts`): un golpe por tick con el mayor `damage`, con
  invulnerabilidad. No existe daño por área, proyectil enemigo ni aviso en el suelo.
- Bajas: `Horde.removeDead` suelta gema (`dropGem`) y suma `kills`. No hay otros botines (madera es 0022).
- Aparición: `WaveDirector` por presupuesto en un anillo (`waves.json`, `ringRadius` 1500) con `placeSpawn`; TNT entra en el
  tramo 180 s con coste 3. `maxAlive` 300.
- Mapa: `generateMap` (azar propio `MAP_STREAM`), celdas `grass/trunk/water/bridge/castle` (`CellType.ts`); solo el jugador
  colisiona; la spec exige que el centro de todo enemigo vivo esté en celda caminable. Firma dorada en
  `tests/support/mapGolden.ts`; límite de objetos del mapa pintados ≤ 1.000.
- Armas: `WeaponTarget` (`x, y, radius, alive, takeDamage`) y el arsenal recibe `horde.alive`; una estructura destruible no es
  hoy un objetivo.
- Arte: en el repo solo hay 3 tropas goblin, flecha, gema, suelo, castillo (`content/asset-provenance.json`, guardarraíl con
  sha256). En el pack local `C:\Users\Adri\TFM\Tiny Swords (Update 010)` (CC0) existen, sin copiar: `Factions/Goblins/Buildings/
  Wood_House/Goblin_House(.png, _Destroyed)`, `Wood_Tower/Wood_Tower_{Red,...,Destroyed,InConstruction}`,
  `Troops/TNT/Dynamite/Dynamite.png`, `Effects/Explosion/Explosions.png`, `Effects/Fire/Fire.png`, `Resources/Resources/W_Idle.png`
  (madera). Hojas de tropas: faltan por inspeccionar los fotogramas de ataque/explosión (incógnita).

## 2. Specs y ADRs afectados
`enemy-behavior` (estados, objetivo ya no siempre el jugador), `enemy-spawning` (TNT sale de casas, no del anillo; cambia la
economía del director), `procedural-map` (casas, torres, campamentos; orden de azar), `player-health` (daño no por contacto),
`auto-weapons` (estructuras como objetivo), `xp-gems` (drops), `sprite-rendering` y `asset-provenance` (arte nuevo),
`simulation-loop` (orden del tick), `run-state` (snapshot de peligros/estructuras). ADR nuevo (máquina de estados en contenido);
ADR-0013 (flujo de azar del mapa) y ADR-0017 (navegación) se rozan.

## 3. Dependencias de changes posteriores
- Madera = 0022: el Barril "suelta madera" no se puede cerrar; se puede dejar el hueco en contenido (lista de drops vacía) o
  soltar solo la gema de XP. Oro/objetivos = 0023: las casas destruibles no dan recompensa aún (solo quitan un foco de
  aparición); "modo Objetivos: destruir N casas" queda fuera.
- Sin dependencia: estados, explosión, dinamita con aviso, patrulla/alerta/retorno, casas y torres como entidades/celdas,
  campamentos como grupos de guardias en el mapa.

## 4. Opciones de alcance (sin elegir)
**A. Un solo change** (todo 0020). + Una sola calibración y un solo contexto. − Muy grande: toca dominio, mapa, azar, armas,
render y arte a la vez; el balance y la firma dorada del mapa cambian juntos y es difícil aislar el culpable.

**B. Dos changes: 0020a comportamientos / 0020b estructuras y campamentos.**
0020a: estados en contenido, Barril kamikaze (explosión, muerte), TNT con dinamita y aviso (peligro nuevo), Antorcha = estado
actual; TNT "de guardia" sin casas (el puesto es su punto de aparición; sin mapa nuevo). 0020b: casas y torres (generación,
destrucción, TNT que nace en ellas), campamentos. + 0020a no toca mapa ni goldens y se calibra solo con comportamientos.
− En 0020a el TNT de guardia queda lejos del jugador (sale en el anillo): hay que decidir un comportamiento provisional
(artillero que se detiene a distancia) distinto del GDD.

**C. Tres changes: kamikaze+dinamita / casas y torres / campamentos y guardia.** + Cada uno pequeño y verificable.
− Más gates humanos y renumeración del GDD (0021–0024 se desplazan); estados "alerta y vuelta al puesto" no se prueban
hasta el último.

## 5. Riesgos e incógnitas
- **Determinismo**: añadir casas/campamentos al generador cambia las partidas de toda semilla (goldens, `BALANCE_SEEDS`);
  colocarlos tras los troncos conserva el trazado previo pero cambia la firma. Patrulla con azar propio añadiría consumo al flujo
  principal: preferible patrulla determinista (waypoints fijos) o flujo derivado (`deriveSeed`). Orden del tick (estados antes o
  después de armas) es contrato.
- **Invariante de celdas caminables**: patrullar/volver al puesto exige navegar; un segundo campo de flujo por puesto es caro;
  alternativa: radios pequeños con línea libre, o campo desde el puesto compartido por todos los guardias de un campamento.
- **Rendimiento**: `maxAlive` 300 con estado por enemigo y bucle `Horde.chase` sin asignar; nuevas listas (peligros activos,
  estructuras) deben acotarse y no asignar por tick. Casas y torres cuentan en el límite de ≤ 1.000 objetos pintados.
- **Balance**: margen actual mínimo (26/50, banda 25–35, 0 quietos). Dinamita, explosiones y guardias endurecen; el bot de
  referencia (`tests/support/policies.ts`) no esquiva peligros: puede hacer falta un bot v3 que evite avisos. El Barril que
  muere al explotar cambia XP por enemigo y tiempo de primera oferta (hoy ~tick 1.527).
- **Contratos**: kills y gemas de un Barril que explota (¿cuenta como baja y suelta gema?); daño de dinamita compatible con
  invulnerabilidad e `applyContact` (un golpe por tick); casas como celda nueva (código 5, bloquea al jugador y recorta el
  campo de flujo) o como entidad no bloqueante.
- **Arte**: copiar PNG nuevos exige entrada con sha256 en `asset-provenance.json`; fotogramas de explosión, lanzamiento y
  destrucción por medir; reserva de color por elemento si no cargan.

## 6. Mediciones previas (las lanza el orquestador antes de la propuesta)
1. Línea base: `measureBalance(config)` sobre `BALANCE_SEEDS` 1..50 con el bot actual: victorias (26), quietos vivos a 10.799
   (0), primera oferta semilla 7 (1.527). Umbral de aceptación tras el change: 25–35 victorias, 0 quietos.
2. Coste: `npm run bench` con 300 enemigos vivos, ms/tick actual; objetivo: el máximo actual + margen razonable (propuesta: ≤ +20 %).
3. Cuántas apariciones de TNT hay hoy en una partida de 600 s (semillas 1..50, bot): fija el nº de casas necesarias para
   sustituirlas sin cambiar la presión.
4. Hueco libre del mapa: celdas caminables lejos de la zona de inicio por semilla (1..50), para saber cuántas casas/campamentos
   caben sin romper conectividad ni el tope de 1.000 objetos.
5. Hojas de arte: tamaño y fotogramas de `Dynamite.png`, `Explosions.png`, `Goblin_House.png`, `Wood_Tower_*.png` y filas de
   ataque de `TNT_Red`/`Barrel_Red`.

## 7. Preguntas para el usuario
1. ¿Partimos (opción B o C) o prefieres un solo change?
2. ¿El Barril que explota cuenta como baja y suelta gema de XP? ¿Cuánto daño hace la explosión y es de área?
3. ¿La dinamita puede alcanzar solo al jugador o también daña a otros goblins/estructuras?
4. ¿Las casas y torres son obstáculos sólidos (nuevo tipo de celda) o decorado destruible no bloqueante?
5. ¿Hasta qué punto vale un TNT provisional (artillero) en 0020a si las casas llegan en 0020b?
6. ¿Aceptas que las casas destruidas no den recompensa hasta 0022/0023 y que el Barril no suelte madera aún?
7. ¿Se permite recalibrar el balance con un bot v3 que esquive avisos, o la banda 25–35 debe mantenerse con el bot actual?
