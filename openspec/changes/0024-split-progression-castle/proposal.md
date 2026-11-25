# Proposal · 0024-split-progression-castle

- **Estado**: aprobada (2026-11-24)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0024-split-progression-castle`

## Problema
Hoy toda la progresión sale de la XP. `content/upgrades.json` mezcla 6 mejoras de arma y 3 de personaje en una
sola oferta de 1 de 3. El oro que se recoge desde 0022 no sirve para nada, y el castillo es decorado. El GDD
("Progresión separada") pide otra cosa: la XP da mejoras de personaje y el oro da mejoras del arma, que se compran
en el castillo-tienda.

Mediciones previas con el bot v3 sobre las semillas 1..50 (contenido por defecto con ovejas, **28/50**):
- **Oro**: cada mapa tiene 74 de oro (4 casas × 5, 3 torres × 8, 3 vetas × 10). El bot recoge 1,86 de media
  (mediana 0). Llega a 10 de oro solo en 6 de 50 partidas y a 25 en ninguna.
- **Subidas de nivel**: 15,86 por partida (entre 5 y 25). La 1.ª llega hacia el tick 2.042, la 5.ª hacia el
  5.179 y la 10.ª hacia el 12.547. De media se eligen 11,42 mejoras de arma y 4,44 de personaje.
- **Castillo**: el bot está de media a 1.110 px de la puerta. Vuelve a 150 px o menos, tras alejarse 400 px o
  más, solo 0,22 veces por partida.
- **Cota inferior**: con solo las 3 mejoras de personaje actuales y sin compras, gana 0 de 50 y muere de media
  en el tick 12.734. Además, el catálogo se agota en 15 niveles.

Separar sin más rompe el juego: la ofensiva desaparece del pool de XP, el oro no llega y la oferta de XP se agota.

## Objetivo
Cuando el change esté hecho:
- Al subir de nivel, el jugador elige 1 de 3 **mejoras de personaje** entre un catálogo ampliado.
- Con oro compra **mejoras de arma** y **curación** en el castillo. Se entra por un radio de interacción en la
  puerta, que solo se vuelve a armar después de alejarse.
- La tienda pausa la partida por completo, igual que la oferta de mejoras. Se sale con Esc o con un botón.
- Los enemigos abatidos sueltan oro, y el mapa tiene más oro que hoy.
- El bot de referencia v4, que compra, vuelve a quedar en la banda de balance.

## Alcance
### Dentro
1. **Dos catálogos en contenido.**
   - **Personaje (XP)**: oferta de 1 de 3 al subir de nivel, con el mismo flujo que hoy.
   - **Arma (oro)**: precio creciente por nivel, declarado en el contenido.
   - Las 6 mejoras de arma actuales (`strict-rules`, `fast-ci`, `wide-analysis`, `hard-asserts`, `watch-mode`,
     `coverage`) pasan a la tienda **con los mismos ids** y el mismo `stat`/`perLevel`/`maxLevel`.
   - El formato de la mejora de arma referencia el arma por su id, como hoy (`target.weapon`). Así podrá servir
     a un loadout con varias armas por personaje (Guerrero, 0027) sin cambiar de formato.
2. **Mejoras de personaje.** Siguen las 3 actuales y se añaden las cualidades nuevas viables. Todas llevan textos
   medievales (solo `name`/`description`, como en 0013). Situación en el código:

   | Candidata | Stat | Estado en el código |
   |---|---|---|
   | `guardrail` (Cota de malla) | `maxHealth` | Existe |
   | `shortcuts` (Botas de viajero) | `speed` | Existe |
   | `context-window` (Amuleto del saqueador) | `pickupRadius` | Existe |
   | Regeneración de vida | nuevo: vida por intervalo de ticks | No existe. Viable: `Health` ya tiene `heal` con tope (la carne lo usa) |
   | Armadura | nuevo: reducción plana del daño recibido | No existe. Se aplica al golpe único `max(contacto, explosión)` de `Run` (0020). Necesita un mínimo de daño |
   | Invulnerabilidad más larga tras un golpe | `invulnerabilityTicks` | La invulnerabilidad **ya existe** (`player.invulnerabilityTicks` 30, `Player.invulnerableUntil`). Falta como mejora: se alarga su duración |
   | Más XP ganada | nuevo: % sobre el valor de cada gema | No existe. Debe redondear a entero para no alterar la curva |
   | Más oro recogido | nuevo: % u oro extra por recogida | No existe. Afecta al `Stockpile` |
   | Más madera recogida | ídem para la madera | No existe. **Hoy la madera no tiene uso**: recomiendo aplazarla a 0025 (solares) |
   | Más curación de la carne | nuevo: suma a `resources.meat.healPercent` (20 %) | No existe como stat del jugador. Viable: la curación ya es una fórmula pura (0023) |

   Hoy `PLAYER_STATS` = `maxHealth | speed | pickupRadius` (`src/domain/upgrade/UpgradeType.ts`). Hay que
   ampliarlo y validar cada stat nuevo con un peor caso, como hace `UpgradeCatalog`.
3. **Castillo-tienda.**
   - **Apertura**: un radio de interacción en la puerta del castillo con **re-armado**. La tienda solo se abre
     cuando el jugador entra en el radio después de haberse alejado al menos la distancia de re-armado. El
     jugador nace en la puerta, así que no se abre en el tick 0, ni tampoco al salir. El radio y la distancia de
     re-armado van en el contenido.
   - **Pausa**: la tienda pausa la partida por completo. Es una fase nueva de `Run`, junto a `running`, `choosing`
     y `over`.
   - **Salida**: con Esc o con un botón.
   - **Productos**: los niveles de las mejoras de arma y la **curación a precio fijo** con tope en la vida
     máxima. No se cobra la curación si la vida está llena.
   - **Gasto**: la tienda es el único gasto de oro. Va por un caso de uso sin azar y con catálogo fijo, para que
     no desplace la secuencia de azar de las ofertas de XP.
   - **Render**: overlay de tienda (DOM o capa fija, la decide el design) con precio, nivel y oro disponible, y
     aviso de oro insuficiente.
4. **Economía de oro, con las dos fuentes.**
   - **Oro por enemigo abatido**: tasa en el contenido. Sale como recogible `gold`, con las mismas reglas de
     "abatido" que la madera del barril (sin `detonated`).
   - **Más oro en el mapa**: más vetas, más oro por casa o torre, o ambas cosas.
   - **Tope `maxGold`**: hoy es 32. Se revisa con las mediciones, porque con oro por baja es probable que haya que
     subirlo.
   - Las cifras finales se calibran en apply.
5. **Bot de referencia v4** (`tests/support/`). Cuando tiene oro para la mejora más barata y no hay peligro
   cerca, va a la puerta del castillo y compra con una prioridad fija: arma primero y curación si tiene poca vida.
   Solo sirve para calibrar.
6. **Balance recalibrado.**
   - La línea base de `tests/support/balanceBaseline.ts` (27/50 con tope de ovejas 0 y el hash de `upgrades`) se
     **reemplaza a propósito** por la nueva, medida con el bot v4.
   - Se actualizan el test "Mechas por partida" y la huella del contenido de combate.
7. **Pruebas.** Escenarios cubiertos con tests unitarios y de aplicación. Como mucho **1–2 E2E nuevos**
   (e2e-lite), en modo manual: abrir la tienda, comprar y salir, preferiblemente ampliando un test de la suite de
   humo. Sonda E2E de la tienda (fase, oro y niveles comprados).
8. **ADR nuevo**: modelo de la tienda, fase de pausa y separación de catálogos.

### Fuera
- Solares de obra y construcción con madera (**0025**).
- Personaje Guerrero y selección de personaje (**0027**). Solo se deja preparado el formato.
- La curación lenta dentro del castillo que menciona el GDD ("dentro cura despacio"). Se sustituye por la
  curación de pago (decisión del autor), y el GDD se ajusta al archivar.
- Otros gastos de oro, como reroll de la oferta o desbloqueos.
- Guardar el oro o las compras entre partidas, o mostrarlos en los resultados. El oro sigue siendo un contador de
  la partida.
- Talar árboles, edificios propios (casa y torre) y UI con el pack (*Could*).
- Rediseñar las armas o añadir armas nuevas.

## Capacidades afectadas
- `openspec/specs/upgrades` (modificada): dos catálogos, oferta solo de personaje y stats nuevos.
- `openspec/specs/leveling` (modificada): la oferta de 1 de 3 sale solo del catálogo de personaje, y hay que
  decidir qué pasa al agotarse.
- `openspec/specs/resources` (modificada): oro por baja, más oro en el mapa, gasto de oro y posible cambio de
  `maxGold`.
- `openspec/specs/run-state` (modificada): fase nueva de tienda y transiciones.
- `openspec/specs/simulation-loop` (modificada): comprobación del disparador de la tienda en el tick y ningún
  tick durante la tienda.
- `openspec/specs/procedural-map` (modificada): la puerta del castillo como disparador. Las vetas también, si se
  añaden.
- `openspec/specs/player-health` (modificada): curación de pago, regeneración, armadura y duración de la
  invulnerabilidad mejorable.
- `openspec/specs/castle-shop` (**nueva**): apertura con re-armado, productos, precios, compra, salida y pausa.
- Confirmadas en spec: `hud` (visible en la tienda), `main-menu` (Esc cierra la tienda sin pausar),
  `run-outcome` (bot v4 y balance) y `sheep` (se retira su requisito de balance, sustituido por el de la tienda).
  "Más XP" va en `leveling` y "más curación de la carne" en `player-health`; `xp-gems` no cambia.
- `run-results` no cambia (el oro no sale en los resultados).

## Riesgos y dudas
- **Balance.** Es el riesgo principal. Con el bot v3, el oro real (1,86 de media) no paga casi nada. Sin la
  economía nueva y sin el bot v4 que compra, la tasa de victorias cae a 0 de 50, como muestra la cota inferior.
  Los precios, la tasa de oro por baja y el oro del mapa se calibran juntos.
- **Oferta de XP agotada.** Hay hasta 25 subidas por partida. Con 3 mejoras × 5 niveles caben 15, así que el
  catálogo de personaje necesita al menos unas 5–6 mejoras o una regla para cuando se agote.
- **Determinismo.**
  - Una oferta de XP distinta desplaza el azar de las ofertas.
  - Una "tasa" de oro por baja con probabilidad consumiría azar del flujo principal. Hay que elegir entre un
    contador determinista (cada N bajas), un valor fijo por tipo o un flujo de azar propio.
- **Firmas doradas.** `MAP_GOLDEN`, `STRUCTURE_GOLDEN` y `SHEEP_GOLDEN` deben quedar intactas. `RESOURCE_GOLDEN`
  **cambia** si se añaden vetas, y cualquier recolocación por las vetas nuevas puede arrastrar a otras firmas.
  Si solo se sube el oro por casa o torre, todas quedan intactas.
- **Tiempo del lote.** Ahora está en 35,4 s en local y ~63 s en CI, con un tope de 90 s. El bot v4 hace
  desplazamientos de ida y vuelta y las partidas duran más, así que puede acercarse al tope.
- **Esc tiene doble uso.** Hoy Esc abre la pausa del menú (0009). Dentro de la tienda debe cerrarla sin abrir la
  pausa.
- **Determinismo con pausas.** Si el bot entra a la tienda en un tick concreto, compra y sale, el resultado tiene
  que depender solo de la semilla y de las acciones.

## Decisiones (antes preguntas abiertas; aprobadas por el autor el 2026-11-24)
1. **Oro por baja**: valor fijo por tipo de enemigo en el contenido, sin azar.
2. **Más oro en el mapa**: se sube el oro de casas y torres; no se añaden vetas, así que ninguna firma dorada
   cambia (`RESOURCE_GOLDEN` incluida).
3. **Mejoras de personaje**: entran las 6 nuevas (regeneración, armadura con un daño mínimo de 1 por golpe,
   invulnerabilidad más larga, más XP, más oro recogido y más curación de la carne) además de las 3 actuales.
   "Más madera recogida" se aplaza a 0025.
4. **Catálogo de personaje agotado**: la subida de nivel sin mejoras disponibles cura un poco al jugador (porción
   del contenido) en lugar de abrir oferta.
5. **Compras**: varias por visita, hasta salir. La curación se vende en porción fija.
6. **Sin botón de tienda en el HUD**: se entra solo por el radio de la puerta; se sale con Esc o con un botón.

## Criterio de éxito
- Todos los escenarios de las specs delta (`upgrades`, `leveling`, `resources`, `run-state`,
  `simulation-loop`, `procedural-map`, `player-health`, `castle-shop` y las que se confirmen) tienen su test y
  están en verde. `npm run verify` y `npm run test:e2e` pasan.
- Las 6 mejoras de arma conservan su id y solo se obtienen en la tienda. La oferta de XP solo contiene mejoras de
  personaje.
- La tienda no se abre en el tick 0 ni nada más salir de ella. Se abre al volver al radio de la puerta tras
  alejarse la distancia de re-armado.
- Durante la tienda no avanza ningún tick.
- **Balance con el bot v4, semillas 1..50**:
  - Entre **25 y 35 victorias de 50**.
  - **0 quietos**: el invariante "quieto pierde antes de 180 s" se cumple en todas las semillas.
  - La línea base nueva queda congelada en `balanceBaseline.ts`.
- El lote de balance cabe en el timeout de CI (≤ 90 s, con margen objetivo ≤ ~81 s).
- Firmas doradas: `MAP_GOLDEN`, `STRUCTURE_GOLDEN` y `SHEEP_GOLDEN` intactas. `RESOURCE_GOLDEN` intacta salvo
  que se añadan vetas, y si cambia se justifica en el design.
- Como mucho 2 E2E nuevos, en modo manual.
