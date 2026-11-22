# 2026-11-20 · Spike `spike/sprites`: sprites animados en lugar de círculos

- **Herramienta / modelo**: Claude Code (claude-opus-5-5) como orquestador, a petición del usuario. Spike
  desechable (AGENTS.md §5, "incierto"), sin change SDD ni subagentes; rama `spike/sprites`, nunca se fusiona.
- **Pregunta**: ¿cuesta mucho pasar de círculos a sprites animados de un pack externo, y se lee bien una horda?
- **Assets**: pack gratuito "Tiny RPG Character Asset Pack v2.0 (Soldier & Orc)", aportado por el usuario. Tiras PNG
  de frames 100×100 (Idle/Walk/Attack/Hurt/Death) y `.aseprite`. Copiados a `public/spike-sprites/` y excluidos con
  `.git/info/exclude`: **no se versionan** (licencia sin confirmar, sin fichero de licencia en el pack).
- **Qué se hizo** (solo `src/infrastructure/phaser` y `src/composition/main.ts`; dominio y aplicación intactos):
  - `spikeSprites.ts`: `load.spritesheet` + `anims.create` por tira; escala derivada del radio de la hitbox.
  - `SpriteEnemyLayer`: mismo `SlotPool` (ADR-0006) con `Sprite`; orientación por desplazamiento entre frames,
    destello de daño con `setTint` + `TintModes.FILL` (API de Phaser 4), tinte por tipo de enemigo y un pool de 64
    "cadáveres" que reproduce la animación de muerte al liberar un hueco.
  - `SpriteProjectileLayer`: flecha rotada con `atan2` del desplazamiento.
  - Jugador: andar/quieto/muerte y volteo derivados del snapshot.
  - `pixelArt: true` y fondo verde.
- **Hallazgos**:
  - **La CSP de 0007 bloquea las imágenes**: el Loader de Phaser descarga por XHR y crea URLs `blob:`, que
    `img-src 'self' data:` no permite. Solución sin relajar la CSP: `loader.imageLoadType: 'HTMLImageElement'`.
  - El personaje ocupa ~18 px del frame de 100: hay que escalar ~2-4× y separar escala visual de hitbox.
  - El snapshot basta: no hizo falta tocar el dominio (orientación y andar/quieto salen del delta de posición).
  - **Rendimiento**: 200 enemigos animados (tope `maxAlive`) a ~165 fps (refresco del monitor), sin caídas.
    Para provocarlo se subieron temporalmente la vida del jugador y de los enemigos en `content/` y se revirtió.
  - **Legibilidad**: sin separación entre enemigos, la horda converge en un único bulto sobre el jugador. Es un tema
    de jugabilidad (dominio), no de arte; candidato a change propio.
  - Con el balance actual las armas limpian la pantalla (≤ 17 vivos a los 6 min): "cientos" no ocurre hoy.
- **Conclusión**: pasar a sprites es un change de adaptador de tamaño medio-bajo. Para el change real: manifiesto
  de aspecto en `content/` validado con zod (hoja, escala, tinte, animaciones por estado), tests de las capas con
  dobles, decisión de licencia del pack definitivo y el ajuste de `imageLoadType` documentado en el design.
