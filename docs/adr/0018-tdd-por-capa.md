# ADR-0018 · TDD por capa, tareas por escenario y verify completo por grupo

- **Estado**: aceptada (chore `tdd-lite`)
- **Fecha**: 2026-11-24

## Contexto
Desde 0001 la fase *apply* aplica TDD estricto a cada tarea, sea cual sea la capa: rojo comprobado, verde,
refactor, `npm run verify` completo (balance incluido) y commit. Los changes salen con unas 14 tareas de ~30 min
(0019). Hay varias fuerzas en juego:
- El valor del TDD está en el núcleo puro y determinista (ADR-0002): las reglas se diseñan con el test y el rojo
  se comprueba con poco coste.
- En infraestructura (escenas, cámara, arte del mapa, layout) y en contenido el rojo casi nunca aporta nada:
  en 0006 unas 10 tareas pasaron en verde a la primera, y las tareas de render se prueban mejor cuando ya existe
  la pieza.
- El `verify` completo con el test de balance se paga en cada tarea, y cada tarea supone un commit y una vuelta
  entre orquestador e implementador.
- Lo que no se puede perder es la red de seguridad: todo escenario de la spec tiene un test que lo prueba de
  verdad, y el verifier lo exige.

## Opciones
1. Mantener TDD estricto en todas las capas y por tarea.
2. TDD por capa: estricto en `domain`/`application`, *test-after* en el resto.
3. `verify` completo y commit por grupo de tareas en lugar de por tarea.
4. Tareas más gruesas: una por escenario o unidad coherente.
5. *Test-after* en todo, con mutation testing sobre `domain` para compensar (nueva dependencia).
6. Modo exprés para changes pequeños (fusionar explore, design y apply).

## Decisión
Se combinan 2, 3 y 4:
- **TDD por capa**: rojo comprobado en `domain` y `application`; *test-after* en infraestructura, composición,
  contenido y E2E. El test sigue teniendo que fallar si se quita la implementación.
- **Verify por grupo**: `verify:fast` en cada tarea; `verify` completo y commit al cerrar cada grupo de
  `tasks.md` (≤ ~5 tareas).
- **Tareas por escenario**: ≤ ~8 tareas en un change mediano, agrupadas por capa.

Se descartan la 5 (añade una dependencia y quita la evidencia del rojo justo donde más vale) y la 6 (se aparta
demasiado del SDD documentado). Sin cambios en los gates humanos ni en la regla del verifier "escenario sin test
= Critical".

## Consecuencias
- Positivas: menos ejecuciones del test de balance, menos commits y menos vueltas por change; el TDD se queda
  donde aporta diseño.
- Negativas / costes: los commits son más grandes y es menos fácil aislar con `git bisect`; en el borde
  infraestructura un test escrito después puede probar menos (lo vigila el verifier). Hay que medir en los
  próximos changes (tareas, commits, duración de apply) y anotarlo en la retrospectiva.
- Cómo revertirla: devolver el texto de `.claude/agents/sdd-implementer.md`, `sdd-architect.md`,
  `sdd-verifier.md`, la skill `test-writer` y AGENTS.md §2 y §5 a su versión anterior y marcar esta ADR como
  sustituida.
