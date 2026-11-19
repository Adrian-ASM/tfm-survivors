# Retrospectiva · 0004-auto-weapons

- **Fechas**: inicio 2026-11-19 → archivado 2026-11-19
- **PR**: pendiente de abrir (rama `change/0004-auto-weapons`, sin push al archivar)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 31 / 31 (bloques 1 a 8) |
| Commits (asistidos por IA) | 36 (36), incluido el de archivado; 35 sobre `d7ccd66` antes de archivar |
| Tests añadidos | 138 unitarios (393 → 531, 32 → 44 ficheros) + 1 E2E (4 → 5; la de vida de 0003 reescrita) + 1 caso de bench |
| Hallazgos verify (C / W / S) | 0 / 0 / 4 (las 4 Suggestions quedan como deuda, ver abajo) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / sin ejecutar (sin push) |
| Iteraciones de prompt relevantes | 1 revisión de la propuesta en el gate (daño base por arma, vida de enemigos); 1 alineación spec ↔ design (5 discrepancias); 2 paradas del apply por equilibrio (4.7 y 4.8) |
| Benchmark `Run.tick` | peor caso (200 enemigos, 32 proyectiles, pulso por tick): 0,124–0,143 ms; 200 vivos: 0,0096–0,0099 ms; 200 encima del jugador: 0,0057–0,0059 ms (umbral 2 ms) |
| Equilibrio medido (núcleo, quieto) | primer golpe: tick 4100 (seed 42), 4098 (seed 7), 3899–4126 (seeds 1–3); primer pulso de Tests: 950 (seed 7), 1177 (seed 42) |

## Qué fue bien
- El modelo genérico de armas (ADR-0007: criterio de objetivo y tipo de ataque como uniones discriminadas, `switch`
  exhaustivo) cubrió las dos armas sin clases por arma, y zod valida las combinaciones compatibles.
- El gate de equilibrio (tarea 4.7) funcionó como se diseñó: el implementer paró en lugar de relajar tests o tocar
  contenido, y la decisión volvió al usuario y a la spec.
- Verify limpio a la primera (0 Critical, 0 Warning): los 81 escenarios con test y el tick sin asignaciones.
- Se cerró la deuda S4 de 0003: `Run.damageEnemy` desaparece y las bajas se compactan con un solo `removeDead()`
  por tick.
- Spec y design en paralelo, con las discrepancias reconciliadas antes de las tareas en vez de durante el apply.

## Qué fue mal / dónde falló la IA
- **Plazos de equilibrio sin medir en la spec**: el spec-writer fijó 3.600 ticks / 60 s para el primer golpe y una
  ventana de 600 ticks para el pulso sin datos; con armas el primer golpe llega hacia el tick 4100 y el Linter mata
  a los bugs antes de que entren en el radio de Tests. Hicieron falta dos paradas del apply y una decisión del
  usuario (≤ 4.800 ticks / 80 s; pulso ≤ 1.800 ticks).
- **El mismo hallazgo apareció dos veces**: la corrección de 4.7 no barrió todas las specs con el mismo plazo, y
  "Partida con contactos reproducible" (simulation-loop) volvió a parar el apply en 4.8.
- **Sesión de orquestador abierta fuera del repo otra vez** (lección de 0003 sin aplicar): los subagentes de
  `.claude/agents/` no se cargaron y se usaron agentes generales con la definición y el modelo de cada rol.
- El implementer usó heredoc dos veces para tests (sin `\`, sin daños) antes de pasar a Edit/Write, y escribió el
  diario de IA fuera de su alcance (precedente de 0003, pedido por la tarea 8.4).
- Al archivar, `git mv` de la carpeta del change falló con "Permission denied" (carpeta bloqueada en Windows,
  probablemente por el servidor de desarrollo); se movieron los ficheros uno a uno.

## Desviaciones respecto a spec o diseño
- Plazos de equilibrio relajados por decisión del usuario: `player-health` primer golpe ≤ 4.800 ticks (núcleo) y
  ≤ 80 s (E2E); `auto-weapons` pulso de Tests ≤ 1.800 ticks; `simulation-loop` "Partida con contactos
  reproducible" a 4.800 ticks. El contenido no cambió.
- `readyAt` empieza en 0 y el snapshot expone `ready` (ajuste del design por la spec de carga en el snapshot).
- 6.5 y 7.1 en un mismo commit (el cambio de `GameScene` no compila sin `main.ts`).
- `SceneCapacity` lleva además la duración visible de cada arma de pulso, que necesita la capa de anillos.
- Sin `Weapon.readyIn` (equivale a `isChargedAt`); `Projectile.launch` con parámetros posicionales para no crear
  un objeto por disparo; mensajes `WEAPONS_REQUIRED` y `WEAPON_ID_REQUIRED` en `schemas.ts`.
- El bench usa `BENCH_HEALTH = 1e9` (constante del fichero) para sostener el tope de 200 enemigos con armas.

## Lecciones → acciones
- Los plazos y ventanas que dependen del equilibrio no se pueden fijar sin medir → en la skill del spec-writer,
  marcar esos números como "provisional, a medir en apply" y poner la tarea de medición al principio de `tasks.md`
  (como se hizo con 4.7).
- Una decisión de equilibrio afecta a todos los escenarios que comparten la misma condición → al volver a spec,
  buscar en todas las specs delta (y en las vivas heredadas) el número cambiado antes de reanudar el apply.
- La sesión del orquestador debe abrirse desde el repo o el worktree → reforzarlo en AGENTS.md (§5 o §8), porque la
  lección de 0003 no bastó.
- Deuda abierta del verify (Suggestions): S1 cuerpo de `design.md` con los plazos originales (corregido solo en
  "Desviaciones", el archivo queda como histórico); S2 `BENCH_HEALTH` documentado como si fuera variable de
  entorno; S3 diario de IA escrito por el implementer; S4 tests heredados sin prefijo `Scenario:`. Siguen abiertas
  S5 (`snapshot()` asigna por frame, ahora también proyectiles y pulsos) y S8 de 0003.
