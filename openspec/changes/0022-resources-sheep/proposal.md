# Proposal · 0022-resources-sheep

- **Estado**: aprobado (2026-11-24). Preguntas abiertas resueltas con las recomendaciones: veta al pasar (un uso,
  queda agotada); sin tipo `meat`; el barril que detona su propia mecha no suelta madera; oro y madera fuera de la
  pantalla de resultados.
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0022-resources-sheep`
- **Base**: `exploration.md` de este change y `docs/gdd.md` (§ Recursos, pilar 2 "Explorar se recompensa").
- **Decisiones del usuario (2026-11-24)**: alcance **B** (recogibles con tipo + oro y madera; ovejas, carne y
  curación pasan a un change propio tras 0022).

## Problema
Hoy lo único que se recoge en la partida son las gemas de XP, y su aspecto es la bolsa dorada (`G_Idle`), que
según el GDD debería ser el oro. El mapa generado (0015–0021) tiene castillo, río, casas y torres goblin, pero
explorarlo no da nada: destruir un campamento o alejarse del inicio no se recompensa (pilar 2 del GDD). Los
changes siguientes (0023 castillo-tienda y 0024 solares de obra) necesitan que existan **oro** y **madera** como
recursos de la partida antes de poder gastarlos.

## Objetivo
Al terminar el change, en una partida con el mapa generado:
- Las gemas de XP son un caso de **recogible con tipo** (`xp`, `gold`, `wood`); los tres comparten imán y
  recogida por solape, y la XP se comporta exactamente como hoy.
- El jugador acumula **oro** y **madera** en la partida, visibles en el HUD (icono + número), aunque todavía no se
  puedan gastar.
- Fuentes de recursos, todas deterministas y sin consumir el azar de oleadas:
  - **Barril goblin** derrotado → suelta madera.
  - **Casa y torre goblin** (0021) al quedar en ruina → sueltan oro.
  - **Montones de madera** y **vetas de oro** (`GoldMine` de Update 010; el pack no trae cofre) colocados por el
    mapa generado con un flujo de azar propio `RESOURCE_STREAM` (4), lejos de la zona de inicio y sin invadir
    castillo, agua ni huellas de estructuras.
- La bolsa dorada pasa a ser el aspecto del oro; la XP recibe un aspecto nuevo.

## Alcance
- **Dentro**:
  - Generalizar `GemField`/gemas a recogibles con tipo cerrado `xp | gold | wood`: valor por pieza, imán y recogida
    comunes; la recogida de XP alimenta la progresión como hoy y la de oro/madera, contadores de la partida.
    Comportamiento con el tope del pool lleno definido **por tipo** (no se mezcla XP con oro ni madera).
  - Contadores de oro y madera en el estado de la partida y en el snapshot (empiezan en 0, solo suben).
  - Drops de madera del barril y de oro de casas y torres al destruirse; cantidades fijas en `content/` (las fija el
    design; no tienen efecto en el juego hasta 0023/0024).
  - Colocación por semilla de montones de madera y vetas de oro con `RESOURCE_STREAM` 4: `MAP_GOLDEN` y
    `STRUCTURE_GOLDEN` intactas; firma dorada nueva de recursos para las semillas de referencia.
  - **Veta: se recoge al pasar** (decisión recomendada, ver abajo). No bloquea, no tiene vida y no es objetivo de
    las armas; al contacto del jugador entrega su oro una sola vez y queda agotada (`GoldMine_Inactive`).
  - Montones de madera: recogibles de tipo `wood` ya presentes al empezar la partida (los atrae el imán como a
    cualquier otro).
  - Render: aspectos por tipo (oro = `G_Idle`, madera = `W_Idle`, XP = aspecto nuevo con reserva de color), vetas
    en el plan de arte del mapa y en el recorte por cámara (0018), sondas E2E con recuentos por tipo.
  - HUD: contadores de oro y madera con icono y número, recolocados por `hudLayout` en cada RESIZE.
  - Arte nuevo copiado de Update 010 con entrada en `content/asset-provenance.json` en la misma tarea.
- **Fuera**:
  - **Ovejas, carne y curación**: van a un change propio tras 0022. Nota para ese change (decisión del usuario):
    curación de cantidad fija por pieza con tope en la vida máxima; solo las ovejas sueltan carne.
  - **Gastar** oro o madera: 0023 (castillo-tienda) y 0024 (solares de obra).
  - Guardar recursos en récords o historial (`progress-persistence` sin cambios) y mostrarlos en la pantalla de
    resultados.
  - Talar árboles (sigue *Could*), cofres (no hay en el pack), campamentos de guardianes en zonas ricas
    (`goblin-guard-camps`, tras 0022).
  - Recalibrar el balance o cambiar el bot de referencia (sigue el v3, que no busca recogibles).

### Decisiones tomadas en la proposal
1. **Veta al pasar, no como objetivo de las armas.** Es lo más simple: no toca la selección de objetivos de
   `auto-weapons` ni el orden de armas sobre estructuras de 0021, no añade vida ni ruina, y no cambia en qué gasta
   el arma sus disparos (que sí podría mover el balance). Como no bloquea, tampoco toca celdas, campo de flujo ni
   `MAP_GOLDEN`. Alternativa descartada: veta con vida que las armas atacan (más coherente con las estructuras,
   pero duplica la lógica de 0021 y entra en el criterio de objetivos).
2. **No se declara todavía el tipo `meat`.** No hay ninguna fuente de carne en este change ni efecto de curación:
   un tipo sin productor ni consumidor sería código y escenarios no verificables (YAGNI). El tipo es una unión
   cerrada validada con zod; añadir `meat` en el change de ovejas es ampliarla sin romper nada.
3. **Aspecto de la XP**: lo decide el design entre otro sprite de Update 010 (con procedencia) o una reserva de
   color; el requisito es que XP, oro y madera sean distinguibles y que cada tipo tenga aspecto de reserva si su
   hoja no carga.

## Capacidades afectadas
- `openspec/specs/xp-gems` (modificada; reescritura grande: gemas → recogibles con tipo, tope por tipo).
- `openspec/specs/resources` (nueva: contadores de oro y madera, fuentes, montones y vetas).
- `openspec/specs/goblin-structures` (modificada: oro al quedar en ruina).
- `openspec/specs/enemy-hazards` / `enemy-behavior` (modificada: madera del barril derrotado; el design concreta
  en cuál vive la muerte del barril).
- `openspec/specs/procedural-map` (modificada: colocación de montones y vetas con `RESOURCE_STREAM`).
- `openspec/specs/simulation-loop` (modificada: orden del tick para drops y recogida, snapshot con tipo y
  contadores, determinismo con el flujo nuevo).
- `openspec/specs/hud` (modificada: contadores de oro y madera).
- `openspec/specs/sprite-rendering` (modificada: aspectos por tipo, vetas activa/agotada, sondas).
- `openspec/specs/asset-provenance` (sin cambio de requisitos previsto; solo entradas nuevas en el manifiesto).
- Sin cambios: `leveling` (la XP sigue igual), `player-health` (sin curación), `enemy-spawning`, `run-outcome`,
  `run-results`, `progress-persistence`.

## Riesgos y dudas
- **Tope del pool compartido**: si montones de madera y drops de oro ocupan huecos de `maxGems` (300), una partida
  con muchas gemas podría cambiar cómo se suelta la XP y mover el balance. Mitigación: tope por tipo o pool
  ampliado; el design lo decide y el gate de balance lo vigila.
- **Determinismo**: la colocación usa solo `RESOURCE_STREAM`; drops con cantidades fijas y sin azar. Cualquier
  consumo del azar de oleadas desplazaría las 50 semillas.
- **Barril que detona su mecha**: hay que fijar si suelta madera solo al morir por armas/explosión ajena o también
  al explotar él mismo (pregunta para el gate; recomendación: solo si no muere por su propia detonación, para
  que la madera premie matarlo antes).
- **Rendimiento**: lote de balance hoy ~30 s local (~85 s CI, tope 90 s). Los recogibles con tipo no deberían
  añadir trabajo apreciable por tick, pero las mediciones de coste por tick (lote y bench con pool lleno de los
  tres tipos) van en design/apply, antes de cerrar el grupo de dominio. No hacen falta mediciones de curación.
- **Objetos del mapa**: las vetas (y los montones, si el design los pinta en el plan del mapa) suman objetos y
  entran en el recorte por cámara; tope ≤ 1.000 en 42/123 (hoy 695/778).
- **Tamaño del change**: toca dominio, contenido, mapa, render, HUD y arte. La retro de 0021 avisa de apply
  largo; las tareas deben agruparse por capa y por escenario.
- **GDD desfasado** (seguimiento, no se edita aquí): la fila "0022 resources-sheep · Recursos recogibles con tipo y
  ovejas" y la línea de carne en § Recursos necesitan renumeración: las ovejas pasan a un change propio tras
  0022 (y `goblin-guard-camps` sigue "tras 0022"). El nombre del change se mantiene por la rama ya creada.

## Criterio de éxito
- Todos los escenarios de las specs delta en verde con `npm run verify`.
- **Balance sin recalibrar**: 27/50 victorias y 0 quietos con el bot v3 sobre las semillas 1..50 (los recursos no
  afectan al combate ni consumen el flujo de oleadas); el lote de balance no crece de forma apreciable (≤ 35 s
  local como referencia; tope CI 90 s).
- `MAP_GOLDEN` y `STRUCTURE_GOLDEN` sin cambios; firma dorada de recursos estable para las semillas de referencia.
- ≤ 1.000 objetos del mapa en las semillas 42 y 123 contando vetas y montones (test sin navegador en `verify`).
- Todo PNG nuevo con entrada en `content/asset-provenance.json` (sha256, bytes) y nada del Free Pack
  (`guard:all` en verde).
- Como máximo 1–2 E2E nuevos, preferiblemente ampliando el de mapa real (contadores del HUD y recuentos por tipo
  en la sonda).

## Preguntas abiertas para el gate
1. ¿Confirmas la veta "al pasar" (agotada tras un uso, sin vida ni objetivo de armas)?
2. ¿Confirmas no declarar `meat` hasta el change de ovejas?
3. Barril que detona su propia mecha: ¿suelta madera o no? (recomendado: no).
4. ¿El oro y la madera se muestran en la pantalla de resultados? (recomendado: no en este change).
