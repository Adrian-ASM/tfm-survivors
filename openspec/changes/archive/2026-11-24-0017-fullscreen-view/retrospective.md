# Retrospectiva · 0017-fullscreen-view

- **Fechas**: inicio 2026-11-23 → archivado 2026-11-24
- **PR**: #41 (squash `35256f6`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 22 / 22 casillas de `tasks.md` (5 bloques) |
| Commits (asistidos por IA) | 26 (26) en la rama, fusionados en squash |
| Tests añadidos | +114 / −61 casos (`it`/`test`) en el diff de `tests/`; unitarios de 1.859 (main tras 0016) a 1.925; E2E `logic` de 12 a 13 (1 nuevo: redimensionado con la oferta abierta; 2 ampliados) |
| Hallazgos verify (C / W / S) | 0 / 2 / 2 (W2 resuelto por el orquestador; W1 y S1–S2 como deuda) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 1 (pre-commit: import sin usar) / 1 (CI del PR: 2 E2E del mapa real por tiempo, sin GPU) |
| Iteraciones de prompt relevantes | 1 `sdd-explorer`, 1 `sdd-implementer` de mediciones previas, 3 `sdd-spec-writer` (propose, spec, ajuste de 2 escenarios), 2 `sdd-architect` (design, contraste + tasks), 3 rondas del `sdd-implementer` de apply (paró en 2.1 y en 2.4), 1 `sdd-verifier` |

Balance final (mundo 3.840 × 2.160, anillo 1.500, `player.speed` 215, oleadas 1,2/2,4/2,4/3,0/4,2): **25/50**
victorias y 0 quietos vivos con mapa generado y vacío; primera oferta (s7) en el tick 1.527. Objetos del mapa:
667 (42) y 750 (123), tope 1.000. `generateMap` 4,15 ms de media (una vez por partida).

## Qué fue bien
- **Preguntas al usuario antes de proponer** (escalado, tamaño del mundo, Fullscreen API, balance) y la petición
  del usuario de escalar el HUD llegaron a la propuesta antes de cualquier spec.
- **Mediciones previas** con arnés temporal: descartaron mantener el anillo actual (16/50) y el anillo nuevo sin
  ajustes (7/50, quietos vivos), y dieron 64 × 36 como viable (≤ 2,3 ms, 0/200 fallos de conectividad).
- **Criterio de salida explícito en la calibración**: el implementer paró al agotar las 6 tablas en lugar de
  relajar "Oleadas que crecen"; la decisión volvió al usuario con datos y se resolvió en la 2.ª ronda (3 tablas).
- **Paradas por conflicto de spec**: dos escenarios incompatibles con el mundo nuevo (auto-weapons 600 ticks,
  primera oferta igual con y sin mapa) se resolvieron en la spec, no en el código.
- **Núcleo limpio**: `View` salió del dominio; el tope de vista no llega al núcleo (`parseContent`).

## Qué fue mal / dónde falló la IA
- **Medición previa con tabla no monótona**: la propuesta llevó oleadas ×1,2/×0,8 que incumplían la spec viva
  "Oleadas que crecen"; lo detectó el spec-writer, pero costó una ronda de apply extra.
- **Las mediciones previas solo miraron balance y mapa, no las specs vivas que fijan ticks** (auto-weapons,
  procedural-map): dos escenarios rompieron en 2.4.
- **CI sin GPU**: el render del mapa 64 × 36 a 1.280 × 720 es ~2,5x más lento por frame; "Cámara" y "Mapa real"
  pasaron de 28 y 20 s a > 60 s. En local con `CI_LIKE=1` no se reproduce (11 s). Se resolvió con `test.slow()`.
- **El verifier no recorrió todos los escenarios** de las 11 specs, solo los puntos pedidos; la tabla escenario →
  test del informe es parcial.
- **El orquestador rompió una inserción con `sed`** (escribió `$C` literal) y tuvo que repetirla con Edit: la regla
  de AGENTS.md §8.1 (no heredocs/sed para código en Windows) también aplica a inserciones.

## Desviaciones respecto a spec o diseño
- Tabla de oleadas 1,2/2,4/2,4/3,0/4,2 (design D9 actualizado) en lugar de los factores ×1,2/×0,8 de la propuesta.
- `auto-weapons`: primera baja con el jugador quieto ≤ 900 ticks (antes 600). `procedural-map`: "Primera oferta en
  plazo con y sin mapa" (≤ 4.800) en lugar de "igual con y sin mapa".
- `parseContent` separa `{ config, maxView }` (D2); título del menú en el `h1` de `MenuPanel`; constantes de
  Phaser como literales comprobados contra 4.2.1.
- E2E del mapa real con `test.slow()` tras el CI del PR.

## Lecciones → acciones
- Una medición previa de balance debe comprobar también los requisitos vivos que restringen la tabla (monotonía) y
  los escenarios con ticks fijos → en `sdd-workflow` §3 "Mediciones previas": contrastar la configuración medida con
  las specs vivas de oleadas y con los escenarios con ticks antes de pasarla a propose.
- Si un change aumenta objetos de render o el tamaño de la ventana de pruebas, medir la duración de los E2E del mapa
  en CI (no basta `CI_LIKE=1` local) → deuda abierta como change 0018-map-culling (no pintar el arte fuera de cámara).
- Pedir al verifier la tabla completa escenario → test cuando el change toca más de 5 specs.
