# 2026-11-25 · GDD · recurso piedra y renumeración 0025–0028

- El autor propuso un recurso nuevo, la piedra, porque las torres de caballeros son de piedra como el castillo.
  La idea era que los enemigos la soltaran al morir en lugar de oro, y le preocupaba que el pack con licencia no
  tuviera arte de piedra.
- El orquestador (Claude Code, claude-opus-5-5) revisó el pack local `Tiny Swords (Update 010)`. No hay un icono de
  piedra como recurso, pero `Deco/04.png`, `05.png` y `06.png` son rocas de 64 × 64 (CC0) que sirven como
  recogible. Descartó `Terrain/Water/Rocks` porque llevan espuma de agua, y el Free Pack por la licencia.
- Recomendó soltar la piedra **además** del oro por baja, no en su lugar: el oro por baja alimenta la tienda de 0024
  y su balance (30/50). También recomendó sacar la tirada de un flujo de azar propio para no alterar las firmas
  doradas. El autor lo aceptó y pidió un change aparte antes de `build-sites`, con el resto renumerado.
- El subagente `game-designer` editó solo `docs/gdd.md`:
  - Añadió la historia 0025 `stone-resource` con criterios Given/When/Then.
  - Dejó la torre propia con coste de madera + piedra en 0026 `build-sites`.
  - Renumeró build-sites → 0026, goblin-tower-archers → 0027 y characters → 0028, con una nota de renumeración
    junto a las anteriores.
- No se tocaron los ADRs (son históricos) ni la spec viva `resources` (solo cambia al archivar). Su "Gastar madera es
  de 0025" se corregirá al archivar 0025.
- Quedan abiertos para el explore/design de 0025: la probabilidad por tipo, `maxStone` y qué roca va en el suelo y
  cuál en el HUD.
- A petición del autor, el orquestador marcó 0023 y 0024 como hechos en la fila MoSCoW y en la tabla de pendientes
  del GDD (PR #58/#59 y #60/#61).
