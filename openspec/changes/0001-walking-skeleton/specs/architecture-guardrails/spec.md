# Spec delta · architecture-guardrails

<!-- Change 0001-walking-skeleton. Los hooks de Claude Code (.claude/hooks/) solo actúan dentro de Claude Code.
     Esta capacidad hace que las MISMAS reglas se apliquen a cualquier autor (persona, Claude desde la app,
     Claude Code u otro agente) en el commit y en CI. Reglas: AGENTS.md §3 y §6. -->

## ADDED Requirements

### Requirement: Guardarraíl en pre-commit
El sistema SHALL ejecutar, en el hook `pre-commit` de git, las reglas de `.claude/hooks/guard-architecture.mjs` y
`.claude/hooks/guard-secrets.mjs` sobre el contenido **preparado** (staged) de cada fichero del commit, y MUST
abortar el commit si alguna regla falla, mostrando el fichero y la regla incumplida.

#### Scenario: Aleatoriedad global en el dominio
- **GIVEN** un fichero preparado `src/domain/x.ts` que contiene `Math.random()`
- **WHEN** se ejecuta `git commit`
- **THEN** el commit se aborta con código distinto de 0
- **AND** la salida nombra `src/domain/x.ts` y el puerto `RandomGenerator`

#### Scenario: El dominio importa el motor
- **GIVEN** un fichero preparado `src/domain/y.ts` con `import Phaser from "phaser"`
- **WHEN** se ejecuta `git commit`
- **THEN** el commit se aborta y la salida dice que el dominio no puede importar el motor

#### Scenario: Fichero de secretos
- **GIVEN** un fichero preparado `.env.local`
- **WHEN** se ejecuta `git commit`
- **THEN** el commit se aborta y la salida menciona `.env.example`

#### Scenario: Se evalúa lo preparado, no el disco
- **GIVEN** `src/domain/x.ts` preparado con `Math.random()` y después corregido en disco sin volver a prepararlo
- **WHEN** se ejecuta `git commit`
- **THEN** el commit se aborta (se comprueba la versión que entraría en el commit)

#### Scenario: Commit limpio
- **GIVEN** ficheros preparados que cumplen todas las reglas
- **WHEN** se ejecuta `git commit`
- **THEN** el guardarraíl termina con código 0 en menos de 2 s para 50 ficheros

### Requirement: Guardarraíl en CI
El sistema SHALL ejecutar las mismas reglas sobre todos los ficheros versionados en el job `quality` del CI, de
modo que un cambio que no haya pasado por el pre-commit (p. ej. `--no-verify` o un commit hecho con la API de
GitHub) haga fallar el pipeline.

#### Scenario: Violación subida sin pre-commit
- **GIVEN** un commit en una rama con `src/application/z.ts` que usa `Date.now()`
- **WHEN** se ejecuta el CI
- **THEN** el job `quality` falla y su log nombra `src/application/z.ts` y el puerto `Clock`

### Requirement: Reglas de capas en ESLint
El sistema SHALL detectar con ESLint, en el IDE, en el pre-commit y en CI, las importaciones prohibidas entre capas
(AGENTS.md §3, reglas 1, 2 y 4) y el uso de `Math.random`, `Date.now`, `performance.now`, `window`, `document` y
`localStorage` en `src/domain` y `src/application`.

#### Scenario: Aplicación importa infraestructura
- **GIVEN** `src/application/a.ts` con un import de `../infrastructure/...`
- **WHEN** se ejecuta `npm run lint`
- **THEN** ESLint informa de un error en ese import y el comando termina con código distinto de 0

#### Scenario: Infraestructura importa el motor
- **GIVEN** `src/infrastructure/phaser/GameScene.ts` con `import Phaser from "phaser"`
- **WHEN** se ejecuta `npm run lint`
- **THEN** no hay error por ese import
