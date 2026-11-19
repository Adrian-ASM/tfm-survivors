# Exploración · 0005-xp-and-level-up

## Contexto actual
- GDD (`docs/gdd.md`): gemas de XP, subida de nivel, elegir 1 de 3 mejoras (*Spec*, *Skill*, *Guardrail*…) es Must;
  0006 hará run-lifecycle + HUD, 0007 el guardado.
- `Run` (`src/domain/run/Run.ts`) es el agregado: orden fijo del tick jugador → persecución → armas (+`removeDead`)
  → contacto → director. Las bajas las produce `Arsenal.step` (devuelve el nº de bajas, sin decir quién ni dónde
  murió). `Run.snapshot()` expone jugador, enemigos, proyectiles, pulsos y armas; no hay XP, nivel ni gemas.
- Armas: `WeaponType` es un VO congelado (ADR-0007: "las mejoras de 0005 serán transformaciones de datos sobre
  `WeaponType`"); `Arsenal` crea `Weapon` con ese tipo y el `Weapon` solo guarda `readyAt`. Hoy no hay forma de
  cambiar el tipo de un arma equipada ni de añadir armas a mitad de partida. `Player` tiene `speed`, `maxHealth`
  fijos desde `content/player.json`.
- Contenido: `content/{arena,enemies,player,waves,weapons}.json`, validado con zod (`infrastructure/content/
  schemas.ts`) y reglas cruzadas en `buildRunRules`. `EnemyType` no tiene valor de XP; no hay `upgrades.json`.
- Entidades con altas/bajas frecuentes: ADR-0006 (compactación estable, sprites por `id`) y ADR-0003 (pools, cero
  asignación por tick) aplican a las gemas.
- Infraestructura: `GameScene` (Phaser 4.2.1) con capas por entidad (`EnemyLayer`, `ProjectileLayer`, `SlotPool`)
  y `KeyboardInput`; `TickRun` ejecuta ticks fijos y devuelve el snapshot. No hay UI/DOM, pausa ni overlay.
- Retros archivadas: marcar los números de equilibrio como "provisional, a medir en apply" con tarea de medición al
  inicio de `tasks.md`; buscar el valor en todas las specs al cambiarlo; abrir la sesión desde el worktree.

## Capacidades/specs afectadas
- Nuevas (probables): `xp-gems` (drop, recogida, atracción), `leveling` (curva de XP, nivel), `upgrades`
  (catálogo, oferta de 3, aplicación).
- Modificadas: `simulation-loop` (el tick gana pasos nuevos; contrato de determinismo y snapshot), `run-state`
  (¿estado "esperando elección" distinto de en curso/terminada? la simulación debe congelarse mientras se elige),
  `enemy-behavior` (las bajas sueltan gema), `auto-weapons` (mejoras que cambian `damage`/`cooldownTicks`/rango),
  `player-health`/`player-movement` (mejoras de vida máxima, velocidad, radio de recogida).
- Contenido nuevo: `content/upgrades.json` y XP por tipo de enemigo; ADR probable sobre cómo se aplican las mejoras
  (modificadores sobre datos) y sobre el azar de la oferta (puerto `RandomGenerator`).

## Opciones (sin elegir)
**A. Aplicación de mejoras**
1. *Modificadores acumulados* (`Run` lleva stats derivados: multiplicadores/sumas por arma y del jugador; el
   `WeaponType` base no cambia). Pros: contenido simple, reversible, testeable; contras: hay que leerlos en cada
   cálculo de arma/jugador.
2. *Reemplazar el `WeaponType`* por uno nuevo en cada mejora (transformación de datos, como anticipa ADR-0007).
   Pros: el `Arsenal` casi no cambia; contras: la mejora puede mutar algo ya "congelado", más difícil mostrar
   nivel de cada mejora, y se pierde la base.
3. *Solo mejoras de jugador* en 0005 y mejoras de arma en otro change. Pros: menor alcance; contras: recorta el
   GDD y la mejora "Spec/Skill" quedaría floja.

**B. Elección de mejora (UI mínima)**
1. *Overlay de Phaser* en `GameScene` (3 rectángulos con texto, teclas 1/2/3 o clic) con la simulación pausada.
   Pros: sin DOM ni dependencias; contras: HUD de 0006 puede querer otro enfoque.
2. *Overlay DOM/HTML* sobre el canvas. Pros: texto y accesibilidad más fáciles; contras: primer uso de DOM, nuevo
   adaptador y guardarraíles.
3. *Solo dominio* + elección automática/por consola y UI en 0006. Pros: cambio centrado en el núcleo; contras: no
   hay vertical jugable del bucle XP → nivel → mejora (el GDD pide ese bucle).

**C. Gemas**
1. *Entidad con pool y compactación* (ADR-0006), suelta en la posición del enemigo muerto, recogida por radio y
   (opcional) imán. 2. *XP directa al matar* sin entidad (más simple, pero no es "recoger gemas" del GDD).
   3. Gema con tope y fusión de cercanas (evita saturar con 200 enemigos; más reglas).

## Riesgos e incógnitas
- `Arsenal.step` devuelve solo un contador: se necesita saber posición/tipo de cada baja para soltar gemas sin
  romper el determinismo ni asignar por tick.
- Pausa de simulación durante la elección: el bucle `FixedStepLoop` acumula tiempo; congelar sin "tick en cola".
- Subidas de nivel múltiples en un tick (varias gemas) → cola de elecciones pendientes.
- Azar de la oferta: consumir `RandomGenerator` cambia las partidas de una semilla (contrato del tick); decidir
  posición en el orden de consumo.
- Equilibrio sin medir (curva de XP, valor por gema, tamaño de mejoras, radio de recogida): provisional, medir en
  apply (lección 0004). Mejoras de arma pueden romper escenarios de las specs vivas (daño ≥ vida del bug).
- Tope de gemas en pantalla/rendimiento (bench de ADR-0003); inventario de mejoras sin HUD (visibilidad hasta 0006).
- Guardrails: el contenido en JSON con zod y sin números mágicos; sin dependencias nuevas.

## Preguntas para el usuario
1. ¿Las mejoras de 0005 incluyen mejoras de armas (daño, cadencia, alcance), solo del jugador (vida máx, velocidad,
   radio de recogida), o ambas? ¿Y mejoras que añadan armas nuevas (p. ej. Refactor) o solo mejorar las 2 actuales?
2. ¿Qué catálogo mínimo de mejoras y con qué temática (*Spec*, *Skill*, *Guardrail*…)? ¿Hay un tope de nivel por
   mejora, y qué pasa cuando no quedan mejoras que ofrecer?
3. ¿La UI de elección es un overlay en Phaser (teclas 1/2/3 y clic) o DOM, y ha de incluir una barra de XP/nivel
   mínima en 0005 o se deja todo el HUD a 0006?
4. ¿La simulación se pausa por completo mientras se elige (enemigos y gemas congelados)? ¿Se permite cancelar o
   re-tirar la oferta (reroll)?
5. ¿Las gemas se recogen solo por contacto, con imán/atracción, o ambos? ¿Se quedan en el suelo para siempre?
6. ¿Cantidad de XP fija por tipo de enemigo (`enemies.json`) o distintos tamaños de gema? ¿Una curva de XP
   (lineal/creciente) fijada ahora o "provisional, a medir en apply"?
7. ¿La oferta de 3 es aleatoria con la semilla de la partida (determinista) y sin repetir? ¿Y si hay menos de 3
   mejoras disponibles?
8. ¿Hay nivel máximo en esta partida (o el cap llega con la victoria de 0006)?
