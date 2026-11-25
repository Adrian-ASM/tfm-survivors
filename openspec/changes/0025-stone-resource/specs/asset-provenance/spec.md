# Spec delta · asset-provenance

## ADDED Requirements

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
