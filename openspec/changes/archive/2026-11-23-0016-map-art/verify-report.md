# Verify report · 0016-map-art

## Resultados de ejecución
- `npm run verify`: verde (lint, typecheck, `guard:all` con 673 ficheros, Vitest 162 ficheros / 1.859 tests).
- `npm run test:e2e` (proyecto `logic`): 12/12 en verde.
- `tasks.md`: 1.1–7.2 marcadas (5.1 con aprobación del usuario registrada en la propia tarea).
- Balance (diario, punto de control 1): 27/50 victorias (banda 25..35); quieto pierde como mucho en el tick 5.544
  (generado) y 5.613 (vacío), < 10.800; primera oferta 4.263 y pulso 4.165, ≤ 4.800.
- Objetos del mapa (punto de control 2): semilla 42 = 196, 123 = 245, máximo 1..50 = 258 (semilla 15), todos ≤ 300.
  Sin palanca de `Blitter`.
- Procedencia: 5 hojas nuevas con entrada y sha256 en `content/asset-provenance.json`; nota "nada del Free Pack"; test
  sobre `git ls-files` sin `Castle_*` de otro color ni `Rocks`. Sin secretos ni código muerto detectados.
- Capas (AGENTS §3): sin hallazgos. Contenido nuevo en `content/` validado con zod (`map.castle`, `appearance.map`).

## Escenarios → Test → Estado
De los 138 escenarios distintos de las 7 specs delta, 128 tienen un test cuyo título los nombra
(unitario, aplicación, contenido o E2E ampliado). Los 10 restantes:

| Escenario | Test | Estado |
|---|---|---|
| Recuentos del mapa pintado [E2E] | `gameplay.spec.ts` "Mapa real…" (ampliado en 6.1) + parte pura en `planMapArt` | Cubierto (título distinto) |
| Sonda con castillo y salida [E2E] | `gameplay.spec.ts` "Mapa real…" | Cubierto |
| Sin solapes en la build con el mapa real | `gameplay.spec.ts` "Mapa real…" (`overlapsBlocked` con `castle`) | Cubierto |
| Hojas del mapa bloqueadas [E2E] | `gameplay.spec.ts` "Sprites…reserva si fallan Torch y las hojas del mapa" | Cubierto |
| Objetos del mapa [realtime] / Fps con el mapa real [realtime] | `realtime.spec.ts` (≤ 300 objetos; a demanda) | Cubierto (a demanda) |
| Animaciones obligatorias y campos desconocidos | `appearance-content.test.ts` (casos de `rotation`) | Cubierto (título distinto) |
| Partida con arte | E2E retirado en `e2e-lite` | Aceptado (regla e2e-lite) |
| Mapa sobre el fondo de reserva | `sprites.spec.ts` retirado en `e2e-lite` (diario de 0015) | Aceptado |
| Fuera de pantalla en una partida real | E2E retirado en `e2e-lite`, ya existía antes de 0016 | Aceptado |

El resto de escenarios (castillo, salida, generador, orillas, puentes, árboles, planes, reserva, recuentos de sonda,
spawns, gemas, jugador, run-outcome) están cubiertos por tests con título idéntico al del escenario.

## Hallazgos

### Critical
Ninguno.

### Warning
- W1. Desviaciones respecto al design anotadas en el diario y no reflejadas en `design.md`/specs: (a) `loadAppearance`
  no recibe `{ enemyIds, cellSize }`; la regla de escala es `checkTileScales` llamada desde `bootContent`;
  (b) reserva por elemento dentro de su hueco de capa y no toda al final (§5.2); (c) `startEmptyWithExit`
  como helper. Son coherentes con las specs, pero el design (§12 manda) debería anotarlas o archivarse con el
  diario como referencia.
- W2. Balance en 27/50, en la banda pero cerca del límite inferior (25). Cualquier retoque de velocidad, mapa o
  arte con colisión puede sacarlo de la banda; el gate lo vigila.
- W3. El tope de 300 objetos se verifica en el plan puro (máx. 258) y a demanda en `@realtime`; no hay gate en
  `logic` sobre el objeto real del navegador más allá de la comparación sonda = plan. Informativo, acorde con e2e-lite.

### Suggestion
- S1. Puente norte-sur con el poste superior derecho recortado y astillas de 1 px (anotado en la puerta visual y
  aceptado); valorar ajustar a 64 de ancho en un change posterior.
- S2. Orillas este/oeste (frames 10 y 12) con borde más fino que norte/sur; mejora estética opcional.
- S3. Los enemigos atraviesan el castillo hasta 0018 (deuda aceptada en el gate): registrarla en el backlog.

C: 0 · W: 3 · S: 3
