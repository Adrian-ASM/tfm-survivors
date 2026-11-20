# 2026-11-20 · MCP de documentación de Phaser

- **Herramienta / modelo**: Claude Code (claude-opus-5-5) como orquestador, a petición del usuario y sin change SDD
  (configuración pequeña y clara, AGENTS.md §5).
- **Investigación**: Phaser ofrece tres integraciones con IA:
  - **Phaser Game Agent / Phaser AE**: genera juegos completos desde una descripción. Es de pago: build por minuto
    y créditos. Se descarta porque no respeta el núcleo puro, el SDD ni los gates, y el código no lo escribirían los
    subagentes del proyecto.
  - **MCP de Phaser Editor v5**: trabaja sobre escenas del editor de escritorio. Se descarta porque las escenas del
    proyecto son TypeScript escrito a mano y su doc dice que no modifica código fuente.
  - **MCP de documentación** (`https://phaser.io/oss/docs/mcp`): público, sin token. Expone `search_phaser_docs`,
    `read_phaser_doc` y `list_phaser_docs`. **Adoptado.**
- **Motivo**: los modelos mezclan las API de Phaser 3 y 4. Precedente: en 0005, `JustDown` no funcionaba como se
  esperaba en Phaser 4.2.1 y solo lo destapó el E2E.
- **Comprobación**: `initialize`, `tools/list` y una búsqueda respondieron sin autenticación. La API publicada más
  reciente es la **4.1.0**, por detrás de la 4.2.1 instalada; por eso los tipos de `node_modules/phaser` siguen
  mandando en caso de duda.
- **Cambios**:
  - `.mcp.json` con el servidor `phaser-docs`.
  - En `.claude/settings.json`: `enabledMcpjsonServers` y permiso para sus tres herramientas.
  - Herramientas e instrucción de uso añadidas a `sdd-architect` y `sdd-implementer`, los únicos que deciden o
    escriben código del adaptador.
  - Puntero en AGENTS.md §9.
- **Privacidad**: las consultas salen a phaser.io y solo contienen términos de API, sin datos del usuario ni del
  repo.
- **Pendiente**: medir en 0007 si los subagentes lo usan y si evita errores de API; anotarlo en la retrospectiva.
