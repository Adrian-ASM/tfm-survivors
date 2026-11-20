# Proposal · 0011-public-deploy

- **Estado**: aprobada por el usuario (2026-11-20)
- **Issue**: (opcional)
- **Rama / worktree**: `change/0011-public-deploy`

## Problema
El despliegue público es el último Must del GDD (`docs/gdd.md`, ficha "0011 public-deploy"). Según la comprobación
del orquestador del 2026-11-20, el despliegue ya existe y funciona:
- GitHub Pages está activado con `build_type: workflow`, el repo es público y HTTPS es obligatorio.
  `https://adrian-asm.github.io/tfm-survivors/` responde 200.
- El último push a `main` (run 44796176861) pasó `setup`, `quality`, `e2e` y `deploy` en verde.
- La clave de `localStorage` ya lleva espacio de nombres (`sprint-survivors/progress`). En el origen compartido
  `adrian-asm.github.io` el riesgo de colisión es bajo y no hace falta cambiarla.

Lo que falta es **evidencia y contrato**:
1. Ninguna spec dice que el juego se publica ni qué tiene que cumplir la build publicada.
2. Hoy los tres criterios del GDD (la URL carga el juego, 0 violaciones de CSP, jugar/guardar/exportar/importar
   funciona igual que en local) solo se comprueban sobre `vite preview` en `localhost:4173`. Esa build no se sirve
   por HTTPS, no lleva las cabeceras de Pages y no pasa por su 404. Contra la URL pública no hay ninguna comprobación
   que se pueda repetir.
3. Pages no permite cabeceras HTTP propias. Por tanto, `frame-ancestors`, `report-uri` y `sandbox` (que la meta CSP
   ignora) no se pueden aplicar en producción. Esa limitación no está documentada como riesgo aceptado en ADR-0004.
4. El README no da la URL pública ni explica cómo comprobarla.

## Objetivo
Cuando el change esté hecho:
- Una spec viva describe el despliegue: qué evento publica y qué cumple la build publicada.
- Existe un **smoke manual a demanda** de Playwright contra una URL parametrizable (por defecto la pública). Se lanza
  con un comando npm local o con `workflow_dispatch` en un workflow propio. Comprueba la carga, 0 violaciones de CSP
  y el flujo jugar → guardar → exportar → importar.
- El smoke **no** corre en cada push, **no** forma parte de `npm run test:e2e` por defecto y **no** forma parte de
  `npm run verify`.
- ADR-0004 recoge como riesgo aceptado las directivas CSP que Pages no permite aplicar.
- El README da la URL pública y explica cómo lanzar el smoke. AGENTS.md y el GDD marcan cerrado el último Must.

## Alcance
- **Dentro**:
  - Spec delta de la capacidad nueva `public-deploy`. Recoge:
    - la publicación automática tras un push a `main` con `quality` y `e2e` en verde (comportamiento ya existente que
      ahora se especifica);
    - la base `/tfm-survivors/`;
    - el smoke a demanda y su exclusión de `verify`, de `test:e2e` y de la CI por push.
  - Smoke E2E corto con `baseURL` parametrizable (variable de entorno o equivalente). Sin `webServer` local cuando
    apunta a una URL remota. Reutiliza la sonda de CSP que ya existe (`watchCsp` / `cspState`).
  - Comando npm propio para lanzar el smoke en local (nombre a decidir en el design).
  - Workflow **separado** de `ci.yml` con disparador `workflow_dispatch`, para no tocar el `ci.yml` que analiza
    `tests/guardrails/ci.test.ts` con regex.
  - Un test que garantice que el smoke remoto queda fuera de `test:e2e`, de `verify` y de los disparadores de push o
    pull_request (verificación estática de configuración).
  - ADR-0004: apartado "Riesgo aceptado: cabeceras en GitHub Pages" (`frame-ancestors`, `report-uri`, `sandbox`;
    clickjacking aceptado en fase 1).
  - README: URL pública y cómo lanzar el smoke (local y `workflow_dispatch`).
  - Al cerrar: AGENTS.md (estado del proyecto) y GDD (Must cerrado).
- **Fuera**:
  - Dominio propio, PWA o service worker, analítica, backend o Supabase (fase 2).
  - Smoke automático en cada push o tras cada `deploy`, por los minutos del plan gratuito.
  - Cambiar la clave de `localStorage`, que ya lleva espacio de nombres.
  - Reestructurar o reformatear `ci.yml`, y cambiar sus jobs `quality`, `e2e` y `deploy`.
  - Mover la CSP a cabeceras HTTP (Pages no lo permite) y cambiar las directivas de la meta actual.
  - Cambios de comportamiento del juego (`src/domain`, `src/application`, `content/`).

## Capacidades afectadas
- `openspec/specs/public-deploy` (**nueva**). Publicación en Pages, base de rutas, carga en la URL pública sin
  violaciones de CSP, flujo jugar/guardar/exportar/importar en producción y smoke a demanda con sus exclusiones.
- `openspec/specs/progress-persistence` (**posiblemente modificada**, solo el requisito "Política de seguridad de
  contenido"). Haría explícito que, en la build publicada en Pages, la CSP solo se aplica por meta y que
  `frame-ancestors`, `report-uri` y `sandbox` quedan fuera por limitación del hosting. Si en la fase SPEC basta con
  documentarlo en `public-deploy` y en ADR-0004, este delta se descarta.
- `openspec/specs/architecture-guardrails`: **sin cambios**. El workflow nuevo no ejecuta guardarraíles y `ci.yml`
  no se toca.

## Riesgos y dudas
- **El smoke escribe en el `localStorage` real del navegador de Playwright, no del usuario.** Cada ejecución usa un
  contexto limpio, así que no hay contaminación. Hay que confirmar en el design que no se siembra nada persistente.
- **Duración del smoke en remoto.** Una partida completa a velocidad normal es larga. Hay que decidir si se usa
  `?e2e&speed=N` contra la URL pública. El parámetro ya existe en producción y es inocuo, según el change 0008. La
  spec fijará un tope de duración concreto.
- **Fallo después de publicar.** Como el smoke es manual, una regresión en producción solo se detecta cuando alguien
  lo lanza. Se acepta a cambio del ahorro de minutos.
- **Dependencia de la red y de la disponibilidad de Pages.** Un fallo puntual de red o de Pages no debe confundirse
  con una regresión. El design decide reintentos y timeouts.
- **`tests/guardrails/ci.test.ts`** lee `ci.yml` con regex. El workflow nuevo va en otro fichero. Si alguien
  reformatea `ci.yml`, el test se rompe.
- **Clickjacking.** Sin `frame-ancestors`, la página se puede incrustar en un iframe ajeno. Impacto bajo: no hay
  cuentas ni datos sensibles. Riesgo aceptado por el usuario.
- **Minutos de CI.** El workflow manual solo consume minutos cuando se lanza.
- **Descarga del export (Blob / `a[download]`) por HTTPS.** No se espera diferencia, pero no está verificado. El
  smoke lo cubre.

## Criterio de éxito
- Escenarios de `specs/public-deploy/spec.md` en verde con tests automáticos donde se pueda (configuración de
  workflows y scripts) y con el smoke a demanda en lo que depende de la URL real.
- Una ejecución del smoke contra `https://adrian-asm.github.io/tfm-survivors/` termina en verde y queda registrada
  en `verify-report.md`: la página carga, hay exactamente 1 meta CSP, 0 eventos `securitypolicyviolation` y se
  completan jugar → guardar → exportar → importar.
- `npm run verify` y `npm run test:e2e` no ejecutan el smoke remoto, y ningún disparador `push` ni `pull_request`
  lo lanza. Lo comprueba un test.
- `tests/guardrails/ci.test.ts` sigue en verde sin modificaciones y `ci.yml` no cambia.
- ADR-0004 documenta el riesgo aceptado de cabeceras en Pages. El README incluye la URL pública y las instrucciones
  del smoke.
