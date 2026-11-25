# Asset Provenance · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Que el repositorio solo versione arte con licencia y procedencia registradas (nota con sha256 y bytes), y nada del Free Pack, comprobado en pre-commit y en CI.

## Requirements

### Requirement: Nota de procedencia
El repositorio SHALL contener una nota de procedencia que registra, para el arte de Tiny Swords: el pack
(`Tiny Swords`), el autor (`Pixel Frog`), la versión (`Update 010`), la licencia (`CC0`), la fecha de la confirmación
del autor de que esa versión es CC0 (`2026-11-22`) y una entrada por cada asset gráfico incluido, con su ruta en el
repositorio y su ruta de origen dentro del pack. La nota MUST NOT exigir ni enlazar una captura o prueba versionada de
la confirmación: basta con la fecha. Cada ruta del repositorio figura una sola vez.

#### Scenario: Nota del repositorio
- **GIVEN** el repositorio tras este change
- **WHEN** el guardarraíl lee la nota de procedencia
- **THEN** la nota registra pack `Tiny Swords`, autor `Pixel Frog`, versión `Update 010`, licencia `CC0` y fecha
  `2026-11-22`
- **AND** tiene ≥ 1 entrada y cada entrada tiene ruta en el repositorio y ruta de origen no vacías

#### Scenario: Nota incompleta
- **GIVEN** una nota sin la fecha de la confirmación, y en otros casos sin licencia, con licencia distinta de `CC0`,
  con versión distinta de `Update 010` o con una entrada sin ruta de origen
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra el campo ausente o incorrecto

#### Scenario: Entrada repetida
- **GIVEN** una nota con dos entradas para la misma ruta del repositorio
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa ruta

### Requirement: Solo assets registrados
El sistema SHALL garantizar que cada asset gráfico de la lista de ficheros versionados tiene entrada en la nota de
procedencia y que cada entrada de la nota corresponde a un fichero de esa lista. La lista MUST NOT contener ficheros
de sistema (`.DS_Store`, `Thumbs.db`, `desktop.ini`), fuentes de edición (`.aseprite`) ni comprimidos (`.zip`,
`.rar`, `.7z`, `.tar`, `.gz`) en ninguna carpeta.

#### Scenario: Estado real del repositorio
- **GIVEN** la lista real de ficheros versionados tras este change
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa: cada asset gráfico tiene entrada, cada entrada tiene fichero y no hay ficheros prohibidos

#### Scenario: PNG sin registrar
- **GIVEN** una lista simulada igual a la real más `public/assets/extra/Goblin_Red.png`, sin entrada en la nota
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra `public/assets/extra/Goblin_Red.png`

#### Scenario: Asset gráfico fuera de la carpeta de assets
- **GIVEN** una lista simulada igual a la real más `docs/captura.jpg`, sin entrada en la nota
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra `docs/captura.jpg`

#### Scenario: Entrada sin fichero
- **GIVEN** la nota real y una lista simulada sin uno de los ficheros que la nota registra
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta que falta

#### Scenario: Ficheros prohibidos
- **GIVEN** una lista simulada igual a la real más, en un caso cada vez, `public/assets/.DS_Store`,
  `assets/Thumbs.db`, `art/Archer.aseprite` o `tiny-swords.zip`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra ese fichero

#### Scenario: Mayúsculas en la extensión
- **GIVEN** una lista simulada igual a la real más `public/assets/Tree.PNG`, sin entrada en la nota
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra `public/assets/Tree.PNG`

### Requirement: Nada del Free Pack
El sistema SHALL rechazar cualquier asset del Tiny Swords Free Pack, que no es CC0. El guardarraíl MUST fallar si un
fichero de la lista de ficheros versionados, o la ruta de origen de una entrada de la nota, contiene `Free Pack`,
`Free_Pack` o `FreePack` (sin distinguir mayúsculas), o si una entrada registra una versión distinta de `Update 010`.

#### Scenario: Ruta del Free Pack en el repositorio
- **GIVEN** una lista simulada igual a la real más `public/assets/Tiny Swords (Free Pack)/Warrior_Blue.png`, con
  entrada en la nota
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra ese fichero y el Free Pack

#### Scenario: Origen del Free Pack
- **GIVEN** la nota real con una entrada cuya ruta en el repositorio es `public/assets/tinyswords/Warrior.png` y cuya
  ruta de origen es `Tiny Swords (Free Pack)/Units/Blue Units/Warrior/Warrior_Idle.png`, y la lista con ese fichero
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra `public/assets/tinyswords/Warrior.png` y el Free Pack

### Requirement: Guardarraíl de procedencia en verify y en CI
El sistema SHALL ejecutar el guardarraíl de procedencia sobre la lista de ficheros versionados como parte de
`npm run verify`, de modo que el check `quality` del CI falle si el guardarraíl falla. El guardarraíl MUST NOT
necesitar red ni el pack original fuera del repositorio.

#### Scenario: Verify en rojo
- **GIVEN** una copia del repositorio con un PNG versionado sin entrada en la nota
- **WHEN** se ejecuta `npm run verify`
- **THEN** termina con código distinto de 0 y su salida nombra ese PNG

#### Scenario: Sin red ni pack
- **GIVEN** el repositorio tras este change, sin red y sin la carpeta original del pack en la máquina
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa

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
este change. MUST NOT versionarse `Wood_Tower_InConstruction`, ningún otro color de torre goblin, `Fire.png` ni ninguna
otra hoja de edificios **goblin** del pack. Las hojas de edificios de caballeros versionadas son solo las de
"Procedencia de las hojas de los edificios de caballeros" y las que ya estaban versionadas antes de este change (el
castillo de 0016).

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

### Requirement: Procedencia de las hojas de la piedra
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen dentro
del pack y el resto de campos que la nota exige a cada entrada), exactamente estas tres hojas nuevas de Tiny Swords
Update 010, en la carpeta `Deco/` de los assets versionados:
- la roca pequeña (`small`), con ruta de origen `Tiny Swords (Update 010)/Deco/04.png`;
- la roca mediana (`medium`), con ruta de origen `Tiny Swords (Update 010)/Deco/05.png`;
- la roca grande (`large`), con ruta de origen `Tiny Swords (Update 010)/Deco/06.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack, y su entrada MUST registrar
los datos de integridad reales (sha256 y bytes) que la nota exige al resto de entradas, añadida en el mismo commit que
el fichero. Ninguna de las tres puede venir del Free Pack. Las entradas que ya existían antes del change MUST NOT
cambiar. MUST NOT versionarse ninguna otra hoja de la carpeta `Deco` del pack.

#### Scenario: Hojas de la piedra registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia (`guard:all`)
- **THEN** pasa, y la nota tiene exactamente 3 entradas más que antes del change, con las rutas de origen de
  `Deco/04.png`, `Deco/05.png` y `Deco/06.png` indicadas arriba
- **AND** las entradas que existían antes del change son iguales campo a campo

#### Scenario: Integridad de las hojas de la piedra
- **GIVEN** los tres ficheros versionados de la piedra y sus entradas en la nota
- **WHEN** se calcula el sha256 y el tamaño en bytes de cada fichero
- **THEN** coinciden con los de su entrada
- **AND** con el sha256 de la entrada de `Deco/05.png` cambiado en un carácter, el guardarraíl falla con un mensaje que
  nombra su ruta en el repositorio

#### Scenario: Hoja de la piedra sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `Deco/06.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `Deco/06.png`

#### Scenario: Hoja de la piedra del Free Pack
- **GIVEN** una nota simulada igual a la real tras el change salvo que la ruta de origen de `Deco/04.png` apunta al Free
  Pack
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa entrada

#### Scenario: Solo las tres rocas de Deco
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan en ella los ficheros de la carpeta `Deco/` de los assets
- **THEN** son exactamente `04.png`, `05.png` y `06.png`, cada uno 1 vez

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

<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0022-resources-sheep (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
<!-- historial: 0025-stone-resource (2026-11-25) -->
<!-- historial: 0026-build-sites (2026-11-25) -->
