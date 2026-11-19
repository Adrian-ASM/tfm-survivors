# ADR-0007 · Modelo genérico de armas: criterio de objetivo y ataque como uniones discriminadas en contenido

- **Estado**: propuesta (change 0004-auto-weapons)
- **Fecha**: 2026-11-19

## Contexto
El GDD pide varias armas automáticas (Linter, Tests y, más adelante, Refactor) y mejoras de armas (0005). La
propuesta de 0004 exige que cada arma combine un **criterio de objetivo** y un **tipo de ataque** configurables en
`content/weapons.json`, y que añadir un tercer criterio o tipo no obligue a tocar las armas existentes. Fuerzas:
- AGENTS.md §3.5: el contenido vive en JSON validado con zod, sin números mágicos.
- ADR-0002 y ADR-0003: núcleo puro, determinista y sin asignar por tick en el camino caliente.
- El formato de `weapons.json` será la base de las mejoras de 0005 (modificar `damage`, `cooldownTicks`…), así que
  cambiarlo después obliga a reescribir contenido, esquemas, tests y mejoras: es caro de revertir.
- AGENTS.md (antipatrones): no crear abstracciones sin dos implementaciones previsibles.

## Opciones
1. **Una clase por arma** (`Linter`, `TestsSuite`): directo, pero cada arma nueva es código nuevo y el contenido solo
   ajusta números; combinar comportamientos exige herencia o duplicación.
2. **Estrategias polimórficas** (`Targeting` y `Attack` como interfaces con una clase por variante, construidas al
   empezar desde el contenido): extensible, pero añade una jerarquía y una fábrica por eje, y el contenido sigue
   necesitando un discriminante.
3. **Uniones discriminadas de datos + despacho con `switch` exhaustivo**: el contenido declara
   `targeting: { mode, … }` y `attack: { type, … }`; zod las valida con `z.discriminatedUnion`; el dominio las trata
   con funciones puras y un `switch` cuyo `default` es `assertNever`, más una tabla de compatibilidad tipada
   (`{ [K in AttackType]: readonly TargetingMode[] }`).
4. **ECS** (componentes y sistemas genéricos): máxima flexibilidad, sobreingeniería para dos armas.

## Decisión
Opción 3.
- El **arma es dato** (`WeaponType`, VO) y su comportamiento sale de dos ejes independientes. Una variante nueva es
  un miembro más de la unión, su esquema zod, su caso en el `switch` y su entrada en la tabla de compatibilidad; el
  compilador señala los `switch` incompletos. Las armas existentes (sus datos) no cambian.
- Todos los criterios tienen la misma firma: devuelven el **índice del enemigo que activa el disparo** o −1. El
  ataque decide qué hacer con él (apuntar o solo condicionar). Así los ejes se combinan sin conocerse.
- Las reglas cruzadas (compatibilidad, enteros, ids únicos) viven una sola vez en `buildRunRules` (patrón de 0002).
- Sin estrategias ni clases por variante: con dos variantes por eje el `switch` es más corto y no asigna nada.

## Consecuencias
- Positivas:
  - `weapons.json` legible y serializable; las mejoras de 0005 serán transformaciones de datos sobre `WeaponType`.
  - Cero asignaciones por tick: despacho por `switch` sobre campos de un VO congelado.
  - El compilador obliga a cubrir cada variante en dominio y en zod.
- Negativas / costes:
  - Añadir una variante toca 3 o 4 sitios (unión, esquema, `switch`, tabla) en lugar de 1 clase.
  - Los campos de un ataque dependen del criterio (el pulso usa el `radius` del criterio); la tabla de
    compatibilidad es la que lo garantiza.
- Cómo revertirla:
  - Pasar a estrategias (opción 2) es interno al dominio: cada caso del `switch` se convierte en una clase creada
    en `Run.start`, sin cambiar el formato del contenido.
  - Cambiar el formato de `weapons.json` sí es caro (contenido, esquemas, tests y, desde 0005, mejoras).
