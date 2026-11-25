# Spec delta · procedural-map

## ADDED Requirements

### Requirement: Puerta de la tienda en cada mapa
El sistema SHALL dar a cada mapa como mucho una **puerta de la tienda** (ver `castle-shop`):
- el mapa generado tiene siempre la puerta en la puerta del castillo, que es su punto de salida (ver "Castillo en el
  mapa generado"): (1.950, 1.170) con el contenido por defecto, para cualquier semilla;
- el mapa vacío no tiene puerta, tampoco el mapa vacío con salida declarada;
- un mapa explícito solo tiene la puerta que declare (una posición dentro del mundo; si no, la partida no se crea y el
  error menciona la puerta de la tienda), sin exigir celdas `castle`.

La puerta no es una celda: no cambia ninguna celda, el campo de distancias, la línea libre, la colisión ni la colocación
de estructuras, recursos u ovejas, y MUST NOT consumir azar. Las firmas doradas de mapa, estructuras, recursos y ovejas
no cambian.

#### Scenario: Puerta en el mapa generado
- **GIVEN** el contenido por defecto
- **WHEN** se crea la partida de cada semilla de 1 a 50, de la 0 y de la 4.294.967.295 con su mapa generado
- **THEN** cada una tiene la puerta de la tienda en (1.950, 1.170), igual a su punto de salida

#### Scenario: Sin puerta en el mapa vacío
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío, y en otro caso el mapa vacío con salida
  (1.950, 1.170)
- **WHEN** se crea la partida
- **THEN** ninguna de las dos tiene puerta de la tienda

#### Scenario: Puerta declarada en un mapa explícito
- **GIVEN** el mapa vacío con puerta declarada en (1.000, 1.000), y en otro caso en (−10, 1.000)
- **WHEN** se crea la partida
- **THEN** la primera se crea con la puerta en (1.000, 1.000) y la segunda no se crea, con un error que menciona la
  puerta de la tienda
