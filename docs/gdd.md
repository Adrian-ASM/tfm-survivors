# Greentide Vanguard · GDD-lite · v2.0 (v1 aprobado 2026-11-19; v1.1 tras 0007; v2.0 "medieval" decidida 2026-11-22, tras 0011)

> Borrador que mantiene el agente `game-designer`; las decisiones son del autor. La v2.0 cambia la visión
> (temática, género, mapa, recursos); lo construido en 0001–0011 se conserva y se reutiliza.

## Concepto
Juego 2D para navegador, partidas de 5 a 10 minutos (que inviten a echar otra; 10 min como máximo):
**survivors-like + exploración + toques de tower defense**.
Un caballero de la facción (arquetipo inicial: Arquero) contra hordas de goblins en un mapa medieval generado por
semilla. El jugador solo se mueve; las armas
atacan solas; al subir de nivel elige 1 de 3 mejoras; explorar el mapa se recompensa con recursos que se gastan en
mejorar el arma y en construir defensas.

**Temática** (v2.0, 2026-11-22): caballeros contra goblins. Título: **"Greentide Vanguard"** (decidido 2026-11-22),
que sustituye a "Sprint Survivors" (dev en un sprint infinito; v1 la había elegido para no parecerse a
*Bug Bane Survivors*). Los ids de enemigo pasan a `goblin-torch` (antes `bug`), `goblin-tnt` (`memory-leak`) y
`goblin-barrel` (`merge-conflict`), con los mismos stats; sus comportamientos propios llegaron en 0020 (parte A) y los campamentos, en 0021. El nombre del
repo, la URL de Pages y las claves técnicas `sprint-survivors` (localStorage, nombre del export, `window.__sprint`)
se mantienen; renombrarlos es una posible tarea futura, no decidida.

**Arte base**: Tiny Swords "Update 010" de Pixel Frog (versión antigua, **CC0**: se puede versionar y publicar).
El Free Pack actual **no** es CC0 (prohíbe redistribuir): solo uso local, nunca en el repo ni en Pages.
El autor **confirmó (2026-11-22) que Update 010 es CC0**, lo que desbloquea 0012. Conviene guardar en el repo
una nota de procedencia y licencia junto a los assets.

## Pilares
1. **El jugador solo se mueve; las armas disparan solas** (se mantiene de v1).
2. **Explorar se recompensa**: cofres, vetas, ovejas y campamentos están lejos del punto de partida.
3. **Tres monedas, tres papeles**: XP mejora al personaje, Oro mejora el arma, Madera construye defensas.

## Core loop
Moverse y explorar → esquivar → las armas matan → recoger XP, oro, madera y carne → subir de nivel (mejora de
personaje) → gastar oro en el castillo (mejora de arma) → gastar madera en solares de obra (casa o torre) →
sobrevivir más tiempo y destruir objetivos goblin.

## Controles
Teclado (WASD / flechas). Pausa con Esc. Táctil (*Should*, 0033 `mobile-web`): joystick flotante en la mitad
izquierda y botones de pausa/salir, reiniciar y pantalla completa abajo a la derecha. Gamepad: *Could*.

## Victoria y derrota
- Derrota: la vida llega a 0. Pantalla de resultados con tiempo, nivel y enemigos eliminados.
- **Modos de partida** (candidatos; Supervivencia es el modo por defecto de los Must):
  - **Supervivencia** (*Must*, el actual): sobrevivir hasta el final del temporizador. Hay que revisar la duración,
    porque explorar para mejorar consume tiempo (pregunta abierta).
  - **Objetivos** (*Should*): p. ej. destruir N casas goblin o campamentos.
  - **Infinito** (*Could*): hasta morir, con máxima puntuación.
  - Variante *Could*: defender el castillo.

## Diseño de la nueva visión

### Mapa
- **Procedural por semilla** y determinista (misma semilla → mismo mapa; usa el puerto `RandomGenerator`, no
  `Math.random`). Rejilla de 60 px (32×18 en el mundo de 1.920×1.080; decidido en 0015): hierba, bosques (manchas), árboles sueltos, agua/ríos y puentes.
- **Conectividad garantizada**: toda zona relevante es alcanzable (puentes sobre el agua).
- Mundo de varias pantallas, cámara que sigue al jugador, **límites duros** (borde de agua). **Sin desniveles.**
- Colisión del jugador contra troncos (no contra la copa) y agua.
- **El castillo ya viene en el mapa**, uno por partida, en el punto de inicio del jugador: el generador reserva la
  zona de inicio con el castillo (0015 reserva la zona; el castillo sólido llega con 0016 y la tienda con 0024).
- Genera también: zonas ricas en recursos con campamentos de guardianes, casas goblin, torres goblin, solares de obra
  y montones de leña aleatorios.

### Navegación de enemigos
Campo de flujo (*flow field*) desde la celda del jugador; los enemigos usan los puentes. Los edificios propios
bloquean celdas y obligan a recalcular el campo al construirse. Encaja con la deuda "sin separación entre enemigos
la horda se amontona".

### Personajes (`content/characters.json`)
Se elige al inicio:
- **Arquero**: arco (el arma de proyectil actual, reconvertida).
- **Guerrero**: tajo en arco hacia donde mira (parte del pulso actual `tests`, un área circular alrededor del jugador, y pasa a un arco frontal) + pasiva de
  bloqueo "Guard"; más vida y menos velocidad.
- Decidido: las armas actuales se reconvierten en arco y tajo; no se crean armas nuevas por ahora.

### Enemigos y comportamientos
Máquina de estados por tipo, definida en contenido:
- **Goblin Barril** (kamikaze): aparece alrededor de la pantalla, va directo, explota, suelta madera.
- **Goblin TNT** (de guardia): nace en casas goblin, patrulla un radio; al entrar el jugador en su radio de alerta
  lanza dinamita con aviso en el suelo; vuelve a su puesto si el jugador se aleja.
- **Goblin Antorcha**: cuerpo a cuerpo, perseguidor.
- **Campamentos de guardianes** en zonas ricas en recursos (generados con el mapa).
- **Casas y torres de madera goblin**: generadores/defensas **destruibles** (única excepción a "edificios
  indestructibles"). Destruirlas da recompensa: oro por objetivos.
  Llevan barra de vida (0031 `combat-feedback`) y, desde 0036, cada torre lleva un arquero goblin que dispara al
  jugador en su radio.

**Bestiario solo con el pack** (no se dibujan enemigos nuevos con IA; el Enemy Pack de pago queda descartado por
licencia): caballeros rivales de otro color (arqueros, guerreros, peones), variantes de élite por color de goblin,
jefes por escala (p. ej. Antorcha 1,6×), TNT lanzabarriles, torres goblin. Recoloreado por script como opción.
Objetivo ~8–10 tipos.

### Recursos
- **Oro**: cofres y vetas al explorar, objetivos destruidos, casas propias.
- **Madera**: barriles goblin y montones aleatorios por el mapa. **Talar árboles: no por ahora** (sigue *Could*;
  un árbol destruible obligaría a recalcular el campo de flujo).
- **Carne**: ovejas neutrales que deambulan y huyen; curan (0023 `sheep-meat`; solo las ovejas la sueltan).
- **Piedra**: la sueltan los enemigos al morir con una probabilidad por tipo (0025 `stone-resource`); se gasta en las
  torres propias (0026 `build-sites`). No sustituye al oro por baja.
- Las gemas de XP (0005) se generalizan a **recogibles con tipo**.

### Progresión separada
- **XP → mejoras de personaje** (salud, velocidad, velocidad de ataque…): pausa y 1 de 3, como hoy.
- **Oro → mejoras del arma** (daño, alcance…) en el **castillo-tienda**: entrar abre la tienda con pausa; dentro
  cura despacio.
- **Madera (y piedra) → construir** en **solares de obra** del mapa: al pasar con recursos suficientes se elige casa
  (madera) o torre (madera + piedra)
  (pausa breve; sprites `*_Construction` del pack). Colocación libre = *Could*.
- El `upgrades.json` actual mezcla personaje y arma: se separa.

### Edificios propios (indestructibles)
- **Casa**: da oro cada X s. **Torre**: dispara flechas a enemigos cercanos (reutiliza el arma de proyectil con
  origen fijo). **Castillo**: tienda única de mejoras de arma + curación; uno por partida, ya en el mapa, en el punto de inicio.

### UI con el pack (*Should*, 0032 `ui-kit`; sube desde *Could* el 2026-11-26)
Banners, botones, cintas y paneles para menú, guía, pausa, resultados, cartas, tienda, obra y HUD; nine-slice; fuente
pixel local (la CSP estricta impide cargarla de fuera). Los iconos de las mejoras (0034) y el audio (0035) van
después.

## Backlog MoSCoW (v2.0, tentativo)
Propuesta de alcance para el TFM; los changes concretos están en "Orden tentativo". Un Must nuevo exige bajar otro a
Should.

| Prioridad | Contenido |
|---|---|
| **Must** (hecho) | Movimiento · 2 armas automáticas · oleadas · colisiones y vida · gemas de XP · subida de nivel con 3 opciones · temporizador, victoria y derrota · HUD · menú · guardado local + exportar/importar · despliegue público (0001–0011) |
| **Must** (nuevo) | Arte con sprites del pack CC0 y tema medieval (0012) · mundo grande con cámara y límites (0013) · mapa procedural por semilla con colisión (0015) · arte del mapa (0016) · vista a pantalla completa (0017) · recorte del arte del mapa fuera de cámara (0018) · navegación por campo de flujo (0019) |
| **Should** | Comportamientos de enemigos (0020, parte A hecha) · casas y torres goblin con TNT de guardia (0021) · recursos (0022, hecho) · ovejas, carne y curación (0023, hecho) · progresión separada y castillo-tienda (0024, hecho) · piedra como recurso (0025, hecho) · solares de obra: casa y torre (0026, hecho) · oferta de obra al tocar el solar (0027, hecho) · guía «Cómo jugar» en el menú (0028) · mapa vivo: decoración y árboles animados (0029) · recogibles visibles y animados (0030) · barras de vida y números de daño (0031) · UI del pack aplicada a la apariencia general (0032) · juego en el navegador móvil con controles táctiles (0033, sin núcleo, en paralelo a los de contenido) · iconos de las mejoras (0034) · audio: música, efectos y opciones de volumen (0035) · arqueros en las torres goblin (0036) · elección de personaje y Guerrero (0037, aplazado hasta tener cerrados 0024 y 0026) · pasada de equilibrio como diseño (balance-pass-2, número al empezar) · campamentos de guardianes en zonas ricas (sin número, tras 0023) ·
modo Objetivos · meta-progresión guardada · un jefe final · accesibilidad (las opciones de audio las absorbe 0035) |
| **Could** | ciclo día/noche · minimapa/niebla de guerra · modo Infinito · victoria "defender el castillo" · talar árboles · colocación libre de edificios · jefes por escala · login con Google + Supabase · reto diario con semilla compartida · i18n ES/EN · PWA |
| **Won't** | Multijugador · desniveles/terreno multinivel · monetización · leaderboard con re-simulación · enemigos dibujados con IA (la IA solo en los iconos de mejora, ADR-0030) |

Nota: v1 tenía "mapas procedurales complejos" en Won't. Se acota a un mapa de rejilla sin desniveles y entra como
Must (0015); lo que baja a Should es todo el bloque de contenido 0020–0037.

Renumeración (2026-11-23): 0014 acabó siendo `e2e-manual-step` (infraestructura de tests), así que el mapa
procedural pasa a 0015. Al aprobar 0015 se partió en mapa puro (0015) y arte del mapa (0016), y se añadió la vista
a pantalla completa (0017); el campo de flujo pasa a 0018 y el bloque Should, a 0019–0023.

Renumeración (2026-11-24): 0018 acabó siendo `map-culling` (recorte del arte del mapa fuera de cámara), así que el
campo de flujo pasa a 0019 y el bloque Should, a 0020–0024.

Renumeración (2026-11-24): el change 0020 `enemy-behaviors` cerró solo su parte A; la parte B (casas y torres
goblin, TNT de guardia y campamentos) pasa a ser el change propio 0021 `goblin-camps` y el bloque Should pasa a
0021–0025.

Renumeración (2026-11-24): 0020 y 0021 están hechos y archivados. El autor aplaza el Guerrero (antes 0022
`characters`) hasta tener cerradas más mecánicas: 0023 separa `upgrades.json` en mejoras de personaje (XP) y de arma
(oro), y el Guerrero necesita ese formato; así no se rehacen sus mejoras ni se recalibra el balance dos veces.
Además entra el change nuevo 0025 `goblin-tower-archers`. El bloque Should queda: 0022 `resources-sheep` (antes
0023), 0023 `split-progression-castle` (antes 0024), 0024 `build-sites` (antes 0025), 0025 `goblin-tower-archers`
(nuevo) y 0026 `characters` (antes 0022).

Renumeración (2026-11-24, segunda): 0022 se cerró solo con recursos recogibles con tipo (XP, oro, madera), sus
fuentes y los contadores del HUD (PR #54/#55; el id histórico del change es `0022-resources-sheep`). Las ovejas
neutrales, la carne y la curación salen de él y pasan al change nuevo 0023 `sheep-meat`, justo después. El resto
se desplaza un número: 0023 `split-progression-castle` (antes 0023) pasa a 0024; 0024 `build-sites`, a 0025;
0025 `goblin-tower-archers`, a 0026; 0026 `characters`, a 0027. Los campamentos de guardianes (sin número) quedan
"tras 0023 sheep-meat".

Renumeración (2026-11-25): 0023 y 0024 están hechos y archivados. Entra el change nuevo 0025 `stone-resource`
(piedra recogible, pequeño) antes de `build-sites`, porque las torres de caballeros se pagarán con madera + piedra.
Se desplazan un número: 0025 `build-sites` pasa a 0026; 0026 `goblin-tower-archers`, a 0027; 0027 `characters`, a
0028. Bloque Should resultante: 0025 `stone-resource`, 0026 `build-sites`, 0027 `goblin-tower-archers`,
0028 `characters`, balance-pass-2 y campamentos de guardianes.

Renumeración (2026-11-25, segunda): 0026 `build-sites` está hecho. Entra el change nuevo 0027 `site-contact`
(la oferta de obra pasa a ser por contacto con el solar, sin punto de acceso) antes de los arqueros. Se desplazan un
número: `goblin-tower-archers` pasa de 0027 a 0028 y `characters`, de 0028 a 0029. Bloque Should resultante: 0027
`site-contact`, 0028 `goblin-tower-archers`, 0029 `characters`, balance-pass-2 y campamentos de guardianes.

Renumeración (2026-11-25, tercera): 0027 `site-contact` está hecho. Entran cuatro changes nuevos antes de las torres
arqueras, aprobados por el autor: 0028 `menu-guide`, 0029 `living-map`, 0030 `pickup-visibility` y 0031
`combat-feedback`. `goblin-tower-archers` pasa de 0028 a 0032 y `characters`, de 0029 a 0033. Las barras de vida de
casas y torres goblin se mueven de `goblin-tower-archers` a 0031. Bloque Should resultante: 0028 `menu-guide`,
0029 `living-map`, 0030 `pickup-visibility`, 0031 `combat-feedback`, 0032 `goblin-tower-archers`, 0033
`characters`, balance-pass-2 y campamentos de guardianes. Los cuatro nuevos son Should y no suben ningún Must.

Renumeración (2026-11-26): 0031 `combat-feedback` está hecho. Entran tres changes nuevos justo después, aprobados por
el autor: 0032 `ui-kit`, 0033 `upgrade-icons` y 0034 `audio`. Los tres son Should y no suben ningún Must: "UI del
pack" y "audio" suben desde Could, y las "opciones de audio" del Should quedan absorbidas por 0034.
`goblin-tower-archers` pasa de 0032 a 0035 y `characters`, de 0033 a 0036. Bloque Should resultante: 0032 `ui-kit`,
0033 `upgrade-icons`, 0034 `audio`, 0035 `goblin-tower-archers`, 0036 `characters`, balance-pass-2 y campamentos de
guardianes. 0033 va después de 0032 porque el icono se encaja en el marco de carta de la UI del pack.

Renumeración (2026-11-26, 2.ª): el spike móvil (`spike/mobile`) salió muy sencillo y no toca el núcleo, así que el
change se adelanta: entra 0033 `mobile-web` justo después de 0032 `ui-kit` (en curso, no se renumera). Es el
"controles táctiles" que estaba en el Should sin número, ampliado a jugar en el navegador del móvil; no sube ningún
Must. Se desplazan un número: `upgrade-icons` pasa de 0033 a 0034, `audio` de 0034 a 0035, `goblin-tower-archers`
de 0035 a 0036 y `characters` de 0036 a 0037. Bloque Should resultante: 0032 `ui-kit`, 0033 `mobile-web`,
0034 `upgrade-icons`, 0035 `audio`, 0036 `goblin-tower-archers`, 0037 `characters`, balance-pass-2 y campamentos de
guardianes. Va tras 0032 para que el HUD y los paneles se escalen una sola vez con la UI del pack.

### Historias Must nuevas (criterios clave)

**0012 · Como jugador quiero ver caballeros y goblins con sprites del pack para que el juego tenga identidad
medieval.**
- Given el repo, When se hace `git ls-files`, Then solo hay assets cuya licencia CC0 está registrada (no el Free Pack).
- Given una partida, When se renderiza, Then jugador y enemigos usan sprites animados y el núcleo no cambia.

**0013 · Como jugador quiero explorar un mundo más grande que la pantalla para tener algo que descubrir.**
- Given el jugador en el borde del mundo, When sigue empujando, Then no sale de los límites.
- Given el jugador moviéndose, When avanza, Then la cámara lo sigue y los enemigos aparecen alrededor de la vista.

**0015 · Como jugador quiero un mapa distinto por semilla, con bosques y ríos, para que cada partida se sienta
nueva.**
- Given la misma semilla, When se genera dos veces, Then los mapas son idénticos celda a celda.
- Given cualquier semilla de 1..50, When se genera, Then el jugador alcanza todas las zonas clave.
- Given un tronco o una celda de agua, When el jugador se mueve contra ella, Then no la atraviesa; la copa sí
  (la copa llega con el arte de 0016; en 0015 el mapa se pinta con colores de reserva).

**0016 · Como jugador quiero ver agua, orillas, árboles y puentes con el arte del pack para que el mapa se lea de
un vistazo.**
- Given el repo, When se hace `git ls-files`, Then los tiles nuevos tienen su entrada CC0 en la nota de procedencia.
- Given un mapa generado, When se renderiza, Then las orillas usan autotile y el agua tiene espuma animada.
- Given el mapa real, When empieza la partida, Then hay un castillo Blue sólido (huella de ~5 × 4 celdas) que el
  jugador no atraviesa y el jugador nace ante su puerta; con `map=empty` no hay castillo y nace en el centro.
- Given un árbol o el tejado del castillo, When una entidad pasa por detrás, Then la copa y el tejado se pintan por
  encima de jugador, enemigos y proyectiles; el tronco bloquea y la copa no.
- Given las semillas 1..50 con el castillo, When se mide con el bot de referencia, Then el balance sigue en banda
  (`player.speed` 215) y el mapa es idéntico celda a celda por semilla.
- Nota: el castillo cambia el núcleo (dominio, generador, firma dorada, bot de referencia y punto de salida). Los
  enemigos lo atraviesan hasta 0019 (deuda aceptada).

**0017 · Como jugador quiero que el juego ocupe todo el monitor para ver más mapa a mi alrededor.**
- Given cualquier tamaño de ventana, When se juega, Then la vista ocupa la ventana completa y la cámara sigue al
  jugador hasta los bordes del mundo.
- Given la misma semilla en dos monitores distintos, When se simula, Then la partida es idéntica (la distancia de
  aparición de enemigos no depende del tamaño de la pantalla).

**0019 · Como jugador quiero que los enemigos rodeen obstáculos y usen puentes para que la horda no se quede
atascada.**
- Given un río con un puente, When el jugador está al otro lado, Then los enemigos cruzan por el puente.
- Given 300 enemigos, When se simula el campo de flujo, Then el tick se mantiene dentro del presupuesto fijado en el
  spike previo.
- Nota: el criterio del recálculo por edificios nuevos pasa a 0026 build-sites (en 0019 el mapa no cambia durante
  la partida). Se acepta el apilamiento en los puentes (sin separación entre enemigos).

**0026 · build-sites (criterio movido desde el campo de flujo).**
- Given un edificio nuevo, When se construye, Then el campo se recalcula y los enemigos lo rodean.
- Coste (decidido con 0025): la casa cuesta madera; la torre (de caballeros, de piedra como el castillo) cuesta madera
  + piedra. Given un solar y recursos insuficientes (p. ej. madera sin piedra para la torre), When el jugador pasa,
  Then no se ofrece la torre. Cada recurso tiene destino: oro a la tienda, madera a casas, madera + piedra a torres.

### Historias Should con detalle

**0025 · stone-resource · Como jugador quiero que los enemigos suelten piedra al morir y poder recogerla, para
reunir el material que luego necesitaré para construir torres.**
- Contexto: change pequeño; la piedra aún no se gasta (su destino es 0026 build-sites). Es ADEMÁS del oro por baja de
  0024, no en su lugar: el oro por baja sigue alimentando la tienda y no se toca, para no recalibrar su economía.
- Given un enemigo con probabilidad de piedra mayor que 0 en `content/`, When muere, Then puede soltar un recogible
  `stone` (quinto tipo junto a `xp | gold | wood | meat`) según la tirada; con probabilidad 0 nunca suelta.
- Given la probabilidad por tipo de enemigo, When se lee el contenido, Then cada tipo la declara en `content/`
  (validada con zod, sin números mágicos) y los tipos pueden diferir.
- Given un recogible `stone` en el suelo, When el jugador lo toca, Then se recoge como los demás y suma al contador de
  piedra de la partida; Given el tope por tipo alcanzado, When cae otra, Then el relleno suma a la más antigua de su
  tipo (como los demás recogibles).
- Given el HUD, When hay partida, Then muestra icono y número de piedra junto a los de oro y madera; el contador no se
  guarda ni sale en resultados.
- Given la misma semilla y los mismos movimientos, When se simula dos veces, Then las piedras caídas son idénticas, y
  Given una semilla, When se compara con la línea base de 0024, Then oleadas, mapa, estructuras, recursos y ovejas
  (sus firmas doradas) no cambian porque la tirada sale de un flujo de azar propio.
- Given las semillas 1..50 con el bot de referencia, When se mide, Then el balance es idéntico a la línea base de
  0024 (30/50 victorias, 0 quietos), porque la piedra aún no se gasta.
- Arte: Tiny Swords Update 010 no trae icono de piedra como recurso; se usan `Deco/04.png`, `05.png` y `06.png`
  (rocas de 64 × 64: pequeña, mediana, grande), CC0, como recogible sin animación de aparición. Cada una con su
  entrada en `content/asset-provenance.json`; nada del Free Pack. El icono del HUD reutiliza una de ellas.
- Prioridad: Should (pequeño).

**0023 · sheep-meat · Como jugador quiero encontrar ovejas que deambulan y huyen de mí, y que al abatirlas
suelten carne que me cure, para tener una razón de explorar y una forma de recuperar vida sin castillo.**
- Contexto: las ovejas se separaron de 0022 (que se cerró solo con recursos y contadores). Decidido: solo las ovejas
  sueltan carne; cada pieza cura una cantidad fija de contenido (sin número mágico) con tope en la vida máxima.
- Given una oveja sin el jugador cerca, When pasan ticks, Then deambula dentro de celdas caminables.
- Given el jugador que entra en el radio de huida de una oveja, When pasan ticks, Then la oveja se aleja de él.
- Given una oveja abatida, When muere, Then suelta una pieza de carne recogible; ningún enemigo ni estructura la suelta.
- Given el jugador con vida incompleta, When recoge carne, Then recupera la cantidad de contenido sin superar su
  vida máxima.
- Given la misma semilla y los mismos movimientos, When se simula dos veces, Then las ovejas y la carne son
  idénticas (sin `Math.random`).
- Preguntas abiertas (no decididas): si las ovejas huyen también de los enemigos; si sufren fuego amigo y
  explosiones; cuántas ovejas hay por mapa.
- Arte disponible (Tiny Swords Update 010, CC0, con entrada en `content/asset-provenance.json`):
  `Resources/Sheep/HappySheep_Idle.png` (8 fotogramas de 128), `Resources/Sheep/HappySheep_Bouncing.png`
  (6 de 128) y `Resources/Resources/M_Idle.png` (carne).

**0027 · site-contact · Como jugador quiero que se me ofrezca construir al tocar un solar por cualquier lado, para
no tener que buscar un punto de acceso y entender de un vistazo qué puedo construir y qué me falta.**
- Motivo: en 0026 la oferta solo sale en un punto de acceso bajo la huella, y los solares libres no estorban a nadie.
- Given un solar libre, When pasan ticks desde el tick 0, Then bloquea el paso a todos (jugador, enemigos, ovejas) y
  el campo de flujo lo rodea.
- Given el jugador que toca la huella del solar por cualquier lado, When el solar está armado, Then se ofrece la obra
  (sin punto de acceso).
- Given una oferta cerrada, When el jugador se aleja 64 px del solar, Then el solar se re-arma y puede ofrecerse de
  nuevo; mientras siga cerca no se reabre.
- Given el panel de obra, When se abre, Then muestra siempre casa y torre, con iconos de recurso y coste.
- Given una opción no asequible, When se muestra, Then queda desactivada con «faltan N» por cada recurso que falta.
- Given las semillas 1..50 con el bot, When se mide, Then victorias en [25, 35], 0 quietos y lote local < 150 s
  proyectado.
- Prioridad: Should (pequeño). Cambia el contenido de solares y su firma dorada.

**0028 · menu-guide · Como jugador quiero un botón «Cómo jugar» en el menú de inicio con páginas que expliquen las
mecánicas, para entender el juego sin probar y fallar.**
- Motivo: el juego ya tiene XP, cuatro recursos, tienda, solares, enemigos con comportamientos y campamentos, y nada
  lo explica al jugador nuevo.
- Given el menú de inicio, When el jugador pulsa «Cómo jugar», Then se abre un modal con la primera página y los
  controles anterior, siguiente y cerrar.
- Given el modal abierto, When el jugador navega con anterior y siguiente, Then ve en orden las páginas: movimiento
  y armas automáticas, XP y mejoras de personaje, recursos (oro, madera, carne, piedra, gemas), castillo-tienda,
  solares de obra (casa y torre), enemigos y campamentos, y victoria y derrota; en la primera no hay anterior y en la
  última no hay siguiente.
- Given el modal abierto, When el jugador pulsa cerrar o Esc, Then vuelve al menú de inicio sin iniciar partida.
- Given `?e2e` al cargar, When aparece el menú o se salta, Then el modal no se muestra por sí solo.
- Given el texto de las páginas, When se lee el contenido, Then vive en `content/` validado con zod (sin textos
  fijos en el código).
- Alcance: solo DOM e infraestructura; el núcleo y el balance no cambian (idéntico a `BALANCE_BASELINE`).
- Prioridad: Should (pequeño).

**0029 · living-map · Como jugador quiero un mapa con más decoración y con árboles y estructuras animados, para que
el mundo se vea vivo y no una rejilla estática.**
- Motivo: Tiny Swords Update 010 trae Deco 01–18 y el repo solo usa 04–06 (rocas de piedra); los árboles tienen más
  fotogramas de los que se usan hoy como modelos fijos.
- Given un mapa generado, When se pinta, Then aparece decoración no bloqueante (Deco 01–18 salvo las rocas ya
  usadas) repartida por la hierba, con variedad por el flujo de decoración de arte; no toca el núcleo ni las firmas
  doradas (`MAP_GOLDEN`, `STRUCTURE_GOLDEN`, etc.).
- Given la decoración, When se aplica el recorte por cámara de 0018, Then solo se pinta la que cae en la vista.
- Given los árboles, When pasan los frames, Then se animan con una fase distinta por árbol (no se balancean todos a
  la vez).
- Given la torre goblin intacta, When se renderiza, Then se anima con los 4 fotogramas de `Wood_Tower_Red` (hoy solo
  el 0).
- Given las semillas 42 y 123, When se cuentan los objetos del mapa, Then no superan 1.000 (hoy 737/820).
- Given una hoja nueva, When se versiona, Then tiene entrada en `content/asset-provenance.json` y no procede del Free
  Pack.
- Nota: castillo, casas, torres azules, casa goblin y mina de oro tienen un solo fotograma y quedan estáticos.
- Preguntas abiertas: densidad de la decoración; si evita caminos, puertas y solares (propuesta: solo en hierba libre
  fuera de huellas, de la zona de inicio y de los accesos); fotogramas exactos del balanceo de los árboles (a
  verificar en explore).
- Prioridad: Should. Solo infraestructura y contenido; balance idéntico.

**0030 · pickup-visibility · Como jugador quiero ver con claridad los recogibles (oro, madera, carne, piedra y gemas
de XP), para no perderme lo que puedo recoger en una pantalla grande.**
- Motivo: en un monitor 4K los recogibles (escala 0,3, unos 38 px) se ven diminutos y estáticos.
- Given un recogible de oro, madera o carne, When aparece, Then reproduce su hoja de aparición (`G_Spawn`, `W_Spawn`,
  `M_Spawn`, 7 fotogramas de 128 px) y después flota levemente.
- Given una piedra o una gema de XP (sin hoja de aparición), When aparece, Then solo flota levemente.
- Given los cinco tipos, When se renderizan, Then su escala es mayor que la actual (valor en `appearance.json`).
- Given el radio de recogida, When se compara con el anterior, Then no cambia y el balance es idéntico a
  `BALANCE_BASELINE`.
- Alcance: solo infraestructura y contenido.
- Pregunta abierta para explore/propose: si lo pequeño es todo el juego en pantallas grandes, valorar un zoom de
  cámara por tamaño de ventana (afecta a ADR-0014, al área visible y exige revisar el anillo de aparición). Decisión
  del autor; puede quedar fuera del change.
- Prioridad: Should.

**0031 · combat-feedback · Como jugador quiero ver la vida de casas y torres goblin y el daño de cada golpe, para
saber cuánto falta para destruir algo y cuánto daño hago y recibo.**
- Motivo: no hay forma de saber cuánto falta para destruir una casa o torre (criterio movido desde `goblin-tower-archers`, entonces 0032) ni cuánto
  daño aplica cada golpe.
- Given una casa o torre goblin con vida completa o dañada, When se renderiza, Then lleva una barra de vida sobre
  ella que refleja su vida actual.
- Given una casa o torre goblin destruida (en ruina), When se renderiza, Then la barra ya no se muestra.
- Given un golpe a un enemigo, estructura, oveja o al jugador, When el tick termina, Then aparece un número con el
  daño aplicado en la posición del objetivo y se desvanece.
- Given la misma semilla y las mismas entradas, When se simula dos veces, Then los golpes de cada tick expuestos en
  el snapshot son idénticos (sin azar; el render los muestra con un pool).
- Given las semillas 1..50 con el bot, When se mide, Then el balance es idéntico a `BALANCE_BASELINE`.
- Preguntas abiertas: color por tipo de objetivo (propuesta: jugador en rojo); agrupar los golpes del mismo tick por
  objetivo; tope de números simultáneos.
- Resuelto en 0031: un color por clase (jugador en rojo), un golpe por objetivo y tick con la suma de lo aplicado y
  un pool de 48 números; tope de 48 golpes por tick (el del jugador aparte). Estado: hecho (apply 2026-11-26).
- Prioridad: Should.

**0032 · ui-kit · Como jugador quiero que menú, cartas, tienda y HUD usen los banners, botones y paneles del pack,
para que el juego tenga una apariencia medieval coherente y no cajas de color planas.**
- Motivo: el arte del mundo ya es Tiny Swords (0012, 0016, 0029, 0030) pero la interfaz sigue siendo DOM y formas de
  Phaser sin el aspecto del pack.
- Given el menú, la guía, la pausa, los resultados, las cartas de mejora, la tienda, el panel de obra y el HUD, When
  se renderizan, Then usan piezas de UI del pack (banners, botones, cintas, paneles) en lugar de fondos planos.
- Given un overlay con fondo de pieza de UI, When cambia el tamaño de la ventana o la escala de UI (×1/×2), Then el
  marco se estira sin deformar las esquinas (nine-slice) y el texto no se desborda.
- Given una pieza de UI que no carga, When se renderiza, Then se muestra el aspecto de reserva actual y el juego sigue
  siendo jugable.
- Given el repo, When se hace `git ls-files`, Then cada pieza de UI nueva tiene entrada en
  `content/asset-provenance.json` y ninguna procede del Free Pack (lo vigila `guard-assets.mjs`).
- Given las semillas 1..50 con el bot, When se mide, Then el balance es idéntico a `BALANCE_BASELINE` y las firmas
  doradas no cambian.
- Alcance: solo render, DOM y contenido de aspecto; el núcleo no cambia.
- Riesgo de procedencia: comprobar en explore qué piezas de UI trae Update 010 (CC0) y que no vengan del Free Pack;
  si falta alguna pieza (p. ej. un botón), se queda con el aspecto actual y no se dibuja con IA (la IA solo se admite
  en los iconos de mejora y de la curación, ADR-0030; ver 0034).
- Preguntas abiertas: si los overlays DOM usan las piezas como CSS (`border-image` / 9-slice) y el HUD de Phaser como
  `NineSlice` (propuesta: sí, un solo juego de piezas con dos adaptadores); fuente pixel local (CSP estricta);
  qué overlays entran en el primer corte si el alcance aprieta (propuesta: menú, cartas y HUD primero).
- Prioridad: Should (sube desde Could el 2026-11-26).

**0033 · mobile-web · Como jugador quiero jugar en el navegador de mi móvil con controles táctiles, para poder
echar una partida sin PC ni app que instalar.**
- Motivo: el juego ya se publica en Pages y corre en el navegador del móvil, pero solo hay teclado. El spike
  desechable `spike/mobile` (2026-11-26, `docs/ai-log/2026-11-26-spike-mobile.md`, rama sin fusionar) demostró que
  basta infraestructura, composición y CSS: va fluido en un Pixel 7 Pro y `PlayerInput` ya es analógico, así que el
  núcleo no cambia.
- Given un dispositivo táctil (`pointer: coarse`) y la partida en marcha, When el jugador apoya el dedo en la mitad
  izquierda y lo arrastra, Then nace un joystick flotante ahí y el arquero se mueve en esa dirección con velocidad
  proporcional al desplazamiento (radio y zona muerta en `content/`); al soltar, se detiene.
- Given la partida recién empezada en táctil y sin movimiento aún, When se muestra la pantalla, Then se ve un joystick
  tenue en reposo con el texto «Arrastra aquí para moverte», que desaparece tras el primer movimiento de la partida.
- Given la partida, la tienda o la obra en táctil, When el jugador pulsa los botones de abajo a la derecha, Then
  pausa/salir hace lo mismo que Esc, reiniciar lo mismo que R, y pantalla completa activa el modo a pantalla completa
  donde el navegador lo permita.
- Given el móvil en vertical, When se carga o gira, Then un aviso «Gira el móvil» cubre el juego y la partida no
  avanza; al ponerlo en horizontal el aviso desaparece y la partida continúa.
- Given una pantalla de móvil en horizontal (p. ej. 844 × 390), When se muestra la partida, Then el lienzo usa una
  resolución virtual de alto base fijo (640, en `content/`, validado con zod) y la vista enseña al menos tanto mundo
  como el mínimo hoy en escritorio (960 × 540), sin tocar la cámara ni el recorte del mapa.
- Given un dispositivo con teclado y pantalla táctil a la vez, When hay teclas pulsadas, Then manda el teclado y el
  joystick se ignora; en escritorio sin pantalla táctil no aparece ningún control táctil.
- Given las semillas 1..50 con el bot, When se mide, Then el balance, `BALANCE_BASELINE` y las firmas son idénticos
  (sin cambios en el determinismo); `?e2e` solo desactiva la autodetección y `?e2e&mobile=1` lo activa.
- Alcance, dentro: `TouchJoystick`, barra de botones DOM, resolución virtual (EXPAND), aviso de orientación,
  `viewport`/CSS táctil, constantes en `content/` y tests de los adaptadores con dobles (como mucho 1 E2E con
  `hasTouch` en el proyecto `logic`). Fuera: app nativa; PWA (sigue en *Could*); gamepad (*Could*); diseño para
  vertical; cambios de núcleo o de balance.
- Riesgos y preguntas abiertas (a cerrar en explore):
  - HUD en móvil: con EXPAND el texto del HUD queda a ~0,6 de su tamaño. ¿Escala propia (mínimo legible) o diseño
    de HUD móvil? Conviene coordinarlo con 0032 `ui-kit`.
  - iOS Safari: sin Fullscreen API en iPhone ni bloqueo de orientación y sin probar. ¿Se oculta el botón de pantalla
    completa allí? Se necesita un iPhone o aceptar «no verificado en iOS».
  - `devicePixelRatio` > 1: a resolución nativa el lienzo se ve algo blando; decidir entre fijar un tope de
    resolución o aceptarlo, midiendo fps con la horda llena.
  - Alto base 640: ¿es el mejor compromiso entre mundo visible y tamaño de los sprites? Se ajusta con pruebas.
  - Usabilidad con el dedo de las cartas de mejora y de los paneles de tienda y obra (tamaño de las zonas de
    pulsación, ≥ 44 px CSS), y de pausa, menú y guía.
  - ¿Un change o dos (pantalla y controles)? Propuesta: uno, porque el spike salió sencillo y los dos son
    infraestructura; si explore saca el HUD como trabajo grande, separar "pantalla móvil" de "controles".
  - Acceso para probar desde el móvil: USB con `chrome://inspect` y reenvío de puerto (la red local pide permisos).
- Prioridad: Should (el "controles táctiles" ya estaba en Should; no sube ningún Must).

**0034 · upgrade-icons · Como jugador quiero ver un icono en cada mejora de personaje y de arma, para reconocerlas de
un vistazo y que cartas y tienda no sean solo texto.**
- Motivo: las 9 mejoras de personaje (cartas por XP) y las 6 de arma (tienda) se distinguen hoy solo por su nombre.
  Va después de 0032 porque el icono se encaja en el marco de carta de la UI del pack.
- Contexto: hubo una prueba previa en otra sesión con 4 imágenes generadas con Antigravity (se agotó el cupo
  gratuito). Faltan 15 para cubrir las 15 mejoras.
- Given una carta de mejora de personaje o un artículo de la tienda, When se muestra, Then lleva el icono de su
  mejora, ligado por id en `content/` (validado con zod, sin rutas fijas en el código).
- Given una mejora sin icono o con la imagen rota, When se muestra, Then usa un icono de reserva por categoría y el
  juego sigue siendo jugable.
- Given los iconos, When se versionan, Then tienen fondo transparente, un tamaño común y una entrada en
  `content/asset-provenance.json` con herramienta, fecha, términos de uso y prompt.
- Given las semillas 1..50 con el bot, When se mide, Then el balance es idéntico a `BALANCE_BASELINE`; ids de mejora y
  firmas intactos.
- Alcance: render, DOM y contenido; el núcleo no cambia.
- Riesgo de procedencia: hoy el Won't dice "enemigos dibujados con IA"; los iconos no son enemigos, pero hace falta
  una regla y un registro de las imágenes generadas con IA. Probable ADR (política de procedencia para imágenes IA,
  decisión del autor). Cualquier icono sin entrada de procedencia lo bloquea el guardarraíl. Resuelto en 0034 con
  ADR-0030: lista `generated[]` aparte, limitada a `public/assets/icons/`.
- Preguntas abiertas: qué herramienta genera las 15 que faltan (otra herramienta, lotes en varios días o iconos de
  reserva por stat); coherencia de estilo con Tiny Swords (propuesta: revisar las 4 existentes antes de generar más);
  alternativa sin IA con piezas de Update 010 recoloreadas. Resuelto en 0034: los 16 iconos y las 2 reservas los
  dibuja Claude Code (Claude Opus 5.5) como pixel art con un script determinista versionado
  (`scripts/icons/draw-icons.mjs`); las 4 de prueba no entran.
- Prioridad: Should.

**0035 · audio · Como jugador quiero música de fondo y efectos de sonido con opciones de volumen y silencio, para que
el juego tenga inmersión y pueda jugar sin sonido cuando quiera.**
- Motivo: el juego es mudo. Tiny Swords no trae audio. Absorbe las "opciones de audio" que ya estaban en el Should.
- Given el menú de inicio, When el jugador pulsa Jugar, Then arranca la música de fondo (el navegador bloquea el
  autoplay hasta un gesto del usuario); antes de ese gesto no suena nada.
- Given una partida, When ocurren golpe recibido, impacto de flecha, muerte de enemigo, recogida, subida de nivel,
  explosión y compra u obra, Then suena el efecto correspondiente, disparado desde el snapshot (hits de 0031,
  recogibles, fases).
- Given cientos de golpes por segundo, When se solicitan efectos, Then no suenan más voces simultáneas que el tope de
  contenido (los sobrantes se descartan).
- Given las opciones de audio, When el jugador cambia volumen o silencio, Then el ajuste se aplica al instante y se
  guarda en local (validado con zod al leerlo); con datos corruptos se usan los valores por defecto.
- Given `?e2e` o una pestaña sin audio disponible, When arranca, Then el juego funciona igual y no falla si el audio no
  carga.
- Given las semillas 1..50 con el bot, When se mide, Then balance y firmas son idénticos: el audio es solo un adaptador
  de infraestructura que reacciona al snapshot y no toca el núcleo.
- Riesgo de procedencia: cada fichero de audio con su entrada de procedencia (fuente, licencia, URL, fecha) y el
  guardarraíl `.claude/hooks/guard-assets.mjs`, hoy centrado en assets gráficos, debe cubrir también `.ogg`, `.mp3` y
  `.wav`. Solo CC0 salvo que el autor acepte atribución (CC-BY).
- Preguntas abiertas (decisión del autor, a cerrar en explore): fuentes candidatas (Kenney CC0, OpenGameArt filtrado
  por CC0, Freesound filtrado por CC0, efectos generados con jsfxr/sfxr) y si se acepta CC-BY con atribución; si la
  música encaja con el tema medieval o se empieza solo con efectos; dónde van las opciones (menú y pausa); formato y
  peso de los ficheros para Pages.
- Prioridad: Should (sube desde Could el 2026-11-26).

**0036 · goblin-tower-archers · Como jugador quiero que las torres goblin me disparen, para que atacar un campamento
sea una decisión de riesgo y no un paseo.**
- Motivo: hoy las torres son estructuras destruibles sin comportamiento (decisión D4 de 0021).
- Nota: los dos criterios de barra de vida de casas y torres se movieron a 0031 `combat-feedback`.
- Given una torre goblin intacta con su arquero y el jugador fuera de su radio, When pasan ticks, Then el arquero
  no dispara.
- Given el jugador que entra en el radio de la torre, When transcurre su cadencia, Then el arquero dispara una
  flecha al jugador y, si impacta, resta el daño de contenido.
- Given la misma semilla y los mismos movimientos del jugador, When se simula dos veces, Then los disparos de las
  torres son idénticos (sin `Math.random`).
- Preguntas abiertas: radio, cadencia y daño de la flecha (todo en `content/`); si el arquero muere con la torre al
  destruirse (propuesta: sí, sin cadáver propio); si la flecha tiene aviso o es esquivable (propuesta: proyectil
  visible y lento, esquivable, sin aviso en el suelo); si las flechas golpean a otros enemigos (propuesta: no).
- Riesgo de procedencia: hay que comprobar en explore si Tiny Swords Update 010 trae un goblin arquero. Si no, se
  usa el arquero de otro color del pack (bestiario "caballeros rivales") o se deja la torre sin figura visible; no se
  dibuja ningún enemigo con IA. Cualquier sprite nuevo exige su entrada en `content/asset-provenance.json`.
- Efecto en balance: las torres con disparo cambian el riesgo de explorar; se vuelve a medir la banda del bot y se
  comprueba que el bot v3 sigue siendo representativo (deuda W3 de 0020).

**0037 · characters · Como jugador quiero elegir entre Arquero y Guerrero para poder jugar de forma distinta.**
- Nota de orden: era 0022. Se movió al final del bloque porque el Guerrero necesita el formato de mejoras separado
  de 0024 (personaje por XP, arma por oro; hecho) y el balance ya estable con recursos, castillo y solares; así sus mejoras
  y su equilibrio se hacen una sola vez. Los criterios se redactan al proponer el change.

**balance-pass-2 (número al empezar) · Como jugador quiero que cada enemigo y cada personaje se sienta distinto y
justo para que la partida sea divertida y no solo "dentro de la banda".**
- Motivo: desde 0010 cada change solo recalibra para mantener el gate (25–35/50 victorias del bot, quieto pierde
  antes de 180 s); es una red de seguridad, no diseño. En 0020 el gate cuadró pero el Goblin Barril casi nunca llega
  a encender la mecha en partida real porque el arco lo mata antes. Se hace después de 0037 porque recursos,
  castillo-tienda, solares, arqueros de torre y personajes mueven los números; hacerlo antes no compensa.
- Mientras tanto, los changes pueden hacer ajustes puntuales cuando una mecánica no se percibe (p. ej. el barril,
  que ya mide 0020b).
- Given los stats (vida, daño, velocidad) de cada tipo de enemigo y de cada personaje (Arquero y Guerrero), When
  se revisan, Then quedan en `content/` con una tabla de intención por tipo y las victorias del bot siguen en banda.
- Given un lote de semillas, When se mide, Then se informa además de la tasa de victoria: daño recibido por fuente,
  barriles y TNT que llegan a actuar, ritmo de subidas de nivel y tasa de elección de mejoras (parte ya medida a
  mano en `openspec/changes/archive/2026-11-24-0020-enemy-behaviors/measurements.md`).
- Given el bot de referencia, When se revisa tras personajes, recursos y solares, Then sigue siendo representativo
  del juego real (deuda W3 de 0020) o se documenta qué ya no cubre.
- Given una sesión de playtest humano, When termina, Then hay notas (qué no se percibe, qué frustra, qué
  divierte) que alimentan los ajustes; la diversión no la mide el bot.

## Estado del backlog Must hecho (2026-11-20, sin cambios)
| Estado | Contenido | Change |
|---|---|---|
| Hecho | Movimiento · oleadas con 3 tipos de enemigo · colisiones y vida · 2 armas automáticas | 0001–0004 |
| Hecho | Gemas de XP · subida de nivel con 3 opciones | 0005 |
| Hecho | Temporizador, victoria y derrota · HUD · reinicio | 0006 |
| Hecho | Guardado local (récords + historial de 10 partidas) · exportar/importar con fusión · CSP estricta | 0007 |
| Hecho | Menú de inicio (jugar, exportar, importar, borrar datos) · pausa con Esc | 0009 |
| Hecho | Despliegue público en GitHub Pages · smoke remoto a demanda (`npm run smoke:public`, workflow `smoke-public`) | 0011 |

Los changes 0008 (infraestructura de tests) y 0010 (equilibrio) no añaden Must: habilitan y protegen a los demás.

## Orden tentativo de changes (v2.0; tentativo, se revisa tras cada spike)
Hechos: 0001 walking-skeleton → 0002 enemy-spawning → 0003 collisions-and-damage → 0004 auto-weapons →
0005 xp-and-level-up → 0006 run-lifecycle + HUD → 0007 local-save-export → 0008 e2e-fast-sim →
0009 main-menu → 0010 balance-pass → 0011 public-deploy → 0012 sprite-rendering → 0013 world-camera →
0014 e2e-manual-step → 0015 procedural-map → 0016 map-art → 0017 fullscreen-view → 0018 map-culling.

Pendientes:
| Change | Contenido | Prioridad | Spike previo |
|---|---|---|---|
| 0015 procedural-map | **Hecho (PR #36)**: mapa por semilla (hierba, troncos, río con puentes) puro y determinista, colisión del jugador, gemas recolocadas, colores de reserva, bot de referencia que esquiva y balance recalibrado; reserva la zona de inicio (ADR-0013) | Must | Sustituido por mediciones previas en explore |
| 0016 map-art | Arte del mapa: agua con espuma, orillas con autotile, árboles (copa), puente y castillo sólido (núcleo, generador, firma dorada, bot, punto de salida; `player.speed` 215), con su procedencia CC0 | Must | Autotiling de orillas y si el mapa se ve bien (puerta visual al inicio del apply) |
| 0017 fullscreen-view | **Hecho (PR #41)**: la vista ocupa toda la ventana (tope 2.560 × 1.440); aparición de enemigos desacoplada del tamaño de pantalla (anillo 1.500); mundo 3.840 × 2.160 (64 × 36); HUD y overlays anclados y escalados ×1/×2; balance recalibrado por oleadas (25/50) | Must | |
| 0018 map-culling | **Hecho (PR #43)**: recorte del arte del mapa fuera de cámara | Must | |
| 0019 flow-field | Navegación por campo de flujo (4 vecinos + línea libre, recolocación de apariciones, `maxAlive` 300) | Must | Con cientos de enemigos |
| 0020 enemy-behaviors | **Parte A hecha**: comportamiento por tipo en contenido (persecución, mecha, carga y espera), barril kamikaze con aviso y explosión de área, TNT artillero provisional con dinamita y aviso, fuego amigo, bot v3 que esquiva y balance 27/50 (ADR-0019). La parte B sigue en 0021 | Should | |
| 0021 goblin-camps | Parte B de 0020: casas y torres goblin destruibles generadas con el mapa, Goblin TNT de guardia que nace en ellas y patrulla, alerta y vuelve a su puesto, ajuste del barril. Los campamentos salen del alcance (decisión D8) | Should | |
| 0022 resources (id histórico `resources-sheep`) | **Hecho y archivado (PR #54/#55)**: recursos recogibles con tipo (XP, oro, madera), fuentes y contadores del HUD | Should | |
| 0023 sheep-meat | **Hecho y archivado (PR #58/#59)**: ovejas neutrales que deambulan y huyen del jugador, sueltan carne y la carne cura (preguntas abiertas: huida ante enemigos, fuego amigo, cuántas por mapa) | Should | |
| 0024 split-progression-castle | **Hecho y archivado (PR #60/#61)**: progresión separada + castillo-tienda (castillo ya en el mapa) | Should | |
| 0025 stone-resource | **Hecho y archivado (PR #63/#64)**: recogible `stone` (quinto tipo): lo sueltan los enemigos al morir con probabilidad por tipo (contenido, flujo de azar propio), además del oro por baja; contador e icono en el HUD; sin uso aún. Balance idéntico a la base de 0024 | Should | |
| 0026 build-sites | **Hecho (apply 2026-11-25)**: 6 solares por mapa; casa (15 madera, 1 oro cada 30 s) y torre de caballeros (30 madera + 15 piedra, flechas propias), edificios que bloquean el paso con el recálculo del campo de flujo. Bot v4 idéntico a la base; bot v5 29/50 | Should | |
| 0027 site-contact | **Hecho (apply 2026-11-25)**: oferta de obra al tocar el solar por cualquier lado (sin punto de acceso); solar libre bloqueante para todos desde el tick 0; re-armado al alejarse 64 px; panel con casa y torre siempre, iconos de recurso y «faltan N» en la no asequible. Bot v4 34/50 y bot v5 34/50 sin recalibrar | Should | |
| 0028 menu-guide | Botón «Cómo jugar» en el menú con páginas (anterior/siguiente/cerrar) que explican las mecánicas; textos en `content/` con zod; solo DOM, balance idéntico | Should | |
| 0029 living-map | Más decoración (Deco 01–18) no bloqueante, árboles animados con fase por árbol y torre goblin animada; ≤ 1.000 objetos del mapa; castillo, casas y mina quedan estáticos | Should | Densidad, zonas permitidas y fotogramas de los árboles (explore) |
| 0030 pickup-visibility | Recogibles más grandes, hoja de aparición para oro, madera y carne (`*_Spawn`) y flote leve en los cinco; radio de recogida y balance intactos | Should | ¿Zoom de cámara por tamaño de ventana? (decisión del autor) |
| 0031 combat-feedback | **Hecho (apply 2026-11-26)**: registro de golpes en el núcleo (daño aplicado sumado por objetivo y tick, ventana 15 y tope 48 en `content/combat.json`, ADR-0027); números de daño con color por clase (jugador en rojo) en un pool de 48 y barras de vida en casas y torres goblin (desaparecen en ruina). Balance y firmas idénticos | Should | |
| 0032 ui-kit | Banners, botones, cintas y paneles de Tiny Swords Update 010 en menú, guía, pausa, resultados, cartas, tienda, obra y HUD (nine-slice: CSS en DOM, `NineSlice` en Phaser); solo render, DOM y contenido de aspecto; balance y firmas intactos | Should | Inventario de piezas de UI de Update 010 (CC0, no Free Pack) |
| 0033 mobile-web | Juego en el navegador del móvil con controles táctiles: joystick flotante en la mitad izquierda con indicación en reposo, botones de pausa/salir, reiniciar y pantalla completa, aviso «Gira el móvil», resolución virtual EXPAND (alto base 640 en `content/`) y escala del HUD; solo infraestructura, composición y CSS, núcleo y balance intactos | Should | Hecho: `spike/mobile` 2026-11-26 ([ai-log](ai-log/2026-11-26-spike-mobile.md)); iOS Safari sin probar |
| 0034 upgrade-icons | **Hecho (apply 2026-11-26)**: icono de 64 × 64 para las 15 mejoras y la curación (cartas de 240 × 240 y filas de la tienda) con reserva de personaje y de arma; pixel art de Claude Code dibujado por script determinista (`scripts/icons/draw-icons.mjs`), lista `generated[]` aparte en la nota (ADR-0030); sin núcleo, balance idéntico | Should | |
| 0035 audio | Música de fondo (arranca al pulsar Jugar) y efectos (golpe recibido, impacto de flecha, muerte, recogida, subida de nivel, explosión, compra y obra) con opciones de volumen y silencio guardadas en local; adaptador de infraestructura sobre el snapshot con tope de voces; el guardarraíl de procedencia cubre audio | Should | Fuentes CC0 (Kenney, OpenGameArt, Freesound, jsfxr) y si la música encaja |
| 0036 goblin-tower-archers | Un arquero goblin en cada torre que dispara al jugador dentro de su radio (decisión D4 de 0021 superada); las barras de vida pasaron a 0031 | Should | ¿Hay goblin arquero en Update 010? (procedencia) |
| 0037 characters | Elección de personaje y Guerrero. Aplazado desde 0022 hasta tener el formato de mejoras de 0024 (hecho) | Should | ¿Es divertido el Guerrero? |
| balance-pass-2 (número al empezar) | Pasada de equilibrio como diseño, no como red de seguridad: stats por tipo de enemigo y de personaje, métricas más allá de la tasa de victoria, revisión del bot de referencia y playtest humano con notas | Should | |
| goblin-guard-camps (sin número, tras 0023 sheep-meat) | Campamentos de guardianes en zonas ricas en recursos (sacados de 0021, D8) | Should | |
| Resto | Día/noche, minimapa, jefes | Could | |

Notas:
- **Marcado Must/Should/Could es una propuesta para el TFM, no un compromiso.** Si el tiempo aprieta, se corta por
  el final de la lista.
- Cualquier change que toque `content/` (0015 en adelante) obliga a **volver a medir** la banda de victorias de 0010
  (ver 0010 · W2). Con personajes y recursos el bot de referencia deberá adaptarse.
- El mapa, el campo de flujo y las colisiones deben vivir en `domain`/`application` (puros y deterministas); Phaser
  solo dibuja.

## Preguntas abiertas
Decididas (2026-11-22, ya recogidas arriba): castillo en el punto de inicio del mapa; no talar árboles por ahora;
Update 010 es CC0; armas actuales reconvertidas en arco y tajo; Supervivencia por defecto, Objetivos *Should*,
Infinito *Could*.

Cerrada (2026-11-22): **Título** = "Greentide Vanguard" (ver Temática). Renombrar repo, URL de Pages y claves
`sprint-survivors` queda como posible tarea futura, no decidida.

Siguen abiertas:
1. **Duración del temporizador** en Supervivencia: objetivo de 5 a 10 minutos por partida (que invite a echar otra),
   con 10 min como máximo. Hoy dura 600 s. Se fija con playtests cuando estén el mapa y la exploración; cambiarla
   obliga a volver a medir el balance.
2. **Equilibrio**: sin criterio nuevo. La banda 25–35 de 0010 no se da por válida con el nuevo mapa y los recursos;
   se decidirá iterando con playtests y el bot tras cada change de contenido.

## Deuda registrada
| Origen | Deuda | Cuándo |
|---|---|---|
| 0006 · W1 | **Saldada en 0010.** Ganabilidad frágil (1 de 10 semillas con el bot sencillo, semilla 2 fija). Ahora el bot de referencia gana 30 de las semillas 1..50 y el test comprueba la banda 25–35. Sigue pendiente un playtest humano. | Change 0010 (hecho) |
| 0006 · W2 | Sin E2E de reinicio tras **victoria** (solo tras derrota); cubierto en tests de aplicación. | Con el change de equilibrio o el de menú |
| 0007 · S2 | **Saldada en 0010.** Semilla frágil 90. Los E2E de derrota usan la 42, que forma parte del conjunto y está cubierta por el invariante "quieto pierde antes de 180 s" sobre las semillas 1..50. | Change 0010 (hecho) |
| 0007 · S4 | La semilla guardada en el historial sale del objeto `probe` de E2E (`wireProgress(root, () => probe.seed)`) en vez de una fuente propia. | Con 0009 o 0010 |
| 0007 · E2E | **Saldada en 0008.** La suite E2E tardaba ~4,2 min (13 tests); cada derrota ~78 s reales. Ahora `?e2e&speed=8` (derrota en ~10 s), progreso sembrado (como mucho 1 derrota por test), 2 workers y `timeout-minutes: 6` en el job `e2e`. | Change 0008 (hecho) |
| 0008 · W2 | `.husky/pre-commit` no ejecuta `typecheck`: un commit local de 0008 entró con un error de `tsc` que solo habría cazado el CI. Añadir `tsc --noEmit` a un pre-push (o al pre-commit si el tiempo lo permite). | Próximo change de tooling o con 0009 |
| 0008 · W3 | El objetivo de suite E2E < 60 s depende de `workers: 2` (con 1 worker ~70 s) y la derrota a `speed=8` (~10 s) tiene poco margen frente al tope de 12 s; `retries: 1` en CI puede enmascarar flakiness. Vigilar los tiempos del job `e2e`. | Revisar si CI da reintentos |
| 0008 · S1/S2 | Sin E2E de `?e2e&speed=<inválido>` aislado ni de `?speed=8` sin `?e2e` avanzando a ritmo normal (cubierto en unitario). | Con 0009 si se tocan los E2E de arranque |
| 0009 · W1 | La sonda E2E no expone la visibilidad del HUD: "HUD en el menú" y "HUD tras Volver al menú" solo se cubren por capas (tests de Node), no en navegador. | Si un change toca el HUD o la sonda |
| 0009 · W2 | **Saldada con 0012.** Sin E2E que compruebe los sprites tras Volver al menú ni el escenario "Cinco ciclos menú-partida" (la sonda no cuenta sprites); la limpieza depende de que Phaser destruya la escena al apagarla. | Change 0012 (hecho) |
| 0009 · W6 | Dos E2E juegan con semilla aleatoria (lo exige la spec tras Volver al menú) a `speed=15`: duración no determinista, timeout holgado. | Vigilar el job `e2e` |
| 0010 · W1 | "Sin semillas sueltas de balance" se comprueba con grep, sin test automático que lo vigile. | Si reaparecen semillas fijas |
| 0010 · W2 | Margen estrecho de la tasa: 30/50 en una banda 25–35, con ±3–4 victorias de ruido entre factores contiguos. Un ajuste pequeño de contenido puede sacarla de la banda: hay que volver a medir. | Cualquier change que toque `content/` (todos los de 0015 en adelante) |
| 0009 · S5 | El test de "Primer frame tras Jugar" declara 601 frames de menú que no llega a pasar al bucle; la garantía es estructural (bucle nuevo por partida). | Con 0010 si se toca `run-launcher.test.ts` |
| v2.0 | Sin separación entre enemigos la horda se amontona. | Pendiente, change propio (0019 la mantiene: apilamiento en puentes aceptado) |
| v2.0 | `upgrades.json` mezcla mejoras de personaje y de arma. | Con 0024 |

## Historial de changes hechos (resumen)

### 0008 e2e-fast-sim · hecho
Derrota E2E de ~78 s a ~10 s: `?speed=N` ejecuta varios ticks por frame solo en el adaptador (núcleo intacto,
determinismo preservado) y los E2E siembran `localStorage`. Descartado un atajo "terminar ya" en el núcleo (0007).

### 0009 main-menu · hecho
Menú de inicio (jugar, exportar, importar, borrar datos con confirmación) y pausa con Esc; `?seed=` y `?e2e` siguen
funcionando (ADR-0011).

### 0010 balance-pass · hecho (PR #20)
Con el bot de referencia (huida + elección priorizada) gana 30 de las semillas 1..50 (banda 25–35) y quieto pierde
con todas antes de 180 s (máx. ~94 s). Palanca: `budgetPerSecond` ×0,8 en los tramos de 300 y 480 s. Ver spec viva
`run-outcome`. Lección: medir en *explore*, no en *apply*.

### 0011 public-deploy · hecho (PR #24)
El despliegue ya existía en `ci.yml`; el change añadió la spec `public-deploy`, el smoke remoto a demanda y la nota
de CSP en Pages de ADR-0004. Aviso v2.0: lo que se publique en Pages debe ser solo CC0 (ver Concepto).

### 0012 sprite-rendering · hecho
Sprites animados del pack Update 010 (CC0) para el jugador (Arquero) y los goblins, con nota de procedencia en
`content/asset-provenance.json`; ids de enemigo `goblin-torch`, `goblin-tnt`, `goblin-barrel` con los mismos stats.
Núcleo sin cambios. Salda la deuda 0009 · W2.

### 0013 world-camera · hecho
Mundo de 1.920×1.080 con vista de 960×540, cámara que sigue al jugador recortada al mundo y textos medievales de
las mejoras. Balance 25/50 con el mundo 2x.

### 0014 e2e-manual-step · hecho
Avance manual en E2E (`?e2e&manual` y `window.__sprint.step(n)`) y proyectos Playwright `logic` y `realtime`.
Infraestructura de tests: no añade Must. Desplaza un número el resto del orden.
