# Spec delta · progress-persistence

<!-- Ruta: openspec/changes/0008-e2e-fast-sim/specs/progress-persistence/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Motivo: con una sola derrota no se puede seguir el orden literal "exporta → recarga → importa", porque importar
> exige el overlay de resultados (otra partida terminada). El bucle parte de progreso sembrado en `localStorage`,
> importa antes de recargar y comprueba la CSP en las dos cargas. El comportamiento del juego no cambia.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Política de seguridad de contenido
La página del juego SHALL declarar una política de seguridad de contenido (CSP) con
`<meta http-equiv="Content-Security-Policy">` en `index.html` que:
- tenga `default-src 'self'` y `object-src 'none'`;
- MUST NOT permitir en `script-src` (ni en `default-src`) `'unsafe-inline'`, `'unsafe-eval'` ni orígenes distintos
  de `'self'`;
- MUST NOT permitir conexiones a orígenes externos.

Con esa política, la build de producción MUST arrancar, jugar, exportar e importar sin ninguna violación de CSP.

#### Scenario: CSP presente y restrictiva
- **GIVEN** el `index.html` de la build de producción
- **WHEN** se lee su `<meta http-equiv="Content-Security-Policy">`
- **THEN** existe exactamente una, contiene `default-src 'self'` y `object-src 'none'` y no contiene
  `'unsafe-eval'`, ni `'unsafe-inline'` en `script-src`, ni `http:`, `https:` o `*` como origen

#### Scenario: Sin violaciones en el bucle completo
- **GIVEN** la build de producción servida con `?seed=42` y un progreso válido P0 con 1 entrada de historial ya
  guardado en `localStorage` antes de la carga
- **WHEN** una prueba E2E juega hasta la derrota (la única partida que juega), exporta el progreso, importa el
  fichero exportado, importa otro fichero válido F (1 entrada de historial) con al menos un récord mayor que los
  guardados y recarga la página
- **THEN** en ninguna de las dos cargas (antes y después de recargar) se registra ningún evento
  `securitypolicyviolation` ni mensaje de consola de violación de CSP
- **AND** tras la recarga, el progreso cargado coincide con el resultado de fusionar P0, la partida jugada, el
  fichero exportado y F, con exactamente 3 entradas de historial

## REMOVED Requirements
<!-- Ninguno. -->
