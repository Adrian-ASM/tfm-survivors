# Retrospectiva · 0021-goblin-camps

- **Fechas**: inicio 2026-11-24 → archivado 2026-11-24
- **PR**: #51 (squash `175a820`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 38 / 38 (7.5–7.7 marcadas "no aplica": firma W3 en 0) |
| Commits (asistidos por IA) | 12 (12), antes del squash |
| Tests añadidos | 182 casos nuevos (7 retirados), en 25 ficheros nuevos y 34 modificados; suite final de 2.463 |
| Hallazgos verify (C / W / S) | 0 / 0 / 5 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 1 / 0 / 0 (procedencia de los PNG antes de registrarlos) |
| Iteraciones de prompt relevantes | 4 (2 cambios de alcance durante las mediciones, 1 ronda extra de combinaciones del barril, 1 contraste del design con las specs) |
| Diff | 127 ficheros, +9.816 / −252 |
| Duración de apply (subagentes) | grupos 1–4 ≈ 43 min · 5–6 ≈ 41 min · 7–8 ≈ 19 min |

## Qué fue bien
- Las mediciones previas evitaron el error de 0006: con ninguna palanca sola del barril se cumplían a la vez más
  mechas, la banda y 0 quietos (vida ×1,5 → 11/50; salida 60 → 41/50). La combinación medida (salida 60, vida 25,
  radio 80) aguantó sin recalibrar en apply: 27/50, 0 quietos y 26,9 mechas por partida, frente a 16,3.
- Modelar las estructuras como entidades y no como celdas (ADR-0020) dejó intactos la rejilla, el campo de flujo y
  `MAP_GOLDEN`, y evitó adelantar el recálculo reservado a 0025.
- La guardia lanza dentro del radio de huida del bot: el caso W3 no se dio y el bot siguió en v3. Es lo que pedía la
  decisión A2 del autor.
- El contraste del design con las specs antes de las tareas encontró 8 decisiones tomadas por separado y las alineó
  sin reabrir el alcance.
- Verify sin Critical ni Warning a la primera.

## Qué fue mal / dónde falló la IA
- **Tamaño**: la exploración avisó de que era "demasiado grande para un change". Se recortaron los campamentos y el
  chore previo, pero quedaron juntos estructuras, guardias, armas, mapa, render, arte, barril y balance. Apply tardó
  unos 100 min de subagente y el autor lo notó.
- **TDD estricto sobre propiedades por construcción**: en 2.4, 4.5 y 4.6 los tests de independencia del azar y de
  orden del tick pasaron a la primera, y el rojo hubo que forzarlo rompiendo el código a mano.
- **Heredocs**: se usaron para ficheros de test en los grupos 4 y 5, contra AGENTS.md §8.1. No rompieron nada, pero
  la regla existe por eso.
- **Orden de tareas**: la 1.2 se hizo antes que la 1.1.
- **Alcance cambiante**: el autor cambió dos veces el alcance (vía la sesión de 0020) mientras corrían las
  mediciones. Parte de la medición 6 se hizo en balde.

## Desviaciones respecto a spec o diseño
- `RunConfig.structures` quedó opcional en los grupos 1–4 y pasó a obligatorio en el 5, como preveía el implementador.
- La constante `STRUCT_STREAM` se adelantó de la 5.3 al grupo 2.
- Los colores de reserva de las estructuras viven en un `structureColors` de nivel superior en `appearance.json`. El
  design no lo fijaba.
- La ruina se muestra con una máscara de habilitado en `MapCuller` y no con `setTexture`. El cambio lo forzó la spec
  "Reserva de las estructuras" en el contraste previo a las tareas.
- El E2E nuevo no es un test aparte: se amplió "Mapa real".
- En el bench, "la mitad de ellos" se leyó como 300 guardias. El verifier aceptó esa lectura.

## Lecciones → acciones
- Si la exploración dice "demasiado grande", partir en changes encadenados (aquí: estructuras + armas → guardias →
  barril + balance) → regla en la skill `sdd-workflow`: un aviso de tamaño del explorer obliga a proponer el corte
  en el gate de propose.
- Una propiedad que se cumple por construcción (orden del tick, no consumo de azar) no necesita rojo previo → nota en
  ADR-0018 o en `test-writer`: se admite un test de regresión con rojo forzado documentado.
- Registrar la procedencia en la misma tarea que copia el asset → recordatorio en las tareas de arte de la plantilla
  `tasks.md`.
- Los cambios de alcance durante las mediciones cuestan rondas → pedir al autor las decisiones de alcance de la
  exploración (§6) antes de lanzar mediciones caras.
- Seguimiento: el lote de balance va por 30,4 s en local (≈ 85 s en CI, frente a un tope propio de 90). El siguiente
  change que añada trabajo por tick debe medirlo antes de proponer. Es candidato para balance-pass-2.
