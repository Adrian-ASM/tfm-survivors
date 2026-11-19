# ADR-0008 · Mejoras como modificadores aditivos sobre datos base inmutables

- **Estado**: aceptada (change 0005-xp-and-level-up, confirmada en apply)
- **Fecha**: 2026-11-19
- **Matiza**: ADR-0007 ("las mejoras de 0005 serán transformaciones de datos sobre `WeaponType`")

## Contexto
En 0005 el jugador sube de nivel y elige mejoras que cambian estadísticas de un arma (daño, cadencia, alcance, radio
del pulso) o del jugador (vida máxima, velocidad, radio de recogida). Cada mejora tiene un nivel (0..máximo) y se
aplica en el acto, a mitad de partida. Fuerzas:
- `WeaponType` es un VO congelado y compartido (ADR-0007); `Player` es inmutable y lleva sus `PlayerRules`.
- El contenido base (`weapons.json`, `player.json`) no debe cambiar: la vista y los tests necesitan la base y el
  nivel de cada mejora, y 0007 (guardado) querrá persistir **niveles**, no estadísticas derivadas.
- ADR-0003: nada de asignaciones por tick. Elegir mejora ocurre como mucho una vez por subida de nivel (camino frío).
- Las invariantes de un arma (enteros ≥ 1, distancias > 0, compatibilidad criterio ↔ ataque) tienen una sola
  implementación, `WeaponType.create`; las del jugador, `checkPlayer` en `buildRunRules`.
- Futuro (fuera de 0005): mejoras porcentuales, mejoras que añadan armas, evoluciones.

## Opciones
1. **Mutar o sustituir el `WeaponType` incrementalmente** (`type = type.with(damage + 3)`): directo, pero la base se
   pierde, el valor efectivo depende del historial de aplicaciones y deshacer o persistir exige reconstruir la
   secuencia.
2. **Modificadores leídos en el camino caliente**: el `Arsenal` suma `base + bonus` en cada disparo. Mantiene la
   base, pero cada lectura de una estadística en el tick pasa por una suma y una búsqueda, y el `switch` de
   criterios necesita un `TargetingConfig` efectivo de todos modos.
3. **Niveles como fuente de verdad + estadísticas efectivas derivadas en frío**: la partida guarda solo el nivel de
   cada mejora. Al elegir, se recalcula desde la base `efectivo = base + Σ (incremento · nivel)` de las mejoras con
   ese objetivo y se construye un `WeaponType` / `PlayerRules` **nuevo** con las mismas fábricas que validan el
   contenido. El arma equipada (`Weapon`) apunta al tipo efectivo; el camino caliente no cambia.

## Decisión
Opción 3.
- **Fuente de verdad**: `levels[i]` por mejora del catálogo (enteros 0..`maxLevel`). La base de contenido nunca se
  toca.
- **Derivación pura y desde cero** (no incremental): `upgradedWeapon(base, catalog, levels)` y
  `upgradedPlayer(base, catalog, levels)` devuelven la configuración efectiva; `WeaponType.create` y las reglas del
  jugador la validan. Mismo nivel ⇒ mismas estadísticas, sin deriva por orden de aplicación.
- **Solo aditivas** en 0005; el incremento por nivel puede tener cualquier signo distinto de 0.
- **Validación al cargar (build de peor caso)**: todas las estadísticas mejorables solo tienen cota inferior
  (enteros ≥ 1 o distancias > 0). `buildRunRules` construye cada estadística a `base + Σ min(0, perLevel · maxLevel)`
  y la pasa por las mismas fábricas (`WeaponType.create`, `checkPlayer`). Si ese peor caso es válido, cualquier
  combinación alcanzable de niveles también lo es (incluida "todas al máximo"), así que construir el tipo efectivo
  en partida no puede fallar. El mismo peor caso da la cota de pulsos visibles (`pulseCapacity`) para los pools.
- Una mejora de vida máxima con incremento negativo recorta la vida actual a `[1, max]`: elegir no mata.
- **Efectos que no son estadística pura** viven en la aplicación del efecto, no en los datos: la vida máxima sube
  también la vida actual en la misma cantidad; la cadencia nueva rige desde el siguiente disparo (`readyAt` no se
  toca); un proyectil en vuelo conserva el daño con el que se lanzó.

## Aplicación (change 0005-xp-and-level-up)
- Niveles en `UpgradeBoard.levels` (orden del catálogo); derivación en `upgrade/upgradeStats.ts` con una función de
  aporte por mejora: `byLevels(levels)` en partida y `worstCase` (`min(0, perLevel · maxLevel)`) al validar, así
  que el peor caso usa exactamente el mismo código que la partida.
- La build de peor caso vive en `UpgradeCatalog.create` (recibe loadout, jugador y arena) y la llama
  `buildRunRules`; para validar al jugador sin ciclo de imports, `PlayerRules` y `checkPlayer` pasaron a
  `player/PlayerRules.ts`. El error nombra estadística, valor y mejoras, p. ej.
  `linter.cooldownTicks = 0 (fast-ci)`.
- `Run` construye el tipo efectivo con `WeaponType.create` en cada elección y lanza un error de invariante si
  fallara (no puede: peor caso validado). `RunRules.pulseCapacity` sale del peor caso y dimensiona los ecos.
- Hallazgo: unas armas con cadencia 1 (bench) hacen inválido el catálogo por defecto (`fast-ci` dejaría −19): el
  peor caso es una regla del contenido completo, no de cada fichero por separado.

## Consecuencias
- Positivas:
  - El camino caliente no cambia: `Arsenal` sigue leyendo `weapon.type.*` (ahora el tipo efectivo).
  - Invariantes con una sola implementación, también para las estadísticas mejoradas.
  - Persistir (0007) o mostrar el inventario (0006) es guardar o leer `levels`.
  - Una mejora porcentual futura es otra regla de derivación sobre la base, sin cambiar el modelo.
- Negativas / costes:
  - Cada elección asigna un `WeaponType` o un `Player` nuevo (camino frío, aceptable).
  - El peor caso es más estricto que "todas al máximo" cuando una estadística tiene incrementos de signos mezclados.
    Si aparece una estadística con cota superior, habrá que validar también el máximo alcanzable.
  - `Weapon.type` deja de ser `readonly`: lo cambia solo `Arsenal` al aplicar una mejora.
- Cómo revertirla:
  - Pasar a la opción 2 es interno al dominio (cambiar `Weapon` y las lecturas de `Arsenal`); el formato de
    `upgrades.json` y los niveles no cambian.
  - Cambiar el formato de `upgrades.json` (objetivo y estadística) sí es caro: contenido, esquemas, tests y guardado.
