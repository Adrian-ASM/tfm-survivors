# Spec delta · asset-provenance

<!-- 0020 y 0021 prohibían versionar `W_Idle.png` ("ninguna hoja de madera"); 0022 la necesita para el recogible de
     madera. Se levanta esa prohibición solo para `W_Idle.png` y se registran las hojas nuevas de los recursos. El
     guardarraíl y el formato de la nota no cambian. -->

## ADDED Requirements

### Requirement: Procedencia de las hojas de los recursos
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen
dentro del pack y el resto de campos que la nota exige a cada entrada), exactamente estas hojas nuevas de Tiny Swords
Update 010:
- la madera, con ruta de origen `Tiny Swords (Update 010)/Resources/Resources/W_Idle.png`;
- la veta activa, con ruta de origen `Tiny Swords (Update 010)/Resources/Gold Mine/GoldMine_Active.png`;
- la veta agotada, con ruta de origen `Tiny Swords (Update 010)/Resources/Gold Mine/GoldMine_Inactive.png`;
- si el aspecto `xp` tiene hoja (ver "Aspectos de los recogibles y de las vetas" en `sprite-rendering`), esa hoja, de
  Update 010 y distinta de `G_Idle.png` y `W_Idle.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas, añadida en el mismo commit que el fichero. La entrada
de `G_Idle.png` y las demás que ya existían antes del change MUST NOT cambiar. MUST NOT versionarse
`GoldMine_Destroyed.png`, las variantes `_(NoShadow)` ni `*_Spawn.png`, ninguna hoja de carne (`M_*`) ni de ovejas
(`HappySheep_*`).

#### Scenario: Hojas de recursos registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia
- **THEN** pasa, y la nota tiene exactamente 3 entradas más que antes del change (4 si `xp` tiene hoja), con las rutas
  de origen de `W_Idle.png`, `GoldMine_Active.png` y `GoldMine_Inactive.png` indicadas arriba
- **AND** las entradas que existían antes del change, `G_Idle.png` incluida, son iguales campo a campo

#### Scenario: Hoja de recursos sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `GoldMine_Inactive.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `GoldMine_Inactive.png`

#### Scenario: Hojas de recursos no usadas
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan en ella `GoldMine_Destroyed`, `NoShadow`, `_Spawn`, `M_Idle` y `HappySheep`
- **THEN** no hay ninguna coincidencia

## MODIFIED Requirements

### Requirement: Procedencia de las hojas de los peligros
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen
dentro del pack y el resto de campos que la nota exige a cada entrada), exactamente estas dos hojas de los peligros de
Tiny Swords Update 010:
- la dinamita, con ruta de origen `Tiny Swords (Update 010)/Factions/Goblins/Troops/TNT/Dynamite/Dynamite.png`;
- la explosión, con ruta de origen `Tiny Swords (Update 010)/Effects/Explosion/Explosions.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas. Las entradas de `Barrel_Red.png` y `TNT_Red.png` MUST
NOT cambiar. Ninguna hoja de fuego MUST versionarse; de madera solo `W_Idle.png` (ver "Procedencia de las hojas de los
recursos"); las de casas y torres son exactamente las de "Procedencia de las hojas de las estructuras".

#### Scenario: Hojas nuevas registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia
- **THEN** pasa, y la nota tiene las entradas de `Dynamite.png` y `Explosions.png` con las rutas de origen indicadas
  arriba, iguales campo a campo a las de antes del change
- **AND** las entradas de `Barrel_Red.png` y `TNT_Red.png` son iguales campo a campo a las de antes del change

#### Scenario: Hoja nueva sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `Explosions.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `Explosions.png`

#### Scenario: Ninguna hoja de más
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se busca en ella `Fire.png`, `W_Idle_(NoShadow).png`, `W_Spawn.png` o `Wood_Tower_InConstruction`
- **THEN** no hay ninguna coincidencia
- **AND** `W_Idle.png` aparece exactamente 1 vez, la de "Procedencia de las hojas de los recursos"
- **AND** las únicas coincidencias de `Goblin_House` y `Wood_Tower` son las 4 hojas de "Procedencia de las hojas de
  las estructuras"

### Requirement: Procedencia de las hojas de las estructuras
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen
dentro del pack y el resto de campos que la nota exige a cada entrada), exactamente estas cuatro hojas de Tiny Swords
Update 010:
- la casa goblin, con ruta de origen
  `Tiny Swords (Update 010)/Factions/Goblins/Buildings/Wood_House/Goblin_House.png`;
- la casa destruida, con ruta de origen
  `Tiny Swords (Update 010)/Factions/Goblins/Buildings/Wood_House/Goblin_House_Destroyed.png`;
- la torre, con ruta de origen `Tiny Swords (Update 010)/Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_<color>.png`,
  con un único `<color>` de `Red`, `Blue`, `Purple` o `Yellow`;
- la torre destruida, con ruta de origen
  `Tiny Swords (Update 010)/Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Destroyed.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas. Las entradas de estas cuatro hojas MUST NOT cambiar en
este change. MUST NOT versionarse `Wood_Tower_InConstruction`, ningún otro color de torre, `Fire.png` ni ninguna otra
hoja de edificios del pack.

#### Scenario: Hojas de estructuras registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia
- **THEN** pasa, y la nota tiene las entradas de `Goblin_House.png`, `Goblin_House_Destroyed.png`, un único
  `Wood_Tower_<color>.png` y `Wood_Tower_Destroyed.png` con las rutas de origen indicadas arriba, iguales campo a campo
  a las de antes del change

#### Scenario: Hoja de estructura sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `Goblin_House_Destroyed.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `Goblin_House_Destroyed.png`

#### Scenario: Hojas de edificios no usadas
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan en ella `Wood_Tower_InConstruction`, `Fire.png` y los nombres `Wood_Tower_Red.png`,
  `Wood_Tower_Blue.png`, `Wood_Tower_Purple.png` y `Wood_Tower_Yellow.png`
- **THEN** no hay ninguna coincidencia de las dos primeras y hay exactamente 1 de los cuatro colores de torre
- **AND** `GoldMine_Active.png` y `GoldMine_Inactive.png` son las únicas hojas versionadas de la carpeta `Gold Mine`
