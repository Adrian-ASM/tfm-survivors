# Spec delta · upgrades

<!-- Ruta: openspec/changes/0013-world-camera/specs/upgrades/spec.md
     Solo cambian los textos visibles. Los ids, objetivos, estadísticas, incrementos y niveles máximos no cambian, y
     los requisitos vivos que citan ids (`strict-rules`, `fast-ci`…) o armas por id (`linter`, `tests`) siguen igual.
     Además, por decisión del usuario en apply (2026-11-23), se sube el plazo de "Primera subida en el núcleo" sin
     tocar el contenido (ver MODIFIED). -->

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

## MODIFIED Requirements

<!-- Plazo de "Primera subida en el núcleo": 3.600 → 4.800 ticks (decisión del usuario, 2026-11-23, sin tocar el
     contenido). Motivo: en el mundo de 1.920 × 1.080 los enemigos nacen más lejos del jugador y ya no se recortan
     contra las paredes de una arena del tamaño de la vista, así que tardan más en llegar al alcance de las armas y
     las primeras gemas caen más tarde. Medido en el punto de control de apply (tarea 0.2): primera oferta con la
     semilla 7 en el tick 4.346. -->

### Requirement: Progresión observable en el juego
El sistema SHALL permitir, en el juego real y con el contenido por defecto, recorrer el bucle completo matar →
recoger gemas → subir de nivel → elegir mejora → seguir jugando.

#### Scenario: Primera subida en el núcleo
- **GIVEN** el contenido por defecto (mundo de 1.920 × 1.080), semilla 7 e input (0, 0) en todos los ticks
- **WHEN** se ejecutan ticks hasta el 4.800 (80 s), eligiendo la opción 0 en cada oferta
- **THEN** se abre ≥ 1 oferta en algún tick ≤ 4.800 (medido en apply de 0013: tick 4.346)

#### Scenario: Recorrido en el navegador
- **GIVEN** la build de producción servida con `?seed=7`
- **WHEN** una prueba E2E deja jugar sin input hasta que aparece el overlay y pulsa la tecla 1
- **THEN** antes del overlay el nivel mostrado es 1; tras pulsar, el overlay desaparece, el nivel mostrado es 2 y
  los ticks del snapshot vuelven a avanzar
