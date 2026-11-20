# Exploración 0012-sprite-rendering

Intención: sustituir los círculos por sprites animados en el adaptador Phaser, con arte intercambiable editando datos.
Los assets finales no están elegidos (pack del spike provisional; candidato: Pixel Frog "Tiny Swords").

## Contexto actual
- Capas en `src/infrastructure/phaser/`: `EnemyLayer`, `ProjectileLayer`, `GemLayer` (todas sobre `SlotPool`, ADR-0006,
  con la costura `CircleSprite` definida en `EnemyLayer.ts`), `PulseLayer` (anillos por índice, `RingSprite`),
  jugador = un `Arc` creado en `GameScene.create` (`PLAYER_COLOR`) y oculto por `playerVisible` (`playerBlink.ts`).
  Color por tipo en `enemyPalette.ts` (mapa en código, con fallback gris). Constantes de color en cada capa.
- Tests con dobles: `tests/infrastructure/{enemy,projectile,gem,pulse}-layer.test.ts`, `layers-clear.test.ts`,
  `player-blink.test.ts`. `SlotPool` no tiene test propio. La sonda E2E (`tests/e2e/probe.ts`) lee solo el snapshot:
  ningún E2E depende de círculos.
- `GameScene.create` crea los objetos; no hay `preload`. `main.ts` (composition) crea `Phaser.Game` sin opciones de
  `pixelArt` ni `loader`. Escena de menú y escena de juego son dos escenas; el menú es DOM.
- Contenido: `content/*.json` + zod en `src/infrastructure/content/schemas.ts` (`strictObject`) y reglas cruzadas en
  `buildRunRules` (dominio). Enemigos: `bug`, `memory-leak`, `merge-conflict`. Armas: `linter` (proyectil) y `tests`
  (pulso). Snapshots: `EnemySnapshot` trae `type`, `radius`, `damaged`; `ProjectileSnapshot` y `GemSnapshot` NO traen
  el arma/tipo (solo id, x, y, radius).
- CSP en `index.html`: `img-src 'self' data:`; `base` de Vite `/tfm-survivors/`; CI (`ci.yml`) hace verify, build, E2E
  y despliega `dist` a Pages. `public/` no existe. `.gitignore` no menciona `public/` ni PNG.
- Spike (`f88216c`, solo lectura): `spikeSprites.ts`, `SpriteEnemyLayer`, `SpriteProjectileLayer`, `loader.imageLoadType:
  'HTMLImageElement'` por la CSP, escala derivada del radio con constantes mágicas, sin tests.

## Capacidades/specs afectadas
- `auto-weapons` "Indicación visual de daño, proyectiles y pulsos": destello por enemigo, anillo por pulso, sprite por
  proyectil sin residuos (escenario "Sprites de proyectiles"). Hay que preservarlo; el texto habla de "sprite" y vale
  igual, pero el destello pasa de `setFillStyle` a tinte.
- `player-health` "Indicación visual de invulnerabilidad": parpadeo por `playerVisible`; se conserva tal cual.
- `xp-gems`, `hud`, `main-menu`, `simulation-loop` (E2E/sonda): sin cambios esperados. Probable spec nueva
  `sprite-rendering` (aspecto por tipo lógico, fallback, animación por estado) y delta en `auto-weapons`.
- ADR-0006 (sprite ligado al id, "sirve para animaciones de muerte"): aplicable. ADR-0004/0007 CSP: el ajuste de
  `imageLoadType` debe documentarse (nuevo ADR o design). Regla 5 de AGENTS.md: el aspecto es "contenido".
- Deuda GDD: 0009·W2 (sin E2E de sprites tras Volver al menú ni "Cinco ciclos"; la sonda no cuenta sprites) se cierra
  "con el change de arte". Kickoff ya anticipaba simplificar el pipeline de assets cuando llegase el arte.

## Opciones

### A. Manifiesto de aspecto en `content/appearance.json` validado con zod; capas genéricas
Un fichero (o `content/art/<pack>.json`) mapea id lógico -> `{ sheet, frame size, anims por estado (idle/walk/death:
filas/frames/fps/loop), escala o `bodyPx` (para derivar de la hitbox), origen, tinte, flipX }`: jugador, cada enemigo,
tipo de ataque (proyectil), gema. Cruce: cada `enemies.types[].id` debe tener entrada o cae a `default` (placeholder).
- Pros: cumple regla 5 y "cambiar de pack = editar datos"; validación única y testeable; fallo ruidoso en carga.
- Contras: presentación en `content/` junto a balance (convive con `strictObject`; el cruce con enemigos queda fuera de
  `buildRunRules`, que es dominio); hay que decidir el esquema sin conocer el pack final (riesgo de sobre/infra-diseño).

### B. Manifiesto en `src/infrastructure/phaser/` (TS) con lookup tipado
- Pros: más simple, sin pasar por zod, el compilador comprueba exhaustividad frente a un union de ids.
- Contras: cambiar de pack exige tocar código (viola el objetivo); ids de enemigos salen de JSON, no de un union.

### C. Híbrido: manifiesto de *pack* en `public/<pack>/pack.json` (cargado en runtime, validado con zod, junto a los PNG) +
selector mínimo en `content/`
- Pros: el pack entero (imágenes + metadatos) viaja junto y es sustituible sin rebuild; encaja con licencia de no
  redistribución (el pack vive fuera del repo).
- Contras: validación async tras `fetch` (connect-src 'self' ya lo permite), más superficie de error en arranque; la
  regla 6 aplica (entrada externa); más complejidad para una sola máquina de estados.

### Estrategia de assets (ortogonal, 3 sub-opciones)
1. **Versionar** el pack en `public/`: CI/E2E/deploy funcionan; viola la prohibición de redistribuir (Tiny Swords) y la
   licencia del pack actual no está confirmada. Repo público => redistribución efectiva.
2. **No versionar** (`.gitignore`, copia local) + **placeholders procedurales** (texturas generadas con `Graphics.generateTexture`
   o canvas, sin ficheros): CI, E2E y tests pasan sin el pack; en Pages se vería el placeholder salvo que el deploy
   inyecte el pack (descarga privada/secret/artefacto: complica CI y choca con "sin secretos"). Pros: licencia segura.
3. Versionar solo un pack **CC0/propio** pequeño como "pack de referencia" y dejar el final como opción local.

## Riesgos e incógnitas
- Licencia: nadie ha confirmado Tiny Swords ni el pack del spike; el despliegue público (0011) publica `dist/`, que
  incluiría los PNG copiados de `public/` => redistribución. Esto decide la estrategia de assets, no el código.
- Carga asíncrona: hay que añadir `preload` (en `MenuScene` o escena de arranque) para que Jugar no muestre texturas
  ausentes; con `?e2e` arranca directo en `GameScene` (sin menú): el preload debe vivir donde ambas rutas pasen.
- Fallo de carga de una textura: debe degradar al placeholder, no romper la partida ni la CSP (`imageLoadType`).
- Animación de muerte: ADR-0006 libera el hueco al desaparecer del snapshot; el spike usó un pool aparte de 64
  "cadáveres". Hay que decidir su limpieza en `restart()` y en `shutdown` (cierra 0009·W2) y si es un requisito de spec.
- Fiabilidad de tests: `CircleSprite` pasa a una costura distinta (`setTexture/play/setTint/setFlipX/setScale`); los 5
  ficheros de test de capas se reescriben o se añade un adaptador. `GameScene` y `main.ts` no tienen tests unitarios.
- Proyectiles por arma: el snapshot no trae el arma; aspecto por arma exige tocar dominio (fuera de alcance de un change
  de adaptador). Hoy solo hay un arma de proyectil, así que el aspecto por "tipo de ataque" basta.
- `pixelArt: true` cambia el filtrado también del texto/HUD en canvas (verificar); fondo y tamaño de frame (100 px con
  personaje de ~18 px) piden `bodyPx`/escala en datos, no constantes.
- Rendimiento: spike midió 200 enemigos a ~165 fps con balance forzado; con el balance real hay <= 17 vivos. Riesgo bajo.
- Orientación/andar-quieto por delta de posición entre frames: hay que guardar posición previa por hueco; un reinicio
  o reutilización de hueco no debe heredarla (flip/anim incorrecta en el primer frame).
- Fuera de arte: separación de enemigos (horda amontonada, jugabilidad), mapa/tiles, UI, audio.

## Mediciones previas
No procede: no se fija un objetivo de balance ni de ritmo. Sugerencia opcional (no bloqueante): repetir el micro-bench de
200 enemigos animados con las capas del change (umbral >= 60 fps en la máquina de desarrollo) durante `verify`.

## Recomendación orientativa (para decidir en propuesta)
Alcance: personajes (jugador + 3 enemigos), proyectil y gemas ahora; pulso mantiene el anillo; mapa, UI y audio fuera.
Manifiesto A (con un `default`/placeholder procedural siempre presente) + assets NO versionados hasta resolver licencia,
con CI en verde gracias al fallback. Estrategia de despliegue público pendiente de la respuesta de licencia.

## Preguntas para el usuario
1. Licencia: ¿aceptas que el repo no contenga el pack (y el sitio público de Pages use placeholders) hasta decidir el
   arte? ¿O prefieres adoptar un pack CC0/propio como referencia versionada ya?
2. ¿Dónde debe vivir el manifiesto: `content/*.json` con zod (A) o también el pack con sus metadatos junto a los PNG (C)?
3. ¿La animación de muerte entra en este change (requisito de spec y E2E de limpieza 0009·W2) o se difiere?
4. ¿Gemas y proyectil con sprite del pack o conservan formas procedurales simples? ¿Anillo de pulso sin cambios?
5. ¿Hay que seguir mostrando el placeholder geométrico en tests/E2E por defecto (modo "sin arte") o el procedural basta?
6. ¿Se acepta tocar el snapshot (añadir `weapon` al proyectil) si se quiere aspecto por arma, o se difiere a otro change?
