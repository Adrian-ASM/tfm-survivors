# Spec delta · asset-provenance

<!-- Change 0034-upgrade-icons. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Decisiones de design pendientes (no las fija esta spec): carpeta exacta de los iconos bajo `public/assets/`,
     nombre de la lista nueva y de sus campos en `content/asset-provenance.json`, número del ADR (probable 0030) y si
     la curación tiene reserva propia (2 o 3 reservas). -->

## ADDED Requirements

### Requirement: Procedencia de las imágenes generadas con IA
El repositorio SHALL registrar cada imagen generada con IA en una **lista propia** de `content/asset-provenance.json`,
aparte de la lista de arte de Tiny Swords (cuya cabecera `CC0` / `Update 010` / `2026-11-22` no cambia) y de la lista
`fonts` (0032). Cada registro tiene, todos obligatorios salvo el paso de procesado:
- la ruta en el repositorio (`.png`);
- la herramienta con la que se generó (texto no vacío);
- la fecha de generación (`AAAA-MM-DD`, fecha de calendario válida);
- los términos de uso de la herramienta sobre sus salidas (referencia no vacía: URL o cita);
- el prompt usado (texto no vacío);
- opcionalmente, el paso de procesado posterior (p. ej. quitar el fondo): la ruta de un script versionado;
- el sha256 (64 caracteres hexadecimales) y los bytes reales del fichero.

La lista MUST referenciar el ADR que fija la política de imágenes con IA (ruta de un fichero versionado en
`docs/adr/`). Las imágenes con IA solo se admiten como **iconos de las mejoras y de la curación** y sus reservas (ver
"Iconos de mejora versionados"): toda ruta de la lista MUST estar en la carpeta de iconos de `public/assets/` (ruta
exacta: decisión de design) y ninguna imagen de esa carpeta puede estar en la lista de arte. El guardarraíl de
procedencia (`guard-assets`) MUST fallar, con un mensaje que nombra la ruta y, si aplica, el campo, si: un registro
tiene un campo ausente, vacío, con otro formato o desconocido; el sha256 o los bytes no coinciden con el fichero; el
script del paso de procesado o el ADR no están versionados; o una ruta de la lista está fuera de la carpeta de iconos.
Se aplica en las tres capas de siempre (hook, commit y `npm run verify` / CI) y MUST NOT necesitar red ni la
herramienta de IA. Comprobar que los términos permiten publicar las salidas en un repositorio público es una revisión
humana (gate de verify); un icono cuyos términos no lo permitan MUST NOT versionarse.

#### Scenario: Lista del repositorio
- **GIVEN** el repositorio tras este change
- **WHEN** se ejecuta `npm run guard:all`
- **THEN** pasa; la lista de imágenes con IA tiene exactamente una entrada por cada imagen de los datos de iconos
  (iconos por id y de reserva, ver "Datos de los iconos de mejora" en `sprite-rendering`), y cada entrada tiene
  herramienta, fecha `AAAA-MM-DD`, términos y prompt no vacíos, y sha256 y bytes iguales a los del fichero
- **AND** el ADR que referencia la lista está versionado en `docs/adr/`
- **AND** la cabecera de la nota sigue registrando para el arte de Tiny Swords licencia `CC0`, versión `Update 010` y
  fecha `2026-11-22`, y la lista de arte y la de `fonts` son iguales campo a campo a las de antes del change

#### Scenario: Registro de imagen con IA incompleto o incorrecto
- **GIVEN** la nota real tras el change con, en un caso cada vez, en la entrada de un icono: sin herramienta; fecha
  `26/11/2026`; fecha `2026-02-30`; términos `""`; prompt `""`; sha256 cambiado en un carácter; bytes + 1; un campo
  extra `version`; o un paso de procesado que apunta a `scripts/no-existe.ps1`, sin versionar
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta del icono y el campo (herramienta, fecha, fecha, términos, prompt,
  sha256, bytes, `version` y paso de procesado respectivamente)

#### Scenario: Imagen con IA sin registro
- **GIVEN** una lista simulada igual a la real tras el change más un PNG nuevo `extra.png` en la carpeta de iconos, sin
  entrada en ninguna lista de la nota
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta de `extra.png`

#### Scenario: Registro de imagen con IA sin fichero
- **GIVEN** la nota real y una lista simulada sin el fichero de uno de los iconos que registra la lista de imágenes con
  IA
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra la ruta que falta

#### Scenario: Imagen con IA fuera de los iconos
- **GIVEN** una nota simulada igual a la real tras el change más una entrada de imagen con IA completa para
  `public/assets/tiny-swords/Factions/Goblins/Troops/Torch/Torch_IA.png`, y la lista con ese fichero
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa ruta (la IA no se admite fuera de los iconos de mejora y curación)

#### Scenario: Política sin ADR
- **GIVEN** una nota simulada igual a la real tras el change cuya referencia al ADR apunta a un fichero no versionado
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa ruta

#### Scenario: Imágenes con IA sin red
- **GIVEN** el repositorio tras este change, sin red y sin la herramienta de IA en la máquina
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa

### Requirement: Iconos de mejora versionados
El repositorio SHALL versionar, en la carpeta de iconos de `public/assets/` y con su entrada en la lista de imágenes
con IA, exactamente las imágenes que usan los datos de iconos (ver "Datos de los iconos de mejora" en
`sprite-rendering`): un icono por cada una de las 15 mejoras y por la curación (16) más los iconos de reserva por
categoría (personaje y arma; y uno de la curación si el design le da reserva propia), ni uno más. Cada uno MUST ser un
PNG de 64 × 64 px con canal alfa y fondo transparente (sus 4 píxeles de esquina con alfa 0). Lo comprueba un test sobre
los PNG del repositorio, no el arranque.

#### Scenario: Iconos del repositorio medidos
- **GIVEN** los PNG versionados de la carpeta de iconos y los datos de iconos del repositorio
- **WHEN** se leen su ancho, su alto, su tipo de color y el alfa de sus 4 esquinas
- **THEN** hay exactamente 16 iconos por id más los de reserva, cada uno de 64 × 64 px, con canal alfa y alfa 0 en las
  4 esquinas

#### Scenario: Icono con otro tamaño o sin alfa
- **GIVEN** una copia de prueba de la carpeta de iconos en la que, en un caso cada vez, el icono de `armor` mide
  48 × 48 px, es un PNG RGB sin alfa o tiene la esquina superior izquierda opaca
- **WHEN** se ejecuta el test de "Iconos del repositorio medidos"
- **THEN** falla y nombra el icono de `armor`

#### Scenario: Icono de más
- **GIVEN** una lista simulada igual a la real tras el change más un PNG en la carpeta de iconos con su entrada en la
  lista de imágenes con IA, sin que ningún id ni ninguna reserva de los datos de iconos lo use
- **WHEN** se ejecuta el test de "Solo las hojas usadas" (`sprite-rendering`)
- **THEN** falla y nombra ese PNG

## MODIFIED Requirements

### Requirement: Nota de procedencia
El repositorio SHALL contener una nota de procedencia que registra, para el arte de Tiny Swords: el pack
(`Tiny Swords`), el autor (`Pixel Frog`), la versión (`Update 010`), la licencia (`CC0`), la fecha de la confirmación
del autor de que esa versión es CC0 (`2026-11-22`) y, en su lista de arte, una entrada por cada asset gráfico incluido
del pack, con su ruta en el repositorio y su ruta de origen dentro del pack. La nota MUST NOT exigir ni enlazar una
captura o prueba versionada de la confirmación: basta con la fecha. La nota tiene además, aparte y con sus propias
reglas, la lista `fonts` (ver "Procedencia y licencia de la fuente") y la lista de imágenes generadas con IA (ver
"Procedencia de las imágenes generadas con IA"); la cabecera (pack, autor, versión, licencia y fecha) se aplica solo a
la lista de arte. Cada ruta del repositorio figura una sola vez en el conjunto de las tres listas.

#### Scenario: Nota del repositorio
- **GIVEN** el repositorio tras este change
- **WHEN** el guardarraíl lee la nota de procedencia
- **THEN** la nota registra pack `Tiny Swords`, autor `Pixel Frog`, versión `Update 010`, licencia `CC0` y fecha
  `2026-11-22`
- **AND** su lista de arte tiene ≥ 1 entrada y cada entrada tiene ruta en el repositorio y ruta de origen no vacías

#### Scenario: Nota incompleta
- **GIVEN** una nota sin la fecha de la confirmación, y en otros casos sin licencia, con licencia distinta de `CC0`,
  con versión distinta de `Update 010` o con una entrada de la lista de arte sin ruta de origen
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra el campo ausente o incorrecto

#### Scenario: Entrada repetida
- **GIVEN** una nota con dos entradas para la misma ruta del repositorio
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa ruta

#### Scenario: Ruta en dos listas
- **GIVEN** una nota simulada igual a la real tras el change en la que la ruta de un icono figura en la lista de
  imágenes con IA y también en la lista de arte
- **WHEN** se ejecuta el guardarraíl
- **THEN** falla con un mensaje que nombra esa ruta

### Requirement: Solo assets registrados
El sistema SHALL garantizar que cada asset gráfico de la lista de ficheros versionados tiene entrada en la nota de
procedencia, en la lista de arte o en la de imágenes generadas con IA (en una sola), y que cada entrada de esas listas
corresponde a un fichero de la lista de ficheros versionados. La lista MUST NOT contener ficheros de sistema
(`.DS_Store`, `Thumbs.db`, `desktop.ini`), fuentes de edición (`.aseprite`) ni comprimidos (`.zip`, `.rar`, `.7z`,
`.tar`, `.gz`) en ninguna carpeta.

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

#### Scenario: Icono registrado solo como imagen con IA
- **GIVEN** la lista real de ficheros versionados tras este change
- **WHEN** se ejecuta el guardarraíl
- **THEN** pasa, y cada PNG de la carpeta de iconos tiene exactamente 1 entrada, en la lista de imágenes con IA

### Requirement: Nada del Free Pack
El sistema SHALL rechazar cualquier asset del Tiny Swords Free Pack, que no es CC0. El guardarraíl MUST fallar si un
fichero de la lista de ficheros versionados, o la ruta de origen de una entrada de la lista de arte, contiene
`Free Pack`, `Free_Pack` o `FreePack` (sin distinguir mayúsculas), o si una entrada de la lista de arte registra una
versión distinta de `Update 010`. Las entradas de la lista de imágenes con IA no tienen versión ni ruta de origen del
pack (no proceden de él) y no se les exige.

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

## REMOVED Requirements
<!-- Ninguno. -->
