# 2026-11-23 · 0018-map-culling · explore + propose

- Origen: deuda de 0017 (PR #41). Con el mundo 3.840 × 2.160, la rejilla 64 × 36 y la ventana E2E de 1.280 × 720,
  los E2E del mapa real tardan el doble en CI. Esta sesión la abrió otra sesión de Claude Code con la tarea de
  explorar y proponer el recorte del render del mapa.
- Rama `change/0018-map-culling`: el worktree de la app se rebasó sobre `origin/main` (35256f6, con 0017).
- Mediciones previas (orquestador, sin subagente):
  - Duraciones de CI leídas de los logs de los jobs `e2e`: run 45256417145 (0016) y run 45279626178 (0017). No se
    lanzó ningún workflow.
  - En local, `CI_LIKE=1 npx playwright test --project=realtime --grep "calibration|\[map\]"`. Semilla 42: 667
    objetos a 14,1 fps. Semilla 123: 750 objetos a 12,9 fps. Calibración: 16,5 fps, p95 de 133,3 ms.
  - El orquestador copió estos números a la sección Mediciones de `exploration.md`. Es la única edición fuera de
    los subagentes.
- `npm.cmd run …` desde Git Bash falló con "El sistema no puede encontrar la ruta especificada". Con `npx
  playwright` funcionó.
- Subagentes: `sdd-explorer` (exploration.md) y `sdd-spec-writer` (proposal.md). Recomiendan la opción A: `bounds`
  por objeto en el plan puro, una regla de visibilidad pura y `setVisible` en el adaptador. Phaser 4.2.1 no
  recorta por objeto fuera de `TilemapLayer`.
- Gate humano pendiente: si va como change propio o dentro del flow-field, si se retira `test.slow()`, si basta
  con mejorar, y si el margen es fijo o proporcional.
- Gate (usuario, 2026-11-23): **change propio**; flow-field → 0019. Preguntas 2–4 siguen abiertas.
