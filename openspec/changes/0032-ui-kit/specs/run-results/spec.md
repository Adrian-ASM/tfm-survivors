# Spec delta · run-results

> Change 0032-ui-kit. Términos (pieza, rol, márgenes, tintas, relleno, k, área útil, contraste, aspecto actual y reserva
> de un panel DOM) según las convenciones del delta de `sprite-rendering` de este change. El contenido, los mensajes y
> el reinicio con R no cambian.

## ADDED Requirements

### Requirement: Aspecto del overlay de resultados con piezas de UI
La vista SHALL pintar el overlay de resultados (`.results-panel`, hasta ahora sin fondo propio) con las piezas de
"Piezas de UI en los paneles DOM" (`sprite-rendering`): marco de `panel` detrás de todo su contenido (título, tiempo,
nivel, bajas, indicación de R, récords, botones, mensajes y avisos), el título (`Victoria` o `Derrota`) con la cabecera
`header`, `Exportar` e `Importar` con las piezas de botón según su estado y la fuente pixel. Los mensajes de import
(`importado`, `no válido`, `64 KiB`) MUST usar la tinta `accent` de `panel` y los avisos (`no se guarda`, `dañados`) la
tinta `danger`; el resto del texto, la tinta `text`. Con una ventana ≥ 960 × 540 y cualquier k, todo su contenido MUST
quedar dentro del área útil del marco, también con los dos avisos y un mensaje de import a la vez, además de las
garantías de "Overlay de resultados centrado en la ventana". El velo de la partida detrás del overlay no cambia. Si la
pieza o la fuente no carga, el overlay se pinta con su reserva y sus botones y la tecla R funcionan igual.

#### Scenario: Colores de mensajes y avisos
- **GIVEN** un overlay de resultados que muestra el aviso `no se guarda`, el aviso `dañados` y el mensaje con
  `no válido`, con los datos de `ui` del repositorio
- **WHEN** se leen los colores de esos textos
- **THEN** los dos avisos usan la tinta `danger` de `panel` y el mensaje la tinta `accent`, cada uno con contraste
  ≥ 4,5 con el relleno de `panel`

#### Scenario: Contenido máximo dentro del marco
- **GIVEN** una ventana de 960 × 540 (k = 1) y una partida terminada cuyo overlay muestra a la vez los dos avisos y el
  mensaje de import, con la pieza de `panel` del repositorio de márgenes (l, t, r, b)
- **WHEN** se leen las reglas del overlay
- **THEN** su relleno interior es ≥ (l, t, r, b) px en cada lado, y su contenido cabe en la ventana sin solaparse (ver
  "Contenido máximo en la ventana mínima")

#### Scenario: Botones de resultados con las piezas en reserva
- **GIVEN** una partida terminada con la pieza de `button` sin cargar
- **WHEN** se pulsa `Exportar` y después la tecla R
- **THEN** se descarga exactamente 1 fichero `sprint-survivors-progress.json` y se crea exactamente 1 partida nueva,
  sin errores no capturados
