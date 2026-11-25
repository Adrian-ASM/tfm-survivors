# Spec delta · asset-provenance

## ADDED Requirements

### Requirement: Procedencia de las hojas de los edificios de caballeros
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen
dentro del pack y el resto de campos que la nota exige a cada entrada, sha256 y bytes incluidos), exactamente estas
tres hojas de Tiny Swords Update 010:
- el solar libre (aspecto común de todo solar sin construir), con ruta de origen
  `Tiny Swords (Update 010)/Factions/Knights/Buildings/House/House_Construction.png`;
- la casa construida, con ruta de origen `Tiny Swords (Update 010)/Factions/Knights/Buildings/House/House_Blue.png`;
- la torre construida, con ruta de origen `Tiny Swords (Update 010)/Factions/Knights/Buildings/Tower/Tower_Blue.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack. MUST NOT versionarse
`Tower_Construction`, `House_Destroyed`, `Tower_Destroyed`, `Castle_Construction` ni ningún otro color de casa o torre
de caballeros, ni `Wood_Tower_InConstruction` (goblin). Las entradas de procedencia existentes antes de este change MUST
NOT cambiar.

#### Scenario: Hojas de caballeros registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia
- **THEN** pasa, y la nota tiene las entradas de `House_Construction.png`, `House_Blue.png` y `Tower_Blue.png` con las rutas de origen indicadas arriba
- **AND** las entradas que había antes del change son iguales campo a campo

#### Scenario: Hoja de caballeros sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `Tower_Blue.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `Tower_Blue.png`

#### Scenario: Hojas de caballeros no usadas
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan en ella `Tower_Construction`, `House_Destroyed`, `Tower_Destroyed`, `Castle_Construction`, `Wood_Tower_InConstruction`,
  `House_Red`, `House_Purple`, `House_Yellow`, `Tower_Red`, `Tower_Purple` y `Tower_Yellow`
- **THEN** no hay ninguna coincidencia

## MODIFIED Requirements

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
este change. MUST NOT versionarse `Wood_Tower_InConstruction`, ningún otro color de torre goblin, `Fire.png` ni ninguna
otra hoja de edificios **goblin** del pack. Las hojas de edificios de caballeros versionadas son solo las de
"Procedencia de las hojas de los edificios de caballeros" y las que ya estaban versionadas antes de este change (el
castillo de 0016).

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->
