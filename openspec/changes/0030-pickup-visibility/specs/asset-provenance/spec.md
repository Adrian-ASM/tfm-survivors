# Spec delta · asset-provenance

<!-- Ruta: openspec/changes/0030-pickup-visibility/specs/asset-provenance/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

## ADDED Requirements

### Requirement: Procedencia de las hojas de aparición de los recogibles
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen dentro
del pack y el resto de campos que la nota exige a cada entrada, sha256 y bytes reales incluidos), exactamente estas
tres hojas nuevas de Tiny Swords Update 010, que usan las animaciones de aparición de "Aparición de oro, madera y carne"
(`sprite-rendering`):
- la aparición del oro, con ruta de origen `Tiny Swords (Update 010)/Resources/Resources/G_Spawn.png`;
- la aparición de la madera, con ruta de origen `Tiny Swords (Update 010)/Resources/Resources/W_Spawn.png`;
- la aparición de la carne, con ruta de origen `Tiny Swords (Update 010)/Resources/Resources/M_Spawn.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack (la variante con sombra) y su
entrada MUST añadirse en el mismo commit que el fichero. Ninguna puede venir del Free Pack. Las entradas que ya existían
antes de este change MUST NOT cambiar. MUST NOT versionarse ninguna variante `_(NoShadow)` (tampoco
`G_Spawn_(NoShadow).png`, `W_Spawn_(NoShadow).png` ni `M_Spawn_(NoShadow).png`), `HappySheep_All.png` ni
`GoldMine_Destroyed.png`.

#### Scenario: Hojas de aparición registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia (`guard:all`)
- **THEN** pasa, y la nota tiene exactamente 3 entradas más que antes del change, con las rutas de origen de
  `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png` indicadas arriba
- **AND** las entradas que existían antes del change son iguales campo a campo

#### Scenario: Integridad de las hojas de aparición
- **GIVEN** los 3 ficheros versionados de aparición y sus entradas en la nota
- **WHEN** se calcula el sha256 y el tamaño en bytes de cada fichero
- **THEN** coinciden con los de su entrada
- **AND** con el sha256 de la entrada de `W_Spawn.png` cambiado en un carácter, el guardarraíl falla con un mensaje que
  nombra su ruta en el repositorio

#### Scenario: Hoja de aparición sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `M_Spawn.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `M_Spawn.png`

#### Scenario: Hoja de aparición del Free Pack
- **GIVEN** una nota simulada igual a la real tras el change salvo que la ruta de origen de `G_Spawn.png` apunta al
  Free Pack
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa entrada

#### Scenario: Variante sin sombra de una hoja de aparición
- **GIVEN** una lista simulada igual a la real tras el change más `W_Spawn_(NoShadow).png`, con su entrada en la nota
- **WHEN** se ejecutan el guardarraíl y el test de hojas usadas de `sprite-rendering`
- **THEN** el test falla porque `W_Spawn_(NoShadow).png` no es la hoja de ningún aspecto ni de ninguna animación, y el
  test de "Hojas de recursos no usadas" falla porque encuentra `NoShadow`

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
recursos") y `W_Spawn.png` (ver "Procedencia de las hojas de aparición de los recogibles"); las de casas y torres son
exactamente las de "Procedencia de las hojas de las estructuras".

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
- **WHEN** se busca en ella `Fire.png`, `W_Idle_(NoShadow).png`, `W_Spawn_(NoShadow).png` o
  `Wood_Tower_InConstruction`
- **THEN** no hay ninguna coincidencia
- **AND** `W_Idle.png` aparece exactamente 1 vez, la de "Procedencia de las hojas de los recursos", y `W_Spawn.png`
  exactamente 1 vez, la de "Procedencia de las hojas de aparición de los recogibles"
- **AND** las únicas coincidencias de `Goblin_House` y `Wood_Tower` son las 4 hojas de "Procedencia de las hojas de
  las estructuras"

### Requirement: Procedencia de las hojas de los recursos
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen
dentro del pack y el resto de campos que la nota exige a cada entrada), estas hojas de recursos de Tiny Swords
Update 010 (añadidas en 0022):
- la madera, con ruta de origen `Tiny Swords (Update 010)/Resources/Resources/W_Idle.png`;
- la veta activa, con ruta de origen `Tiny Swords (Update 010)/Resources/Gold Mine/GoldMine_Active.png`;
- la veta agotada, con ruta de origen `Tiny Swords (Update 010)/Resources/Gold Mine/GoldMine_Inactive.png`;
- si el aspecto `xp` tiene hoja (ver "Aspectos de los recogibles y de las vetas" en `sprite-rendering`), esa hoja, de
  Update 010 y distinta de `G_Idle.png`, `W_Idle.png`, `M_Idle.png`, `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas. La entrada de `G_Idle.png` y las demás que ya existían
antes de este change MUST NOT cambiar. MUST NOT versionarse `GoldMine_Destroyed.png` ni las variantes `_(NoShadow)`.
De las hojas `*_Spawn.png` solo se versionan exactamente `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png` (ver
"Procedencia de las hojas de aparición de los recogibles"); de la carne y de las ovejas, solo las hojas de "Procedencia
de las hojas de las ovejas y de la carne" y `M_Spawn.png`.

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
- **THEN** no hay ninguna coincidencia de `GoldMine_Destroyed` ni de `NoShadow`
- **AND** las coincidencias de `_Spawn` son exactamente 3, una por fichero: `G_Spawn.png`, `W_Spawn.png` y
  `M_Spawn.png`, los tres en la misma carpeta de assets que `G_Idle.png`

#### Scenario: Una hoja de aparición de más
- **GIVEN** una lista simulada igual a la real tras el change más un `S_Spawn.png` en la carpeta de recursos, con su
  entrada en la nota
- **WHEN** se ejecuta el test de "Hojas de recursos no usadas"
- **THEN** falla porque hay 4 coincidencias de `_Spawn` y nombra `S_Spawn.png`

### Requirement: Procedencia de las hojas de las ovejas y de la carne
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen dentro
del pack y el resto de campos que la nota exige a cada entrada), exactamente estas tres hojas nuevas de Tiny Swords
Update 010 (añadidas en 0023):
- la oveja en pasto, con ruta de origen `Tiny Swords (Update 010)/Resources/Sheep/HappySheep_Idle.png`;
- la oveja en movimiento, con ruta de origen `Tiny Swords (Update 010)/Resources/Sheep/HappySheep_Bouncing.png`;
- la carne, con ruta de origen `Tiny Swords (Update 010)/Resources/Resources/M_Idle.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad que la nota exige al resto de entradas, añadida en el mismo commit que el fichero. Las entradas
que ya existían antes del change MUST NOT cambiar. MUST NOT versionarse `HappySheep_All.png`, `M_Idle_(NoShadow).png`,
`M_Spawn_(NoShadow).png` ni ninguna otra hoja de las carpetas `Sheep` y `Resources/Resources` del pack que no esté en
la lista de arriba, en la de "Procedencia de las hojas de los recursos" o en la de "Procedencia de las hojas de
aparición de los recogibles" (que incluye `M_Spawn.png`).

#### Scenario: Hojas de ovejas y carne registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia
- **THEN** pasa, y la nota tiene las entradas de `HappySheep_Idle.png`, `HappySheep_Bouncing.png` y `M_Idle.png` con
  las rutas de origen indicadas arriba, iguales campo a campo a las de antes del change

#### Scenario: Hoja de oveja sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `HappySheep_Bouncing.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `HappySheep_Bouncing.png`

#### Scenario: Hojas de ovejas y carne no usadas
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan en ella `HappySheep_All`, `M_Idle_(NoShadow)`, `M_Spawn_(NoShadow)` y `M_Spawn`
- **THEN** no hay ninguna coincidencia de las tres primeras
- **AND** `M_Spawn` tiene exactamente 1 coincidencia, `M_Spawn.png`, la de "Procedencia de las hojas de aparición de
  los recogibles"
- **AND** `HappySheep_Idle.png`, `HappySheep_Bouncing.png` y `M_Idle.png` aparecen exactamente 1 vez cada una

## REMOVED Requirements
<!-- Ninguno. -->
