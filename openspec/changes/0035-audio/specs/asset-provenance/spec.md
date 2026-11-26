# Spec delta · asset-provenance

<!-- Change 0035-audio. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Base de los MODIFIED: la spec viva MÁS el delta de 0034-upgrade-icons (fusionado en `main`, pendiente de
     archivar), que ya introduce la lista de imágenes generadas con IA. Si 0034 se archiva antes, estos MODIFIED
     sustituyen a los suyos; si no, el archivado de 0035 debe aplicar primero el de 0034.
     Decisiones de design pendientes (no las fija esta spec): carpeta exacta del audio bajo `public/assets/` y nombre
     de la lista y de sus campos en `content/asset-provenance.json`. -->

## ADDED Requirements

### Requirement: Procedencia del audio
El repositorio SHALL registrar cada fichero de audio versionado en una **lista de audio** propia de
`content/asset-provenance.json`, aparte de la lista de arte de Tiny Swords (cuya cabecera `CC0` / `Update 010` /
`2026-11-22` no cambia), de la lista `fonts` y de la de imágenes generadas con IA. Son ficheros de audio los `.ogg`,
`.mp3`, `.wav` y `.flac` (sin distinguir mayúsculas). Cada registro tiene, todos obligatorios:
- la ruta en el repositorio, dentro de la carpeta de audio de `public/assets/` (ruta exacta: decisión de design);
- el título o nombre del recurso en su fuente y su autor (textos no vacíos);
- la URL de la página de la fuente, `https`, cuyo host es `kenney.nl`, `opengameart.org` o `freesound.org` (con o sin
  `www.`);
- la licencia, exactamente `CC0`;
- la fecha de descarga (`AAAA-MM-DD`, fecha de calendario válida);
- el sha256 (64 caracteres hexadecimales) y los bytes reales del fichero.

El audio de este change procede solo de esas fuentes CC0, sin generar por IA ni por script y sin recodificar: cada
fichero MUST ser idéntico byte a byte al descargado (comprobarlo frente a la fuente es revisión humana del gate de
verify). El guardarraíl de procedencia (`guard-assets`) MUST fallar, con un mensaje que nombra la ruta y, si aplica,
el campo, si: un fichero de audio versionado no tiene registro en la lista de audio; un registro no tiene fichero
versionado; un campo falta, está vacío, tiene otro formato o es desconocido; la licencia no es `CC0` (p. ej.
`CC-BY-4.0`); el host de la URL no es uno de los tres; el sha256 o los bytes no coinciden; la ruta está fuera de la
carpeta de audio; o un fichero de audio figura en la lista de arte, en `fonts` o en la de imágenes con IA. Se aplica en
las tres capas de siempre (hook, commit y `npm run verify` / CI) y MUST NOT necesitar red.

#### Scenario: Audio del repositorio registrado
- **GIVEN** el repositorio tras este change
- **WHEN** se ejecuta `npm run guard:all`
- **THEN** pasa; la lista de audio tiene exactamente una entrada por cada fichero de audio versionado, cada una con
  licencia `CC0`, URL `https` de uno de los tres hosts, fecha `AAAA-MM-DD` y sha256 y bytes iguales a los del fichero
- **AND** la lista de arte, la de `fonts` y la de imágenes con IA son iguales campo a campo a las de antes del change

#### Scenario: Audio sin registrar
- **GIVEN** una lista simulada igual a la real más, en un caso cada vez, `public/assets/extra/hit.ogg`,
  `public/assets/extra/hit.MP3`, `docs/demo.wav` y `public/assets/extra/hit.FLAC`, sin registro
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra ese fichero

#### Scenario: Registro de audio incompleto o incorrecto
- **GIVEN** la nota real tras el change con, en la entrada de un efecto y en un caso cada vez: licencia `CC-BY-4.0`;
  sin licencia; URL `http://kenney.nl/assets/x`; URL `https://example.com/x.ogg`; sin autor; fecha `2026-13-01`; sha256
  cambiado en un carácter; bytes + 1; un campo extra `attribution`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta del fichero y el campo (licencia, licencia, URL, URL, autor, fecha,
  sha256, bytes y `attribution` respectivamente)

#### Scenario: Registro de audio sin fichero
- **GIVEN** la nota real y una lista simulada sin el fichero de la música
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta de la música

#### Scenario: Audio en otra lista
- **GIVEN** una nota simulada igual a la real tras el change en la que, en un caso, un fichero de audio se registra
  también en la lista de imágenes con IA y, en otro, solo en la lista de arte
- **WHEN** se ejecuta el guardarraíl
- **THEN** en ambos casos falla con un mensaje que nombra esa ruta

#### Scenario: Audio fuera de su carpeta
- **GIVEN** una nota y una lista simuladas iguales a las reales más `public/assets/icons/beep.wav` con un registro de
  audio completo y correcto
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra `public/assets/icons/beep.wav`

#### Scenario: Audio sin red
- **GIVEN** el repositorio tras este change, sin red
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa

## MODIFIED Requirements

### Requirement: Nota de procedencia
El repositorio SHALL contener una nota de procedencia que registra, para el arte de Tiny Swords: el pack
(`Tiny Swords`), el autor (`Pixel Frog`), la versión (`Update 010`), la licencia (`CC0`), la fecha de la confirmación
del autor de que esa versión es CC0 (`2026-11-22`) y, en su lista de arte, una entrada por cada asset gráfico incluido
del pack, con su ruta en el repositorio y su ruta de origen dentro del pack. La nota MUST NOT exigir ni enlazar una
captura o prueba versionada de la confirmación: basta con la fecha. La nota tiene además, aparte y con sus propias
reglas, la lista `fonts` (ver "Procedencia y licencia de la fuente"), la lista de imágenes generadas con IA (ver
"Procedencia de las imágenes generadas con IA") y la lista de audio (ver "Procedencia del audio"); la cabecera (pack,
autor, versión, licencia y fecha) se aplica solo a la lista de arte. Cada ruta del repositorio figura una sola vez en
el conjunto de las cuatro listas.

#### Scenario: Nota del repositorio
- **GIVEN** el repositorio tras este change
- **WHEN** el guardarraíl lee la nota de procedencia
- **THEN** la nota registra pack `Tiny Swords`, autor `Pixel Frog`, versión `Update 010`, licencia `CC0` y fecha
  `2026-11-22`
- **AND** su lista de arte tiene ≥ 1 entrada y cada entrada tiene ruta en el repositorio y ruta de origen no vacías
- **AND** su lista de audio tiene ≥ 1 entrada

#### Scenario: Nota incompleta
- **GIVEN** una nota sin la fecha de la confirmación, y en otros casos sin licencia, con licencia distinta de `CC0`,
  con versión distinta de `Update 010` o con una entrada de la lista de arte sin ruta de origen
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra el campo ausente o incorrecto

#### Scenario: Entrada repetida
- **GIVEN** una nota con dos entradas para la misma ruta del repositorio, en un caso en la lista de arte y en otro en
  la lista de audio
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa ruta

#### Scenario: Ruta en dos listas
- **GIVEN** una nota simulada igual a la real tras el change en la que la ruta de un icono figura en la lista de
  imágenes con IA y también en la lista de arte
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa ruta

### Requirement: Solo assets registrados
El sistema SHALL garantizar que cada asset gráfico de la lista de ficheros versionados tiene entrada en la nota de
procedencia, en la lista de arte o en la de imágenes generadas con IA (en una sola), que cada fichero de audio
versionado (`.ogg`, `.mp3`, `.wav`, `.flac`, sin distinguir mayúsculas) tiene entrada en la lista de audio y en ninguna otra, y
que cada entrada de esas listas corresponde a un fichero de la lista de ficheros versionados. La lista MUST NOT
contener ficheros de sistema (`.DS_Store`, `Thumbs.db`, `desktop.ini`), fuentes de edición (`.aseprite`) ni comprimidos
(`.zip`, `.rar`, `.7z`, `.tar`, `.gz`) en ninguna carpeta (tampoco el comprimido en que se descargue un pack de audio).

#### Scenario: Estado real del repositorio
- **GIVEN** la lista real de ficheros versionados tras este change
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa: cada asset gráfico y cada fichero de audio tiene entrada, cada entrada tiene fichero y no hay ficheros
  prohibidos

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
  `assets/Thumbs.db`, `art/Archer.aseprite`, `tiny-swords.zip` o `public/assets/audio/kenney_rpg-audio.zip`
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra ese fichero

#### Scenario: Mayúsculas en la extensión
- **GIVEN** una lista simulada igual a la real más `public/assets/Tree.PNG` y, en otro caso, `public/assets/Hit.WAV`,
  sin entrada en la nota
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra ese fichero

#### Scenario: Icono registrado solo como imagen con IA
- **GIVEN** la lista real de ficheros versionados tras este change
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa, y cada PNG de la carpeta de iconos tiene exactamente 1 entrada, en la lista de imágenes con IA

#### Scenario: Audio registrado solo como audio
- **GIVEN** la lista real de ficheros versionados tras este change
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa, y cada fichero de audio tiene exactamente 1 entrada, en la lista de audio, aunque varios tipos de
  efecto del contenido de audio lo usen (un registro por fichero, no por tipo)

### Requirement: Nada del Free Pack
El sistema SHALL rechazar cualquier asset del Tiny Swords Free Pack, que no es CC0. El guardarraíl MUST fallar si un
fichero de la lista de ficheros versionados, o la ruta de origen de una entrada de la lista de arte, contiene
`Free Pack`, `Free_Pack` o `FreePack` (sin distinguir mayúsculas), o si una entrada de la lista de arte registra una
versión distinta de `Update 010`. Las entradas de la lista de imágenes con IA y de la lista de audio no tienen versión
ni ruta de origen del pack (no proceden de él) y no se les exige.

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

#### Scenario: Imagen con IA sin versión del pack
- **GIVEN** el repositorio tras este change, cuyas entradas de imágenes con IA no tienen versión ni ruta de origen
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa, sin ningún mensaje sobre versión ni Free Pack para esas entradas

#### Scenario: Audio sin versión del pack
- **GIVEN** el repositorio tras este change, cuyas entradas de audio no tienen versión ni ruta de origen del pack
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa, sin ningún mensaje sobre versión ni Free Pack para esas entradas

## REMOVED Requirements
<!-- Ninguno. -->
