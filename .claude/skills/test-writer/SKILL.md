---
name: test-writer
description: Escribe tests siguiendo la pirámide de Clean Architecture del curso (dominio, casos de uso, contratos, E2E) con Vitest y Playwright, builders y dobles. Úsala para test, TDD, cobertura, doble, fake, spy, contrato, E2E (EN test, coverage, mock, contract test).
---

# Test writer

## Pirámide objetivo
| Nivel | Peso | Qué | Dónde |
|---|---|---|---|
| Dominio | 50-60 % | VOs, invariantes, reglas, determinismo | `tests/domain/` |
| Casos de uso | 25-30 % | Orquestación con fakes y spies | `tests/application/` |
| Contratos + E2E | 10-15 % | Cada adaptador cumple su puerto; el juego arranca y se juega | `tests/contracts/`, `tests/e2e/` |

## Reglas
- Un escenario de la spec ⇒ al menos un test cuyo nombre lo cita: `it('Scenario: se supera el umbral conservando el sobrante', ...)`.
- Patrón AAA (Arrange / Act / Assert). Sin lógica condicional en los tests.
- Datos con **builders** (`tests/builders.ts`) y dobles compartidos (`tests/doubles.ts`): `FixedRandom`, `FakeClock`, `InMemoryProgressRepository`, `SpyAudioPlayer`.
- **Fakes antes que mocks**. Mocks solo para verificar interacciones con puertos de salida.
- **Contratos**: una suite parametrizada por fábrica que ejecutan todas las implementaciones del puerto.
- **Determinismo**: test que ejecuta N ticks dos veces con la misma seed e inputs y compara snapshots.
- E2E con `?seed=42` y sin errores de consola. Los *test hooks* solo existen en builds de test.

## Antipatrones
- Tests que pasan sin la implementación (comprueba siempre el rojo).
- Asserts sobre detalles internos en lugar de comportamiento observable.
- Perseguir el 100 % de cobertura a costa de tests sin valor.
- E2E que adelanta `page.clock` sin sonda: gasta CPU como una partida a máxima velocidad (0014). Una regla que no
  depende del render se prueba en Node; en E2E, `?e2e&manual` con `window.__sprint.step(n)`.
