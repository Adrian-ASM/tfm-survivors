# ADR-0026 · Solar libre bloqueante y oferta de obra por contacto

- **Estado**: propuesta (change 0027-site-contact, design 2026-11-25)
- **Fecha**: 2026-11-25

## Contexto
En 0026 (ADR-0025) el solar libre es hierba: el jugador y los enemigos lo cruzan. La oferta de obra se abre en un
punto de acceso invisible (1,5 celdas bajo la huella, radio 40, re-armado a 160) y solo si algo es asequible. El
jugador no encuentra el acceso y no entiende por qué no pasa nada. El usuario aprobó (proposal 0027) que el solar
sea un obstáculo desde el tick 0 y que la oferta se abra siempre al tocarlo.

Hay que decidir tres cosas:
- cómo representar el solar libre en la capa de obra;
- qué pasa con `revision` y con sus lectores (`FlowField`, `GuardPost` y el filtro de ovejas
  `revision > 0`);
- cómo evitar que el modal se reabra al rozar el solar.

## Opciones
1. Reutilizar `BUILT` (5) para el solar libre y marcar las huellas al crear la partida.
2. Un código nuevo `SITE` (6), no caminable, que pasa a `BUILT` al construir.
3. Re-armado: (a) al dejar de tocar, (b) por histéresis de distancia desde el borde de la huella o (c) con
   temporizador.

## Decisión
- **Opción 1.** Ningún consumidor del mapa distingue un solar libre de un edificio. El estado vive en
  `BuildSite`, y el despeje y los puestos de guardia deben tratar los dos igual. `BUILT` pasa a significar
  "celda de la capa de obra".
- `GameMap.build` sube `revision` **solo si cambia alguna celda**. Construir sobre un solar ya marcado no
  invalida campos.
- El filtro de reapariciones de ovejas deja de depender de `revision > 0`: usa siempre `overlapsBlocked`, que es
  lo mismo que se midió en el prototipo.
- **Contacto**: hueco entre el círculo del jugador y el rectángulo de la huella ≤ `CONTACT_EPS` (1 px, constante
  de dominio).
- **Re-armado (b)**: hueco ≥ `contact.rearmDistance` (64 px, `buildings.json`, zod > ε). La (a) reabre al rozar
  o "picar" la pared. La (c) reabre estando pegado.
- La oferta se abre siempre y lleva las dos opciones con `affordable` y lo que falta.
- Se retira el punto de acceso del contenido, del dominio, del snapshot y de la sonda. `ProximityGate` queda
  solo para la tienda.
- La colocación (`placeSites`, `SITE_STREAM` 7) no cambia: la fila de referencia bajo la huella se mantiene para
  que `SITE_GOLDEN` no cambie.

Prototipo (rama desechable, opción 1 con re-armado a): v4 34/50, v5 34/50, 0 quietos. Solo cambia
`STONE_GOLDEN`.

## Consecuencias
- Positivas:
  - El solar se lee como un lugar y se encuentra solo.
  - Hay una única representación de la obra.
  - La revisión cumple "cambia si y solo si cambia la caminabilidad".
  - Construir deja de recalcular los campos de flujo.
- Negativas / costes:
  - El bloqueo cambia las trayectorias en todas las semillas: se regeneran `BALANCE_BASELINE`, la referencia
    del v5 y `STONE_GOLDEN`.
  - Hay que reescribir unos 92 tests del acceso.
  - El v4 queda cerca del techo de la banda.
  - Pasar rozando un solar armado abre el modal. Lo mitiga la histéresis, y X se ajusta en el contenido.
  - `BUILT` deja de significar solo "construido".
- Cómo revertirla:
  - no marcar las huellas al empezar;
  - restaurar `access` + `ProximityGate` en `BuildSite`;
  - recuperar la condición "algo asequible" en `Settlement.step`.

  La revisión idempotente se puede quedar.
