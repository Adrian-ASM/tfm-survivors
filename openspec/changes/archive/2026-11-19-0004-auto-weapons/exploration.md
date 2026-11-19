# Exploración · 0004-auto-weapons

Intención: primeras armas automáticas. Disparan solas (el jugador solo se mueve) y sus proyectiles dañan y eliminan enemigos.

## Contexto actual
- `docs/gdd.md`: Must = "2 armas automáticas"; orden 0003 → **0004 auto-weapons** → 0005 xp-and-level-up. Temática: armas = linter, tests, refactor.
- `src/domain/run/Run.ts`: orden de tick fijo jugador → persecución → contacto → director → `tickCount`. Hay un comentario `(0004)` en `tick` donde irán el daño de armas y un único `removeDead()` por tick. Cambiar el orden o el consumo de azar cambia las partidas de una semilla.
- `Run.damageEnemy(id, amount)`: búsqueda O(n) por id, llama a `removeDead()` en el acto; solo la usan tests (deuda S4). `Enemy.takeDamage` ya recorta a 0 y devuelve si mata; `Enemy.alive/hp` listos.
- `removeDead()` (ADR-0006): compactación estable en el sitio, sin asignar. ADR-0006 prevé que proyectiles y gemas usen el mismo patrón (`removeDead()` privado por colección, una vez por tick, y sprites asociados por `id`).
- `src/domain/collision/contact.ts`: `circlesOverlap` (estricto) y `contactDamage` (fuerza bruta O(n)). El JSDoc menciona una rejilla espacial "en 0004".
- Contenido: `content/{player,arena,enemies,waves}.json`. Enemigos: bug (hp 10, r 10), memory-leak (hp 45, r 22), merge-conflict (hp 20, r 16). Jugador: speed 200, r 16, vida 100. `maxAlive` limita a ~200 vivos. Hoy no existe ningún `weapons.json`.
- Esquemas: `src/infrastructure/content/schemas.ts` (zod `strictObject`, mensajes importados del dominio) y `loadRunConfig.ts` (`superRefine` que delega en `buildRunRules`). `RunConfig` y `buildRunRules` (`src/domain/run/RunConfig.ts`) son el único sitio de reglas cruzadas. Añadir armas implica ampliar `RunConfig`, `RunRules`, `parseRunConfig` y su firma de 4 ficheros.
- Tiempo: 60 ticks/s (`TICKS_PER_SECOND`), paso fijo `TICK_SECONDS`. Sin `Clock` en el dominio: la cadencia se mide en ticks.
- Render: `GameScene` + `EnemyLayer` (pool de círculos preasignado con capacidad `maxAlive`, hueco ↔ `id`, 3 pasadas en `sync`). `Run.snapshot()` asigna ~200 objetos congelados por frame (S5, 0,004 ms). `RunSnapshot` no tiene proyectiles.
- Retrospectiva 0003, deudas dirigidas a 0004: S4 (`damageEnemy` O(n)), S5 (snapshot asigna; vigilar con proyectiles), S8 (`determinism.test.ts` importa `playerBlink`; mantener como único caso), prueba manual de esquiva, y "¿cómo observa el usuario este comportamiento?" en la propuesta (feedback visual de disparo/impacto/baja). Lección: escenarios largos deben declarar la vida necesaria.
- Bench 0003: `Run.tick` con 200 vivos ≈ 0,008 ms frente a umbral 2 ms (mucho margen).

## Capacidades/specs afectadas
- `simulation-loop` (orden del tick, snapshot con proyectiles, determinismo con armas, bajas).
- `enemy-behavior` (daño recibido desde armas, bajas por proyectil).
- `run-state` (sin disparos con la partida terminada; sin consumo de azar al terminar).
- Nueva capacidad probable: `auto-weapons` (arma, cadencia, proyectil, contenido `weapons.json`).
- `enemy-spawning` / `player-health`: solo si cambia el orden del tick o la reposición de bajas.
- ADR-0006 (se aplica a proyectiles) y posible ADR nuevo si se adopta rejilla espacial o SoA.

## Opciones

### A. Selección de objetivo
1. **Enemigo más cercano al jugador**: es lo habitual (Vampire Survivors). Requiere un barrido O(n) por disparo; el desempate (distancia igual) debe fijarse por orden de la lista (determinista). Pros: sencillo, siempre acierta si hay enemigos. Contras: sin enemigos en rango no dispara; el jugador no controla la dirección.
2. **Dirección de movimiento / última dirección**: sin barrido; el jugador "apunta" moviéndose. Pros: coste cero, más agencia. Contras: con el jugador quieto no hay dirección (hay que definir una por defecto), y el cuerpo a cuerpo con enemigos que persiguen es menos fiable.
3. **Híbrido** (más cercano con alcance máximo; si no hay, no dispara). Más contenido por balancear.

### B. Proyectil con vida/alcance vs hitscan
1. **Proyectil físico** (posición, velocidad, vida en ticks o alcance): entidad nueva en `Run` con su colección, `removeDead()` y sprites por `id` (ADR-0006), colisión círculo-círculo contra enemigos. Pros: es lo que pide la intención ("proyectiles"), se ve y es esquivable/perforable. Contras: más estado, snapshot y pool de sprites crecen.
2. **Hitscan** (daño instantáneo al objetivo, solo efecto visual): sin entidades de dominio nuevas, mucho más simple y barato. Contras: no cumple literalmente "proyectiles"; el feedback visual se separa del estado.

### C. Colisión proyectil-enemigo y perforación
1. **Fuerza bruta P×E** con salida anticipada: con ~200 enemigos y pocos proyectiles (decenas) son miles de comprobaciones por tick, aceptable según el bench (0,008 ms con 200). Cero asignaciones.
2. **Rejilla espacial** (la que anticipa el JSDoc de `contact.ts`): solo si el bench lo exige; añade complejidad y un ADR.
3. Perforación: proyectil se consume al primer impacto vs atraviesa N enemigos (contador `pierce` en el contenido; si atraviesa, no puede dañar dos veces al mismo enemigo: hace falta registro de ya golpeados o `pierce` acotado con ids). Decidir si entra en 0004.

### D. Cadencia
- **Acumulador de ticks** determinista (enteros: `cooldownTicks` en el contenido; contador por arma que baja cada tick y dispara a 0, sin `Date`). Pros: exacto y sin deriva. Contras: tasas no divisibles de 60 hay que expresarlas en ticks (redondeo explícito en la validación).
- Alternativa: acumulador de segundos en coma flotante con `TICK_SECONDS`; menos exacto.
- Preguntas: ¿se dispara en el tick 1 o tras el primer intervalo? ¿qué pasa si no hay objetivo (el cooldown se queda listo y dispara en cuanto aparece, o se consume)? Esto cambia las partidas de una semilla y debe quedar en la spec.

### E. Alcance mínimo de 0004
1. **Mínimo**: 1 arma automática de proyectil único al enemigo más cercano; contenido `weapons.json` + zod + `buildRunRules`; proyectiles con vida; bajas por daño; render de proyectiles; `damageEnemy` por id sustituido por daño por referencia/índice y `removeDead()` una vez por tick. Deja el GDD "2 armas" para después.
2. **Medio**: lo anterior + una segunda arma de otro comportamiento (p. ej. área alrededor o proyectil perforante) para forzar un modelo de armas genérico (`WeaponType`).
3. **Fuera de 0004**: XP/gemas/subida de nivel (0005), mejoras, jefe, audio, HUD de armas (0006).

## Riesgos e incógnitas
- Determinismo: el orden de sub-pasos del tick (disparo → movimiento de proyectiles → colisión → `removeDead()` → director) debe fijarse en el design; el director no debe consumir azar distinto. Si el objetivo se elige con aleatoriedad (desempates) cambia el consumo; mejor evitarla.
- Rendimiento: `snapshot()` ya asigna ~200 objetos por frame (S5); añadir proyectiles suma más. Vigilar con `npm run bench` y valorar snapshot por escalares/reutilizable si crece. Sin asignar por tick en el camino caliente (ADR-0003): reutilizar o preasignar proyectiles.
- Pool de sprites de proyectiles: capacidad máxima debe salir de contenido o de una cota (`maxProjectiles`); si se supera, descartar disparos o sprites sin pintar (como `EnemyLayer`).
- Cobertura E2E: el disparo debe ser observable en el juego (feedback visual de disparo, impacto o baja) y tener al menos una comprobación E2E o de snapshot (lección de 0003: S7).
- Equilibrado: daños/vidas actuales (bug 10, memory-leak 45) y el ritmo del jugador quieto (muere ~16 s). Un arma mal calibrada vuelve el juego trivial o imposible.
- `Run.damageEnemy` queda como API redundante; decidir si se elimina (cambia tests) o se mantiene para tests.
- Código muerto/duplicado: `contactDamage` y el nuevo barrido proyectil-enemigo comparten `circlesOverlap`; la rejilla (si llega) debería servir a ambos.
- Dependencias: no hacen falta nuevas; Phaser 4.2.1 (ADR-0001), sin tocar `package.json`.

## Preguntas para el usuario
1. ¿Una sola arma (mínimo) o ya dos armas de distinto comportamiento en 0004?
2. Selección de objetivo: ¿más cercano, dirección de movimiento, o híbrido con alcance?
3. ¿Proyectil físico con vida o hitscan con efecto visual? ¿Perforación en 0004?
4. Sin enemigos en alcance: ¿el arma retiene la carga y dispara al aparecer uno, o espera su intervalo?
5. ¿Qué feedback visual esperas al disparar/impactar/matar (flash, partícula, contador de bajas)?
6. ¿Se elimina `Run.damageEnemy` por id (S4) o se conserva para tests?
7. ¿Se prefiere medir antes de decidir la rejilla espacial (bench) y dejarla para un change posterior?
