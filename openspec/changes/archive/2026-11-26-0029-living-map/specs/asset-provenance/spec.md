# Spec delta · asset-provenance

> Change 0029 `living-map`. Entran 11 hojas de la carpeta `Deco/` de Tiny Swords Update 010 para la decoración del
> mapa. Las rocas `Deco/04`–`06` siguen siendo solo de la piedra; las calabazas (`12`, `13`) y los huesos (`14`, `15`)
> quedan fuera.

## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements
(ninguno)
