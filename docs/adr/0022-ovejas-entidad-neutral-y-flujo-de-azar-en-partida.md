# ADR-0022 · Ovejas como entidad neutral, flujo de azar de ovejas consumido en partida y reserva por niveles

- **Estado**: propuesta (design de 0023)
- **Fecha**: 2026-11-24

## Contexto
El change 0023 añade la primera entidad **neutral**: ovejas que deambulan, huyen del jugador, mueren por armas y
explosiones, sueltan carne que cura y **reaparecen** con el tiempo. Hay cuatro fuerzas:
- `kills`, `maxAlive`, el presupuesto del director y el daño de contacto están construidos sobre `Horde.alive`. Una
  oveja no debe contar en ninguno.
- La oveja respeta el mapa (agua, troncos, castillo) y los enemigos lo ignoran.
- Hasta hoy, el único azar que se consume **durante** la partida es el de oleadas y ofertas, `Mulberry32(seed)`. Los
  flujos de mapa (ADR-0013), estructuras (ADR-0020) y recursos (ADR-0021) solo se usan al crearla. La reaparición
  necesita azar en partida sin mover las oleadas, las firmas doradas (`MAP_`, `STRUCTURE_`, `RESOURCE_GOLDEN`) ni la
  firma inicial de las ovejas.
- El usuario fijó el orden de objetivos de las armas: enemigos → estructuras → ovejas.

## Opciones
1. **Modelo**: (a) oveja como tipo de enemigo neutral en `enemies.json`; (b) entidad propia `Sheep` con su `Flock`.
2. **Azar en partida**: (a) usar el generador de oleadas; (b) un `SHEEP_STREAM` 5 consumido en fases ordenadas
   (colocación, primer pasto y, durante la partida, paseos y reapariciones); (c) `SHEEP_STREAM` 5 solo para la
   colocación y un `RESPAWN_STREAM` 6 para la partida.
3. **Deambular** (la spec fija pasto/paseo con origen y primer pasto aleatorio): (a) un valor del flujo por cada
   paseo con dirección aleatoria; (b) un hash entero de (sal, id, nº de paseo), sin generador.
4. **Armas**: (a) un tercer parámetro `sheep` en `Arsenal.step`; (b) una lista ordenada de niveles de reserva.

## Decisión
**1b + 2b + 3a + 4b** (revisada tras el contraste con las specs: el primer design elegía 3b).

- **1b**: la oveja vive fuera de `Horde`. `kills`, director y contacto no cambian por construcción. Se mueve con el
  barrido por ejes del jugador.
- **2b**: un solo flujo, `Mulberry32(deriveSeed(seed, 5))`, con un orden de consumo fijo:
  1. 1 valor por oveja colocada (solo mapas generados).
  2. 1 valor por oveja colocada para la duración de su primer pasto, en orden de lista.
  3. Durante la partida: en el paso 1, 1 valor por cada paseo que empieza con dirección aleatoria, en orden de
     lista; en el paso 9.2, 1 valor por reaparición vencida con candidatas, en orden de muerte.

  La firma inicial solo depende de la fase 1, que va primera. El generador de oleadas no ve este flujo. Se descarta
  (a) porque cada oveja muerta movería oleadas y ofertas, y (c) porque añade un flujo y una constante sin una ventaja
  que se vaya a usar. En los mapas declarados de los tests, el flujo lo pasa el escenario.
- **3a**: la dirección de un paseo aleatorio es `DIRS[⌊next · 8⌋]`, una tabla fija de 8 unitarios con
  `Math.SQRT1_2`, sin `Math.cos`/`Math.sin` (cuyo resultado ECMAScript no exige igual en todos los motores). Se
  descarta (b) porque la spec `simulation-loop` exige que toda la aleatoriedad venga de instancias de
  `RandomGenerator`, y porque el deambular de la spec ya tiene estado (fases con duración), así que el hash no ahorra
  nada. Coste aceptado: la muerte de una oveja cambia los paseos posteriores de las demás.
- **4b**: `Run` crea una vez `[structures.all, flock.all]`. El arma apunta al primer nivel con objetivo según su
  criterio, y el proyectil guarda su nivel (`tier`). Es la generalización exacta de 0021. Se descarta (a) porque cada
  entidad de reserva futura añadiría otro parámetro.

## Consecuencias
- **Positivas**:
  - Sin ovejas, armas, peligros y oleadas se comportan bit a bit como antes.
  - Añadir otra entidad de reserva es añadir un nivel.
  - Las firmas existentes no cambian y hay una nueva, `SHEEP_GOLDEN`.
- **Negativas / costes**:
  - Las ovejas cambian la partida de cada semilla (armas y curación), así que el balance se vuelve a medir: banda
    25–35/50 con 0 quietos con ovejas, e igualdad exacta con la línea base de 0022 solo con el tope de ovejas a 0
    (segundo lote del bot en `verify`).
  - Cambiar `SHEEP_STREAM`, el orden de fases o el criterio de candidatas cambia ovejas y reapariciones de todas las
    semillas.
  - La reaparición es una fuente de curación sin límite fijo por partida. La acotan el contenido (intervalo, distancia
    al jugador, huida) y el gate del quieto.
- **Cómo revertirla**:
  - Con `maxAlive` 0 no hay ovejas ni consumo de su flujo, y el nivel de reserva 2 queda vacío (lo vigila el lote con
    tope 0 igual a la línea base).
  - Quitar el nivel o el flujo no toca mapa, estructuras, recursos ni oleadas.
