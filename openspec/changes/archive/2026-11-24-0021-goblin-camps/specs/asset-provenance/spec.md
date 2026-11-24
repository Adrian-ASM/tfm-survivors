# Spec delta · asset-provenance

<!-- Change 0021-goblin-camps. Se retira a propósito la prohibición de `Goblin_House` y `Wood_Tower` que fijó 0020
     ("Ninguna hoja de más") y se registran las 4 hojas de casas, torres y ruinas. Siguen prohibidos `Fire.png`,
     `W_Idle.png`, `Wood_Tower_InConstruction` y los colores de torre que no se usen. El color de la torre lo fija el
     design (uno solo de `Red`, `Blue`, `Purple` o `Yellow`). -->

## ADDED Requirements

### Requirement: Procedencia de las hojas de las estructuras
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen
dentro del pack y el resto de campos que la nota exige a cada entrada), exactamente estas cuatro hojas nuevas de Tiny
Swords Update 010:
- la casa goblin, con ruta de origen
  `Tiny Swords (Update 010)/Factions/Goblins/Buildings/Wood_House/Goblin_House.png`;
- la casa destruida, con ruta de origen
  `Tiny Swords (Update 010)/Factions/Goblins/Buildings/Wood_House/Goblin_House_Destroyed.png`;
- la torre, con ruta de origen `Tiny Swords (Update 010)/Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_<color>.png`,
  con un único `<color>` de `Red`, `Blue`, `Purple` o `Yellow`;
- la torre destruida, con ruta de origen
  `Tiny Swords (Update 010)/Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Destroyed.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas. Las entradas que ya existían antes del change MUST NOT
cambiar. MUST NOT versionarse `Wood_Tower_InConstruction`, ningún otro color de torre, `Fire.png` ni ninguna otra hoja
de edificios del pack.

#### Scenario: Hojas de estructuras registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia
- **THEN** pasa, y la nota tiene exactamente 4 entradas más que antes del change, con las rutas de origen de
  `Goblin_House.png`, `Goblin_House_Destroyed.png`, un único `Wood_Tower_<color>.png` y `Wood_Tower_Destroyed.png`
  indicadas arriba
- **AND** las entradas que existían antes del change son iguales campo a campo

#### Scenario: Hoja de estructura sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `Goblin_House_Destroyed.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `Goblin_House_Destroyed.png`

#### Scenario: Hojas de edificios no usadas
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan en ella `Wood_Tower_InConstruction`, `Fire.png`, `W_Idle.png` y los nombres
  `Wood_Tower_Red.png`, `Wood_Tower_Blue.png`, `Wood_Tower_Purple.png` y `Wood_Tower_Yellow.png`
- **THEN** no hay ninguna coincidencia de las tres primeras y hay exactamente 1 de los cuatro colores de torre

## MODIFIED Requirements

### Requirement: Procedencia de las hojas de los peligros
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen
dentro del pack y el resto de campos que la nota exige a cada entrada), exactamente estas dos hojas de los peligros de
Tiny Swords Update 010:
- la dinamita, con ruta de origen `Tiny Swords (Update 010)/Factions/Goblins/Troops/TNT/Dynamite/Dynamite.png`;
- la explosión, con ruta de origen `Tiny Swords (Update 010)/Effects/Explosion/Explosions.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas. Las entradas de `Barrel_Red.png` y `TNT_Red.png` MUST
NOT cambiar. Ninguna hoja de fuego ni de madera MUST versionarse; las de casas y torres son exactamente las de
"Procedencia de las hojas de las estructuras".

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
- **WHEN** se busca en ella `Fire.png`, `W_Idle.png` o `Wood_Tower_InConstruction`
- **THEN** no hay ninguna coincidencia
- **AND** las únicas coincidencias de `Goblin_House` y `Wood_Tower` son las 4 hojas de "Procedencia de las hojas de
  las estructuras"
