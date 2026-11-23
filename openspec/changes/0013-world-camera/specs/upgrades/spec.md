# Spec delta · upgrades

<!-- Ruta: openspec/changes/0013-world-camera/specs/upgrades/spec.md
     Solo cambian los textos visibles. Los ids, objetivos, estadísticas, incrementos y niveles máximos no cambian, y
     los requisitos vivos que citan ids (`strict-rules`, `fast-ci`…) o armas por id (`linter`, `tests`) siguen igual. -->

## ADDED Requirements

### Requirement: Textos medievales de las mejoras
El contenido por defecto SHALL dar a cada mejora el `name` y la `description` de esta tabla, carácter a carácter. En
los textos visibles, el arma `linter` se llama **arco** y el arma `tests` se llama **tajo**.

| id | `name` | `description` |
|---|---|---|
| `strict-rules` | Puntas de acero | Las flechas del arco hacen más daño. |
| `fast-ci` | Tensado rápido | El arco dispara más a menudo. |
| `wide-analysis` | Ojo de halcón | El arco alcanza objetivos más lejanos. |
| `hard-asserts` | Filo templado | El tajo hace más daño. |
| `watch-mode` | Brazo incansable | El tajo se lanza más a menudo. |
| `coverage` | Barrido amplio | El tajo llega más lejos a tu alrededor. |
| `guardrail` | Cota de malla | Más vida máxima (y la misma cantidad de vida actual). |
| `shortcuts` | Botas de viajero | Te mueves más rápido. |
| `context-window` | Amuleto del saqueador | Atraes las gemas desde más lejos. |

Los ids, el objetivo, `stat`, `perLevel` y `maxLevel` de cada mejora MUST ser los mismos que antes del change. El
renombrado MUST NOT cambiar la simulación, el bot de referencia ni los datos guardados (`localStorage` y JSON
exportado).

#### Scenario: Textos del catálogo por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** las 9 mejoras tienen, por id, exactamente el `name` y la `description` de la tabla

#### Scenario: Sin textos del tema anterior
- **GIVEN** el contenido por defecto
- **WHEN** se buscan en los 9 `name` y `description`, como palabra completa y sin distinguir mayúsculas, `Skill`,
  `Linter`, `Tests`, `CI`, `asserts`, `watch`, `cobertura`, `Guardrail`, `Atajos`, `teclado` y `contexto`
- **THEN** no hay ninguna coincidencia

#### Scenario: Ids y números sin cambios
- **GIVEN** el contenido de mejoras de `main` antes del change y el contenido por defecto tras el change
- **WHEN** se comparan mejora a mejora sin tener en cuenta `name` ni `description`
- **THEN** son iguales campo a campo y en el mismo orden

#### Scenario: La carta muestra el texto nuevo
- **GIVEN** un snapshot con una oferta abierta cuyas opciones son `strict-rules`, `guardrail` y `shortcuts`
- **WHEN** se pinta el overlay de elección
- **THEN** las cartas muestran, en ese orden, "Puntas de acero", "Cota de malla" y "Botas de viajero", cada una con
  su descripción de la tabla y "0 → 1"

#### Scenario: Misma partida con los textos nuevos
- **GIVEN** dos partidas con la semilla 42, los mismos inputs y las mismas elecciones, una con los textos anteriores
  y otra con los de la tabla
- **WHEN** se ejecutan hasta que terminan o hasta el tick 36.000
- **THEN** sus snapshots son iguales tick a tick salvo en el `name` y la `description` de las opciones de oferta
