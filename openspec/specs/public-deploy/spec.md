# Public deploy · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Publicar la build de producción del juego en una URL pública de GitHub Pages solo cuando la calidad está en verde,
y poder comprobar a demanda, sin gastar minutos en cada push, que esa URL carga el juego sin violaciones de CSP y
que jugar, guardar, exportar e importar funcionan igual que en local (ADR-0004). El requisito de CSP de
`progress-persistence` aplica a esta misma build.

Términos:
- **URL pública**: `https://adrian-asm.github.io/tfm-survivors/`.
- **Smoke remoto**: la prueba E2E a demanda descrita en "Smoke a demanda contra una URL": comando
  `npm run smoke:public` y workflow `smoke-public.yml`.
- **URL objetivo**: la URL contra la que corre el smoke remoto; por defecto, la URL pública.

## Requirements

### Requirement: Publicación automática tras la calidad en verde
El sistema SHALL publicar la build de producción en GitHub Pages, en la URL pública, después de un push a `main`
que modifique al menos un fichero que no sea solo documentación, y solo si los jobs `quality` y `e2e` de esa misma
ejecución terminan en verde. Se considera solo documentación lo que ya excluye la CI: `**.md`, `docs/**`,
`openspec/**`, `.claude/agents/**` y `.claude/skills/**`.

El sistema MUST NOT publicar:
- desde un `pull_request`, aunque todos sus checks estén en verde;
- desde un lanzamiento manual (`workflow_dispatch`) del workflow `ci`;
- desde una rama distinta de `main`;
- si `quality` o `e2e` fallan, se cancelan o se saltan.

#### Scenario: Push a main con código y CI en verde
- **GIVEN** el workflow `ci` (`.github/workflows/ci.yml`)
- **WHEN** se analiza su configuración
- **THEN** existe un job `deploy` que depende (`needs`) de `quality` y de `e2e`
- **AND** `deploy` solo se ejecuta si el evento es `push` y la referencia es `refs/heads/main`
- **AND** el artefacto de Pages se sube solo en ese mismo caso y contiene el directorio `dist`

#### Scenario: Pull request en verde
- **GIVEN** un `pull_request` cuyos jobs `quality` y `e2e` terminan en verde
- **WHEN** termina la ejecución de `ci`
- **THEN** el job `deploy` no se ejecuta y no se sube ningún artefacto de Pages

#### Scenario: Push a main solo de documentación
- **GIVEN** un push a `main` que solo modifica `README.md` y `openspec/changes/0011-public-deploy/proposal.md`
- **WHEN** GitHub evalúa los disparadores de `ci`
- **THEN** el workflow `ci` no se ejecuta y la URL pública sigue sirviendo la build anterior

#### Scenario: Push a main con e2e en rojo
- **GIVEN** un push a `main` con cambios en `src/` cuyo job `e2e` falla
- **WHEN** termina la ejecución de `ci`
- **THEN** el job `deploy` no se ejecuta y la URL pública sigue sirviendo la build anterior

#### Scenario: Evidencia del despliegue vigente
- **GIVEN** el último push a `main` que cambió código
- **WHEN** se consulta su ejecución de `ci`
- **THEN** los jobs `setup`, `quality`, `e2e` y `deploy` terminaron en verde
- **AND** el `verify-report.md` del change registra el identificador de esa ejecución

### Requirement: Base de rutas de la build publicada
La build de producción SHALL servirse bajo la ruta base `/tfm-survivors/`: todo recurso que cargue la página
(scripts, estilos e imágenes del propio juego) MUST pedirse con una ruta que empiece por `/tfm-survivors/` en el
mismo origen. La carga de la página MUST NOT producir ninguna respuesta HTTP con estado ≥ 400 para recursos del
propio origen.

#### Scenario: Rutas del index.html publicado
- **GIVEN** el `index.html` que sirve la URL objetivo (es el `dist/index.html` publicado), leído por el smoke remoto
- **WHEN** se leen todos sus atributos `src` y `href` que apuntan a recursos locales
- **THEN** todos empiezan por la ruta de la URL objetivo (`/tfm-survivors/` en la URL pública)
- **AND** ninguno empieza por `/src/` ni por `http:`, `https:` o `//`

#### Scenario: Sin recursos rotos en la URL objetivo
- **GIVEN** la URL objetivo
- **WHEN** el smoke remoto carga la página y espera a que se vea el menú de inicio
- **THEN** la respuesta del documento tiene estado 200
- **AND** 0 peticiones al mismo origen terminan con estado ≥ 400 o fallan por red

#### Scenario: Ruta inexistente bajo la base
- **GIVEN** la URL pública
- **WHEN** se pide `https://adrian-asm.github.io/tfm-survivors/no-existe`
- **THEN** la respuesta tiene estado 404 y no se ejecuta el juego (no hay canvas del juego en la página)

### Requirement: Carga del juego en la URL pública sin violaciones de CSP
La URL pública SHALL servirse por HTTPS y cargar el juego con la misma política de seguridad de contenido que exige
`progress-persistence` ("Política de seguridad de contenido"). Como GitHub Pages no permite cabeceras HTTP propias,
la CSP de la build publicada se aplica solo con la `<meta http-equiv="Content-Security-Policy">` de `index.html` y
MUST NOT incluir directivas que la meta ignora (`frame-ancestors`, `report-uri`, `report-to`, `sandbox`). La
ausencia de protección contra el incrustado en iframes ajenos (clickjacking) es un riesgo aceptado en fase 1 y
MUST quedar documentado en ADR-0004 con esas directivas nombradas.

#### Scenario: Carga limpia
- **GIVEN** la URL objetivo sin parámetros y un contexto de navegador nuevo (sin almacenamiento previo)
- **WHEN** el smoke remoto carga la página y espera a que se vea el menú de inicio
- **THEN** la URL final empieza por `https://` (si la URL objetivo es la pública)
- **AND** existe exactamente 1 `<meta http-equiv="Content-Security-Policy">`
- **AND** se registran 0 eventos `securitypolicyviolation` y 0 mensajes de consola de violación de CSP
- **AND** hay 0 errores no capturados en la consola

#### Scenario: Directivas que la meta ignora
- **GIVEN** el `index.html` fuente del repositorio (la build no altera su meta CSP) y, por separado, el `index.html`
  que sirve la URL objetivo
- **WHEN** un test de `npm run verify` lee la meta CSP del fuente y el smoke remoto lee la del servido
- **THEN** ninguna de las dos contiene `frame-ancestors`, `report-uri`, `report-to` ni `sandbox`
- **AND** si se quiere comprobar el `dist/index.html` literal, es una comprobación del verifier tras
  `npm run build`, no un test de `verify` (que no construye)

#### Scenario: HTTP redirige a HTTPS
- **GIVEN** la URL `http://adrian-asm.github.io/tfm-survivors/`
- **WHEN** se pide siguiendo redirecciones
- **THEN** la respuesta final tiene estado 200 y su URL empieza por `https://adrian-asm.github.io/tfm-survivors/`

#### Scenario: Riesgo aceptado documentado
- **GIVEN** `docs/adr/0004-seguridad-local-first.md`
- **WHEN** se lee
- **THEN** contiene un apartado de riesgo aceptado sobre las cabeceras en GitHub Pages que nombra
  `frame-ancestors`, `report-uri` y `sandbox` y menciona el clickjacking

### Requirement: Bucle completo en la build publicada
En la URL objetivo, el sistema SHALL permitir jugar una partida hasta su fin, guardarla automáticamente, exportar el
progreso e importarlo, con el mismo comportamiento que especifica `progress-persistence` para la build local y sin
ninguna violación de CSP en todo el recorrido. Para acotar la duración, el smoke remoto MAY usar
`?e2e&seed=42&speed=15` (parámetros ya disponibles en producción, ver `simulation-loop`).

#### Scenario: Jugar, guardar, exportar e importar en producción
- **GIVEN** la URL objetivo con `?e2e&seed=42&speed=15` y un contexto de navegador nuevo (progreso vacío)
- **WHEN** el smoke remoto deja al jugador quieto hasta que la partida termina en derrota
- **THEN** el overlay de resultados es visible y el progreso guardado en `localStorage` es válido según
  `progress-persistence` y tiene exactamente 1 entrada de historial con `outcome` `'lost'` y `seed` 42
- **AND** al pulsar **Exportar** se descarga exactamente 1 fichero `sprint-survivors-progress.json`, válido e igual
  campo a campo al progreso guardado
- **AND** al importar ese mismo fichero, el overlay muestra el mensaje de éxito y el progreso guardado sigue
  teniendo exactamente 1 entrada de historial (import idempotente)
- **AND** en todo el recorrido se registran 0 eventos `securitypolicyviolation` y 0 errores no capturados

#### Scenario: Persistencia tras recargar en producción
- **GIVEN** el estado final del escenario anterior
- **WHEN** se recarga la URL objetivo en el mismo contexto de navegador
- **THEN** el progreso cargado coincide campo a campo con el guardado antes de recargar
- **AND** no se emite ningún aviso por consola que mencione `progress`

### Requirement: Smoke a demanda contra una URL
El proyecto SHALL ofrecer un smoke remoto que ejecute los escenarios de "Base de rutas", "Carga del juego en la URL
pública" y "Bucle completo en la build publicada" contra la URL objetivo, lanzable de dos formas:
- en local, con un comando npm propio;
- en GitHub Actions, con un workflow propio (distinto de `ci.yml`) cuyo único disparador es `workflow_dispatch`.

La URL objetivo MUST poder cambiarse sin editar código (por variable de entorno o entrada del workflow); si no se
indica, es la URL pública. Cuando la URL objetivo no es `localhost`, el smoke MUST NOT construir la app ni arrancar
un servidor local. El smoke MUST usar contextos de navegador nuevos, de modo que no dependa de datos previos ni deje
datos fuera del navegador de la prueba. Antes de abrir ninguna página, el smoke MUST comprobar que la URL objetivo
responde con estado 200 (comprobación previa de como mucho 40 s). Los tests del smoke MUST tener un tope global de
130 s, de modo que el smoke completo (comprobación previa y tests, sin contar la instalación de dependencias y
navegadores) termine en 180 s o menos de reloj, responda o no la URL objetivo. El smoke usa
`?e2e&seed=42&speed=15` para el bucle de juego.

#### Scenario: Smoke en verde contra la URL pública
- **GIVEN** la URL pública sirviendo la build vigente y ninguna URL objetivo indicada
- **WHEN** se lanza el smoke remoto con el comando npm
- **THEN** corre contra `https://adrian-asm.github.io/tfm-survivors/`, todos sus tests pasan y el proceso termina
  con código 0 en 180 s o menos
- **AND** no se ha ejecutado `npm run build` ni `vite preview`

#### Scenario: URL objetivo alternativa
- **GIVEN** una build servida con `vite preview` en `http://localhost:4173/tfm-survivors/`
- **WHEN** se lanza el smoke remoto indicando esa URL como objetivo
- **THEN** todas las peticiones de documento del smoke van a `http://localhost:4173/tfm-survivors/` y 0 a
  `adrian-asm.github.io`

#### Scenario: Barra final opcional
- **GIVEN** la URL objetivo indicada como `https://adrian-asm.github.io/tfm-survivors` (sin barra final)
- **WHEN** se lanza el smoke remoto
- **THEN** el resultado es el mismo que con `https://adrian-asm.github.io/tfm-survivors/`

#### Scenario: URL objetivo inválida
- **GIVEN** una URL objetivo `ftp://ejemplo` o el texto `no-es-una-url`
- **WHEN** se lanza el smoke remoto
- **THEN** termina con código distinto de 0 sin abrir ninguna página y con un mensaje que contiene la URL indicada

#### Scenario: URL objetivo que no responde
- **GIVEN** una URL objetivo `https://` que no responde o devuelve 404 en la raíz
- **WHEN** se lanza el smoke remoto
- **THEN** termina con código distinto de 0 en 180 s o menos
- **AND** el fallo indica que la carga inicial no llegó a estado 200 y contiene la URL objetivo, distinguible de un
  fallo de CSP o del bucle de juego

#### Scenario: Workflow manual
- **GIVEN** el workflow del smoke remoto en `.github/workflows/`
- **WHEN** se analiza su configuración
- **THEN** su único disparador es `workflow_dispatch`, con una entrada opcional para la URL objetivo cuyo valor por
  defecto es la URL pública
- **AND** sus permisos se limitan a `contents: read` (sin `pages`, `id-token` ni escritura)
- **AND** su job tiene `timeout-minutes: 8`

### Requirement: Smoke remoto fuera de la verificación habitual
El smoke remoto SHALL quedar fuera de la verificación que corre en cada cambio, para no depender de la red ni gastar
minutos del plan gratuito:
- `npm run test:e2e` MUST NOT ejecutar ningún test del smoke remoto;
- `npm run verify` MUST NOT ejecutar ningún test del smoke remoto ni acceder a la red;
- ningún workflow MUST lanzarlo con los disparadores `push`, `pull_request`, `pull_request_target`, `schedule`,
  `workflow_run` ni como paso o job de `ci.yml`.

Los tres puntos anteriores los comprueba un test estático incluido en `npm run verify`. Además, este change MUST NOT
modificar `.github/workflows/ci.yml` ni `tests/guardrails/ci.test.ts`; eso no es un test permanente (bloquearía
cambios futuros de la CI), sino una comprobación del verifier en este change.

#### Scenario: test:e2e no incluye el smoke remoto
- **GIVEN** la configuración de Playwright que usa `npm run test:e2e`
- **WHEN** un test de `verify` la analiza
- **THEN** sus tests se buscan solo en `tests/e2e/`, que no contiene ni importa ningún test del smoke remoto

#### Scenario: Mismo número de E2E que en main (comprobación del verifier)
- **GIVEN** la rama `change/0011-public-deploy`
- **WHEN** el verifier ejecuta `npx playwright test --list` con la configuración de `test:e2e`
- **THEN** lista 48 tests, los mismos que en `main`

#### Scenario: verify no incluye el smoke remoto
- **GIVEN** los scripts de `package.json`
- **WHEN** se sigue la cadena de comandos de `verify`
- **THEN** ninguno lanza Playwright ni el comando npm del smoke remoto

#### Scenario: Ningún disparador automático
- **GIVEN** todos los ficheros de `.github/workflows/`
- **WHEN** se analizan
- **THEN** el único workflow que referencia el smoke remoto es el suyo propio
- **AND** ese workflow no declara `push`, `pull_request`, `pull_request_target`, `schedule` ni `workflow_run`
- **AND** `ci.yml` no menciona el smoke remoto ni su comando npm

#### Scenario: ci.yml intacto (comprobación del verifier)
- **GIVEN** la rama `change/0011-public-deploy` lista para PR
- **WHEN** el verifier ejecuta `git diff --quiet main -- .github/workflows/ci.yml tests/guardrails/ci.test.ts`
- **THEN** el comando termina con código 0 (sin diferencias)
- **AND** `tests/guardrails/ci.test.ts` pasa en verde dentro de `npm run verify`

### Requirement: Documentación del despliegue
El `README.md` SHALL incluir la URL pública como enlace y explicar cómo lanzar el smoke remoto en local (con el
comando npm y la forma de indicar otra URL objetivo) y desde GitHub Actions (nombre del workflow y entrada de URL).

#### Scenario: README con URL e instrucciones
- **GIVEN** el `README.md` al cerrar el change
- **WHEN** se lee
- **THEN** contiene `https://adrian-asm.github.io/tfm-survivors/`, el comando npm del smoke remoto, el nombre de su
  workflow y la palabra `workflow_dispatch`

<!-- historial: 0011-public-deploy (2026-11-20) -->
