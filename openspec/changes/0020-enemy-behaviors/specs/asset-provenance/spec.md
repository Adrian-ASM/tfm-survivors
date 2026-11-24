# Spec delta · asset-provenance

<!-- Change 0020-enemy-behaviors. Dos hojas nuevas del pack local Update 010: la dinamita y la explosión. La mecha
     del barril y el lanzamiento del TNT usan `Barrel_Red.png` y `TNT_Red.png`, ya versionadas y registradas desde
     0012: no se copian de nuevo ni cambian su entrada. -->

## ADDED Requirements

### Requirement: Procedencia de las hojas de los peligros
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen
dentro del pack y el resto de campos que la nota exige a cada entrada), exactamente estas dos hojas nuevas de Tiny
Swords Update 010:
- la dinamita, con ruta de origen `Tiny Swords (Update 010)/Factions/Goblins/Troops/TNT/Dynamite/Dynamite.png`;
- la explosión, con ruta de origen `Tiny Swords (Update 010)/Effects/Explosion/Explosions.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas. Las entradas de `Barrel_Red.png` y `TNT_Red.png` MUST
NOT cambiar. Ninguna otra hoja del pack (fuego, casas, torres, madera) MUST versionarse en este change.

#### Scenario: Hojas nuevas registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia
- **THEN** pasa, y la nota tiene exactamente 2 entradas más que antes del change, con las rutas de origen de
  `Dynamite.png` y `Explosions.png` indicadas arriba
- **AND** las entradas de `Barrel_Red.png` y `TNT_Red.png` son iguales campo a campo a las de antes del change

#### Scenario: Hoja nueva sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `Explosions.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `Explosions.png`

#### Scenario: Ninguna hoja de más
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se busca en ella `Fire.png`, `Goblin_House`, `Wood_Tower` o `W_Idle.png`
- **THEN** no hay ninguna coincidencia

## MODIFIED Requirements

<!-- Ninguno. -->

## REMOVED Requirements

<!-- Ninguno. -->
