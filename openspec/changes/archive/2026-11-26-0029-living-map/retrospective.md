# Retrospectiva · 0029-living-map

- **Fechas**: inicio 2026-11-25 → archivado 2026-11-26
- **PR**: #74 (archivo en PR aparte)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 8 / 8 |
| Commits (asistidos por IA) | 10 (10) en la rama; squash en `d3b515a` |
| Tests añadidos | 89 casos `it`/`test` nuevos (6 ficheros de test nuevos, 25 modificados); 3.667 en total; 0 E2E nuevos (2 ampliados) |
| Hallazgos verify (C / W / S) | 0 / 2 / 2 (W1 corregido antes de la PR; W2 y S1–S2 como deuda) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 4 (abiertos del gate, corrección de la pausa, ajuste spec↔design en tasks, escenario de ovejas) |

## Qué fue bien
- El orquestador encontró el pack local (`Tiny Swords (Update 010)/Deco`) y montó una hoja de contacto con las 18
  Deco: el autor decidió sobre imágenes, no sobre nombres, y la propuesta enumeró cada elemento (lección de 0028).
- Colocación y fases por hash, sin PRNG ni flujo nuevo: firmas doradas y `BALANCE_BASELINE` intactas sin tocar el
  núcleo.
- Presupuesto con holgura: 820 / 904 objetos en 42 / 123 (objetivo ≤ 950, límite 1.000).
- El implementer comprobó que el test de reaparición detecta un fallo, quitando el cebado a propósito.

## Qué fue mal / dónde falló la IA
- El orquestador describió mal el comportamiento actual en el gate («la espuma sigue en pausa»): la espuma se
  congela. Lo detectó el architect y hubo que volver a preguntar al autor.
- La spec fijó «misma decoración con tope de ovejas 0» sin ver la cadena ovejas → solares → decoración; saltó en
  apply (822 frente a 820 en la semilla 42).
- La spec dijo que el reloj de render «no depende de `step(n)`», contra el modo manual de 0014.
- W1: el test de «Misma semilla, misma decoración» omitía el tercer cálculo tras R.

## Desviaciones respecto a spec o diseño
- Decoración sin pesos, volteo ni `id` (`density`, `tall`, una hoja); espantapájaros con base 3 × 1. La spec se
  alineó en la fase de tasks.
- `origin.y = 1` en 16/17/18 pese a medir la última fila opaca (103/128, 104/128, 168/192): bajarlo ocuparía otra
  fila de base.
- Cebado del frame justo después de mostrar el objeto (mismo frame, antes de pintar), no antes.
- Getter de solo lectura `RenderLayers.renderMs` para los tests del reloj.

## Lecciones → acciones
- Antes de preguntar al autor por un comportamiento «como X», comprobar en el código qué hace X hoy →
  `sdd-workflow` §3: verificar el comportamiento actual que se cita en una pregunta del gate.
- Las dependencias de colocación entre flujos (ovejas → solares → decoración) invalidan escenarios «con tope 0
  igual» → pedir al spec-writer que recorra la cadena de colocación antes de afirmar invariancias.
- Las frases de spec sobre el reloj de render deben citar el modo manual de 0014.
