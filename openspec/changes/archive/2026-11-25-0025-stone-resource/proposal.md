# Proposal · 0025-stone-resource

- **Estado**: aprobado (2026-11-25)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0025-stone-resource` (`.claude/worktrees/game-assets-strategy-245862`)
- **Origen**: GDD, historia Should 0025 `stone-resource`, y exploración en `exploration.md` (se adopta la opción A).

## Problema
El change 0026 `build-sites` cobrará las torres de caballeros en madera + piedra, y hoy la piedra no existe. Los
recogibles son `xp | gold | wood | meat` y ningún enemigo suelta otro material que oro y madera. Si no se mete antes
una fuente de piedra, determinista y medida aparte, 0026 tendría que inventar el recurso y los solares a la vez. Además
correría el riesgo de tocar la economía del oro, que ya está calibrada con la tienda de 0024.

## Objetivo
Al morir, un enemigo puede soltar una piedra. La probabilidad depende de su tipo y la tirada sale de un flujo de azar
propio de la partida. El jugador recoge la piedra como cualquier otro recogible y el HUD muestra su número junto al
oro y la madera. La piedra todavía no se gasta. Con la misma semilla y la misma entrada caen las mismas piedras. Las
oleadas, el mapa, las estructuras, los recursos, las ovejas y el balance son idénticos a la línea base de 0024,
semilla a semilla.

## Alcance
- **Dentro**:
  - **Quinto tipo de recogible `stone`** en la unión cerrada (`xp | gold | wood | meat | stone`). Tiene tope propio
    `maxStone`; al llegar al tope, el relleno suma a la piedra más antigua, como en los demás tipos. Comparte la lista
    única, la secuencia de ids y el pool de Σ topes. Se recoge como el resto (radio de recogida e imán).
  - **Probabilidad por tipo de enemigo** en `content/` (validada con zod, sin números mágicos). Es un **porcentaje
    entero en 0..100** y cada tipo del catálogo declara el suyo, así que los tipos pueden diferir. Con 0, el tipo
    no suelta piedra nunca. Decidido.
  - **Una piedra de valor 1 por baja que suelta**. El tipo de enemigo fija en contenido el aspecto de la roca
    (`Deco/04` pequeña, `05` mediana, `06` grande), que es solo visual: elegirlo no gasta azar ni cambia el valor.
    Decidido.
  - **El barril que explota por su mecha (`Enemy.detonated`) no suelta piedra**, igual que con la madera. Las demás
    bajas sí tiran, mueran por armas o por explosiones. Decidido.
  - **Flujo de azar propio de la piedra** (opción A de la exploración). Sale de la semilla de la partida y existe
    **en todo mapa**: generado, `open` (`map=empty` en E2E) y `cells`. La tirada se hace al procesar la baja, después
    de la madera y el oro, en el orden de bajas que ya es determinista. No consume el generador de oleadas ni los
    flujos de mapa, decoración, estructuras, recursos u ovejas. Por eso `MAP_GOLDEN`, `STRUCTURE_GOLDEN`,
    `RESOURCE_GOLDEN`, `SHEEP_GOLDEN` y las oleadas no cambian. Hay una firma dorada nueva con la secuencia de piedras
    caídas para una semilla y una entrada fijas. Decidido.
  - **Contador de piedra de la partida**: lo suma la recogida, sin bonificaciones (no hereda `goldBonusPercent`).
    Empieza en 0, aparece en el snapshot de recursos y no se guarda ni sale en resultados, récords ni historial.
  - **HUD**: icono y número de piedra junto a los de oro y madera, en las escalas de UI ×1 y ×2.
  - **Render y arte**: las hojas `Deco/04.png`, `05.png` y `06.png` de Tiny Swords Update 010 (CC0) se copian a
    `public/assets/tiny-swords/Deco/`, cada una con su entrada en `content/asset-provenance.json` (sha256 y bytes
    reales; nada del Free Pack). La piedra tiene aspecto de reserva por si su hoja no carga. La sonda E2E cuenta las
    piedras (`sprites.pickups.stone`) y el HUD expone el contador de piedra.
  - **Valores de contenido**: `maxStone` y las probabilidades por tipo son datos de contenido. Se eligen en
    **design**, sin mediciones previas obligatorias. La spec fija reglas y validación, no esos números.
  - **E2E**: como mucho 1, mejor ampliando un test de la suite de humo `logic` (modo manual, `step(n)`). El resto de
    escenarios se cubre con tests unitarios o de aplicación.
- **Fuera**:
  - Gastar piedra. Solares, casas y torres propias son de 0026 `build-sites`.
  - Cambiar el oro por baja, la madera del barril, las vetas, los montones o la tienda.
  - Piedra de estructuras, vetas o montones de piedra en el mapa, o piedra que dependa del tamaño de la roca (el
    valor es siempre 1).
  - Guardar la piedra, enseñarla en resultados, récords o historial, o exportarla.
  - Mejoras o bonificaciones que afecten a la piedra.
  - Recalibrar oleadas, curva de XP, `player.speed` o el bot de referencia (el bot no lee recogibles).
  - Avisos visuales o sonido al recoger piedra.

## Capacidades afectadas
- `openspec/specs/resources` (modificada): fuente "piedra por enemigo abatido" junto a "oro por enemigo abatido",
  exclusión del barril detonado, contador de piedra, validación del contenido nuevo y "recursos sin efecto en el
  combate" ampliado a la piedra.
- `openspec/specs/xp-gems` (modificada): quinto tipo `stone` en la unión de recogibles, tope `maxStone` y pool de
  Σ topes.
- `openspec/specs/simulation-loop` (modificada): flujo de azar nuevo y su orden de consumo en la baja, recogida con
  cinco tipos, snapshot de recursos con piedra y determinismo con la firma dorada nueva.
- `openspec/specs/hud` (modificada): contador e icono de piedra junto a oro y madera.
- `openspec/specs/sprite-rendering` (modificada): aspecto de la piedra por tipo de enemigo, reserva y sonda
  `sprites.pickups.stone`.
- `openspec/specs/asset-provenance` (modificada): entradas de `Deco/04`, `05` y `06`.
- Por contraste, sin cambios de comportamiento previstos: `enemy-spawning` y `procedural-map` (firmas doradas y
  oleadas intactas), `sheep` (`SHEEP_GOLDEN` intacta), `run-results` y `progress-persistence` (la piedra no se guarda
  ni sale; la exclusión se fija en `resources`), `castle-shop` (el oro no cambia).

## Riesgos y dudas
- **Balance idéntico, por construcción y comprobado**: la piedra no toca `Run.random`, los otros flujos, la vida, el
  oro ni el bot. Pero ocupa ids de la secuencia única y plazas del pool, así que puede desplazar los ids de los
  recogibles posteriores. Hay que confirmar que `balanceMeasure` y los tests de escenario no dependen de ids
  contiguos ni absolutos. Si algo cambia, se corrige la medición, no la línea base.
- **Coste del flujo nuevo en la firma de arranque**: `RunSeeding`/`Run.start` reciben el flujo de piedra. Los tests
  que montan la partida a mano necesitan un valor por defecto, y con él la piedra no debe caer nunca, para que los
  escenarios actuales no cambien.
- **Consumo de azar**: hay que fijar en la spec cuántos valores consume cada baja (por ejemplo, uno por baja de tipo
  con probabilidad > 0, o uno por baja) y en qué orden. Cambia la firma dorada nueva, no el balance.
- **Esquema de aspecto**: `appearance.json` asume hoy 4 tipos exactos, hojas de 128 × 128 y ficheros distintos. La
  roca es de otro tamaño y el aspecto lo elige el tipo de enemigo. Ampliar esquema, `looks` y `PickupLayer` es
  trabajo de design. Hay que verificar el tamaño real y los fotogramas de las hojas al copiarlas.
- **HUD**: una tercera fila de contador en `uiLayout`, con escala ×1/×2, y sus tests de layout.
- **Rendimiento**: el pool crece en `maxStone` y la retro de 0022 avisa del coste por tope. Se informa del bench de
  recogibles y del lote frente a 0024. No bloquea CI.
- **Tamaño de `Run.ts`**: conviene meter la tirada en un colaborador de dominio puro y no hacer crecer `onDeath`. Lo
  decide el design.

## Criterio de éxito
- Todos los escenarios de las specs delta están en verde con tests unitarios o de aplicación, con como mucho 1 E2E
  nuevo o ampliado en la suite `logic`, que sigue en verde. `npm run verify` está en verde.
- **Determinismo**: misma semilla y misma entrada dan las mismas piedras caídas (tick, posición, id y aspecto) y el
  mismo contador. Hay una firma dorada nueva de la secuencia de piedras. `MAP_GOLDEN`, `STRUCTURE_GOLDEN`,
  `RESOURCE_GOLDEN`, `SHEEP_GOLDEN` y las oleadas no cambian.
- **Probabilidad**: un tipo con 0 no suelta piedra en ninguna baja. Un tipo con 100 suelta una piedra de valor 1 en
  cada baja que no sea barril detonado. El barril detonado no suelta nunca. Un valor de contenido fuera de 0..100, no
  entero o de un tipo que falta se rechaza al validar.
- **Tope**: con `maxStone` piedras en el suelo, la siguiente suma 1 al valor de la más antigua y el número de piedras
  no pasa del tope.
- **Balance idéntico**: sobre las semillas 1..50 con el bot v4, los resultados coinciden semilla a semilla con la
  línea base de 0024 en `tests/support/balanceBaseline.ts` (**30/50** victorias) y el invariante "quieto pierde
  antes de 180 s" se cumple en las 50 (0 quietos que ganan). Se informa además de la piedra media por partida.
- **Persistencia**: después de una partida con piedra recogida, resultados, récords, historial y export son idénticos
  a los de la misma partida sin piedra.
- **Procedencia**: `guard:all` en verde con `Deco/04`, `05` y `06` registradas y nada del Free Pack.
