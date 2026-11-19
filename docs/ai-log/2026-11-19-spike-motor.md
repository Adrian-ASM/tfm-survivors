# 2026-11-19 · spike del motor (ADR-0001)

- **Herramienta / modelo**: Claude (Opus 5.5) desde la app de Claude, con tres conectores: GitHub (rama y commits
  remotos), Desktop Commander (terminal en el PC) y el navegador integrado de la app (medición de FPS).
- **Objetivo**: comparar Phaser 4, Kaplay y Canvas 2D con el mismo escenario y cerrar ADR-0001.
- **Resultado**: aceptado. Phaser 4.2.1 elegido; aguanta 20.000 entidades a 165 FPS, mientras que Kaplay cae a
  80 FPS con 2.000 y Canvas 2D tiene tirones a 5.000. Detalle en `spikes/engine/README.md` (rama `spike/engine`).
- **Decisiones**: simulación común y motor como simple pintor (valida ADR-0002 antes de escribir el núcleo real).
- **Incidencias de la IA**:
  - El código se escribió primero sin poder ejecutarlo y aun así funcionó a la primera en los tres motores.
  - Conector de GitHub: 403 "Resource not accessible by integration" hasta instalar la app correcta
    ("Claude Github MCP Connector") con permisos de escritura. Un commit subió solo 1 de 6 ficheros por error
    del agente; se completó con un segundo commit (`1dccc6c` + `e055b55`).
  - Al sincronizar el repo local, el clasificador de seguridad bloqueó un `git stash drop` (borrado). Se rehízo sin
    borrar nada: el stash queda guardado (`stash@{0}`) para que el autor lo elimine.
  - `npm` bloqueado en PowerShell por la política de ejecución; se usó `npm.cmd`.
- **Lección aprendida**: medir con la máquina del autor y el navegador integrado da evidencia reproducible sin
  intervención manual. Desde la app los hooks de Claude Code no se ejecutan: las fases de implementación siguen
  necesitando ESLint y CI como guardarraíles (o Claude Code para tener también los hooks).
