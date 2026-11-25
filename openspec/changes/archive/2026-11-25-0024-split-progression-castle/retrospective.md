# Retrospectiva · 0024-split-progression-castle

- **Fechas**: inicio 2026-11-24 → archivado 2026-11-25
- **PR**: [#60](https://github.com/Adrian-ASM/tfm-survivors/pull/60) (squash `02ef3ae`; CI `quality` y `e2e` en verde)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 13 / 13 (7 grupos, 0–6) |
| Commits (asistidos por IA) | 9 (9): 1 de planificación, 6 de apply (uno por grupo; 0 y 1 juntos), 1 de test tras verify, 1 de verify y specs W1/W2 |
| Tests añadidos | ~225 (2.853 → 3.078 en `verify`); 18 ficheros de `tests/` nuevos y 43 modificados; 1 E2E nuevo (tienda, ampliando `gameplay.spec`) |
| Hallazgos verify (C / W / S) | 0 / 2 / 1 (W1 aceptado y registrado en design §15; W2 resuelto en la spec + test en `94fdc97`; S1 en `94fdc97`) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 (`core.hooksPath` apuntaba al worktree de 0022; se corrigió antes del primer commit) |
| Iteraciones de prompt relevantes | 5: preguntas de alcance tras explorar, economía de oro y bot tras las mediciones previas, 6 preguntas abiertas en el gate de propuesta, aparcado del lote en el gate de tareas, decisión W1/W2 tras verify |

Balance (M1, una sola palanca: precios): bot v4 **30/50** (22/50 con los precios de partida), 0 quietos con ambos
mapas (muerte máxima en el tick 6.081 / 6.475, margen 4.325 hasta 10.800), 30,44 mechas por partida. Economía media:
284 de oro ganado y 122,5 gastado, 2,54 visitas, 11,6 niveles de arma comprados (18,9 en las ganadas), 0,12
curaciones. Lote del bot v4 34,7–35,8 s local (×2,8 ≈ 97–100 s, por encima del objetivo previo de 90 s; aceptado).
Medición previa decisiva: con el contenido de 0023 había como máximo 74 de oro por mapa, el bot recogía 1,86 y solo
con mejoras de personaje ganaba 0/50.

## Qué fue bien
- Las mediciones previas a *propose* cambiaron el alcance: mostraron que la economía de oro no daba para comprar y
  que el bot nunca volvía al castillo; el autor decidió oro por baja + más oro en estructuras y el bot v4 antes de
  escribir la propuesta, no en apply.
- Ningún consumo de azar nuevo: las cuatro firmas doradas (MAP, STRUCTURE, RESOURCE, SHEEP) intactas; solo cambia
  la secuencia de ofertas, como se esperaba.
- El aparcado explícito del lote de balance (aprobado en el gate de tareas) permitió cerrar los grupos 1–4 en verde
  sin falsear la banda, y verify comprobó que no quedó ningún `skip`.
- Calibración en una iteración y con una palanca; CI verde a la primera.
- La ejecución cortada por apagar el PC se retomó con `SendMessage` al mismo implementador sin perder trabajo
  (commits por grupo y `tasks.md` como estado).

## Qué fue mal / dónde falló la IA
- El `sdd-explorer` y el `sdd-verifier` devolvieron su informe sin escribir el fichero (`exploration.md`,
  `verify-report.md`): interpretaron "devuélveme un resumen, no el fichero" del prompt como prohibición de
  escribirlo. Hizo falta un segundo mensaje a cada uno.
- Spec ∥ design dejó un choque que nadie detectó hasta apply: "Límites válidos" de `resources` (carne 100) contra la
  cota de carne efectiva con `hunter` en `upgrades` (W2). El test lo esquivó quitando `hunter` en vez de parar.
- El objetivo de tiempo del lote (≤ 90 s en CI) se fijó en la spec sin medir el coste del bot v4 (W1).
- `prettier --write` del implementador reformateó `tasks.md` (revertido) y dos ficheros ajenos que entraron en los
  commits de los grupos 4 y 5 (solo formato).

## Desviaciones respecto a spec o diseño
- Design §15: stats de base 0 opcionales en `PlayerRules`; `drops.goldPerKill` opcional en el dominio (obligatorio en
  el fichero); `ShopProductSnapshot` con `kind`; `ReferenceBot.shop` devuelve la siguiente compra; política de tienda
  fija en `chooseWhileOpen`; DOM falso (`tests/support/fakeDom.ts`) en vez de jsdom; el E2E pulsa la fila sin oro con
  `click({ force: true })` (`aria-disabled`).
- W1: el objetivo del lote pasa a "dentro de `BOT_BATCH_TIMEOUT_MS` 180 s" (specs `castle-shop` y `run-outcome`).
- W2: la cota 1..100 de la carne en `resources` se lee sobre el valor base; la cota con `hunter` es la de `upgrades`.
- Se retiró el segundo lote del bot "sin ovejas" y los escenarios de prioridad del bot v3 con ids de arma.
- Verify de las correcciones sin segunda pasada del `sdd-verifier` (solo specs y un test; `verify` en verde).

## Lecciones → acciones
- "Devuélveme un resumen, no el fichero" se lee como "no escribas el fichero" → en los prompts a subagentes decir
  "escribe `<fichero>` y devuélveme un resumen de ≤ N líneas" (añadir a §3.1 de `sdd-workflow`).
- Un límite de validación de un fichero que otro fichero puede superar (contenido base vs. efectivo con mejoras) se
  escapa entre spec ∥ design → al pedir *tasks*, pedir al `sdd-architect` que liste las cotas cruzadas entre
  capacidades; en apply, si un test necesita quitar contenido para cumplir un escenario, parar y avisar.
- Un objetivo de tiempo del lote sin medir el bot nuevo acaba en Warning → fijarlo tras M1, no en la spec inicial.
- Cuando un change mueve poder de una fuente a otra (XP → oro), medir antes la economía real con el bot (aquí 74 de
  oro y 0/50) evitó una propuesta inviable → mantener la regla de mediciones previas y citarla como ejemplo.
