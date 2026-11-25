# Spec delta · sheep

<!-- El movimiento de las ovejas ("Deambular de las ovejas" y su barrido) ya respeta las celdas no caminables; por la
     convención de "Rejilla de celdas tipadas" (`procedural-map`) eso incluye las huellas de los solares libres desde el
     tick 0. Solo cambia la elección de la celda de reaparición. -->

## MODIFIED Requirements

### Requirement: Reaparición de ovejas
El sistema SHALL, por cada oveja que muere en el tick t de una partida con ovejas, hacer aparecer una oveja nueva en
el paso de reaparición (ver "Orden de los pasos del tick" en `simulation-loop`) del tick t + intervalo de reaparición,
o del primer tick posterior en que haya una celda candidata. La oveja nueva:
- se crea en el centro de una celda **candidata** elegida con el azar de las ovejas. Una celda es candidata si es
  `grass`, es caminable en ese tick (no es una celda de obra: ni de la huella de un solar libre ni de la de un edificio
  construido, ver `build-sites`), no pertenece a la huella de ninguna estructura ni es la puerta de una casa, no es la
  celda en la que estaba el centro de la oveja muerta al morir y su centro está a distancia ≥ la distancia mínima de
  reaparición del centro del jugador en ese tick; con el mapa generado, además, cumple las distancias mínimas a la zona
  de inicio y al castillo de "Ovejas en el mapa generado" (`procedural-map`);
- tiene un identificador nuevo, la vida del contenido, su punto de origen en su posición, estado `graze` con un pasto de
  la duración completa, y entra al final de la lista;
- no se mueve ni puede ser objetivo de las armas en su tick de aparición (aparece después de esos pasos).

Si en un tick hay varias reapariciones pendientes, se atienden en el orden de muerte (y, a igual tick de muerte, en el
orden que tenían en la lista de ovejas). Una reaparición sin celda candidata queda pendiente y se intenta de nuevo en
cada tick siguiente. En los ticks que acaban antes del paso de reaparición (victoria o derrota) no aparece ninguna. La
reaparición MUST NOT consumir el azar de la partida ni cambiar la colocación inicial de las ovejas.

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: Sin reaparición en un solar
- **GIVEN** el mapa vacío con la oveja de prueba como única oveja declarada, el jugador quieto en la salida
  (1.920, 1.080), distancia mínima de reaparición 0 y 4 solares declarados cuyas huellas cubren 16 celdas, y la oveja
  muere en el tick n
- **WHEN** se repite el escenario con las semillas 1 a 50 y se ejecuta cada una hasta el tick n + intervalo de
  reaparición
- **THEN** en cada semilla la oveja nueva aparece en el centro de una celda `grass` caminable que no es de ninguna de las
  4 huellas
- **AND** con los mismos 4 solares construidos (escenario preparado) tampoco aparece en ninguna de sus huellas

#### Scenario: Solo celdas de obra disponibles
- **GIVEN** un mapa explícito de troncos salvo las 4 celdas de la huella del solar de prueba y la celda (5, 5), que son
  `grass`, la salida declarada en (330, 330) (centro de la (5, 5)), distancia mínima de reaparición 0 y la oveja de
  prueba declarada que muere en el tick n con el centro en la celda (5, 5)
- **WHEN** se ejecutan 3.600 ticks más
- **THEN** no aparece ninguna oveja (no hay celda candidata), no hay errores y la partida sigue en curso
