# ADR-0010 · Progreso persistido: formato v1, forma canónica y fusión del import

- **Estado**: propuesta (change 0007-local-save-export)
- **Fecha**: 2026-11-20

## Contexto
El change 0007 guarda por primera vez datos del jugador fuera de la pestaña (`localStorage`) y los saca a un fichero
JSON que otro navegador puede importar. A partir de aquí el formato es un contrato con datos que ya no controlamos:
cambiarlo obliga a migrar, y un error de diseño se arrastra en cada fichero exportado. Fuerzas:
- ADR-0004: local-first, import como entrada no confiable (tamaño máximo, `JSON.parse` protegido, zod estricto,
  versión) y fase 2 opcional con `SupabaseProgressRepository` del mismo puerto.
- AGENTS.md §3: el núcleo no toca `localStorage` ni `Date.now`; toda entrada externa se valida con zod.
- Spec `progress-persistence`: la fusión debe ser conmutativa e idempotente (importar dos veces no cambia nada),
  con duplicado = coincidencia en los 6 campos, y el orden o las repeticiones dentro de un documento no lo invalidan.
- GitHub Pages sirve todos los proyectos de un usuario bajo el mismo origen (`<usuario>.github.io`): su
  `localStorage` es compartido entre repos.

## Opciones
**Representación**
1. Persistir el `Progress` de dominio tal cual (`JSON.stringify` del objeto).
2. **Documento v1 propio de infraestructura** (`schemaVersion` + `records` + `history`, vocabulario de la spec:
   `victory`/`defeat`), traducido a/desde el `Progress` de dominio por un codec con zod.

**Fusión e identidad de entradas**
- a. Identidad por (`playedAt`, `seed`); en conflicto gana una de las dos.
- b. **Identidad por los 6 campos y forma canónica**: orden total sobre los 6 campos (`playedAt` descendente y
  desempate fijo por el resto), deduplicado de adyacentes iguales y recorte a 10.

**Puerto**
- i. Asíncrono (`Promise`), pensando en Supabase.
- ii. **Síncrono** (`Result` directo), como `localStorage`.

## Decisión
**2 + b + ii.**
- El documento v1 es el formato del fichero exportado y del valor guardado (una sola fuente, `progressCodec.ts`).
  El dominio no conoce `schemaVersion` ni el vocabulario `victory`/`defeat`: usa `RunOutcome` (`won`/`lost`).
- Clave de almacenamiento con espacio de nombres: `sprint-survivors/progress`.
- Toda entrada (almacenamiento o fichero) pasa por `decodeProgress`: límite de tamaño, `JSON.parse` en `try`,
  `z.strictObject` en todos los niveles, versión exacta `1` (otra versión ⇒ rechazo, sin migrar) y normalización a la
  forma canónica. El dominio solo recibe `Progress` válido y canónico.
- `normalizeHistory` (dominio) aplica el orden total y el deduplicado; `mergeProgress` es "máximo campo a campo +
  `normalizeHistory(a ∪ b)`". Al ser un orden total cuyo 0 equivale a "6 campos iguales", la fusión es conmutativa,
  asociativa e idempotente por construcción (se prueba con propiedades sobre muestras generadas con semilla).
- Puerto síncrono: el guardado al terminar ocurre en el mismo frame que el fin de la partida, así que está hecho
  antes de que R pueda leerse (spec, "Reinicio inmediato") sin estados "guardando…".

Descartadas:
- (1): acopla el formato de usuario al modelo interno; renombrar un campo de dominio rompería ficheros exportados.
- (a): con conflicto hay que elegir ganador y la fusión deja de ser conmutativa; la proposal aprobó (b).
- (i): no hay hoy ningún adaptador asíncrono (Supabase es opcional y no planificado); obligaría a gestionar
  guardados en vuelo y reinicios durante la espera.

## Consecuencias
- Positivas:
  - El dominio queda libre de detalles de formato; el codec y su esquema son el único punto que cambia con la v2.
  - Fusionar es una función pura con propiedades comprobables sin navegador.
  - Datos de otros repos del mismo origen no colisionan con la clave del juego.
- Negativas / costes:
  - Una v2 exige escribir `migrate(v1 → v2)` en el codec y mantener el esquema v1 para leer ficheros antiguos.
  - Dos partidas idénticas en los 6 campos (mismo milisegundo, misma semilla y mismo resultado) cuentan como una.
  - Fase 2 con Supabase exigirá un puerto asíncrono: cambio de firma en `ProgressRepository` y en los casos de uso
    que lo usan (3 ficheros de application y sus tests), no en el formato.
- Cómo revertirla:
  - Puerto asíncrono: cambio local a application + escena; el formato no cambia.
  - Identidad (a): cambiar el comparador de `normalizeHistory`; los ficheros v1 siguen siendo legibles.
