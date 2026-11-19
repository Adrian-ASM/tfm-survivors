---
name: domain-modeling
description: Modela el núcleo del juego según Clean Architecture y DDD del curso - entidades, value objects, agregados, eventos y errores de dominio, puros y deterministas. Úsala para entidad, value object, VO, invariante, agregado, evento de dominio (EN entity, aggregate, invariant, domain event). NO la uses para escenas, render o input del motor.
---

# Domain modeling

## Reglas
- **Value objects** inmutables: constructor privado + `static create(...)` que valida y devuelve `Result<VO, DomainError>`; `equals()` por valor. Ej.: `Health`, `Damage`, `Experience`, `Cooldown`, `Seed`.
- **Entidades** con identidad; el **aggregate root** (`Run`) es la única puerta para modificar su estado y protege las invariantes.
- **Eventos** en pasado y con namespace: `enemy.killed`, `player.leveled_up`, `player.died`. El agregado los acumula y la aplicación los extrae por tick.
- **Errores** tipados (`InvalidHealthError`…), nunca `throw new Error('...')` genérico para fallos esperables.
- **Determinismo**: aleatoriedad por `RandomGenerator`, tiempo por `dt` del tick o `Clock`. Nada de APIs del navegador.
- **Rendimiento** (ADR-0003, pendiente): VOs inmutables en reglas y configuración; en el camino caliente (cientos de enemigos) el agregado puede usar arrays/pools mutables internos **sin exponerlos**.

## Checklist de antipatrones
- [ ] *Primitive obsession*: `number` suelto para vida/daño/XP.
- [ ] Setters públicos o propiedades mutables expuestas.
- [ ] Lógica de reglas en la escena del motor o en el caso de uso (debe estar en el dominio).
- [ ] Dependencia del dominio hacia cualquier otra capa.
- [ ] Invariantes validadas fuera del objeto que las posee.

## Prompt de apoyo (curso, "IA como copiloto")
> Actúa como experto en DDD. Dado este requisito y este VO, enumera las invariantes que faltan y propón los tests
> que las demuestran (nombre + GIVEN/WHEN/THEN). No escribas implementación.
