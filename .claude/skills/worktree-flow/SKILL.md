---
name: worktree-flow
description: Crea, lista y elimina git worktrees para trabajar cada change SDD o spike en su propia carpeta y rama, permitiendo sesiones de Claude en paralelo. Úsala para worktree, rama de change, trabajo en paralelo, spike (EN worktree, branch, parallel work).
---

# Worktree flow

Un change = una rama = un worktree = una sesión de Claude. El repo principal se queda en `main` y limpio.

## Convenciones
- Carpeta hermana del repo: `../<repo>.worktrees/<id>`.
- Ramas: `change/<NNNN-nombre>` (se fusionan por PR) y `spike/<tema>` (desechables, **nunca** se fusionan).

## Crear
```bash
git fetch origin
git worktree add -b change/<id> ../<repo>.worktrees/<id> origin/main
cd ../<repo>.worktrees/<id> && npm ci   # cada worktree tiene su node_modules
```
En Windows puedes usar `scripts/worktree.ps1 new <id>`.

## Trabajar
- Abre una sesión nueva de Claude Code dentro de la carpeta del worktree.
- Commits pequeños. Publica con `git push -u origin change/<id>` (requiere confirmación) y abre un PR con `gh pr create --fill` o desde la web.

## Cerrar (tras merge del PR)
```bash
git worktree remove ../<repo>.worktrees/<id>
git branch -d change/<id>
git worktree prune
```

## Antipatrones
- Dos worktrees con la misma rama (git no lo permite; no fuerces con `--force`).
- Editar `openspec/specs/` desde dos changes a la vez sin coordinarlo: el segundo en archivar debe rebasar.
- Borrar la carpeta a mano en lugar de `git worktree remove`.
