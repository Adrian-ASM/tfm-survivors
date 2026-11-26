# Spec delta · xp-gems

<!-- Ruta: openspec/changes/0030-pickup-visibility/specs/xp-gems/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Solo cambia el pintado: el modelo, la recogida, el imán, los topes y `gemRadius` no cambian. -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Pintado de las gemas
El adaptador de render SHALL mostrar en cada frame exactamente un sprite visible por cada recogible del último
snapshot, salvo los que están en su retardo de aparición, que no se ven (ver "Aparición escalonada de los recogibles
del inicio" en `sprite-rendering`), en su posición pintada y con el aspecto de su tipo (en la piedra, el de la roca de su origen; ver "Aspectos de
los recogibles y de las vetas" en `sprite-rendering`), asociado por identificador, sin crear sprites durante la partida
más allá de una reserva igual a la suma de los topes de los cinco tipos. La **posición pintada** es la del snapshot
durante la aparición de un recogible `gold`, `wood` o `meat` (y su retardo) y con aspecto de reserva, y la del snapshot
más su desplazamiento vertical de flote en el resto de casos, con error ≤ 0,001 (ver "Flote de los recogibles" y
"Aparición de oro, madera y carne" en `sprite-rendering`). El tamaño en pantalla lo fija el aspecto de su tipo (en la
gema sin hoja, su diámetro de aspecto), no `gemRadius`; el radio de recogida (`gemRadius`) y el de atracción
(`pickupRadius`) no dependen del tamaño pintado. MUST NOT quedar visible ningún sprite de un recogible recogido, y un
sprite reutilizado MUST tomar el aspecto del tipo (y, en la piedra, de la roca), la aparición y el flote del recogible
que pinta en ese frame, sin heredar nada del anterior.

#### Scenario: Recogidas y nuevas
- **GIVEN** un snapshot con 10 gemas ya pintado
- **WHEN** se pinta un snapshot en el que 3 se han recogido y han aparecido 2 nuevas
- **THEN** hay exactamente 9 sprites de gema visibles, cada uno en la x de una gema distinta del snapshot y en su y más
  el desplazamiento de flote de su id (error ≤ 0,001)

#### Scenario: Tope de gemas pintado
- **GIVEN** un snapshot con 300 gemas
- **WHEN** se pinta
- **THEN** hay exactamente 300 sprites de gema visibles, todos con el aspecto de la gema

#### Scenario: Todas recogidas
- **GIVEN** un snapshot con 300 gemas ya pintado
- **WHEN** se pinta un snapshot sin gemas
- **THEN** no hay ningún sprite de gema visible

#### Scenario: Topes de los cinco tipos pintados
- **GIVEN** un snapshot con `maxGems` gemas, tantos recogibles `gold` como el tope de oro, tantos `wood` como el de
  madera, tantos `meat` como el de carne y `maxStone` recogibles `stone` con orígenes de las tres rocas
- **WHEN** se pinta, con los `gold`, `wood` y `meat` en su aparición y, en otro frame, en `idle`
- **THEN** en ambos frames hay exactamente un sprite visible por recogible, cada uno con el aspecto de su tipo (y cada
  piedra con el de la roca de su origen), y ninguno de reserva

#### Scenario: Sprite reutilizado para la piedra
- **GIVEN** los datos de aspecto con roca `large` en `goblin-tnt-guard` y `small` en `goblin-torch`, la amplitud del
  flote 0, y un snapshot pintado con 1 recogible `stone` de origen `goblin-tnt-guard` y 0 de otro tipo
- **WHEN** se pinta un snapshot en el que esa piedra se ha recogido y hay 1 recogible `stone` nuevo de origen
  `goblin-torch`
- **THEN** hay exactamente 1 sprite de recogible visible, con el aspecto de la roca `small`, en la posición de la piedra
  nueva

#### Scenario: Gema reutilizada por un recogible con aparición
- **GIVEN** un snapshot pintado con 1 gema de id 3 flotando y 0 recogibles de otro tipo
- **WHEN** se pinta un snapshot en el que esa gema se ha recogido y hay 1 recogible `meat` nuevo de id 4 en (500, 300)
- **THEN** hay exactamente 1 sprite de recogible visible, con el frame 0 del `spawn` de `meat` en (500, 300)
  (error ≤ 0,001), sin flote

#### Scenario: El tamaño pintado no cambia la recogida
- **GIVEN** el contenido por defecto (`gemRadius` 5, `pickupRadius` 128), los datos de aspecto del repositorio (gema de
  20 px, `gold` de 64 × 64 px) y 1 gema y 1 recogible `gold` a 100 px del centro del jugador, dentro de
  `pickupRadius` y fuera de la distancia de recogida (radio del jugador + 5 = 21)
- **WHEN** se ejecutan ticks sin input hasta recoger ambos, una vez con esos datos de aspecto y otra con la gema de
  10 px y el `gold` a escala 0,3 (los de antes de este change)
- **THEN** en ambos casos los dos se recogen en el mismo tick y la XP y el oro finales son iguales

## REMOVED Requirements
<!-- Ninguno. -->
