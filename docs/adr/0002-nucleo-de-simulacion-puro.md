# ADR-0002 · Núcleo de simulación puro y determinista

- **Estado**: aceptada
- **Fecha**: 2026-11-19

## Contexto
El autor viene de backend (APIs, eventos, cloud) y quiere aplicar Clean Architecture a un juego. Los motores invitan a
meter la lógica en las escenas, lo que hace el juego difícil de testear y acopla todo al motor.

## Decisión
*Functional core, imperative shell*:
- `domain` + `application` en TypeScript puro: movimiento, colisiones, daño, XP, oleadas y mejoras, con paso fijo
  (60 ticks/s) y RNG/reloj inyectados por puertos.
- El motor (infraestructura) recoge input, ejecuta `TickRun` en pasos fijos, pinta el `RunSnapshot` y traduce los
  eventos de dominio en sonido, partículas y UI.

| Backend | Juego |
|---|---|
| Controller HTTP | Escena del motor |
| Request | Tick: input + `dt` fijo |
| DTO de respuesta | `RunSnapshot` |
| Postgres vs InMemory | Motor vs runner headless (Node) |
| Eventos de dominio | Cola de eventos vaciada en cada tick |

## Consecuencias
- Positivas: tests rápidos sin navegador, partidas reproducibles por seed, motor intercambiable.
- Negativas: no usamos la física del motor; colisiones propias (círculos + *spatial hash*), asumible en un survivors.
- Se verifica automáticamente: hook `guard-architecture.mjs`, ESLint y CI (AGENTS.md §3).
