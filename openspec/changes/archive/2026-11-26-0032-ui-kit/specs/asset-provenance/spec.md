# Spec delta · asset-provenance

> Change 0032-ui-kit. "Pieza" y "rol" según las convenciones del delta de `sprite-rendering` de este change. Las
> reglas de "Nota de procedencia" (pack, autor, versión, licencia `CC0` y fecha del arte de Tiny Swords) no cambian.

## ADDED Requirements

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
