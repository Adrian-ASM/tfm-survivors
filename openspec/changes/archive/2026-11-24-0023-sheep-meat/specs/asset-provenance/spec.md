# Spec delta · asset-provenance

<!-- Change 0023-sheep-meat: entran las hojas de la oveja y de la carne de Tiny Swords Update 010 (CC0). La prohibición
     de 0022 sobre `M_*` y `HappySheep_*` se sustituye por una lista cerrada de las que sí se versionan. -->

## ADDED Requirements

### Requirement: Procedencia de las hojas de las ovejas y de la carne
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen dentro
del pack y el resto de campos que la nota exige a cada entrada), exactamente estas tres hojas nuevas de Tiny Swords
Update 010:
- la oveja en pasto, con ruta de origen `Tiny Swords (Update 010)/Resources/Sheep/HappySheep_Idle.png`;
- la oveja en movimiento, con ruta de origen `Tiny Swords (Update 010)/Resources/Sheep/HappySheep_Bouncing.png`;
- la carne, con ruta de origen `Tiny Swords (Update 010)/Resources/Resources/M_Idle.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas, añadida en el mismo commit que el fichero. Las entradas
que ya existían antes del change MUST NOT cambiar. MUST NOT versionarse `HappySheep_All.png`, `M_Spawn.png`,
`M_Idle_(NoShadow).png` ni ninguna otra hoja de las carpetas `Sheep` y `Resources/Resources` del pack que no esté en la
lista de arriba o en la de "Procedencia de las hojas de los recursos".

#### Scenario: Hojas de ovejas y carne registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia
- **THEN** pasa, y la nota tiene exactamente 3 entradas más que antes del change, con las rutas de origen de
  `HappySheep_Idle.png`, `HappySheep_Bouncing.png` y `M_Idle.png` indicadas arriba
- **AND** las entradas que existían antes del change son iguales campo a campo

#### Scenario: Hoja de oveja sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `HappySheep_Bouncing.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `HappySheep_Bouncing.png`

#### Scenario: Hojas de ovejas y carne no usadas
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan en ella `HappySheep_All`, `M_Spawn` y `M_Idle_(NoShadow)`
- **THEN** no hay ninguna coincidencia
- **AND** `HappySheep_Idle.png`, `HappySheep_Bouncing.png` y `M_Idle.png` aparecen exactamente 1 vez cada una

## MODIFIED Requirements

### Requirement: Procedencia de las hojas de los recursos
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen
dentro del pack y el resto de campos que la nota exige a cada entrada), estas hojas de recursos de Tiny Swords
Update 010 (añadidas en 0022):
- la madera, con ruta de origen `Tiny Swords (Update 010)/Resources/Resources/W_Idle.png`;
- la veta activa, con ruta de origen `Tiny Swords (Update 010)/Resources/Gold Mine/GoldMine_Active.png`;
- la veta agotada, con ruta de origen `Tiny Swords (Update 010)/Resources/Gold Mine/GoldMine_Inactive.png`;
- si el aspecto `xp` tiene hoja (ver "Aspectos de los recogibles y de las vetas" en `sprite-rendering`), esa hoja, de
  Update 010 y distinta de `G_Idle.png`, `W_Idle.png` y `M_Idle.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas. La entrada de `G_Idle.png` y las demás que ya existían
antes de este change MUST NOT cambiar. MUST NOT versionarse `GoldMine_Destroyed.png`, las variantes `_(NoShadow)` ni
`*_Spawn.png`; de la carne y de las ovejas solo las hojas de "Procedencia de las hojas de las ovejas y de la carne".

#### Scenario: Hojas de recursos registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia
- **THEN** pasa, y la nota tiene las entradas de `W_Idle.png`, `GoldMine_Active.png` y `GoldMine_Inactive.png` con las
  rutas de origen indicadas arriba, iguales campo a campo a las de antes del change
- **AND** la entrada de `G_Idle.png` es igual campo a campo a la de antes del change

#### Scenario: Hoja de recursos sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `GoldMine_Inactive.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `GoldMine_Inactive.png`

#### Scenario: Hojas de recursos no usadas
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan en ella `GoldMine_Destroyed`, `NoShadow` y `_Spawn`
- **THEN** no hay ninguna coincidencia
