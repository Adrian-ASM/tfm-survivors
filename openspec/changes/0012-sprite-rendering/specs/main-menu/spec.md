# Spec delta · main-menu

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/main-menu/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios:
> - La limpieza tras `Volver al menú` y "Cinco ciclos menú-partida" pasan a verificarse con la sonda de render (ver
>   "Sonda de render para E2E" en `sprite-rendering`), lo que cierra la deuda 0009 · W2. "Sprites de enemigo" son los
>   de enemigos vivos; los cadáveres se cuentan aparte y también deben desaparecer.
> - Nombre visible del juego: "Greentide Vanguard". Ninguna spec viva fijaba el texto del título, así que se añade
>   como requisito. Las claves técnicas (`sprint-survivors/progress`, `sprint-survivors-progress.json`,
>   `window.__sprint`) no cambian.

## ADDED Requirements

### Requirement: Nombre visible del juego
El sistema SHALL mostrar como nombre del juego `Greentide Vanguard` en el título del menú de inicio y en el título del
documento (`<title>` de `index.html`). Ningún texto visible del menú ni el título del documento MUST contener
`Sprint Survivors`. El cambio de nombre MUST NOT cambiar la clave de `localStorage` `sprint-survivors/progress`, el
nombre del fichero exportado `sprint-survivors-progress.json` ni la sonda `window.__sprint`.

#### Scenario: Título en el menú y en el documento
- **GIVEN** la build de producción servida sin parámetros
- **WHEN** termina la carga y se ve el menú de inicio
- **THEN** el título del menú es `Greentide Vanguard` y `document.title` contiene `Greentide Vanguard`
- **AND** ni el texto visible del menú ni `document.title` contienen `Sprint Survivors`

#### Scenario: Claves técnicas sin cambios
- **GIVEN** un progreso con récords (300, 8, 120) guardado antes de este change en `sprint-survivors/progress`
- **WHEN** se carga la página tras el change y se pulsa `Exportar` en el menú
- **THEN** se descarga `sprint-survivors-progress.json` con récords (300, 8, 120), igual campo a campo al guardado

#### Scenario: Export antiguo importable
- **GIVEN** un fichero exportado antes de este change con 2 entradas de historial y un navegador sin progreso
- **WHEN** se importa desde el menú
- **THEN** el menú muestra un mensaje que contiene `importado` y un `Exportar` posterior contiene esas 2 entradas

## MODIFIED Requirements

### Requirement: Volver al menú
El sistema SHALL, al pulsar `Volver al menú` con la partida en pausa, descartar la partida en pausa y mostrar el menú
de inicio en modo menú. La partida descartada no está terminada: MUST NOT registrarse en el historial ni en los
récords ni provocar ninguna escritura del progreso (ver `progress-persistence`). Desde el primer frame del menú MUST
NOT quedar visible ningún sprite de jugador, enemigo, cadáver (aunque su animación de muerte no haya terminado, ver
`sprite-rendering`), proyectil, pulso ni gema, ni el HUD, el overlay de pausa ni el de resultados. El siguiente
`Jugar` empieza una partida nueva desde cero con una semilla aleatoria nueva (ver `simulation-loop`), cuya vista
contiene solo los elementos de su snapshot. En esta spec, "sprites de enemigo" son los de enemigos vivos; los
cadáveres se cuentan aparte.

#### Scenario: Volver al menú desde la pausa
- **GIVEN** `?e2e` y una partida en pausa en el tick 3.000 con ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema en el snapshot
- **WHEN** se pulsa `Volver al menú` y se pinta el siguiente frame
- **THEN** el menú de inicio es visible con sus cuatro opciones y la sonda de render informa de 0 sprites visibles
  de jugador, enemigo, cadáver, proyectil, pulso y gema
- **AND** el HUD y los overlays de pausa y de resultados no son visibles

#### Scenario: Volver al menú con cadáveres en curso
- **GIVEN** `?e2e&seed=7` y una partida en pausa en un frame en que la sonda de render informa de ≥ 1 cadáver
- **WHEN** se pulsa `Volver al menú` y se pintan 60 frames en el menú
- **THEN** en los 60 frames la sonda informa de 0 cadáveres y 0 sprites de jugador, enemigo, proyectil, pulso y gema
- **AND** al pulsar `Jugar`, en el primer frame de la partida nueva hay 0 cadáveres

#### Scenario: La partida abandonada no se guarda
- **GIVEN** un progreso guardado G y una partida en pausa en el tick 5.000 con 41 bajas y nivel 6
- **WHEN** se pulsa `Volver al menú` y después `Exportar`
- **THEN** el valor guardado sigue siendo G byte a byte, se han hecho 0 escrituras de progreso y el fichero
  exportado es igual campo a campo a G

#### Scenario: Jugar tras volver al menú
- **GIVEN** una partida abandonada con `Volver al menú` en el tick 3.000, nivel 5, 200 bajas y `guardrail` en nivel 2
- **WHEN** se pulsa `Jugar` y se lee el snapshot antes del primer tick
- **THEN** tick 0, estado en curso, vida 100 de 100, nivel 1, XP 0, 0 bajas, sin mejoras adquiridas, sin oferta y
  listas de enemigos, proyectiles, pulsos y gemas vacías
- **AND** el overlay de pausa no es visible y el HUD muestra tiempo `10:00`

#### Scenario: Cinco ciclos menú-partida
- **GIVEN** una carga con `?e2e&seed=7` en la que se repite 5 veces: `Jugar` (salvo en el primer ciclo, que empieza
  con la partida del arranque directo), 600 frames, Esc, `Volver al menú`
- **WHEN** se pulsa `Jugar` una sexta vez y se pintan 600 frames
- **THEN** en cada frame de los 6 ciclos con partida, la sonda de render informa de un número de sprites visibles de
  enemigo, proyectil, pulso y gema igual al número de enemigos, proyectiles, pulsos y gemas del snapshot pintado, y
  de 1 sprite de jugador salvo en los frames en que el parpadeo lo oculta
- **AND** en el primer frame del menú tras cada uno de los 5 `Volver al menú` la sonda informa de 0 sprites de
  jugador, enemigo, cadáver, proyectil, pulso y gema
- **AND** en el primer frame de cada partida hay 0 cadáveres, en ningún frame hay más de 64 y existe exactamente 1
  partida durante el sexto ciclo

## REMOVED Requirements
<!-- Ninguno. -->
