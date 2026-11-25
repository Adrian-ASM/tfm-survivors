# Spec delta · build-sites

> Change 0029 `living-map`. Solo cambia la cifra de objetos del plan de arte, que ahora incluye la decoración (ver
> "Decoración del mapa generado" en `sprite-rendering`). La colocación de solares, `SITE_GOLDEN` y el bloqueo de las
> huellas no cambian.

## ADDED Requirements
(ninguno)

## MODIFIED Requirements

### Requirement: Colocación y arte intactos con el solar bloqueante
El sistema SHALL mantener, con el contenido por defecto final de este change, la misma colocación de solares que antes
del change (huellas y orden por semilla, `SITE_GOLDEN` intacta) y el mismo arte del mapa: el bloqueo de las huellas
libres MUST NOT cambiar el número de objetos del plan de arte del mapa (ver `sprite-rendering`). La decoración del mapa
generado nunca se ancla en la huella de un solar, esté libre o construido.

#### Scenario: Objetos del mapa sin cambios
- **GIVEN** el contenido por defecto final y las semillas 42 y 123 con su mapa generado
- **WHEN** se planifica el arte del mapa de cada una con el tope de decoración 0, y después con los datos de aspecto
  del repositorio
- **THEN** con tope 0 tiene 737 y 820 objetos respectivamente, los de antes de este change
- **AND** con los datos del repositorio tiene esos mismos objetos más los de su decoración, ≤ 950

#### Scenario: Solares sin decoración
- **GIVEN** el contenido por defecto y los mapas generados de las semillas 1 a 50, y en otro caso los mismos mapas con
  una casa construida en el primer solar y una torre en el segundo
- **WHEN** se planifica el arte del mapa
- **THEN** ninguna decoración tiene su celda de anclaje en la huella de un solar, y la decoración es la misma, celda a
  celda, en los dos casos

## REMOVED Requirements
(ninguno)
