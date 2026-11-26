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
cambiar. Estas tres hojas son solo de la piedra recogible (no se usan como decoración). De la carpeta `Deco` del pack
MUST NOT versionarse ninguna otra hoja salvo las de "Procedencia de las hojas de la decoración".

#### Scenario: Hojas de la piedra registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia (`guard:all`)
- **THEN** pasa, y la nota tiene las entradas de `Deco/04.png`, `Deco/05.png` y `Deco/06.png` con las rutas de origen
  indicadas arriba, iguales campo a campo a las de antes del change

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

#### Scenario: Solo las rocas y la decoración en Deco
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan en ella los ficheros de la carpeta `Deco/` de los assets
- **THEN** son exactamente `01.png` a `11.png` y `16.png` a `18.png` (las 3 rocas y las 11 de decoración), cada uno 1
  vez, y ninguno de `12.png` a `15.png`

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

### Requirement: Procedencia de las hojas de la decoración
El repositorio SHALL versionar, con su entrada en la nota de procedencia (ruta en el repositorio, ruta de origen dentro
del pack y el resto de campos que la nota exige a cada entrada, sha256 y bytes reales incluidos), exactamente estas 11
hojas nuevas de Tiny Swords Update 010, en la carpeta `Deco/` de los assets versionados, con ruta de origen
`Tiny Swords (Update 010)/Deco/<nn>.png`:
- setas: `01.png` (pequeña), `02.png` (mediana) y `03.png` (grande);
- arbustos: `07.png`, `08.png` y `09.png`;
- matas de hierba: `10.png` y `11.png`;
- cartel con calavera: `16.png`; poste con flecha: `17.png`; espantapájaros: `18.png`.

Cada fichero versionado MUST ser idéntico byte a byte al de su ruta de origen en el pack y su entrada MUST añadirse en
el mismo commit que el fichero. Ninguna puede venir del Free Pack. Las entradas que ya existían antes del change
(las rocas `Deco/04`–`06` incluidas) MUST NOT cambiar. MUST NOT versionarse `Deco/12.png`, `Deco/13.png` (calabazas),
`Deco/14.png` ni `Deco/15.png` (huesos), ni ninguna otra hoja de la carpeta `Deco` del pack fuera de las de esta lista
y de las de "Procedencia de las hojas de la piedra".

#### Scenario: Hojas de la decoración registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia (`guard:all`)
- **THEN** pasa, y la nota tiene exactamente 11 entradas más que antes del change, con las rutas de origen
  `Tiny Swords (Update 010)/Deco/01.png`, `02.png`, `03.png`, `07.png`, `08.png`, `09.png`, `10.png`, `11.png`,
  `16.png`, `17.png` y `18.png`
- **AND** las entradas que existían antes del change son iguales campo a campo

#### Scenario: Integridad de las hojas de la decoración
- **GIVEN** los 11 ficheros versionados de la decoración y sus entradas en la nota
- **WHEN** se calcula el sha256 y el tamaño en bytes de cada fichero
- **THEN** coinciden con los de su entrada
- **AND** con el sha256 de la entrada de `Deco/18.png` cambiado en un carácter, el guardarraíl falla con un mensaje que
  nombra su ruta en el repositorio

#### Scenario: Hoja de la decoración sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de `Deco/09.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de `Deco/09.png`

#### Scenario: Hoja de la decoración del Free Pack
- **GIVEN** una nota simulada igual a la real tras el change salvo que la ruta de origen de `Deco/16.png` apunta al
  Free Pack
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa entrada

#### Scenario: Calabazas y huesos fuera
- **GIVEN** una lista simulada igual a la real tras el change más `Deco/13.png`, en un caso sin entrada en la nota y en
  otro con su entrada
- **WHEN** se ejecuta el guardarraíl y, en el segundo caso, el test de hojas usadas de `sprite-rendering`
- **THEN** en el primer caso el guardarraíl falla con un mensaje que nombra `Deco/13.png`, y en el segundo el test
  falla porque `Deco/13.png` no es la hoja de ningún aspecto

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

### Requirement: Procedencia de las piezas de UI
El repositorio SHALL versionar, en `public/assets/tiny-swords/UI/<Banners|Buttons|Ribbons>/` y con su entrada en la lista
de arte de la nota de procedencia (ruta en el repositorio, ruta de origen dentro del pack, versión `Update 010`, sha256 y
bytes reales, añadida en el mismo commit que el fichero), exactamente las 8 hojas que usan las piezas de la sección `ui`
de `appearance.json`, ni una más. Cada ruta de origen MUST empezar por `Tiny Swords (Update 010)/UI/Banners/`, `Tiny Swords (Update 010)/UI/Buttons/` o
`Tiny Swords (Update 010)/UI/Ribbons/`, y cada fichero MUST ser idéntico byte a byte al de su ruta de origen. MUST NOT
versionarse ninguna hoja de `UI/Icons` ni de `UI/Pointers`, ninguna del Free Pack (`UI Elements` incluida) ni ninguna
pieza dibujada o modificada fuera del pack. Las entradas que ya existían antes del change MUST NOT cambiar.

#### Scenario: Piezas registradas
- **GIVEN** el repositorio tras este change y la nota de procedencia
- **WHEN** se ejecuta el guardarraíl de procedencia (`guard:all`)
- **THEN** pasa, y la lista de arte de la nota tiene exactamente 8 entradas más que antes del change, una por hoja de
  pieza de `ui`, con su ruta de origen bajo `UI/Banners`, `UI/Buttons` o `UI/Ribbons`
- **AND** las entradas que existían antes del change son iguales campo a campo

#### Scenario: Integridad de las piezas
- **GIVEN** los ficheros versionados de las piezas y sus entradas en la nota
- **WHEN** se calcula el sha256 y el tamaño en bytes de cada fichero
- **THEN** coinciden con los de su entrada
- **AND** con el sha256 de la entrada de la hoja de `panel` cambiado en un carácter, el guardarraíl falla con un mensaje
  que nombra su ruta en el repositorio

#### Scenario: Pieza sin entrada
- **GIVEN** una lista simulada igual a la real tras el change y una nota sin la entrada de la hoja de `button`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta en el repositorio de esa hoja

#### Scenario: Pieza del Free Pack
- **GIVEN** una nota simulada igual a la real tras el change salvo que la ruta de origen de la hoja de `button` es
  `Tiny Swords (Free Pack)/UI Elements/UI Elements/Banners/Banner.png`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa entrada y el Free Pack

#### Scenario: Iconos y punteros fuera
- **GIVEN** la lista de ficheros versionados tras el change
- **WHEN** se buscan entradas de la nota cuya ruta de origen contiene `/UI/Icons/` o `/UI/Pointers/`
- **THEN** no hay ninguna

### Requirement: Procedencia y licencia de la fuente
El repositorio SHALL versionar la fuente pixel de la interfaz, Departure Mono de Helena Zhang (ver "Fuente pixel local"
en `sprite-rendering`), como `public/assets/fonts/DepartureMono-Regular.woff2`, sin modificar ni renombrar, junto con el
texto completo de su licencia SIL Open Font License 1.1 en `public/assets/fonts/OFL.txt`, y registrarla en una lista
`fonts` de `content/asset-provenance.json`, aparte de la lista del arte de Tiny Swords (cuya cabecera `CC0` no cambia).
Cada registro tiene: ruta en el repositorio, familia, autor, origen (URL de la release), versión, licencia `OFL-1.1`,
fichero de licencia (ruta versionada), sha256 y bytes reales. El guardarraíl de procedencia (`guard-assets`) MUST
vigilar también los ficheros de fuente (`.woff2`, `.woff`, `.ttf` y `.otf`, sin distinguir mayúsculas): cada fuente
versionada MUST tener registro en `fonts`, cada registro MUST corresponder a un fichero versionado con su sha256 y sus
bytes, la licencia MUST ser `OFL-1.1` y el fichero de licencia MUST estar versionado. Se aplica en las tres capas de
siempre (hook, commit y `npm run verify` / CI) y MUST NOT necesitar red. No se versiona ningún comprimido de la release
(`.zip` sigue prohibido).

#### Scenario: Fuente registrada
- **GIVEN** el repositorio tras este change
- **WHEN** se ejecuta `npm run guard:all`
- **THEN** pasa; `fonts` tiene exactamente 1 registro, el de `public/assets/fonts/DepartureMono-Regular.woff2`, con
  familia `Departure Mono`, licencia `OFL-1.1` y fichero de licencia `public/assets/fonts/OFL.txt`, que está versionado
  y contiene `SIL OPEN FONT LICENSE Version 1.1`
- **AND** la cabecera de la nota sigue registrando para el arte de Tiny Swords licencia `CC0`, versión `Update 010` y
  fecha `2026-11-22`, y ningún registro de `fonts` está en la lista de arte

#### Scenario: Fuente sin registro
- **GIVEN** una lista simulada igual a la real tras el change más `public/assets/fonts/Otra.woff2` y, en otro caso,
  `public/assets/fonts/Otra.TTF`, sin registro
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra ese fichero

#### Scenario: Registro de fuente incompleto
- **GIVEN** el registro de la fuente con, en un caso cada vez, licencia `CC0`, sin autor, sin fichero de licencia o con
  un sha256 cambiado en un carácter
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta de la fuente y el campo

#### Scenario: Licencia de la fuente sin versionar
- **GIVEN** una lista simulada igual a la real tras el change sin `public/assets/fonts/OFL.txt`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra `public/assets/fonts/OFL.txt`

#### Scenario: Registro sin fichero
- **GIVEN** la nota real y una lista simulada sin `public/assets/fonts/DepartureMono-Regular.woff2`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa ruta

<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0022-resources-sheep (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
<!-- historial: 0025-stone-resource (2026-11-25) -->
<!-- historial: 0026-build-sites (2026-11-25) -->
<!-- historial: 0029-living-map (2026-11-26) -->
<!-- historial: 0030-pickup-visibility (2026-11-26) -->
<!-- historial: 0032-ui-kit (2026-11-26) -->
