# ADR-0027 · Registro de golpes en el núcleo con ventana en el snapshot

- **Estado**: propuesta (change 0031-combat-feedback, design 2026-11-26)
- **Fecha**: 2026-11-26

## Contexto
El change 0031 pinta un número por cada golpe que daña a un enemigo, una estructura, una oveja o al jugador, con el
**daño aplicado**: tras `armor` y el mínimo 1, recortado a la vida restante y con el golpe letal incluido. Hoy el
daño se aplica en siete sitios (`Arsenal` ×4, `TowerBattery`, `HazardField` ×2) y en `Run.applyHit`. Nadie lo
anota: solo queda `lastHitTick`, para el destello.

Hay tres fuerzas en juego:
- `Run.snapshot()` se pide una vez por frame, y un frame puede cubrir hasta 15 ticks (`MAX_FRAME_MS` 250). Pausa,
  tienda y obra repiten el render con el mismo snapshot.
- El núcleo tiene que seguir siendo determinista y sin asignaciones por tick (ADR-0002, ADR-0003, ADR-0006), con
  `BALANCE_BASELINE` y las firmas intactas.
- Un pulso entre cientos de enemigos puede dar cientos de golpes en un tick.

## Opciones
1. **Registro central en `Run`** (`HitLog`, anillo preasignado). Se inyecta a `Arsenal`, `TowerBattery` y
   `HazardField` como único punto de daño (`strike`), y `applyHit` anota el golpe del jugador. Ids de secuencia
   propia, suma por objetivo y tick, y tope por tick. El snapshot expone una **ventana** de N ticks y el render
   **deduplica por id**.
2. **Cada objetivo guarda su `lastHit {tick, daño}`** y `Run` los recoge. Pierde el golpe letal (el enemigo sale en
   `removeDead`) y los golpes al jugador quedan aparte.
3. **El render deriva el daño** por diferencia de `health` entre snapshots. No toca el núcleo, pero pierde el golpe
   letal, mezcla la curación y agrega todos los ticks de un frame.
4. Variante de 1: **acumular desde el último snapshot** en lugar de usar una ventana. Así `snapshot()` tendría
   efectos (vaciar el registro) y un segundo render del mismo estado no vería los golpes.

## Decisión
**Opción 1**, con ventana `hitWindowTicks` ≥ el máximo de ticks por frame (15) y tope `maxHitsPerTick`. Las dos
cifras van en `content/combat.json`, un fichero propio validado con zod: el tope cubre explosiones y al jugador, así
que no encaja en `weapons.json`.
- El daño anotado es `hp antes − hp después` del mismo `takeDamage` de hoy. `strike` devuelve su booleano, así que
  bajas, sueltas y consumo de azar no cambian.
- Los golpes del mismo tick sobre el mismo objetivo se suman en un solo registro. Por encima del tope no se crean
  registros nuevos, pero los que ya existen siguen sumando. El jugador tiene una plaza reservada, porque recibe como
  mucho un golpe por tick.
- Los ids crecen en orden de registro y el render solo recuerda el último id mostrado. `snapshot()` sigue siendo
  una lectura pura: la ventana sale de `snapshot.tick` y no del número de llamadas.

## Consecuencias
- Positivas:
  - El número es fiel a la vida perdida, golpe letal incluido.
  - Es determinista y reproducible por semilla, así que sirve de base a futuros registros (curación, recursos).
  - Ninguna asignación por tick.
  - Los re-render de pausa, tienda y obra no duplican números.
- Negativas / costes:
  - Cambian los constructores de `Arsenal`, `TowerBattery` y `HazardField` (con un `HitLog` desactivado por
    defecto).
  - `WeaponTarget` gana `hp`.
  - Hay un fichero de contenido más en `RunConfig` y en los builders de test.
  - El snapshot crece hasta `N × (M + 1)` entradas en el peor caso.
  - Con `?e2e&speed` > 1 se pueden perder números (aceptado).
- Cómo revertirla: quitar `hits` del snapshot y la capa de números. Volver a llamar a `takeDamage` directamente en
  los siete sitios y borrar `HitLog`, `CombatRules` y `combat.json`. No hay datos persistidos que migrar.
