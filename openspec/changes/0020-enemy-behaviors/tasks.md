# Tasks · 0020-enemy-behaviors

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     Design de referencia: design.md (revisión 2). Siglas: EB = enemy-behavior, EH = enemy-hazards,
     ES = enemy-spawning, PH = player-health, XG = xp-gems, RO = run-outcome, RS = run-state,
     SL = simulation-loop, SR = sprite-rendering, AP = asset-provenance.
     Al cerrar cada sección: `npm run verify 2>&1 | tail -20` en verde. Bucle interno: `npm run verify:fast`. -->

## 1. Dominio · comportamiento por tipo
- [x] 1.1 `BehaviorConfig` y `Behavior.create`: compilar las cuatro clases (`chase` con `exit` opcional, `fuse`,
  `charge` y `wait`) a arrays por índice. Rechazar `initial` inexistente, `to` inexistente y nombres repetidos, con
  el id del tipo y el nombre del estado en el mensaje. Test `tests/domain/enemy/Behavior.test.ts`. Escenarios: EB
  "Destino inexistente", "Estado inicial ausente o inexistente" (caso inexistente) y "Nombre de estado repetido".
- [x] 1.2 `EnemyType`: `behavior` obligatorio y `damage` opcional (si está, > 0; si falta, `hasContact` false y
  `damage` 0). `EnemyCatalog` y `RunConfig.enemies` pasan a `{ hazards, types }`, y se añade `HazardRules`
  (`maxDynamites`, `dynamiteRadius` y `blastTicks`, con sus invariantes). Se adaptan `aDefaultConfig` y los
  builders: el contenido de escenario da a cada tipo genérico un `chase` sin salida. Escenarios: ES "Daño cero o
  negativo" (dominio) y EH "Tope inválido" y "Tope mínimo" (dominio).
- [x] 1.3 `Enemy.state`/`since`/`enter`/`explode` y `Horde.act` en sus tres pasadas: esperas que terminan, `chase`
  que se mueve y salida por distancia tras moverse. En `fuse`, `charge` y `wait` el enemigo no se mueve. Escenarios:
  EB "Salida por distancia justo en el límite", "Barril que ya está dentro al aparecer en el escenario",
  "Persecución en línea recta · Un enemigo en espera no persigue" y SL "La espera termina antes de moverse" (este
  último con `RunSetup` de 1.4).
- [x] 1.4 `RunSetup`: `enemies[i].state`/`elapsed` y `dynamites[]`, validados (estado existente, `elapsed` en
  [0, ticks), tope de dinamitas, `ticksLeft` ≥ 1 y punto finito). Test `RunSetup.test.ts` con un caso inválido por
  regla y uno válido que arranca en mecha o carga. Builders `inState`, `aDynamite`, `aBarrelType`, `aTntType` y
  `aWaitType`. Escenario: EB "El daño no cambia el estado" (carga desde el tick t con y sin impacto del Linter).
- [x] 1.5 Snapshot: `EnemySnapshot.state` y `stateKind`. Listas `dynamites`, `warnings` y `blasts` vacías y
  congeladas. Escenarios: SL "Partida recién creada", "Enemigos en el snapshot" (estado de persecución) y "Estado
  de comportamiento en el snapshot", y EB "Estado inicial al aparecer".

## 2. Dominio · peligros y orden del tick
- [x] 2.1 `HazardField` con dinamitas: pool `maxDynamites`, lanzamientos en orden de lista mientras haya sitio
  (paso 4.4), TNT lista que espera sitio y entra en `wait` al lanzar. Interpolación en el snapshot. Escenarios: EB
  "Ciclo completo de lanzamiento", "Objetivo fijado al lanzar" y "Lanza aunque el jugador se aleje durante la
  carga", y EH "Posiciones del vuelo" y "Vuelo de 1 tick".
- [x] 2.2 Explosiones de dinamita (paso 4.2b): daño al jugador como golpe candidato (`playerHit`), fuego amigo con
  solape estricto, daño acumulado entre explosiones, `Blast` visible `blastTicks` y `expire`. Escenarios: EH
  "Jugador dentro del radio", "Tangencia y justo dentro", "Fuego amigo que no mata", "Goblin fuera del radio", "Dos
  explosiones sobre el mismo goblin" y "Explosión visible varios ticks", y EB "La explosión no empuja".
- [x] 2.3 `Run.tick` con el orden nuevo: `removeDead` tras las armas, explosiones, segundo `removeDead` con gemas
  y bajas, lanzamientos y `applyHit` = max(contacto con daño, `playerHit`). Escenarios: EH "Fuego amigo que mata" y
  "La dinamita sigue tras morir su lanzador"; ES "Baja por explosión ajena" y "Armas y explosión en el mismo tick";
  XG "Bajas por armas y por explosión en el mismo tick" (los dos órdenes); SL "Un enemigo muerto por explosión no
  golpea en ese tick", "Lanzamiento con la posición del jugador ya movido" y "La explosión de la victoria"; EB "TNT
  abatido durante la carga no lanza".
- [x] 2.4 Golpe único y la invulnerabilidad frente a las explosiones. Escenarios PH: "Contacto y explosión en el
  mismo tick", "Dos explosiones en el mismo tick", "Explosión que no alcanza no es candidata", "Explosión durante la
  invulnerabilidad", "Explosión justo al expirar", "La explosión inicia la invulnerabilidad" y "Un tipo sin daño por
  contacto no golpea"; ES "Daño ausente".
- [x] 2.5 Mecha del barril (paso 4.2a): se marcan todos los barriles del tick, cada uno explota sin dañarse a sí
  mismo y después `explode()`. Gema y baja. El aviso de mecha se deriva en `warnings`, ordenados por `explodesAt`
  con las mechas primero. Escenarios: EB "Mecha y explosión con el jugador quieto", "Esquiva de la explosión del
  barril" y "El barril no golpea por contacto"; EH "Aviso de mecha", "Aviso de dinamita", "Barril que explota con
  otro goblin dentro" y "Dos barriles que explotan a la vez"; XG "El barril que explota suelta su gema"; SL "Peligros
  en el snapshot".
- [x] 2.6 Bajas antes del estallido y ausencia de cadenas. Escenarios: EB "Barril abatido durante la mecha no
  explota" y "Barril abatido en el mismo tick en que terminaría la mecha"; SL "Las armas actúan antes que la mecha";
  EH "Explosión sobre una dinamita en vuelo", "Explosión sobre un barril en mecha que sobrevive", "Explosión que
  abate a un barril en mecha", "Dos lanzadores con tope 1" y "Tope por defecto alcanzado" (con el contenido por
  defecto en 2.9).
- [x] 2.7 Bajas y hueco del director. Escenarios: RO "Explosión letal para el jugador y para el barril" y "Una
  explosión que mata a varios"; SL "La explosión libera hueco para el director"; ES "El hueco del barril que explota
  se repone en el mismo tick".
- [x] 2.8 Congelación y determinismo. Escenarios: RS "Peligros congelados al terminar" y "Peligros en pausa durante
  la oferta"; EH "Los peligros no consumen azar"; SL "Los comportamientos no consumen azar" y "Snapshot no mutable
  desde fuera" (dinamitas, avisos, explosiones y estado). Si algún escenario pasa en verde sin tocar `src/`, se
  marca y se junta con la tarea anterior (ver nota al final).

## 3. Infraestructura · contenido
- [x] 3.1 `EnemiesSchema`: `hazards` estricto (con `chainReaction` → error), `behavior` obligatorio con
  `discriminatedUnion('kind')` estricta, `damage` opcional y `Count` en los ticks. Los errores nombran el tipo
  (`superRefine` → `buildRunRules`). Escenarios EB: "Clase desconocida", "Estado inicial ausente o inexistente"
  (ausente), "Parámetros no positivos", "Duraciones inválidas" y "Duración mínima válida". ES: "Tipo sin
  comportamiento" y "Daño cero o negativo" (zod). EH: "Tope inválido", "Otros parámetros inválidos" y "Contenido por
  defecto" (forma).
- [x] 3.2 `content/enemies.json` con los comportamientos y `hazards` de design §5. El barril pierde `damage`.
  Ajustar los tests existentes que suponían el contacto del barril (MODIFIED de las specs). Test de contenido
  `tests/content/enemies.test.ts`. Escenarios: EB "Comportamientos del contenido por defecto", "Sin contacto del
  barril por defecto", "Cotas del contenido por defecto" y "Esquiva con el contenido por defecto"; ES "Contenido por
  defecto" y "Stats por defecto"; RO "Presupuesto de oleadas y stats intactos" (comparando con una copia de los
  valores de `main` fijada en el test); EB "Velocidad por tipo · Dos tipos, dos velocidades" (TNT en persecución).
- [x] 3.3 `appearanceSchema`: `fuse`/`throw` opcionales por enemigo, `dynamite`, `explosion.explode` sin bucle,
  `warnings.fuse`/`warnings.dynamite` con `alpha` ∈ (0, 1) y `maxBlastSprites`. En composición,
  `checkAppearanceRefs` exige `fuse` si el tipo tiene un estado `fuse` y `throw` si tiene `charge`. Escenarios SR:
  "Valores fuera de rango" (opacidad), "Animaciones obligatorias y campos desconocidos", "Animación de
  comportamiento no exigida", "Rutas de hoja no admitidas" (explosión) y "El aviso deja ver lo que cubre".
- [x] 3.4 Copiar byte a byte `Dynamite.png` y `Explosions.png` a `public/assets/tiny-swords/...` y añadir sus **2
  entradas** a `content/asset-provenance.json` (`source`, `version`, `sha256` y `bytes`, medidos con un script del
  scratchpad). Datos en `appearance.json` (§5). Test de la nota y `npm run guard:all`. Escenarios: AP "Hojas nuevas
  registradas", "Hoja nueva sin entrada" y "Ninguna hoja de más"; SR "Datos del repositorio", "Hoja de cada
  elemento" y "Solo las hojas usadas".

## 4. Infraestructura · render y sonda
- [x] 4.1 `HazardLayer`: un `Graphics` para los avisos (color por origen), un pool de dinamitas y un pool de
  explosiones (`SlotPool` por id, `explode` sin bucle que se queda en el último frame) y `clear()`. Test con
  `FakeSprite` y un `Graphics` falso que comprueba que no se crea nada por frame. Escenarios SR: "Peligros del
  snapshot", "Fin de un aviso", "Explosión más larga que su animación" y "Peligros con el mundo detenido".
- [x] 4.2 Reservas de dinamita y explosión (diámetro 2r) y frame de `fuse` fuera de la hoja: el tipo entero va con
  reserva. Escenarios SR: "Reserva de la dinamita y la explosión" y "Frame de mecha fuera de la hoja".
- [x] 4.3 `EnemyLayer`: `fuse` para `stateKind` `fuse` y `throw` para `charge`, desde su primer frame al entrar.
  Contador por clase de estado. Escenarios SR: "Mecha y lanzamiento" y "Mundo detenido" (barril en `fuse`).
- [x] 4.4 `RenderLayers`, `GameScene` y `renderCounts`: crear `HazardLayer` tras la capa alta del mapa y antes del
  HUD. Añadir a la sonda `warnings`, `dynamites`, `explosions` y `enemyStates`, a 0 en el menú y tras `clear()`.
  Test sin navegador del orden de creación y de la sonda. Escenarios SR: "Peligros sobre las copas y bajo el HUD",
  "Capas tras redimensionar" (orden por creación), "R con cadáveres en curso" (peligros a 0), "Sonda en el menú" y
  "Los aspectos no cambian la simulación" (colores de aviso cambiados).

## 5. Test support · bot v3 y bench
- [x] 5.1 Bot v3 en `tests/support/policies.ts`: esquiva por avisos amenazantes (d < r_aviso + r_jugador + v/60),
  suma de unitarios, cuantización a 8 direcciones, regla de direcciones bloqueadas y, con suma nula, `fleeInput`.
  Documentarlo en el JSDoc. Escenarios RO: "La esquiva gana a la huida", "Aviso no amenazante", "Dos avisos que se
  anulan" y "Esquiva bloqueada por un tronco". Los escenarios vigentes del bot siguen en verde.
- [x] 5.2 Bench "Peor caso con peligros" (`tests/bench/run.bench.ts`), con preparación por `RunSetup` rehecha cada
  60 ticks fuera del tiempo medido. Un test unitario comprueba sus condiciones: ≥ 100 barriles, ≥ 100 TNT, tope
  lleno y una explosión con ≥ 50 dentro cada 10 ticks. Anotar la media junto a la del peor caso con proyectiles.
  Escenarios SL: "Peor caso con peligros" y "Peor caso con proyectiles" (anotación).

## 6. Determinismo, balance y calibración
- [x] 6.1 Escenarios de reproducibilidad con el contenido final. SL: "Partida con peligros reproducible" (14.400
  ticks, ≥ 1 explosión de barril y ≥ 1 dinamita), "Posiciones de enemigos reproducibles con el mapa generado" (con
  el estado) y "Mapa intacto" (`mapGolden.ts` sin cambios). EH: "Mismos peligros con cualquier ventana" (sin
  ventana en el núcleo, por comparación de snapshots). RO: "Bot reproducible".
- [x] 6.2 **Recalibración con el gate de balance.** `measureBalance` con el bot v3 sobre `BALANCE_SEEDS`. Iterar
  solo con los parámetros de comportamiento y `hazards`, dentro de las cotas de 3.2, y solo si no basta, con la
  curva de XP. Objetivo: 25–35 victorias, 0 quietos con el mapa generado y con el vacío, y los plazos de la semilla
  7 (primer golpe, primer pulso y primera oferta ≤ 4.800, primera baja ≤ 900). Si ninguna combinación lo consigue,
  **parar y volver al usuario**. Actualizar en las specs delta todo valor fijado que cambie. Registrar la tabla de
  lotes y los ticks medidos en el addendum del ADR-0018. Escenarios RO: "Tasa de victoria del bot de referencia",
  "Toda partida del bot termina", "Jugador quieto pierde con todas las semillas", "Jugador quieto pierde también con
  el mapa vacío", "Muerte quieta en el límite de 180 s" y "Plazos del jugador quieto con el contenido final"; PH
  "Primer golpe en el núcleo con armas activas"; SL "Partida con contactos reproducible", "Partida con armas
  reproducible" y "Partida con progresión reproducible".

## 7. E2E y documentación
- [ ] 7.1 **E2E único** (proyecto `logic`, ampliando `tests/e2e/gameplay.spec.ts`): `?e2e&manual&map=empty&seed=s`
  (semilla fijada tras 6.2), jugador quieto, `step(120)` hasta que la partida termina, política de elección fija y
  lectura de la sonda tras cada llamada. Debe haber ≥ 1 lectura con aviso y barril en mecha y una posterior con
  explosión, sin reserva. En cada lectura los recuentos de aviso, dinamita y explosión coinciden con el snapshot.
  Sin esperas de reloj ni umbrales de fps. Escenarios SR: "Barril en mecha y su explosión en el navegador [E2E]" y
  "Recuento coherente con el snapshot" (parte de peligros).
- [ ] 7.2 Documentación: estado del proyecto en `AGENTS.md` (§1, change 0020), JSDoc del contrato del tick en
  `Run`, la entrada del GDD (comportamientos de la parte A hechos y la B pendiente) y el diario de IA
  (`docs/ai-log/`). `npm run verify` y `npm run test:e2e -- gameplay.spec` en verde.

<!-- Nota de agrupación: 2.8 y 6.1 pueden quedar en verde a la primera, porque derivan de la pureza del diseño. Si
     ocurre, el implementer las junta con la tarea anterior de su sección (regla 0006) y lo anota en el commit. -->
