# ADR-0015 · Radio del anillo de aparición como contenido, sin vista en el núcleo

- **Estado**: propuesta (change 0017-fullscreen-view)
- **Fecha**: 2026-11-23
- **Complementa**: ADR-0002 (núcleo de simulación puro y determinista)

## Contexto
Desde el change 0002 el radio del anillo de aparición se calculaba con la vista de contenido:
`ringRadius = View.halfDiagonal + margin`, que daba 582,7 con 960 × 540 y margin 32. Era determinista porque la
vista era un valor fijo de contenido. Con el lienzo a ventana completa (ADR-0014), la vista real cambia con cada
monitor y en cada redimensionado. Si siguiera alimentando el anillo:
- la misma semilla daría partidas distintas en monitores distintos;
- el balance calibrado con el bot (semillas 1..50) dejaría de ser reproducible;
- el núcleo dependería de un dato de la pantalla, en contra de ADR-0002.

## Opciones
1. **Radio explícito en contenido** (`waves.spawn.ringRadius`): `View` se borra del dominio.
2. **Vista de referencia de contenido** (una `View` ficticia, por ejemplo el tope) + `margin`: se mantiene la
   fórmula, pero el dominio sigue modelando una "vista" que no es la real y que engaña al lector.
3. **Radio a partir de la ventana real congelada al empezar la partida**: es determinista dentro de una partida pero
   no entre máquinas, así que rompe el balance y la reproducción por semilla.

## Decisión
**Opción 1.**
- `SpawnRules.create(config)` recibe `ringRadius` (finito y > 0) y deja de recibir `View`. `margin` desaparece.
- Se borran `View` y `RunRules.view`.
- Valor: **1.500** (media diagonal del tope de vista de 2.560 × 1.440, 1.468,7, + 32, redondeado).
- La intención de "nacer fuera de la vista" la protege una regla de **infraestructura** al validar el contenido:
  `ringRadius ≥ hypot(maxView) / 2`, con el error en `waves.spawn.ringRadius`. El núcleo no conoce el tope.

## Consecuencias
- Positivas:
  - Ninguna entrada del núcleo depende de la pantalla.
  - La igualdad tick a tick entre tamaños de ventana es estructural.
  - Hay un parámetro de balance explícito y medible.
- Negativas / costes:
  - Los enemigos nacen más lejos (≈ 1.500 frente a ≈ 583) y tardan más en llegar. Las oleadas se recalibran
    (change 0017: 27/50 victorias y 0 quietos vivos).
  - Cerca de los bordes del mundo el recorte del anillo puede hacer que un enemigo nazca dentro del área visible
    (aceptado).
  - Si se sube el tope de vista, hay que revisar `ringRadius` (la validación lo exige).
- Cómo revertirla: volver a calcular el radio con una vista de contenido (opción 2) es local a `SpawnRules` y
  `RunConfig`, pero obliga a volver a medir el balance.
