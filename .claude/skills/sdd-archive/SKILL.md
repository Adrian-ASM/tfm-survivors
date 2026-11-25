---
name: sdd-archive
description: Cierra un change SDD verificado y aprobado - fusiona sus specs delta en las specs vivas, escribe la retrospectiva y mueve el change a openspec/changes/archive. Úsala para archivar, cerrar change, retrospectiva (EN archive, retro, close change). NO la uses si verify-report tiene Critical > 0 o el usuario no ha aprobado.
---

# SDD archive + retrospectiva

## Precondiciones (comprueba todas; si falla una, para y dilo)
- `verify-report.md` existe y tiene `C: 0`.
- Todas las casillas de `tasks.md` están marcadas.
- El usuario ha aprobado el PR (o lo dice explícitamente).

## Pasos
1. **Specs vivas**: `node scripts/merge-spec-deltas.mjs <id> AAAA-MM-DD`. Para cada
   `openspec/changes/<id>/specs/<capacidad>/spec.md`:
   - ADDED → añade los requisitos a `openspec/specs/<capacidad>/spec.md` (créalo con la cabecera de `references/living-spec.md` si no existe).
   - MODIFIED → sustituye la descripción y los escenarios con el mismo nombre, **conserva** los escenarios vivos
     que la delta no cita ("Escenarios vivos sin cambios: …") y añade los nuevos. No sustituyas el requisito
     entero: las deltas son parciales y se perderían escenarios (0025: −56 en `simulation-loop`).
   - REMOVED → elimínalo.
   - Añade al pie de la spec viva: `<!-- historial: <id> (AAAA-MM-DD) -->`.
   - A mano, con la salida del script: las notas en comentarios ("Al archivar…": Purposes, vocabulario) y los
     escenarios nuevos que **sustituyen** a uno vivo con otro nombre ("X se sustituye por Y": borra X).
     Comprueba el recuento de escenarios antes y después (`grep -c '^#### Scenario'`).
2. **Retrospectiva**: crea `openspec/changes/<id>/retrospective.md` con `references/retrospective.md`.
   Rellena las métricas con datos reales (`git log`, verify-report, cobertura), no estimaciones.
3. **Mover**: `git mv openspec/changes/<id> openspec/changes/archive/AAAA-MM-DD-<id>`.
4. **Diario de IA**: añade una entrada breve en `docs/ai-log/` enlazando la retrospectiva.
5. Commit: `docs(sdd): archive <id>` con `refs: <id>`. El merge del PR lo hace el usuario.

Si tienes el CLI de OpenSpec instalado, puedes usar `openspec archive <id>` para el paso 1 y 3 y después
escribir la retrospectiva dentro de la carpeta archivada.
