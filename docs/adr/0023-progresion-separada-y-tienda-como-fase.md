# ADR-0023 · Progresión separada: catálogo con dos orígenes y tienda como fase de la partida

- **Estado**: propuesta (change 0024-split-progression-castle)
- **Fecha**: 2026-11-24
- **Matiza**: ADR-0008 (las mejoras ganan origen y precio por nivel), ADR-0009 (cuarta fase de `Run`)

## Contexto
El GDD pide que la XP dé mejoras de personaje (1 de 3 al subir) y el oro, mejoras de arma compradas en el castillo.
Hoy `upgrades.json` mezcla las 9 en una sola oferta y el oro no tiene uso. Fuerzas:
- ADR-0008: los niveles son la fuente de verdad y las estadísticas efectivas se derivan desde la base con una sola
  implementación, validada por la build de peor caso.
- La tienda pausa la partida por completo y se abre por una regla del tick (radio de la puerta con re-armado): tiene
  que ser reproducible con semilla y acciones, como la oferta.
- Determinismo: comprar no puede consumir azar del flujo principal.
- 0027 (Guerrero) traerá varios personajes con su loadout; el formato de las mejoras de arma no debería cambiar.

## Opciones
1. **Dos catálogos y dos vectores de niveles** (personaje y arma), cada uno con su derivación.
2. **Un catálogo con campo `currency`** en cada mejora, sin separar el contenido.
3. **Contenido en dos listas, un catálogo de dominio con origen (`level` | `shop`) y un solo vector de niveles**;
   la tienda es una fase de `Run` (`shopping`) y comprar es un método de `Run` sin azar.
4. Tienda como estado de la presentación (como la pausa de Esc, ADR-0011), con compras desde el adaptador.

## Decisión
Opción 3.
- `upgrades.json` declara `character` (sin precio) y `weapons` (con `prices`, uno por nivel). `UpgradeCatalog` las
  une (`character` y después `weapons`) y valida que cada lista apunte a su objetivo. La derivación, el peor caso,
  `snapshot.upgrades` y `RunSetup.upgrades` no cambian de modelo.
- La oferta sortea solo entre las mejoras `level`; la compra sube el nivel de una `shop` con `raise`, sin azar.
- `RunPhase` gana `shopping`. Un paso nuevo al final del tick abre la tienda (puerta armada y jugador en el radio) y
  desarma la puerta; se re-arma al alejarse la distancia de re-armado. En `shopping` no se ejecuta ningún paso.
- Se descarta la 1 porque duplica la derivación y el peor caso; la 2, porque mezcla en una lista dos modelos con
  campos distintos (precio solo en las de arma) y la tienda no es una oferta; la 4, porque la apertura es una regla del
  tick y la pausa de presentación no es reproducible desde el núcleo (los tests y el bot no la verían).

## Consecuencias
- Positivas:
  - Una sola implementación de estadísticas efectivas y de validación para las dos progresiones.
  - Tienda y oferta comparten las garantías de `run-state` (simulación congelada, sin azar, sin invulnerabilidad que
    corra) y `TickRun` no cambia.
  - Una mejora de arma sigue apuntando a su arma por id: 0027 solo cambia la regla "arma existente" y el filtro de la
    tienda por loadout.
- Negativas / costes:
  - Cambia la secuencia de ofertas de cada semilla: el balance se recalibra y la línea base se reemplaza.
  - `upgrades.json` cambia de forma (esquemas, builders y tests que leían `upgrades.upgrades`).
  - Un índice global de catálogo mezcla orígenes; `levelIndices`/`shopIndices` lo encapsulan.
- Cómo revertirla:
  - Volver a una sola oferta es unir las listas y quitar el filtro de `open`; quitar la tienda es retirar la fase y el
    paso 11. El vector de niveles no cambia en ninguno de los dos casos.
